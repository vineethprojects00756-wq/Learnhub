const mongoose = require("mongoose");

const paymentLogSchema = new mongoose.Schema({
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  payload: { type: Object },
  status: { type: String },
}, { timestamps: true });

const PaymentLog = mongoose.model("PaymentLog", paymentLogSchema);

module.exports = { PaymentLog };
