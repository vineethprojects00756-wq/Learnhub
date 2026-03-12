const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { ChatMessage } = require("../models/ChatMessage");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Unauthorized"));

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: payload.sub, role: payload.role };
      return next();
    } catch (_err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join-class", (roomId) => {
      socket.join(roomId);
    });

    socket.on("leave-class", (roomId) => {
      socket.leave(roomId);
    });

    socket.on("chat-message", async ({ roomId, message }) => {
      if (!roomId || !message) return;
      const saved = await ChatMessage.create({
        roomId,
        sender: socket.user?.id,
        message,
      });

      io.to(roomId).emit("chat-message", {
        id: saved._id,
        roomId,
        message,
        sender: socket.user?.id,
        createdAt: saved.createdAt,
      });
    });
  });
}

module.exports = { initSocket };
