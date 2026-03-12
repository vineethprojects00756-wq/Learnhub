const mongoose = require("mongoose");

const apiUsageSchema = new mongoose.Schema({
  method: String,
  path: String,
  statusCode: Number,
  durationMs: Number,
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const ApiUsage = mongoose.model("ApiUsage", apiUsageSchema);

module.exports = { ApiUsage };
