export type User = {
  socketId: string;
  name: string;
  email: string;
  avatar: string;
  color: string;
  publicChannels: string[];
};

export type FirebaseUser = {
  name: string;
  email: string;
  avatar: string;
  color: string;
};

export type Message = {
  id: string;
  author: User;
  date: Date;
  msg: string;
  channel: Channel;
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
  user: User;
  name: string;
  category: string;
};

export type UserNotification = {
  id: string;
  type: "invitation" | "mention";
  message: string;
  date: Date;
  channelId?: string;
};

export type FirebaseNotification = {
  id: string;
  type: "invitation" | "mention";
  message: string;
  date: { _seconds: number; _nanoseconds: number };
  channelId?: string;
};

export type UserInvitation = {
  author: User;
  channel: Channel;
  name: string;
};

export type JoinPublic = { user: User; category: string };
