const mongoose = require("mongoose");

const reviewModel = mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      required: [true, "Course ID is required"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "User ID is required"],
    },
    userName: {
      type: String,
      required: [true, "User name is required"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "Rating is required"],
    },
    title: {
      type: String,
      required: [true, "Review title is required"],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
    },
    helpful: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const reviewSchema = mongoose.model("review", reviewModel);

module.exports = reviewSchema;
