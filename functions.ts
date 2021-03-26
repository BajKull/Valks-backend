import { v4 } from "uuid";
import {
  Channel,
  Message,
  User,
  CreateRoom,
  UserInvitation,
  UserNotification,
} from "./types";
import { firestore, admin } from "./firebase";

const rooms: Channel[] = [];
const activeUsers: User[] = [];

const DEFAULT_ROOM_SIZE = 20;

const init = () => {
  firestore
    .collection("channels")
    .get()
    .then((res) => {
      res.forEach((channel) => {
        const ch = channel.data().room;
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

    const id = v4();
    const room: Channel = {
      id,
      name: data.name,
      category: data.category,
      size: DEFAULT_ROOM_SIZE,
      users: [data.user],
      messages: [],
      type: "private",
      avatar:
        "https://www.unfe.org/wp-content/uploads/2019/04/SM-placeholder-1024x512.png",
    };
    const msg: Message = {
      id: v4(),
      author: data.user,
      date: new Date(Date.now()),
      msg: `${data.user.name}, welcome to the room ${data.name}!`,
      channel: room,
    };

    const r = firestore
      .collection("channels")
      .doc(room.id)
      .set({ room })
      .then(() => {
        console.log(data.user.name);
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
        console.log(err);
        reject("Couldn't connect to the databse.");
      });
  });
};

export const sendMessage = (data: Message) => {
  const message: Message = {
    id: v4(),
    author: data.author,
    date: new Date(Date.now()),
    msg: data.msg,
    channel: data.channel,
  };
  const room = rooms.find((r) => r.id === data.channel.id);
  if (!room) throw new Error("There is no room with this id.");
  room.messages.push(message);
  return message;
};

export const sendInvitation = async (data: UserInvitation) => {
  return new Promise((resolve, reject) => {
    const user = firestore
      .collection("users")
      .doc(data.name)
      .get()
      .then((doc) => {
        if (doc.exists) {
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
  const index = activeUsers.findIndex((u) => u.socketId === id);
  activeUsers.splice(index, 1);
};
