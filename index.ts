require("dotenv").config();
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import {
  joinRoom,
  createRoom,
  sendMessage,
  sendInvitation,
  activeUser,
  deActiveUser,
} from "./functions";
import {
  CreateRoom,
  Message,
  User,
  UserInvitation,
  UserNotification,
} from "./types";

const PORT = process.env.PORT || 5000;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  console.log(socket.id);
  socket.on("activeUser", (user: User, callback) => {
    activeUser(user)
      .then((res) => {
        callback({
          type: "success",
          message: "Room successfully created!",
          data: res,
        });
      })
      .catch((error) => {
        callback({
          type: "error",
          message: error,
        });
      });
  });
  socket.on("disconnect", () => deActiveUser(socket.id));

  socket.on("joinRoom", (user, roomId) => {
    try {
      const users = joinRoom(user, roomId);
      socket.join(roomId);
      socket.broadcast.to(roomId).emit("message", {
        type: "message",
        message: `User ${user.name} has joined the room!`,
        date: Date.now(),
      });
      socket.emit("message", {
        type: "message",
        message: `${user.name}, welcome to the room!`,
        date: Date.now(),
      });
      io.to(roomId).emit("userList", { users: users });
    } catch (error) {
      socket.emit("error", { type: "error", message: error });
    }
  });

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
    console.log(data.msg);
    try {
      const msg = sendMessage(data);
      socket.broadcast.to(msg.channel.id).emit("message", msg);
      callback({
        type: "success",
        message: "Message successfully sent!",
        data: msg,
      });
    } catch (error) {
      callback({
        type: "error",
        message: error.message,
      });
    }
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
});

httpServer.listen(PORT);
