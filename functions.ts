import categories from "./categories";
import { v4 } from "uuid";
import {
  Channel,
  Message,
  User,
  CreateRoom,
  UserInvitation,
  UserNotification,
  FirebaseNotification,
  FirebaseUser,
} from "./types";
import { firestore, admin } from "./firebase";
import { getDefMsg, getDefNotification, getDefRoom } from "./defaultObjects";

const rooms: Channel[] = [];
const users: FirebaseUser[] = [];
const activeUsers: User[] = [];

const init = () => {
  categories.forEach((cat: string) => {
    rooms.push(getDefRoom(cat, cat, "public"));
  });
  firestore
    .collection("channels")
    .get()
    .then((res) => {
      res.forEach((channel) => {
        const ch = channel.data() as Channel;
        if (ch) rooms.push(ch);
      });
    });
  firestore
    .collection("users")
    .get()
    .then((res) => {
      res.forEach((user) => {
        const u = user.data() as FirebaseUser;
        if (u) users.push(u);
      });
    });
};
init();

export const registerUser = (user: FirebaseUser, socketId: string) => {
  users.push(user);
  const aUser: User = {
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    color: user.color,
    blockList: [],
    notifications: [],
    socketId,
    publicChannels: [],
  };
  activeUsers.push(aUser);
};

export const deleteAccount = (acc: FirebaseUser) => {
  const user = users.find((u) => u.email === acc.email);
  const uIndex = users.indexOf(user);
  const aIndex = activeUsers.findIndex((a) => a.email === user.email);
  const channelIndexes = user.channels;
  user.channels.forEach(async (ch) => {
    const channel = rooms.find((r) => r.id === ch);
    const index = channel.users.findIndex((u) => u === user.email);
    channel.users.splice(index, 1);
    await leaveChannel(user, ch);
  });
  firestore.collection("users").doc(acc.name).delete();
  users.splice(uIndex, 1);
  activeUsers.splice(aIndex, 1);
  return channelIndexes;
};

export const getUserList = (channel: string) =>
  rooms
    .find((r) => r.id === channel)
    .users.map((user) => {
      const u = users.find((u) => u.email === user);
      return {
        email: u.email,
        name: u.name,
        avatar: u.avatar,
        color: u.color,
      };
    });

export const joinPublic = (u: FirebaseUser, category: string) => {
  const room = rooms.find(
    (room) => room.type === "public" && room.category === category
  );
  if (room) {
    const active = activeUsers.find((user) => user.email === u.email);
    if (!active)
      throw new Error(`Session expired. Reload the page and try again.`);
    room.users.push(u.email);
    active.publicChannels.push(room.id);
    const r = { ...room, users: getUserList(room.id) };
    const m1 = getDefMsg(u, `${u.name}, welcome the channel!`, room.id, true);
    const m2 = getDefMsg(u, `${u.name} has joined the channel!`, room.id, true);
    return { room: r, m1, m2 };
  } else throw new Error("Invalid category.");
};

export const createRoom = async (data: CreateRoom) => {
  return new Promise((resolve, reject) => {
    if (data.name === "") reject("Name can't be empty.");
    else if (data.name.match(/[^a-z A-Z0-9]/))
      reject("Name can't containt any special symbols.");
    else if (data.name.length > 32)
      reject("Name can't be longer than 32 characters.");
    else if (data.category === "") reject("Category can't be empty.");
    else if (data.category.length > 32)
      reject("Category can't be longer than 32 characters.");

    const room = getDefRoom(data.name, data.category, "private");
    room.users.push(data.user.email);
    const msg = getDefMsg(
      data.user,
      `${data.user.name}, welcome to the channel ${data.name}!`,
      room.id,
      true
    );

    firestore
      .collection("channels")
      .doc(room.id)
      .set(room)
      .then(() => {
        firestore
          .collection("users")
          .doc(data.user.name)
          .update({
            channels: admin.firestore.FieldValue.arrayUnion(room.id),
          });
        rooms.push(room);
        const user = users.find((u) => u.email === data.user.email);
        const r = { ...room, users: getUserList(room.id) };
        user.channels.push(room.id);
        resolve({ room: r, msg });
      })
      .catch((err) => {
        reject("Couldn't connect to the databse.");
      });
  });
};

