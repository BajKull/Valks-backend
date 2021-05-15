import {
  Channel,
  FirebaseUser,
  Message,
  User,
  UserNotification,
} from "./types";
import { v4 } from "uuid";

const DEFAULT_ROOM_SIZE = 20;
export const getDefRoom = (
  name: string,
  category: string,
  type: "private" | "public"
) => {
  const room: Channel = {
    id: v4(),
    name: name,
    category: category,
    size: DEFAULT_ROOM_SIZE,
    users: [],
    messages: [],
    type: type,
    avatar:
      "https://www.unfe.org/wp-content/uploads/2019/04/SM-placeholder-1024x512.png",
  };
  return room;
};

export const getDefMsg = (
  author: FirebaseUser,
  msg: string,
  channel: string,
  system: boolean
) => {
  const message: Message = {
    id: v4(),
    author,
    date: new Date(Date.now()).getTime(),
    msg,
    channel,
    system,
  };
  return message;
};

export const getDefNotification = (
  channel: string,
  type: "mention" | "invitation",
  message: string
) => {
  const notification: UserNotification = {
    id: v4(),
    type,
    message,
    date: new Date(Date.now()).getTime(),
    channelId: channel,
  };
  return notification;
};
