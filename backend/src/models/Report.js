const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  targetType: { type: String, enum: ["course", "comment", "user"] },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  reason: { type: String },
  status: { type: String, enum: ["open", "resolved", "dismissed"], default: "open" },
}, { timestamps: true });

const Report = mongoose.model("Report", reportSchema);

module.exports = { Report };