export const sendMessage = (data: Message) => {
  return new Promise((resolve, reject) => {
    const msg = getDefMsg(data.author, data.msg, data.channel, false);
    const room = rooms.find((r) => r.id === data.channel);
    if (!room) {
      const pRoom = rooms.find((r) => r.id === data.channel);
      if (!pRoom) reject("There is no channel with this id.");
      pRoom.messages.push(msg);
      resolve(msg);
    }
    const tags = msg.msg
      .match(/@[a-z0-9\d]+/gi)
      ?.map((t) => t.substring(1))
      .filter((t) => t !== data.author.name);
    const activeTags = [];
    tags?.forEach((tag) => {
      const a = activeUsers.find((u) => u.name === tag);
      const notification = getDefNotification(msg.channel, "mention", msg.msg);
      if (a) activeTags.push({ user: a, notification });
      const userExists = users.find((u) => u.name === tag);
      userExists.notifications.push(notification);
      if (userExists)
        firestore
          .collection("users")
          .doc(tag)
          .update({
            notifications: admin.firestore.FieldValue.arrayUnion(notification),
          });
    });
    firestore
      .collection("channels")
      .doc(data.channel)
      .update({
        messages: admin.firestore.FieldValue.arrayUnion(msg),
      })
      .then(() => {
        room.messages.push(msg);
        resolve({ msg, users: activeTags });
      })
      .catch((err) => {
        reject("Couldn't connect to the database.");
      });
  });
};

export const sendInvitation = async (data: UserInvitation) => {
  return new Promise((resolve, reject) => {
    firestore
      .collection("users")
      .doc(data.name)
      .get()
      .then((doc) => {
        if (doc.exists) {
          if (data.author.email === doc.data().email)
            reject(`You can't invite yourself.`);
          const userChannels: string[] = doc
            .data()
            .channels.map((ref) => ref._path.segments[1]);
          if (userChannels.includes(data.channel.id))
            reject(`User is already a channel member.`);
          const invite: UserNotification = {
            id: v4(),
            type: "invitation",
            message: `${data.author.name} invited you to channel ${data.channel.name}`,
            date: new Date(Date.now()),
            channelId: data.channel.id,
          };
          firestore
            .collection("users")
            .doc(data.name)
            .update({
              notifications: admin.firestore.FieldValue.arrayUnion(invite),
            })
            .then(() => {
              const user = activeUsers.find((u: User) => u.name === data.name);
              const u = users.findIndex((u) => u.email === doc.data().email);
              users[u].notifications.push(invite);
              resolve({ user, invite });
            })
            .catch(() => {
              reject("Couldn't connect to the databse.");
            });
        } else reject("There is no user with this name.");
      })
      .catch(() => {
        reject("Couldn't connect to the databse.");
      });
  });
};

export const acceptInvitation = async (
  user: FirebaseUser,
  data: UserNotification
) => {
  return new Promise((resolve, reject) => {
    const usr = users.find((u) => u.email === user.email);
    const channel = rooms.find(
      (channel: Channel) => channel.id === data.channelId
    );
    deleteNotification(user, data).catch((error) => reject(error));
    firestore
      .collection("channels")
      .doc(channel.id)
      .update({ users: admin.firestore.FieldValue.arrayUnion(user.email) })
      .then(() =>
        firestore
          .collection("users")
          .doc(user.name)
          .update({
            channels: admin.firestore.FieldValue.arrayUnion(data.channelId),
          })
          .then(() => {
            const message = getDefMsg(
              user,
              `${user.name} has joined the channel!`,
              channel.id,
              true
            );
            usr.channels.push(channel.id);
            channel.users.push(usr.email);
            const ch = { ...channel, users: getUserList(channel.id) };
            resolve({ channel: ch, message });
          })
          .catch(() => reject("Couldn't connect to the database."))
      );
  });
};

export const deleteNotification = async (
  user: FirebaseUser,
  notification: FirebaseNotification | UserNotification
) => {
  return new Promise((resolve, reject) => {
    const fireNotification: FirebaseNotification =
      notification as unknown as FirebaseNotification;

    if ((notification as FirebaseNotification).date._seconds === undefined) {
      const d: Date = new Date((notification as UserNotification).date);
      console.log(d.getMilliseconds());
      notification.date = {
        _nanoseconds: d.getTime(),
        _seconds: d.getTime() * 1000,
      };
    }
    firestore
      .collection("users")
      .doc(user.name)
      .update({
        notifications: admin.firestore.FieldValue.arrayRemove({
          ...notification,
          date: new admin.firestore.Timestamp(
            fireNotification.date._seconds,
            fireNotification.date._nanoseconds
          ),
        }),
      })
      .then(() => {
        const usr = users.find((u) => u.email === user.email);
        const nIndex = usr.notifications.findIndex(
          (n) => n.id === notification.id
        );
        usr.notifications.splice(nIndex, 1);
      })
      .catch(() => reject("Couldn't connecto to the database."));
  });
};

