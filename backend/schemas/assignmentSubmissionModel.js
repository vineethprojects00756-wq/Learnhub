const mongoose = require("mongoose");

const assignmentSubmissionModel = mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "assignment",
      required: true,
    },
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
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attachments: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["submitted", "returned", "graded"],
      default: "submitted",
    },
    marksAwarded: {
      type: Number,
      default: 0,
    },
    remarks: {
      type: String,
      default: "",
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("assignmentSubmission", assignmentSubmissionModel);
