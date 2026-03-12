const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  });

  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!authHeader) return next();

      const token = String(authHeader).startsWith("Bearer ")
        ? String(authHeader).split(" ")[1]
        : String(authHeader);
      const decoded = jwt.verify(token, process.env.JWT_KEY);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next();
    }
  });

  io.on("connection", (socket) => {
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }

    socket.on("join-course", ({ courseId }) => {
      if (!courseId) return;
      socket.join(`course:${courseId}`);
    });

    socket.on("leave-course", ({ courseId }) => {
      if (!courseId) return;
      socket.leave(`course:${courseId}`);
    });
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initSocket,
  getIO,
};
