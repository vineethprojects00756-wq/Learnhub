const { getIO } = require("../realtime/socket");

const emitToUser = (userId, event, payload) => {
  const io = getIO();
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

const emitToCourse = (courseId, event, payload) => {
  const io = getIO();
  if (!io || !courseId) return;
  io.to(`course:${courseId}`).emit(event, payload);
};

module.exports = {
  emitToUser,
  emitToCourse,
};
