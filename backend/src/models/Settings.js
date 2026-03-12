const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  maintenanceMode: { type: Boolean, default: false },
  globalDiscountPercent: { type: Number, default: 0 },
  commissionPercent: { type: Number, default: 0 },
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = { Settings };
