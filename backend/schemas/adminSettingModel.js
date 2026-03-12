const mongoose = require("mongoose");

const adminSettingModel = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const adminSettingSchema = mongoose.model("adminSetting", adminSettingModel);

module.exports = adminSettingSchema;
