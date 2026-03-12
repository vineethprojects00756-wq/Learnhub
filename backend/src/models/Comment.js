const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  content: { type: String, required: true },
  isRemoved: { type: Boolean, default: false },
}, { timestamps: true });

const Comment = mongoose.model("Comment", commentSchema);

module.exports = { Comment };
