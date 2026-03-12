const courseSchema = require("../schemas/courseModel");
const { emitToUser, emitToCourse } = require("./realtime");

const processScheduledPublishes = async () => {
  const now = new Date();
  const dueCourses = await courseSchema.find({
    publishStatus: "scheduled",
    scheduledPublishAt: { $lte: now },
  });

  if (!dueCourses.length) return 0;

  await Promise.all(
    dueCourses.map(async (course) => {
      course.publishStatus = "published";
      course.approved = true;
      course.archived = false;
      course.scheduledPublishAt = null;
      course.versionHistory = course.versionHistory || [];
      course.versionHistory.push({
        version: course.versionHistory.length + 1,
        changedAt: new Date(),
        changedBy: String(course.userId),
        summary: "Auto-published from schedule",
        snapshot: {
          C_title: course.C_title,
          publishStatus: "published",
        },
      });
      await course.save();

      emitToUser(String(course.userId), "teacher:course-publish-state", {
        courseId: String(course._id),
        state: "published",
        automated: true,
      });
      emitToCourse(String(course._id), "course:publish-state", {
        courseId: String(course._id),
        state: "published",
        automated: true,
      });
    })
  );

  return dueCourses.length;
};

module.exports = {
  processScheduledPublishes,
};
