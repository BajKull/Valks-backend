require("dotenv").config();
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
} from "./functions";
import {
  CreateRoom,
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
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket: Socket) => {
  console.log(socket.id);
  socket.on("activeUser", (user: User, callback) => {
    activeUser(user)
      .then((res: any) => {
        res.channels.forEach((channel) => socket.join(channel.id));
        callback({
          type: "success",
          message: "User data successfully fetched!",
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
    try {
      const msg = sendMessage(data);
      io.in(msg.channel.id).emit("message", msg);
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

  socket.on("acceptInvitation", (data: UserNotification, callback) => {
    acceptInvitation(socket.id, data)
      .then((res: any) => {
        if (res.channel) {
          socket.join(res.channel.id);
          socket.to(res.channel.id).emit("message", res.message);
          socket.emit("joinChannel", res.channel);
          socket.broadcast.to(res.channel.id).emit("userList", {
            channel: res.channel.id,
            userList: getUserList(res.channel.id),
          });
          callback({
            type: "success",
            message: "Invite successfully accepted!",
            data: res.channel,
          });
        }
      })
      .catch((error) =>
        callback({
          type: "error",
          message: error,
        })
      );
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

  socket.on("deleteNotification", (user: User, data: UserNotification) => {
    deleteNotification(user, data).catch((error) => {
      console.log(error);
    });
  });

  socket.on("publicList", (callback) => {
    callback({
      type: "success",
      message: "List of public channels successfully fetched!",
      data: publicList(),
    });
  });
});

httpServer.listen(PORT);
