import { DocumentReference } from "@firebase/firestore-types";

export type User = {
  socketId: string;
  name: string;
  email: string;
  avatar: string;
  color: string;
  blockList: string[];
  publicChannels: string[];
  notifications: UserNotification[];
};

export type FirebaseUser = {
  name: string;
  email: string;
  avatar: string;
  color: string;
  blockList: string[];
  channels: string[];
  notifications: UserNotification[];
};

export type Message = {
  id: string;
  author: FirebaseUser;
  date: number;
  msg: string;
  channel: string;
  system: boolean;
};

export type Channel = {
  id: string;
  name: string;
  category: string;
  size: number;
  users: string[];
  messages: Message[];
  type: "private" | "public";
  avatar: string;
};

export type CreateRoom = {
  user: FirebaseUser;
  name: string;
  category: string;
};

export type UserNotification = {
  id: string;
  type: "invitation" | "mention";
  message: string;
  date: number;
  channelId?: string;
};

export type UserInvitation = {
  author: User;
  channel: Channel;
  name: string;
};

export type JoinPublic = { user: FirebaseUser; category: string };
export type LeaveChannel = { user: FirebaseUser; channel: string };
export type AcceptInvitation = { user: FirebaseUser; invite: UserNotification };
export type CategoryScore = { category: string; score: number };
