const mongoose = require("mongoose");

const quizAttemptModel = mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    quizIndex: {
      type: Number,
      required: true,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    score: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    canRetry: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

quizAttemptModel.index({ courseId: 1, studentId: 1, quizIndex: 1, attemptNumber: 1 }, { unique: true });

module.exports = mongoose.model("quizAttempt", quizAttemptModel);
