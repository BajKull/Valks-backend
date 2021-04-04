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
} from "./types";
import { firestore, admin } from "./firebase";
import { getDefMsg, getDefRoom } from "./defaultObjects";

const rooms: Channel[] = [];
const publicRooms: Channel[] = [];
const activeUsers: User[] = [];

const init = () => {
  categories.forEach((cat: string) => {
    publicRooms.push(getDefRoom(cat, cat, "public"));
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
};
init();

export const joinRoom = (user: User, roomId: string) => {
  const room = rooms.find((room) => room.id === roomId);
  if (room) {
    if (room.users.length >= room.size) throw new Error("Room is full.");
    room.users.push(user);
    return room.users;
  } else throw new Error("Invalid room ID.");
};

export const joinPublic = (u: User, category: string) => {
  const room = publicRooms.find((room) => room.category === category);
  if (room) {
    room.users.push(u);
    const active = activeUsers.find((u) => u.id === u.id);
    active.publicChannels.push(room.id);
    const m1 = getDefMsg(u, `${u.name}, welcome the room!`, room, true);
    const m2 = getDefMsg(u, `${u.name} has joined the room!`, room, true);
    return { room, m1, m2 };
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
    room.users.push(data.user);
    const msg = getDefMsg(
      data.user,
      `${data.user.name}, welcome to the room ${data.name}!`,
      room,
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
            channels: admin.firestore.FieldValue.arrayUnion(
              firestore.collection("channels").doc(room.id)
            ),
          });
        rooms.push(room);
        resolve({ room, msg });
      })
      .catch((err) => {
        reject("Couldn't connect to the databse.");
      });
  });
};

export const sendMessage = (data: Message) => {
  const msg = getDefMsg(data.author, data.msg, data.channel, false);
  const room = rooms.find((r) => r.id === data.channel.id);
  if (!room) {
    const pRoom = publicRooms.find((r) => r.id === data.channel.id);
    if (!pRoom) throw new Error("There is no room with this id.");
    pRoom.messages.push(msg);
    return msg;
  }
  room.messages.push(msg);
  return msg;
};

export const sendInvitation = async (data: UserInvitation) => {
  return new Promise((resolve, reject) => {
    const user = firestore
      .collection("users")
      .doc(data.name)
      .get()
      .then((doc) => {
        if (doc.exists) {
          if (data.author.email === doc.data().email)
            reject(`You can't invite yourself.`);
          const invite: UserNotification = {
            id: v4(),
            type: "invitation",
            message: `${data.author.name} invited you to room ${data.channel.name}`,
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
              const user = activeUsers.find(
                (user: User) => user.name === data.name
              );
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
  socketId: string,
  data: UserNotification
) => {
  return new Promise((resolve, reject) => {
    const user = activeUsers.find((user: User) => user.socketId === socketId);
    const channel = rooms.find(
      (channel: Channel) => channel.id === data.channelId
    );
    delete user.socketId;
    deleteNotification(user, data).catch((error) => reject(error));
    firestore
      .collection("channels")
      .doc(channel.id)
      .update({ users: admin.firestore.FieldValue.arrayUnion(user) })
      .then(() =>
        firestore
          .collection("users")
          .doc(user.name)
          .update({
            channels: admin.firestore.FieldValue.arrayUnion(
              firestore.collection("channels").doc(data.channelId)
            ),
          })
          .then(() => {
            const message = getDefMsg(
              user,
              `${user.name} has joined the room!`,
              channel,
              true
            );

            resolve({ channel, message });
          })
          .catch(() => reject("Couldn't connect to the database."))
      );
  });
};

export const deleteNotification = async (
  user: User,
  notification: UserNotification
) => {
  return new Promise((resolve, reject) => {
    const fireNotification: FirebaseNotification = (notification as unknown) as FirebaseNotification;
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
      .catch(() => reject("Couldn't connecto to the database."));
  });
};

export const activeUser = async (data: User) => {
  activeUsers.push(data);
  return new Promise((resolve, reject) => {
    firestore
      .collection("users")
      .doc(data.name)
      .get()
      .then((res) => {
        const data = res.data();
        if (data) {
          const mapped = {
            ...data,
            channels: data.channels.map((channel) =>
              rooms.find((r: Channel) => r.id === channel._path.segments[1])
            ),
          };
          resolve(mapped);
        }
        reject("Couldn't connect to the database.");
      })
      .catch(() => reject("Couldn't connect to the database."));
  });
};

export const deActiveUser = (id: string) => {
  const user = activeUsers.find((u) => u.socketId === id);
  console.log(user);
  if (user) {
    user.publicChannels.forEach((prId) => {
      const roomWithUser = publicRooms.find((pr) => pr.id === prId);
      const index = roomWithUser.users.indexOf(user);
      roomWithUser.users.splice(index, 1);
    });
    const index = activeUsers.findIndex((u) => u.socketId === id);
    activeUsers.splice(index, 1);
  }
};

export const publicList = () => {
  return publicRooms.map((channel: Channel) => {
    return { name: channel.name, users: channel.users.length };
  });
};
