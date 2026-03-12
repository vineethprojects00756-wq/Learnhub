const mongoose = require("mongoose");

const courseSchema = require("../schemas/courseModel");
const userSchema = require("../schemas/userModel");
const enrolledCourseSchema = require("../schemas/enrolledCourseModel");
const wishlistSchema = require("../schemas/wishlistModel");
const quizAttemptSchema = require("../schemas/quizAttemptModel");
const assignmentSchema = require("../schemas/assignmentModel");
const assignmentSubmissionSchema = require("../schemas/assignmentSubmissionModel");
const contentReportSchema = require("../schemas/contentReportModel");
const teacherMessageSchema = require("../schemas/teacherMessageModel");
const notificationSchema = require("../schemas/notificationModel");

const { emitToUser, emitToCourse } = require("../utils/realtime");
const { awardLearningActivity } = require("../utils/gamification");

const buildProgressPayload = (enrollment) => {
  const totalSections = Number(enrollment?.course_Length || 0);
  const completedSections = Array.isArray(enrollment?.progress) ? enrollment.progress.length : 0;
  const progressPercent = totalSections > 0 ? Math.min(Math.round((completedSections / totalSections) * 100), 100) : 0;
  return {
    courseId: enrollment?.courseId,
    totalSections,
    completedSections,
    progressPercent,
    lastAccessedSection: enrollment?.lastAccessedSection ?? 0,
    lastAccessedAt: enrollment?.lastAccessedAt || null,
  };
};

const ensureStudent = async (userId) => {
  const user = await userSchema.findById(userId);
  if (!user) return { ok: false, code: 404, message: "User not found" };
  if (String(user.type || "").toLowerCase() !== "student") {
    return { ok: false, code: 403, message: "Student access required" };
  }
  return { ok: true, user };
};

const createUserNotification = async ({ userId, title, message, type = "general", meta = {} }) => {
  const note = await notificationSchema.create({
    userId,
    title,
    message,
    type,
    meta,
  });
  emitToUser(String(userId), "notification:new", note);
  return note;
};

