const mongoose = require("mongoose");

const featureFlagSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  enabled: { type: Boolean, default: false },
}, { timestamps: true });

const FeatureFlag = mongoose.model("FeatureFlag", featureFlagSchema);

module.exports = { FeatureFlag };
