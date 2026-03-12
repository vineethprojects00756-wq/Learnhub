const mongoose = require("mongoose");

const wishlistModel = mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      required: true,
    },
  },
  { timestamps: true }
);

wishlistModel.index({ studentId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model("wishlist", wishlistModel);
