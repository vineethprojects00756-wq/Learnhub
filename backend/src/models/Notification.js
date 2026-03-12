const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  audience: { type: String, enum: ["all", "students", "instructors"], default: "all" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = { Notification };
