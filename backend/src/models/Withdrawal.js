const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
}, { timestamps: true });

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

module.exports = { Withdrawal };
