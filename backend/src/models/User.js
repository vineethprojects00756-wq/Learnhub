const mongoose = require("mongoose");
const { roles } = require("../utils/constants");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: roles, default: "student" },
  status: { type: String, enum: ["active", "suspended", "banned"], default: "active" },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  tokenVersion: { type: Number, default: 0 },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  lastLoginAt: { type: Date },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

module.exports = { User };
