const mongoose = require("mongoose");

const teacherMessageModel = mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
    },
    kind: {
      type: String,
      enum: ["private", "bulk", "announcement", "email"],
      default: "private",
    },
    subject: {
      type: String,
      default: "",
    },
    body: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("teacherMessage", teacherMessageModel);