const getPreviewLessonsController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });

    const previewLessons = (course.sections || []).slice(0, 3).map((section, index) => ({
      sectionId: index,
      title: section.S_title || section.lessonTitle || `Lesson ${index + 1}`,
      description: section.S_description || section.lessonDescription || "",
      videoPreviewPath: section?.S_content?.path || section?.video?.path || null,
    }));

    return res.status(200).send({
      success: true,
      data: {
        courseId: course._id,
        title: course.C_title,
        educator: course.C_educator,
        previewLessons,
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const toggleWishlistController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { courseId } = req.params;
    const studentCheck = await ensureStudent(studentId);
    if (!studentCheck.ok) return res.status(studentCheck.code).send({ success: false, message: studentCheck.message });

    const existing = await wishlistSchema.findOne({ studentId, courseId });
    let inWishlist = false;
    if (existing) {
      await wishlistSchema.findByIdAndDelete(existing._id);
    } else {
      await wishlistSchema.create({ studentId, courseId });
      inWishlist = true;
    }

    emitToUser(String(studentId), "student:wishlist-updated", { courseId, inWishlist });
    return res.status(200).send({ success: true, message: inWishlist ? "Added to wishlist" : "Removed from wishlist", inWishlist });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getWishlistController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const rows = await wishlistSchema.find({ studentId }).populate("courseId");
    const data = rows
      .filter((row) => row.courseId)
      .map((row) => ({
        _id: row._id,
        courseId: row.courseId._id,
        course: row.courseId,
        addedAt: row.createdAt,
      }));
    return res.status(200).send({ success: true, data });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getWishlistCourseIdsController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const rows = await wishlistSchema.find({ studentId }).select("courseId");
    return res.status(200).send({
      success: true,
      data: rows.map((row) => String(row.courseId)),
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const updateContinueLearningController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { courseId } = req.params;
    const { sectionId } = req.body;

    const enrollment = await enrolledCourseSchema.findOne({ courseId, userId: studentId });
    if (!enrollment) return res.status(404).send({ success: false, message: "Enrollment not found" });

    enrollment.lastAccessedSection = Number(sectionId || 0);
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    const payload = buildProgressPayload(enrollment);
    emitToUser(String(studentId), "student:progress-updated", payload);
    return res.status(200).send({ success: true, data: payload });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getCourseProgressController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { courseId } = req.params;
    const enrollment = await enrolledCourseSchema.findOne({ courseId, userId: studentId });
    if (!enrollment) return res.status(404).send({ success: false, message: "Enrollment not found" });
    return res.status(200).send({ success: true, data: buildProgressPayload(enrollment) });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const submitQuizAttemptController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { courseId, quizIndex } = req.params;
    const quizIdx = Number(quizIndex);
    const answers = req.body.answers || {};

    const [course, enrollment] = await Promise.all([
      courseSchema.findById(courseId),
      enrolledCourseSchema.findOne({ courseId, userId: studentId }),
    ]);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (!enrollment) return res.status(403).send({ success: false, message: "Not enrolled in this course" });

    const quiz = Array.isArray(course.quizzes) ? course.quizzes[quizIdx] : null;
    if (!quiz) return res.status(404).send({ success: false, message: "Quiz not found" });

    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const maxAttempts = Number(quiz.maxAttempts || 3);
    const retryAllowed = quiz.retryAllowed !== false;
    const showCorrectAnswers = quiz.showCorrectAnswers !== false;

    const attemptCount = await quizAttemptSchema.countDocuments({ courseId, studentId, quizIndex: quizIdx });
    if (!retryAllowed && attemptCount > 0) {
      return res.status(400).send({ success: false, message: "Retry not allowed for this quiz" });
    }
    if (retryAllowed && attemptCount >= maxAttempts) {
      return res.status(400).send({ success: false, message: "Maximum attempts reached" });
    }

    let score = 0;
    const total = questions.reduce((sum, q) => sum + Number(q.marks || 1), 0);
    questions.forEach((question, idx) => {
      const answer = answers?.[idx];
      if (answer !== undefined && Number(answer) === Number(question.correctOptionIndex)) {
        score += Number(question.marks || 1);
      }
    });

    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const canRetry = retryAllowed && attemptCount + 1 < maxAttempts;
    const attempt = await quizAttemptSchema.create({
      courseId,
      studentId,
      quizIndex: quizIdx,
      attemptNumber: attemptCount + 1,
      answers,
      score,
      total,
      percentage,
      canRetry,
    });

    await awardLearningActivity({
      userId: studentId,
      points: Math.max(5, Math.round(percentage / 10)),
      reason: "Quiz attempt submitted",
      courseId,
    });

    const response = {
      attemptId: attempt._id,
      score,
      total,
      percentage,
      attemptNumber: attempt.attemptNumber,
      canRetry,
    };
    if (showCorrectAnswers) {
      response.correctAnswers = questions.map((q) => q.correctOptionIndex);
    }

    emitToUser(String(studentId), "student:quiz-attempted", {
      courseId,
      quizIndex: quizIdx,
      ...response,
    });

    return res.status(200).send({ success: true, message: "Quiz submitted", data: response });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getQuizScoresController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { courseId } = req.params;
    const attempts = await quizAttemptSchema
      .find({ courseId, studentId })
      .sort({ createdAt: -1 });
    return res.status(200).send({ success: true, data: attempts });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getAssignmentGradesController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { courseId } = req.params;
    const submissions = await assignmentSubmissionSchema
      .find({ courseId, studentId })
      .populate("assignmentId", "title description deadline maxMarks")
      .sort({ updatedAt: -1 });

    const data = submissions.map((item) => ({
      _id: item._id,
      assignmentId: item.assignmentId?._id,
      title: item.assignmentId?.title || "Assignment",
      deadline: item.assignmentId?.deadline || null,
      maxMarks: item.assignmentId?.maxMarks || 100,
      status: item.status,
      marksAwarded: item.marksAwarded,
      remarks: item.remarks,
      gradedAt: item.gradedAt,
      updatedAt: item.updatedAt,
    }));

    return res.status(200).send({ success: true, data });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getCertificateController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { courseId } = req.params;

    const [enrollment, course] = await Promise.all([
      enrolledCourseSchema.findOne({ courseId, userId: studentId }),
      courseSchema.findById(courseId),
    ]);
    if (!enrollment || !course) return res.status(404).send({ success: false, message: "Course enrollment not found" });

    const payload = buildProgressPayload(enrollment);
    if (payload.progressPercent < 100) {
      return res.status(400).send({ success: false, message: "Certificate is available after 100% completion" });
    }

    if (!enrollment.certificateDate) {
      enrollment.certificateDate = new Date();
      await enrollment.save();
    }

    return res.status(200).send({
      success: true,
      data: {
        studentName: req.body.studentName || null,
        courseTitle: course.C_title,
        educator: course.C_educator,
        completedOn: enrollment.certificateDate,
        progressPercent: payload.progressPercent,
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const sendStudentMessageController = async (req, res) => {
  try {
    const senderId = req.body.userId;
    const { teacherId } = req.params;
    const { subject = "", body, courseId = null } = req.body;
    if (!body) return res.status(400).send({ success: false, message: "Message body is required" });

    const teacher = await userSchema.findById(teacherId);
    if (!teacher || String(teacher.type || "").toLowerCase() !== "teacher") {
      return res.status(404).send({ success: false, message: "Teacher not found" });
    }

    if (courseId) {
      const isEnrolled = await enrolledCourseSchema.exists({ courseId, userId: senderId });
      if (!isEnrolled) {
        return res.status(403).send({ success: false, message: "Not enrolled in this course" });
      }
    }

    const messageDoc = await teacherMessageSchema.create({
      senderId,
      recipientId: teacherId,
      courseId,
      kind: "private",
      subject,
      body,
    });

    await createUserNotification({
      userId: teacherId,
      type: "message",
      title: subject || "New student message",
      message: body,
      meta: { messageId: messageDoc._id, courseId, senderId },
    });

    emitToUser(String(teacherId), "message:private", messageDoc);
    emitToUser(String(senderId), "message:private", messageDoc);
    return res.status(201).send({ success: true, message: "Message sent", data: messageDoc });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getStudentMessageThreadController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { teacherId } = req.params;

    const messages = await teacherMessageSchema
      .find({
        kind: "private",
        $or: [
          { senderId: userId, recipientId: teacherId },
          { senderId: teacherId, recipientId: userId },
        ],
      })
      .populate("senderId", "name type")
      .populate("recipientId", "name type")
      .sort({ createdAt: 1 })
      .limit(200);

    return res.status(200).send({ success: true, data: messages });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const reportContentController = async (req, res) => {
  try {
    const reporterId = req.body.userId;
    const { courseId, sectionId = null, reason, details = "" } = req.body;
    if (!courseId || !reason) {
      return res.status(400).send({ success: false, message: "courseId and reason are required" });
    }

    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });

    const report = await contentReportSchema.create({
      courseId,
      reporterId,
      sectionId: sectionId !== null ? Number(sectionId) : null,
      reason,
      details,
    });

    if (course.userId && mongoose.Types.ObjectId.isValid(course.userId)) {
      await createUserNotification({
        userId: course.userId,
        type: "report",
        title: `Content report for ${course.C_title}`,
        message: `${reason}${details ? ` - ${details}` : ""}`,
        meta: { reportId: report._id, courseId, sectionId },
      });
    }

    emitToCourse(String(courseId), "course:content-reported", {
      reportId: report._id,
      courseId,
      sectionId,
      reason,
    });
    return res.status(201).send({ success: true, message: "Content reported successfully", data: report });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getStudentLeaderboardController = async (req, res) => {
  try {
    const limit = Math.max(5, Math.min(Number(req.query.limit || 20), 100));
    const students = await userSchema
      .find({ type: { $regex: /^student$/i } })
      .select("name points badges streakDays")
      .sort({ points: -1, streakDays: -1, updatedAt: -1 })
      .limit(limit);

    return res.status(200).send({
      success: true,
      data: students.map((student, index) => ({
        rank: index + 1,
        userId: student._id,
        name: student.name,
        points: Number(student.points || 0),
        streakDays: Number(student.streakDays || 0),
        badges: student.badges || [],
      })),
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const updateReminderSettingsController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { reminderEnabled, reminderTime } = req.body;
    const user = await userSchema.findById(userId);
    if (!user) return res.status(404).send({ success: false, message: "User not found" });

    if (reminderEnabled !== undefined) user.reminderEnabled = !!reminderEnabled;
    if (reminderTime !== undefined) user.reminderTime = String(reminderTime || "19:00");
    await user.save();

    const data = {
      reminderEnabled: !!user.reminderEnabled,
      reminderTime: user.reminderTime || "19:00",
    };
    emitToUser(String(userId), "student:reminder-updated", data);
    return res.status(200).send({ success: true, message: "Reminder settings updated", data });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getStudentSummaryController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const [user, wishlistCount, unreadCount] = await Promise.all([
      userSchema.findById(userId).select("points badges streakDays reminderEnabled reminderTime"),
      wishlistSchema.countDocuments({ studentId: userId }),
      notificationSchema.countDocuments({ userId, isRead: false }),
    ]);

    const assignmentGradedCount = await assignmentSubmissionSchema.countDocuments({
      studentId: userId,
      status: { $in: ["graded", "returned"] },
    });

    return res.status(200).send({
      success: true,
      data: {
        points: Number(user?.points || 0),
        badges: user?.badges || [],
        streakDays: Number(user?.streakDays || 0),
        wishlistCount,
        assignmentGradedCount,
        unreadCount,
        reminderEnabled: !!user?.reminderEnabled,
        reminderTime: user?.reminderTime || "19:00",
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

module.exports = {
  getPreviewLessonsController,
  toggleWishlistController,
  getWishlistController,
  getWishlistCourseIdsController,
  updateContinueLearningController,
  getCourseProgressController,
  submitQuizAttemptController,
  getQuizScoresController,
  getAssignmentGradesController,
  getCertificateController,
  sendStudentMessageController,
  getStudentMessageThreadController,
  reportContentController,
  getStudentLeaderboardController,
  updateReminderSettingsController,
  getStudentSummaryController,
};
