const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Announcement = mongoose.model("Announcement", announcementSchema);

module.exports = { Announcement };
