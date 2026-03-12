const mongoose = require("mongoose");

const courseModel = mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    C_educator: {
      type: String,
      required: [true, "name is required"],
    },
    C_title: {
      type: String,
      required: [true, "C_title is required"],
    },
    C_categories: {
      type: String,
      required: [true, "C_categories: is required"],
    },
    C_price: {
      type: String,
    },
    C_description: {
      type: String,
      required: [true, "C_description: is required"],
    },
    thumbnail: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    prerequisites: {
      type: [String],
      default: [],
    },
    publishStatus: {
      type: String,
      enum: ["draft", "published", "scheduled", "unpublished"],
      default: "draft",
    },
    scheduledPublishAt: {
      type: Date,
      default: null,
    },
    lastDraftSavedAt: {
      type: Date,
      default: null,
    },
    sections: {
      type: Array,
      default: [],
    },
    quizzes: {
      type: [
        {
          title: String,
          questions: [
            {
              question: String,
              options: [String],
              correctOptionIndex: Number,
            },
          ],
        },
      ],
      default: [],
    },
    assignments: {
      type: [
        {
          assignmentId: String,
          title: String,
          description: String,
          deadline: Date,
          autoGradeMCQ: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
    liveSessions: {
      type: [
        {
          title: String,
          agenda: String,
          startTime: Date,
          endTime: Date,
          meetingLink: String,
        },
      ],
      default: [],
    },
    downloadableFiles: {
      type: [
        {
          title: String,
          fileUrl: String,
          fileType: String,
        },
      ],
      default: [],
    },
    discussionEnabled: {
      type: Boolean,
      default: true,
    },
    enrolled: {
      type: Number,
      default: 0,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    discount: {
      type: Number,
      default: 0,
    },
    versionHistory: {
      type: [
        {
          version: Number,
          changedAt: {
            type: Date,
            default: Date.now,
          },
          changedBy: String,
          summary: String,
          snapshot: mongoose.Schema.Types.Mixed,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const courseSchema = mongoose.model("course", courseModel);

module.exports = courseSchema;
