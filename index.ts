if (process.env.NODE_ENV == "development") require("dotenv").config();

import { createServer } from "http";
import { Server, Socket } from "socket.io";
import {
  createRoom,
  sendMessage,
  sendInvitation,
  activeUser,
  deActiveUser,
  acceptInvitation,
  deleteNotification,
  joinPublic,
  publicList,
  getUserList,
  leaveChannel,
  blockUser,
  changeAvatar,
  registerUser,
  deleteAccount,
} from "./functions";
import {
  AcceptInvitation,
  CreateRoom,
  FirebaseUser,
  JoinPublic,
  Message,
  User,
  UserInvitation,
  UserNotification,
} from "./types";

const PORT = process.env.PORT || 5000;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "https://valks.netlify.app",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  console.log(socket.id);

  socket.on("register", (user, callback) => {
    registerUser(user, socket.id);
    callback(true);
  });

  socket.on("deleteAccount", (user: FirebaseUser) => {
    deleteAccount(user).then((msgs: any) => {
      msgs.forEach((msg: Message) => {
        socket.to(msg.channel).emit("message", msg);
        socket.to(msg.channel).emit("userList", {
          channel: msg.channel,
          users: getUserList(msg.channel),
        });
        socket.leave(msg.channel);
      });
    });
  });

  socket.on("activeUser", (email: string, callback) => {
    try {
      const { user, catOfDay } = activeUser(email, socket.id);
      user.channels.forEach((ch) => socket.join(ch.id));
      callback({
        type: "success",
        message: "User data successfully fetched!",
        data: { user, catOfDay },
      });
    } catch (error) {
      console.log(error.message);
      callback({
        type: "error",
        message: error.message,
      });
    }
  });
  socket.on("disconnect", () => deActiveUser(socket.id));

  socket.on("createRoom", (data: CreateRoom, callback) => {
    createRoom(data)
      .then((res: any) => {
        socket.join(res.room.id);
        socket.emit("message", res.msg);
        socket.emit("userList", { channel: res.room.id, users: [data.user] });
        callback({
          type: "success",
          message: "Room successfully created!",
          data: res.room,
        });
      })
      .catch((error) =>
        callback({
          type: "error",
          message: error,
        })
      );
  });

  socket.on("sendMessage", (data: Message, callback) => {
    sendMessage(data)
      .then((data: any) => {
        io.in(data.msg.channel).emit("message", data.msg);
        data.users.forEach((u) => {
          socket.to(u.user.socketId).emit("notification", u.notification);
        });
      })
      .catch((error) => {
        callback({
          type: "error",
          message: error.message,
        });
      });
  });

  socket.on("sendInvitation", (data: UserInvitation, callback) => {
    sendInvitation(data)
      .then((res: any) => {
        if (res.user)
          socket.to(res.user.socketId).emit("notification", res.invite);
        callback({
          type: "success",
          message: "Invite successfully sent!",
          data: res.invite,
        });
      })
      .catch((error) =>
        callback({
          type: "error",
          message: error,
        })
      );
  });

  socket.on("acceptInvitation", (data: AcceptInvitation, callback) => {
    acceptInvitation(data.user, data.invite)
      .then((res: any) => {
        if (res.channel) {
          socket.join(res.channel.id);
          socket.to(res.channel.id).emit("message", res.message);
          socket.emit("joinChannel", res.channel);
          socket.broadcast.to(res.channel.id).emit("userList", {
            channel: res.channel.id,
            users: getUserList(res.channel.id),
          });
          callback({
            type: "success",
            message: "Invite successfully accepted!",
            data: res.channel,
          });
        }
      })
      .catch((error) => {
        console.log(error.message);
        callback({
          type: "error",
          message: error,
        });
      });
  });

  socket.on("joinPublic", (data: JoinPublic, callback) => {
    try {
      const { room, m1, m2 } = joinPublic(data.user, data.category);
      socket.join(room.id);
      callback({
        type: "success",
        message: "Successfully joined!",
        data: room,
      });
      socket.emit("message", m1);
      socket.broadcast.to(room.id).emit("message", m2);
      io.to(room.id).emit("userList", {
        channel: room.id,
        users: getUserList(room.id),
      });
    } catch (error) {
      callback({
        type: "error",
        message: error,
      });
    }
  });

  socket.on(
    "deleteNotification",
    (user: FirebaseUser, data: UserNotification) => {
      deleteNotification(user, data).catch((error) => {
        console.log(error);
      });
    }
  );

  socket.on("publicList", (callback) => {
    callback({
      type: "success",
      message: "List of public channels successfully fetched!",
      data: publicList(),
    });
  });

  socket.on("leaveChannel", (data, callback) => {
    leaveChannel(data.user, data.channel)
      .then((res) => {
        socket.leave(data.channel);
        socket.broadcast.to(data.channel).emit("message", res);
        socket.broadcast.to(data.channel).emit("userList", {
          channel: data.channel,
          users: getUserList(data.channel),
        });
        callback({
          type: "success",
          message: "Channel successfully left.",
          data: data.channel,
        });
      })
      .catch((error) => {
        callback({
          type: "error",
          message: error,
        });
      });
  });

  socket.on("blockUser", (data) => {
    blockUser(data.user, data.blocked);
  });

  socket.on("changeAvatar", (data) => {
    changeAvatar(data.user, data.url);
  });
});

httpServer.listen(PORT);
