const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  message: { type: String, required: true },
}, { timestamps: true });

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

module.exports = { ChatMessage };
