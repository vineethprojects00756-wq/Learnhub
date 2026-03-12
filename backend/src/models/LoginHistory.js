const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  ip: { type: String },
  userAgent: { type: String },
  success: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);

module.exports = { LoginHistory };
