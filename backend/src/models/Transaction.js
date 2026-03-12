const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  amount: { type: Number, required: true },
  currency: { type: String, default: "USD" },
  status: { type: String, enum: ["pending", "paid", "refunded", "failed"], default: "pending" },
  gateway: { type: String },
  gatewayRef: { type: String },
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = { Transaction };
