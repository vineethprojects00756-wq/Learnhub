const mongoose = require("mongoose");

const adminLogModel = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const adminLogSchema = mongoose.model("adminLog", adminLogModel);

module.exports = adminLogSchema;