export const activeUser = (email: string, socketId: string) => {
  const usr = users.find((u) => u.email === email);
  console.log(usr.notifications);
  if (!usr) throw new Error("Try again.");
  const user = {
    ...usr,
    channels: usr.channels
      .map((channel) => {
        return rooms.find((r) => r.id === channel);
      })
      .map((r) => {
        return { ...r, users: getUserList(r.id) };
      }),
  };
  const u: User = {
    socketId: socketId,
    ...user,
    publicChannels: [],
  };
  activeUsers.push(u);
  return user;
};

export const deActiveUser = (id: string) => {
  const user = activeUsers.find((u) => u.socketId === id);
  if (user) {
    user.publicChannels.forEach((prId) => {
      const roomWithUser = rooms.find((pr) => pr.id === prId);
      const index = roomWithUser.users.indexOf(user.email);
      roomWithUser.users.splice(index, 1);
    });
    const index = activeUsers.findIndex((u) => u.socketId === id);
    activeUsers.splice(index, 1);
  }
};

export const publicList = () => {
  return rooms
    .filter((r) => r.type === "public")
    .map((channel: Channel) => {
      return { name: channel.name, users: channel.users.length };
    });
};

export const leaveChannel = (user: FirebaseUser, channelId: string) => {
  return new Promise((res, rej) => {
    const channel = rooms.find((r) => r.id === channelId);
    const usr = users.find((u) => u.email === user.email);

    const msg = getDefMsg(
      usr,
      `${usr.name} has left the channel.`,
      channel.id,
      true
    );

    if (channel.type === "public") {
      const activeUser = activeUsers.find((u) => u.email === user.email);
      const chIndex = activeUser.publicChannels.findIndex(
        (channelId) => channelId === channel.id
      );
      activeUser.publicChannels.splice(chIndex, 1);
      const uIndex = channel.users.findIndex((u) => u === user.email);
      channel.users.splice(uIndex, 1);
      res(msg);
    }
    if (channel.type === "private") {
      firestore
        .collection("users")
        .doc(usr.name)
        .update({
          channels: admin.firestore.FieldValue.arrayRemove(channelId),
        })
        .then(() => {
          const index = usr.channels.findIndex((c) => c === channelId);
          usr.channels.splice(index, 1);
          if (channel.users.length === 1) {
            const chIndex = rooms.indexOf(channel);
            rooms.splice(chIndex, 1);
            firestore
              .collection("channels")
              .doc(channel.id)
              .delete()
              .then(() => {
                res(msg);
              });
          } else {
            const uIndex = channel.users.findIndex((u) => u === user.email);
            channel.users.splice(uIndex, 1);
            firestore
              .collection("channels")
              .doc(channel.id)
              .update({
                users: admin.firestore.FieldValue.arrayRemove(user.email),
              })
              .then(() => {
                res(msg);
              })
              .catch(() => {
                rej(`Couldn't connect to the database.`);
              });
          }
        })
        .catch((error) => console.log(error));
    }
  });
};

export const blockUser = (user: User, blocked: string) => {
  const index = users.findIndex((u) => u.email === user.email);
  if (index === -1) return;
  if (users[index].blockList.includes(blocked)) {
    const blockedIndex = users[index].blockList.findIndex((b) => b === blocked);
    users[index].blockList.splice(blockedIndex, 1);
    firestore
      .collection("users")
      .doc(user.name)
      .update({
        blocked: admin.firestore.FieldValue.arrayRemove(blocked),
      });
  } else {
    users[index].blockList.push(blocked);
    firestore
      .collection("users")
      .doc(user.name)
      .update({
        blocked: admin.firestore.FieldValue.arrayUnion(blocked),
      });
  }
};

export const changeAvatar = (user: User, url: string) => {
  firestore
    .collection("users")
    .doc(user.name)
    .update({ avatar: url })
    .then(() => {
      users.find((u) => u.email === user.email).avatar = url;
    });
};
