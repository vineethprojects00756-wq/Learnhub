const mongoose = require("mongoose");

const assignmentModel = mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    deadline: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["essay", "file", "mcq", "mixed"],
      default: "mixed",
    },
    questions: {
      type: [
        {
          question: String,
          options: [String],
          correctOptionIndex: Number,
          marks: {
            type: Number,
            default: 1,
          },
        },
      ],
      default: [],
    },
    autoGradeMCQ: {
      type: Boolean,
      default: false,
    },
    maxMarks: {
      type: Number,
      default: 100,
    },
    published: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("assignment", assignmentModel);
