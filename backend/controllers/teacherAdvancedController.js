const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mongoose = require("mongoose");

const userSchema = require("../schemas/userModel");
const courseSchema = require("../schemas/courseModel");
const enrolledCourseSchema = require("../schemas/enrolledCourseModel");
const coursePaymentSchema = require("../schemas/coursePaymentModel");
const notificationSchema = require("../schemas/notificationModel");
const assignmentSchema = require("../schemas/assignmentModel");
const assignmentSubmissionSchema = require("../schemas/assignmentSubmissionModel");
const discussionSchema = require("../schemas/courseDiscussionModel");
const teacherMessageSchema = require("../schemas/teacherMessageModel");
const withdrawalRequestSchema = require("../schemas/withdrawalRequestModel");

const { emitToUser, emitToCourse } = require("../utils/realtime");
const { sendEmail } = require("../utils/emailService");
const { awardLearningActivity } = require("../utils/gamification");

const parsePrice = (value) => {
  if (value === "free" || value === undefined || value === null || value === "") return 0;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const normalizeTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const normalizeList = (list) => {
  if (!list) return [];
  if (Array.isArray(list)) return list.map((item) => String(item).trim()).filter(Boolean);
  return String(list)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const ensureTeacher = async (userId) => {
  const teacher = await userSchema.findById(userId);
  if (!teacher) return { ok: false, code: 404, message: "User not found" };
  if ((teacher.type || "").toLowerCase() !== "teacher") {
    return { ok: false, code: 403, message: "Teacher access required" };
  }
  if (teacher.teacherApprovalRequired && teacher.teacherApprovalStatus !== "approved") {
    return { ok: false, code: 403, message: "Teacher account approval pending" };
  }
  return { ok: true, teacher };
};

const createNotification = async ({ userId, title, message, type = "general", meta = {} }) => {
  const notification = await notificationSchema.create({
    userId,
    title,
    message,
    type,
    meta,
  });
  emitToUser(String(userId), "notification:new", notification);
  return notification;
};

const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ success: false, message: "Email is required" });
    }

    const user = await userSchema.findOne({ email });
    if (!user) {
      return res.status(200).send({
        success: true,
        message: "If this email exists, a reset link has been sent.",
      });
    }

    const resetTokenRaw = crypto.randomBytes(24).toString("hex");
    const resetTokenHashed = crypto.createHash("sha256").update(resetTokenRaw).digest("hex");
    user.resetToken = resetTokenHashed;
    user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const resetLink = `${appUrl}/reset-password?token=${resetTokenRaw}&email=${encodeURIComponent(email)}`;
    await sendEmail({
      to: email,
      subject: "LearnHub Password Reset",
      text: `Reset your password using this link: ${resetLink}`,
      html: `<p>Reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    });

    return res.status(200).send({
      success: true,
      message: "If this email exists, a reset link has been sent.",
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const resetPasswordController = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).send({ success: false, message: "Email, token and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).send({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await userSchema.findOne({ email });
    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      return res.status(400).send({ success: false, message: "Invalid or expired reset token" });
    }

    const hashedIncoming = crypto.createHash("sha256").update(token).digest("hex");
    if (hashedIncoming !== user.resetToken || new Date(user.resetTokenExpiry) < new Date()) {
      return res.status(400).send({ success: false, message: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return res.status(200).send({ success: true, message: "Password reset successful" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const updateTeacherProfileAdvancedController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const teacherCheck = await ensureTeacher(userId);
    if (!teacherCheck.ok) {
      return res.status(teacherCheck.code).send({ success: false, message: teacherCheck.message });
    }

    const teacher = teacherCheck.teacher;
    const { name, bio, phone, location, qualifications } = req.body;
    if (name) teacher.name = name;
    if (bio !== undefined) teacher.bio = bio;
    if (phone !== undefined) teacher.phone = phone;
    if (location !== undefined) teacher.location = location;
    if (qualifications !== undefined) teacher.qualifications = normalizeList(qualifications);
    if (req.file) teacher.profilePicture = `/uploads/${req.file.filename}`;

    await teacher.save();

    emitToUser(String(userId), "teacher:profile-updated", {
      userId,
      profilePicture: teacher.profilePicture,
      qualifications: teacher.qualifications,
    });

    return res.status(200).send({ success: true, message: "Teacher profile updated", data: teacher });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const buildCourseSnapshot = (course) => ({
  C_educator: course.C_educator,
  C_title: course.C_title,
  C_categories: course.C_categories,
  C_price: course.C_price,
  C_description: course.C_description,
  sections: course.sections,
  tags: course.tags,
  prerequisites: course.prerequisites,
  thumbnail: course.thumbnail,
  downloadableFiles: course.downloadableFiles,
  publishStatus: course.publishStatus,
  scheduledPublishAt: course.scheduledPublishAt,
});

const appendVersion = (course, changedBy, summary) => {
  const nextVersion = (course.versionHistory?.length || 0) + 1;
  course.versionHistory.push({
    version: nextVersion,
    changedAt: new Date(),
    changedBy: String(changedBy),
    summary,
    snapshot: buildCourseSnapshot(course),
  });
};

const createCourseAdvancedController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const teacherCheck = await ensureTeacher(userId);
    if (!teacherCheck.ok) {
      return res.status(teacherCheck.code).send({ success: false, message: teacherCheck.message });
    }

    const {
      C_educator,
      C_title,
      C_categories,
      C_price,
      C_description,
      sections = [],
      tags = [],
      prerequisites = [],
      publishStatus = "draft",
      scheduledPublishAt = null,
      downloadableFiles = [],
      quizzes = [],
      liveSessions = [],
      thumbnail = "",
    } = req.body;

    const normalizedStatus =
      publishStatus === "published" || publishStatus === "scheduled" || publishStatus === "unpublished"
        ? publishStatus
        : "draft";

    const course = await courseSchema.create({
      userId: String(userId),
      C_educator: C_educator || teacherCheck.teacher.name,
      C_title,
      C_categories,
      C_price: parsePrice(C_price) === 0 ? "free" : String(C_price),
      C_description,
      sections: Array.isArray(sections) ? sections : [],
      tags: normalizeTags(tags),
      prerequisites: normalizeList(prerequisites),
      publishStatus: normalizedStatus,
      approved: normalizedStatus === "published",
      scheduledPublishAt: normalizedStatus === "scheduled" ? scheduledPublishAt : null,
      downloadableFiles: Array.isArray(downloadableFiles) ? downloadableFiles : [],
      quizzes: Array.isArray(quizzes) ? quizzes : [],
      liveSessions: Array.isArray(liveSessions) ? liveSessions : [],
      thumbnail,
      lastDraftSavedAt: new Date(),
      versionHistory: [],
    });

    appendVersion(course, userId, "Initial course creation");
    await course.save();

    emitToUser(String(userId), "teacher:course-updated", { action: "created", course });
    return res.status(201).send({ success: true, message: "Course created", data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const updateCourseAdvancedController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { courseId } = req.params;

    const teacherCheck = await ensureTeacher(userId);
    if (!teacherCheck.ok) {
      return res.status(teacherCheck.code).send({ success: false, message: teacherCheck.message });
    }

    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(userId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    const patchableFields = [
      "C_educator",
      "C_title",
      "C_categories",
      "C_description",
      "thumbnail",
      "sections",
      "downloadableFiles",
      "quizzes",
      "liveSessions",
    ];
    patchableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

    if (req.body.C_price !== undefined) {
      course.C_price = parsePrice(req.body.C_price) === 0 ? "free" : String(req.body.C_price);
    }
    if (req.body.tags !== undefined) course.tags = normalizeTags(req.body.tags);
    if (req.body.prerequisites !== undefined) course.prerequisites = normalizeList(req.body.prerequisites);

    course.lastDraftSavedAt = new Date();
    appendVersion(course, userId, req.body.versionSummary || "Course updated");
    await course.save();

    emitToUser(String(userId), "teacher:course-updated", { action: "updated", course });
    emitToCourse(String(courseId), "course:updated", { courseId, course });
    return res.status(200).send({ success: true, message: "Course updated", data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const autosaveDraftController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { courseId } = req.params;
    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(userId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    course.publishStatus = "draft";
    course.lastDraftSavedAt = new Date();
    if (req.body.C_title !== undefined) course.C_title = req.body.C_title;
    if (req.body.C_description !== undefined) course.C_description = req.body.C_description;
    if (req.body.sections !== undefined) course.sections = req.body.sections;
    if (req.body.downloadableFiles !== undefined) course.downloadableFiles = req.body.downloadableFiles;
    if (req.body.tags !== undefined) course.tags = normalizeTags(req.body.tags);
    if (req.body.prerequisites !== undefined) course.prerequisites = normalizeList(req.body.prerequisites);

    appendVersion(course, userId, "Auto-saved draft");
    await course.save();

    emitToUser(String(userId), "teacher:draft-autosaved", {
      courseId,
      lastDraftSavedAt: course.lastDraftSavedAt,
    });
    return res.status(200).send({ success: true, message: "Draft auto-saved", data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const setPublishStateController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { courseId } = req.params;
    const { state, scheduledPublishAt } = req.body;
    const validStates = ["published", "unpublished", "scheduled", "draft"];
    if (!validStates.includes(state)) {
      return res.status(400).send({ success: false, message: "Invalid publish state" });
    }

    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(userId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    course.publishStatus = state;
    course.approved = state === "published";
    course.archived = state === "unpublished";
    course.scheduledPublishAt = state === "scheduled" ? scheduledPublishAt : null;
    appendVersion(course, userId, `Publish state set to ${state}`);
    await course.save();

    emitToUser(String(userId), "teacher:course-publish-state", { courseId, state, scheduledPublishAt });
    emitToCourse(String(courseId), "course:publish-state", { courseId, state, scheduledPublishAt });
    return res.status(200).send({ success: true, message: "Publish state updated", data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const listCourseVersionsController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { courseId } = req.params;
    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(userId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }
    return res.status(200).send({ success: true, data: course.versionHistory || [] });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};
const createAssignmentController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const teacherCheck = await ensureTeacher(teacherId);
    if (!teacherCheck.ok) {
      return res.status(teacherCheck.code).send({ success: false, message: teacherCheck.message });
    }

    const { courseId, title, description, deadline, type, questions, autoGradeMCQ, maxMarks } = req.body;
    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(teacherId)) {
      return res.status(403).send({ success: false, message: "Not authorized for this course" });
    }

    const assignment = await assignmentSchema.create({
      courseId,
      teacherId,
      title,
      description,
      deadline,
      type,
      questions: Array.isArray(questions) ? questions : [],
      autoGradeMCQ: !!autoGradeMCQ,
      maxMarks: Number(maxMarks || 100),
    });

    course.assignments.push({
      assignmentId: String(assignment._id),
      title: assignment.title,
      description: assignment.description,
      deadline: assignment.deadline,
      autoGradeMCQ: assignment.autoGradeMCQ,
    });
    appendVersion(course, teacherId, `Assignment added: ${assignment.title}`);
    await course.save();

    emitToCourse(String(courseId), "assignment:created", assignment);
    return res.status(201).send({ success: true, message: "Assignment created", data: assignment });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const submitAssignmentController = async (req, res) => {
  try {
    const studentId = req.body.userId;
    const { assignmentId } = req.params;
    const { answers = {}, attachments = [] } = req.body;

    const assignment = await assignmentSchema.findById(assignmentId);
    if (!assignment) return res.status(404).send({ success: false, message: "Assignment not found" });

    const enrolled = await enrolledCourseSchema.findOne({
      courseId: assignment.courseId,
      userId: studentId,
    });
    if (!enrolled) {
      return res.status(403).send({ success: false, message: "You are not enrolled in this course" });
    }

    let marksAwarded = 0;
    let status = "submitted";
    if (assignment.autoGradeMCQ && Array.isArray(assignment.questions)) {
      assignment.questions.forEach((question, index) => {
        const candidate = answers?.[index];
        if (candidate !== undefined && Number(candidate) === Number(question.correctOptionIndex)) {
          marksAwarded += Number(question.marks || 1);
        }
      });
      status = "graded";
    }

    const submission = await assignmentSubmissionSchema.findOneAndUpdate(
      { assignmentId, studentId },
      {
        assignmentId,
        courseId: assignment.courseId,
        studentId,
        answers,
        attachments,
        marksAwarded,
        status,
        gradedAt: status === "graded" ? new Date() : null,
      },
      { upsert: true, new: true }
    );

    await awardLearningActivity({
      userId: studentId,
      points: status === "graded" ? 20 : 15,
      reason: "Assignment submitted",
      courseId: assignment.courseId,
    });

    emitToUser(String(assignment.teacherId), "assignment:submission", submission);
    emitToUser(String(studentId), "student:assignment-submitted", submission);
    return res.status(200).send({ success: true, message: "Assignment submitted", data: submission });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const listTeacherAssignmentsController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const { courseId } = req.query;
    const query = { teacherId };
    if (courseId) query.courseId = courseId;
    const assignments = await assignmentSchema.find(query).sort({ createdAt: -1 });
    return res.status(200).send({ success: true, data: assignments });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const listAssignmentSubmissionsController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const { assignmentId } = req.params;
    const assignment = await assignmentSchema.findById(assignmentId);
    if (!assignment) return res.status(404).send({ success: false, message: "Assignment not found" });
    if (String(assignment.teacherId) !== String(teacherId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    const submissions = await assignmentSubmissionSchema
      .find({ assignmentId })
      .populate("studentId", "name email")
      .sort({ updatedAt: -1 });
    return res.status(200).send({ success: true, data: submissions });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const gradeSubmissionController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const { submissionId } = req.params;
    const { marksAwarded, remarks = "", returnSubmission = false } = req.body;

    const submission = await assignmentSubmissionSchema.findById(submissionId);
    if (!submission) return res.status(404).send({ success: false, message: "Submission not found" });

    const assignment = await assignmentSchema.findById(submission.assignmentId);
    if (!assignment || String(assignment.teacherId) !== String(teacherId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    submission.marksAwarded = Number(marksAwarded || 0);
    submission.remarks = remarks;
    submission.gradedBy = teacherId;
    submission.gradedAt = new Date();
    submission.status = returnSubmission ? "returned" : "graded";
    await submission.save();

    await createNotification({
      userId: submission.studentId,
      type: "assignment",
      title: "Assignment Updated",
      message: `Your assignment has been ${submission.status}.`,
      meta: { assignmentId: assignment._id, submissionId: submission._id },
    });

    emitToUser(String(submission.studentId), "assignment:graded", submission);
    return res.status(200).send({ success: true, message: "Submission updated", data: submission });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getEnrolledStudentsController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const { courseId } = req.query;
    const courseQuery = { userId: String(teacherId) };
    if (courseId) courseQuery._id = courseId;

    const courses = await courseSchema.find(courseQuery);
    const courseIdList = courses.map((course) => course._id);

    const enrollments = await enrolledCourseSchema
      .find({ courseId: { $in: courseIdList } })
      .populate("userId", "name email")
      .sort({ updatedAt: -1 });

    const rows = enrollments.map((item) => {
      const total = Number(item.course_Length || 0);
      const completed = Array.isArray(item.progress) ? item.progress.length : 0;
      const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        enrollmentId: item._id,
        courseId: item.courseId,
        studentId: item.userId?._id,
        studentName: item.userId?.name || "Unknown",
        studentEmail: item.userId?.email || "",
        completedModules: completed,
        totalModules: total,
        completionPercent,
      };
    });

    return res.status(200).send({ success: true, data: rows });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const exportPerformanceController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const courses = await courseSchema.find({ userId: String(teacherId) });
    const courseIds = courses.map((course) => course._id);
    const enrollments = await enrolledCourseSchema
      .find({ courseId: { $in: courseIds } })
      .populate("userId", "name email");

    const csvHeader = "Course Title,Student Name,Student Email,Completion %,Completed Modules,Total Modules\n";
    const courseMap = new Map(courses.map((course) => [String(course._id), course.C_title]));
    const csvRows = enrollments
      .map((item) => {
        const total = Number(item.course_Length || 0);
        const completed = Array.isArray(item.progress) ? item.progress.length : 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const title = (courseMap.get(String(item.courseId)) || "").replace(/,/g, " ");
        const name = (item.userId?.name || "Unknown").replace(/,/g, " ");
        const email = (item.userId?.email || "").replace(/,/g, " ");
        return `${title},${name},${email},${percent},${completed},${total}`;
      })
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=teacher-performance.csv");
    return res.status(200).send(csvHeader + csvRows);
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};
const sendDirectMessageController = async (req, res) => {
  try {
    const senderId = req.body.userId;
    const { recipientId, subject = "", body, courseId = null, sendEmailCopy = false } = req.body;
    if (!recipientId || !body) {
      return res.status(400).send({ success: false, message: "recipientId and body are required" });
    }

    const recipient = await userSchema.findById(recipientId);
    if (!recipient) {
      return res.status(404).send({ success: false, message: "Recipient not found" });
    }

    const messageDoc = await teacherMessageSchema.create({
      senderId,
      recipientId,
      courseId,
      kind: "private",
      subject,
      body,
    });

    await createNotification({
      userId: recipientId,
      type: "message",
      title: subject || "New message",
      message: body,
      meta: { messageId: messageDoc._id, courseId },
    });

    if (sendEmailCopy) {
      await sendEmail({
        to: recipient.email,
        subject: subject || "Message from your teacher",
        text: body,
        html: `<p>${body}</p>`,
      });
    }

    emitToUser(String(recipientId), "message:private", messageDoc);
    return res.status(201).send({ success: true, message: "Message sent", data: messageDoc });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const sendBulkMessageController = async (req, res) => {
  try {
    const senderId = req.body.userId;
    const { courseId, subject = "", body, sendEmailCopy = false } = req.body;
    if (!courseId || !body) {
      return res.status(400).send({ success: false, message: "courseId and body are required" });
    }

    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(senderId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    const enrollments = await enrolledCourseSchema.find({ courseId }).populate("userId", "email name");
    const recipientIds = enrollments.map((item) => item.userId?._id).filter(Boolean);

    const messageDoc = await teacherMessageSchema.create({
      senderId,
      courseId,
      kind: "bulk",
      subject,
      body,
    });

    await Promise.all(
      recipientIds.map(async (recipientId) => {
        await createNotification({
          userId: recipientId,
          type: "announcement",
          title: subject || `Update from ${course.C_title}`,
          message: body,
          meta: { messageId: messageDoc._id, courseId },
        });
      })
    );

    if (sendEmailCopy) {
      const recipients = enrollments.map((item) => item.userId?.email).filter(Boolean);
      await Promise.all(
        recipients.map((email) =>
          sendEmail({
            to: email,
            subject: subject || `Course update: ${course.C_title}`,
            text: body,
            html: `<p>${body}</p>`,
          })
        )
      );
    }

    emitToCourse(String(courseId), "message:bulk", messageDoc);
    return res.status(201).send({
      success: true,
      message: "Bulk message sent",
      data: { message: messageDoc, recipients: recipientIds.length },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const createAnnouncementController = async (req, res) => {
  try {
    const { courseId, title, body, sendEmailCopy = false } = req.body;
    if (!courseId || !title || !body) {
      return res.status(400).send({ success: false, message: "courseId, title and body are required" });
    }

    req.body.subject = title;
    req.body.sendEmailCopy = sendEmailCopy;
    return sendBulkMessageController(req, res);
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getPrivateMessagesController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { withUserId } = req.query;
    if (!withUserId) {
      return res.status(400).send({ success: false, message: "withUserId is required" });
    }

    const messages = await teacherMessageSchema
      .find({
        kind: "private",
        $or: [
          { senderId: userId, recipientId: withUserId },
          { senderId: withUserId, recipientId: userId },
        ],
      })
      .populate("senderId", "name email")
      .populate("recipientId", "name email")
      .sort({ createdAt: 1 })
      .limit(200);

    return res.status(200).send({ success: true, data: messages });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const deleteCourseAdvancedController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { courseId } = req.params;
    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(userId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    await Promise.all([
      assignmentSchema.deleteMany({ courseId }),
      assignmentSubmissionSchema.deleteMany({ courseId }),
      discussionSchema.deleteMany({ courseId }),
      teacherMessageSchema.deleteMany({ courseId }),
      courseSchema.findByIdAndDelete(courseId),
    ]);

    emitToUser(String(userId), "teacher:course-updated", { action: "deleted", courseId });
    return res.status(200).send({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const uploadCourseAssetsController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { courseId } = req.params;
    const course = await courseSchema.findById(courseId);
    if (!course) return res.status(404).send({ success: false, message: "Course not found" });
    if (String(course.userId) !== String(userId)) {
      return res.status(403).send({ success: false, message: "Not authorized" });
    }

    const files = req.files || {};
    const thumbnails = files.thumbnail || [];
    const pdfFiles = files.pdfFiles || [];
    const lessonVideos = files.lessonVideos || [];

    if (thumbnails[0]) {
      course.thumbnail = `/uploads/${thumbnails[0].filename}`;
    }

    if (pdfFiles.length > 0) {
      const docs = pdfFiles.map((file, idx) => ({
        title: req.body[`pdfTitle_${idx}`] || file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        fileType: "pdf",
      }));
      course.downloadableFiles = [...(course.downloadableFiles || []), ...docs];
    }

    if (lessonVideos.length > 0) {
      const videosAsLessons = lessonVideos.map((file, idx) => ({
        moduleTitle: req.body[`moduleTitle_${idx}`] || "Module",
        lessonTitle: req.body[`lessonTitle_${idx}`] || file.originalname,
        lessonDescription: req.body[`lessonDescription_${idx}`] || "",
        video: {
          filename: file.filename,
          path: `/uploads/${file.filename}`,
        },
      }));
      course.sections = [...(course.sections || []), ...videosAsLessons];
    }

    appendVersion(course, userId, "Uploaded course assets");
    course.lastDraftSavedAt = new Date();
    await course.save();

    emitToUser(String(userId), "teacher:course-updated", { action: "assets-uploaded", course });
    emitToCourse(String(courseId), "course:updated", { courseId, course });
    return res.status(200).send({ success: true, message: "Assets uploaded", data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const postDiscussionMessageController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { courseId } = req.params;
    const { message, parentId = null } = req.body;
    if (!message) return res.status(400).send({ success: false, message: "message is required" });

    const enrolledOrTeacher = await Promise.all([
      enrolledCourseSchema.findOne({ courseId, userId }),
      courseSchema.findOne({ _id: courseId, userId: String(userId) }),
    ]);
    if (!enrolledOrTeacher[0] && !enrolledOrTeacher[1]) {
      return res.status(403).send({ success: false, message: "Not authorized in this discussion board" });
    }

    const post = await discussionSchema.create({
      courseId,
      userId,
      parentId: parentId || null,
      message,
    });

    const populated = await discussionSchema.findById(post._id).populate("userId", "name type");
    const authorType = String(populated?.userId?.type || "").toLowerCase();
    if (authorType === "student") {
      await awardLearningActivity({
        userId,
        points: 3,
        reason: "Discussion activity",
        courseId,
      });
    }
    emitToCourse(String(courseId), "discussion:new", populated);
    return res.status(201).send({ success: true, message: "Discussion message posted", data: populated });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const listDiscussionMessagesController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const messages = await discussionSchema
      .find({ courseId })
      .populate("userId", "name type")
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).send({ success: true, data: messages });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const teacherEarningsOverviewController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const courses = await courseSchema.find({ userId: String(teacherId) });
    const courseIds = courses.map((course) => course._id);
    const payments = await coursePaymentSchema.find({ courseId: { $in: courseIds } });

    const courseMap = new Map(courses.map((course) => [String(course._id), course]));
    let grossRevenue = 0;
    payments.forEach((payment) => {
      const course = courseMap.get(String(payment.courseId));
      if (!course) return;
      const base = parsePrice(course.C_price);
      const discount = Number(course.discount || 0);
      const final = base > 0 ? Math.max(base - (base * discount) / 100, 0) : 0;
      grossRevenue += final;
    });

    const paidWithdrawals = await withdrawalRequestSchema.aggregate([
      { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalWithdrawn = Number(paidWithdrawals?.[0]?.total || 0);
    const pendingWithdrawals = await withdrawalRequestSchema.aggregate([
      { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const pendingAmount = Number(pendingWithdrawals?.[0]?.total || 0);
    const availableBalance = Math.max(grossRevenue - totalWithdrawn - pendingAmount, 0);

    const revenueByCourse = courses.map((course) => {
      const price = parsePrice(course.C_price);
      const discount = Number(course.discount || 0);
      const finalPrice = price > 0 ? Math.max(price - (price * discount) / 100, 0) : 0;
      return {
        courseId: course._id,
        title: course.C_title,
        enrolled: Number(course.enrolled || 0),
        revenue: Number(course.enrolled || 0) * finalPrice,
      };
    });

    return res.status(200).send({
      success: true,
      data: {
        grossRevenue,
        totalWithdrawn,
        pendingAmount,
        availableBalance,
        revenueByCourse,
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const createWithdrawalRequestController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const { amount, method = "bank-transfer", accountDetails = {} } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).send({ success: false, message: "Valid amount is required" });
    }

    const courses = await courseSchema.find({ userId: String(teacherId) });
    const courseIds = courses.map((course) => course._id);
    const payments = await coursePaymentSchema.find({ courseId: { $in: courseIds } });
    const grossRevenue = payments.reduce((acc, payment) => {
      const course = courses.find((item) => String(item._id) === String(payment.courseId));
      if (!course) return acc;
      const base = parsePrice(course.C_price);
      const discount = Number(course.discount || 0);
      return acc + (base > 0 ? Math.max(base - (base * discount) / 100, 0) : 0);
    }, 0);

    const settled = await withdrawalRequestSchema.aggregate([
      { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: { $in: ["paid", "pending"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const blocked = Number(settled?.[0]?.total || 0);
    const availableBalance = Math.max(grossRevenue - blocked, 0);

    if (Number(amount) > availableBalance) {
      return res.status(400).send({ success: false, message: "Requested amount exceeds available balance" });
    }

    const withdrawal = await withdrawalRequestSchema.create({
      teacherId,
      amount: Number(amount),
      method,
      accountDetails,
      status: "pending",
    });

    emitToUser(String(teacherId), "earnings:withdrawal-requested", withdrawal);
    return res.status(201).send({ success: true, message: "Withdrawal request created", data: withdrawal });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const teacherPerformanceStatsController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const courses = await courseSchema.find({ userId: String(teacherId) });
    const courseIds = courses.map((course) => course._id);
    const enrollments = await enrolledCourseSchema.find({ courseId: { $in: courseIds } });

    const byCourse = courses.map((course) => {
      const related = enrollments.filter((enrollment) => String(enrollment.courseId) === String(course._id));
      let avgCompletion = 0;
      if (related.length > 0) {
        const total = related.reduce((acc, enrollment) => {
          const len = Number(enrollment.course_Length || 0);
          const done = Array.isArray(enrollment.progress) ? enrollment.progress.length : 0;
          return acc + (len > 0 ? Math.min((done / len) * 100, 100) : 0);
        }, 0);
        avgCompletion = Math.round(total / related.length);
      }
      return {
        courseId: course._id,
        title: course.C_title,
        status: course.publishStatus,
        enrollments: related.length,
        avgCompletion,
      };
    });

    return res.status(200).send({
      success: true,
      data: {
        totalCourses: courses.length,
        totalEnrollments: enrollments.length,
        courseStats: byCourse,
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const teacherAdvancedDashboardController = async (req, res) => {
  try {
    const teacherId = req.body.userId;
    const [courses, assignments, pendingSubmissions, recentMessages, withdrawals] = await Promise.all([
      courseSchema.find({ userId: String(teacherId) }).sort({ updatedAt: -1 }),
      assignmentSchema.find({ teacherId }).sort({ createdAt: -1 }).limit(10),
      assignmentSubmissionSchema.countDocuments({ status: "submitted" }),
      teacherMessageSchema.find({ senderId: teacherId }).sort({ createdAt: -1 }).limit(10),
      withdrawalRequestSchema.find({ teacherId }).sort({ createdAt: -1 }).limit(10),
    ]);

    const totalDrafts = courses.filter((course) => course.publishStatus === "draft").length;
    const scheduled = courses.filter((course) => course.publishStatus === "scheduled").length;
    const published = courses.filter((course) => course.publishStatus === "published").length;
    const totalStudents = courses.reduce((sum, course) => sum + Number(course.enrolled || 0), 0);

    return res.status(200).send({
      success: true,
      data: {
        summary: {
          totalCourses: courses.length,
          published,
          totalDrafts,
          scheduled,
          totalStudents,
          pendingSubmissions,
          assignments: assignments.length,
        },
        courses: courses.slice(0, 20),
        assignments,
        recentMessages,
        withdrawals,
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

module.exports = {
  forgotPasswordController,
  resetPasswordController,
  updateTeacherProfileAdvancedController,
  createCourseAdvancedController,
  updateCourseAdvancedController,
  autosaveDraftController,
  setPublishStateController,
  listCourseVersionsController,
  createAssignmentController,
  submitAssignmentController,
  listTeacherAssignmentsController,
  listAssignmentSubmissionsController,
  gradeSubmissionController,
  getEnrolledStudentsController,
  exportPerformanceController,
  sendDirectMessageController,
  sendBulkMessageController,
  getPrivateMessagesController,
  createAnnouncementController,
  deleteCourseAdvancedController,
  uploadCourseAssetsController,
  postDiscussionMessageController,
  listDiscussionMessagesController,
  teacherEarningsOverviewController,
  createWithdrawalRequestController,
  teacherPerformanceStatsController,
  teacherAdvancedDashboardController,
};
