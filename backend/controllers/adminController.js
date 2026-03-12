const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = require("../schemas/userModel");
const courseSchema = require("../schemas/courseModel");
const enrolledCourseSchema = require("../schemas/enrolledCourseModel");
const coursePaymentSchema = require("../schemas/coursePaymentModel");
const reviewSchema = require("../schemas/reviewModel");
const adminSettingSchema = require("../schemas/adminSettingModel");
const adminLogSchema = require("../schemas/adminLogModel");
const notificationSchema = require("../schemas/notificationModel");

const notImplemented = (feature) => async (req, res) => {
  res.status(501).send({ success: false, message: `${feature} not implemented yet` });
};

const parseCoursePrice = (price) => {
  if (price === "free" || price === undefined || price === null || price === "") return 0;
  const parsed = Number(price);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const writeAdminLog = async (type, message, meta = {}) => {
  try {
    await adminLogSchema.create({ type, message, meta });
  } catch (error) {
    console.error("Failed to write admin log:", error.message);
  }
};

const upsertSetting = async (key, value) => {
  const setting = await adminSettingSchema.findOneAndUpdate(
    { key },
    { value },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return setting;
};

const getSettingValue = async (key, fallback = null) => {
  const setting = await adminSettingSchema.findOne({ key });
  return setting?.value ?? fallback;
};

const notifyUsersByQuery = async (query, payload) => {
  const users = await userSchema.find(query).select("_id");
  if (!users.length) return;
  const docs = users.map((user) => ({
    userId: user._id,
    title: payload.title,
    message: payload.message,
    type: payload.type || "general",
    meta: payload.meta || {},
  }));
  await notificationSchema.insertMany(docs, { ordered: false });
};

const notifyOneUser = async (userId, payload) => {
  if (!userId) return;
  await notificationSchema.create({
    userId,
    title: payload.title,
    message: payload.message,
    type: payload.type || "general",
    meta: payload.meta || {},
  });
};

const notifyStudentsInCourse = async (courseId, payload) => {
  if (!courseId) return;
  const enrolled = await enrolledCourseSchema.find({ courseId }).select("userId");
  const uniqueIds = Array.from(new Set(enrolled.map((entry) => String(entry.userId))));
  if (!uniqueIds.length) return;

  const docs = uniqueIds.map((userId) => ({
    userId,
    title: payload.title,
    message: payload.message,
    type: payload.type || "course",
    meta: payload.meta || {},
  }));
  await notificationSchema.insertMany(docs, { ordered: false });
};

// Admin authentication
const adminLoginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send({ success: false, message: "Email and password are required" });
    }

    const user = await userSchema.findOne({ email });
    if (!user) {
      return res.status(404).send({ success: false, message: "Admin user not found" });
    }

    if (user.type !== "admin") {
      return res.status(403).send({ success: false, message: "Admin access required" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, role: "admin" }, process.env.JWT_KEY, { expiresIn: "1d" });
    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).send({
      success: true,
      message: "Admin login successful",
      token,
      userData: safeUser,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const adminLogoutController = async (req, res) => {
  return res.status(200).send({ success: true, message: "Admin logout successful" });
};

const adminRefreshTokenController = notImplemented("Admin refresh token");
const admin2FAController = notImplemented("Admin 2FA");

// Existing core admin controls
const getAllUsersController = async (req, res) => {
  try {
    const allUsers = await userSchema.find();
    return res.status(200).send({ success: true, data: allUsers });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getAllCoursesController = async (req, res) => {
  try {
    const allCourses = await courseSchema.find();
    return res.status(200).send({ success: true, data: allCourses });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const deleteCourseController = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findByIdAndDelete({ _id: courseid });
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    return res.status(200).send({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    return res.status(500).send({ success: false, message: "Failed to delete course" });
  }
};

const deleteUserController = async (req, res) => {
  const { userid } = req.params;
  try {
    const user = await userSchema.findByIdAndDelete({ _id: userid });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    return res.status(200).send({ success: true, message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).send({ success: false, message: "Failed to delete user" });
  }
};

// Admin user management
const createTeacherController = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await userSchema.findOne({ email });
    if (exists) {
      return res.status(400).send({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = new userSchema({ name, email, password: hashedPassword, type: "teacher" });
    await teacher.save();

    return res.status(201).send({ success: true, data: teacher });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const createStudentController = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await userSchema.findOne({ email });
    if (exists) {
      return res.status(400).send({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const student = new userSchema({ name, email, password: hashedPassword, type: "student" });
    await student.save();

    return res.status(201).send({ success: true, data: student });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const updateUserController = async (req, res) => {
  const { userid } = req.params;
  const updateData = req.body;
  try {
    const user = await userSchema.findByIdAndUpdate(userid, updateData, { new: true });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    return res.status(200).send({ success: true, data: user });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const suspendUserController = async (req, res) => {
  const { userid } = req.params;
  try {
    const user = await userSchema.findByIdAndUpdate(userid, { suspended: true }, { new: true, strict: false });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    await notifyOneUser(user._id, {
      type: "account",
      title: "Account Suspended",
      message: "Your account has been suspended by admin.",
      meta: { action: "suspended" },
    });
    return res.status(200).send({ success: true, data: user });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const assignRoleController = async (req, res) => {
  const { userid, role } = req.body;
  try {
    const user = await userSchema.findByIdAndUpdate(userid, { type: role }, { new: true });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    await notifyOneUser(user._id, {
      type: "account",
      title: "Role Updated",
      message: `Your account role has been changed to ${role} by admin.`,
      meta: { action: "role_change", role },
    });
    return res.status(200).send({ success: true, data: user });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const resetPasswordController = async (req, res) => {
  const { userid, newPassword } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await userSchema.findByIdAndUpdate(userid, { password: hashedPassword }, { new: true });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    return res.status(200).send({ success: true, message: "Password reset successfully" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const bulkUploadUsersController = notImplemented("Bulk user upload");

const softDeleteUserController = async (req, res) => {
  const { userid } = req.params;
  try {
    const user = await userSchema.findByIdAndUpdate(userid, { deleted: true }, { new: true, strict: false });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    return res.status(200).send({ success: true, data: user });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const restoreUserController = async (req, res) => {
  const { userid } = req.params;
  try {
    const user = await userSchema.findByIdAndUpdate(userid, { deleted: false }, { new: true, strict: false });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    await notifyOneUser(user._id, {
      type: "account",
      title: "Account Restored",
      message: "Your account access has been restored by admin.",
      meta: { action: "restored" },
    });
    return res.status(200).send({ success: true, data: user });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const userActivityLogsController = notImplemented("User activity logs");
const forceLogoutUserController = notImplemented("Force logout user");
const userLoginHistoryController = notImplemented("User login history");
const userAnalyticsController = notImplemented("User analytics");

// Admin security and moderation
const viewReportedContentController = async (req, res) => {
  try {
    const flaggedKeywords = ["abuse", "spam", "scam", "fraud", "hate", "offensive"];
    const reviews = await reviewSchema.find().sort({ createdAt: -1 }).limit(200);

    const content = reviews
      .filter((review) => {
        const text = `${review.title || ""} ${review.comment || ""}`.toLowerCase();
        const hasKeyword = flaggedKeywords.some((word) => text.includes(word));
        return hasKeyword || Number(review.rating) <= 2;
      })
      .map((review) => ({
        _id: review._id,
        content: review.comment,
        user: review.userId?.toString(),
        userName: review.userName,
        courseId: review.courseId?.toString(),
        createdAt: review.createdAt,
      }));

    return res.status(200).send({ success: true, content });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const removeInappropriateCommentsController = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).send({ success: false, message: "Reported content ID is required" });
    }

    const deleted = await reviewSchema.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).send({ success: false, message: "Reported content not found" });
    }

    await writeAdminLog("moderation_remove", "Removed inappropriate review content", { reviewId: id });
    return res.status(200).send({ success: true, message: "Inappropriate content removed" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const blockAbusiveUserController = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).send({ success: false, message: "User ID is required" });
    }

    const user = await userSchema.findByIdAndUpdate(
      id,
      { blocked: true, suspended: true },
      { new: true, strict: false }
    );
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    await notifyOneUser(user._id, {
      type: "account",
      title: "Account Restricted",
      message: "Your account has been blocked by admin due to policy violations.",
      meta: { action: "blocked" },
    });
    await writeAdminLog("moderation_block_user", "Blocked abusive user", { userId: id });
    return res.status(200).send({ success: true, message: "User blocked successfully", data: user });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const viewSystemLogsController = async (req, res) => {
  try {
    const logs = await adminLogSchema.find().sort({ createdAt: -1 }).limit(200);
    return res.status(200).send({ success: true, logs });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const apiUsageMonitoringController = async (req, res) => {
  try {
    const [users, courses, enrollments, reviews, transactions] = await Promise.all([
      userSchema.countDocuments(),
      courseSchema.countDocuments(),
      enrolledCourseSchema.countDocuments(),
      reviewSchema.countDocuments(),
      coursePaymentSchema.countDocuments(),
    ]);

    const usage = [
      { name: "users", count: users },
      { name: "courses", count: courses },
      { name: "enrollments", count: enrollments },
      { name: "reviews", count: reviews },
      { name: "transactions", count: transactions },
    ];

    return res.status(200).send({ success: true, usage });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

// Admin platform settings
const manageTagsController = async (req, res) => {
  try {
    const { category, tag } = req.body;

    if (!category && !tag) {
      return res.status(400).send({ success: false, message: "Category or tag is required" });
    }

    if (category) {
      const existing = await getSettingValue("categories", []);
      const next = Array.from(new Set([...(Array.isArray(existing) ? existing : []), category]));
      await upsertSetting("categories", next);
      await writeAdminLog("platform_category", "Added platform category", { category });
      return res.status(200).send({ success: true, message: "Category added successfully", categories: next });
    }

    const existing = await getSettingValue("tags", []);
    const next = Array.from(new Set([...(Array.isArray(existing) ? existing : []), tag]));
    await upsertSetting("tags", next);
    await writeAdminLog("platform_tag", "Added platform tag", { tag });
    return res.status(200).send({ success: true, message: "Tag added successfully", tags: next });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const enableDisableFeatureController = async (req, res) => {
  try {
    const { enabled } = req.body;
    await upsertSetting("featureEnabled", Boolean(enabled));
    await notifyUsersByQuery(
      { type: { $in: ["teacher", "student"] } },
      {
        type: "platform",
        title: "Platform Feature Update",
        message: `Admin has ${enabled ? "enabled" : "disabled"} a platform feature.`,
        meta: { enabled: Boolean(enabled) },
      }
    );
    await writeAdminLog("platform_feature_toggle", "Updated feature toggle", { enabled: Boolean(enabled) });
    return res.status(200).send({
      success: true,
      message: `Feature ${enabled ? "enabled" : "disabled"} successfully`,
      enabled: Boolean(enabled),
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const maintenanceModeController = async (req, res) => {
  try {
    const { enabled } = req.body;
    await upsertSetting("maintenanceMode", Boolean(enabled));
    await notifyUsersByQuery(
      { type: { $in: ["teacher", "student"] } },
      {
        type: "platform",
        title: "Maintenance Mode Update",
        message: `Maintenance mode has been ${enabled ? "enabled" : "disabled"} by admin.`,
        meta: { enabled: Boolean(enabled) },
      }
    );
    await writeAdminLog("platform_maintenance", "Updated maintenance mode", { enabled: Boolean(enabled) });
    return res.status(200).send({
      success: true,
      message: `Maintenance mode ${enabled ? "enabled" : "disabled"} successfully`,
      enabled: Boolean(enabled),
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const announcementSystemController = async (req, res) => {
  try {
    const { announcement } = req.body;
    if (!announcement) {
      return res.status(400).send({ success: false, message: "Announcement is required" });
    }

    const existing = await getSettingValue("announcements", []);
    const next = [{ announcement, createdAt: new Date() }, ...(Array.isArray(existing) ? existing : [])].slice(0, 100);
    await upsertSetting("announcements", next);
    await notifyUsersByQuery(
      { type: { $in: ["teacher", "student"] } },
      {
        type: "announcement",
        title: "New Announcement",
        message: announcement,
      }
    );
    await writeAdminLog("platform_announcement", "Published announcement", { announcement });
    return res.status(200).send({ success: true, message: "Announcement published successfully", announcements: next });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const globalNotificationsController = async (req, res) => {
  try {
    const { notification } = req.body;
    if (!notification) {
      return res.status(400).send({ success: false, message: "Notification is required" });
    }

    const existing = await getSettingValue("globalNotifications", []);
    const next = [{ notification, createdAt: new Date() }, ...(Array.isArray(existing) ? existing : [])].slice(0, 100);
    await upsertSetting("globalNotifications", next);
    await notifyUsersByQuery(
      { type: { $in: ["teacher", "student"] } },
      {
        type: "global",
        title: "Admin Notification",
        message: notification,
      }
    );
    await writeAdminLog("platform_notification", "Sent global notification", { notification });
    return res.status(200).send({ success: true, message: "Global notification sent successfully", notifications: next });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const getPlatformSettingsController = async (req, res) => {
  try {
    const [categories, tags, featureEnabled, maintenanceMode, announcements, globalNotifications] = await Promise.all([
      getSettingValue("categories", []),
      getSettingValue("tags", []),
      getSettingValue("featureEnabled", true),
      getSettingValue("maintenanceMode", false),
      getSettingValue("announcements", []),
      getSettingValue("globalNotifications", []),
    ]);

    return res.status(200).send({
      success: true,
      settings: {
        categories,
        tags,
        featureEnabled,
        maintenanceMode,
        announcements,
        globalNotifications,
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

// Admin financial controls
const commissionManagementController = async (req, res) => {
  try {
    const result = await coursePaymentSchema.updateMany(
      {},
      { $set: { commissionProcessedAt: new Date() } },
      { strict: false }
    );
    await writeAdminLog("finance_commission", "Processed commission management", { modifiedCount: result.modifiedCount });
    return res.status(200).send({
      success: true,
      message: "Commission processing completed",
      result,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const withdrawApprovalController = async (req, res) => {
  try {
    const result = await coursePaymentSchema.updateMany(
      { status: { $in: ["withdraw_requested", "pending_withdraw"] } },
      { $set: { status: "withdraw_approved", withdrawApprovedAt: new Date() } },
      { strict: false }
    );
    await writeAdminLog("finance_withdraw", "Approved withdraw requests", { modifiedCount: result.modifiedCount });
    return res.status(200).send({
      success: true,
      message: "Withdraw approvals processed",
      result,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const refundApprovalController = async (req, res) => {
  try {
    const result = await coursePaymentSchema.updateMany(
      { status: { $in: ["refund_requested", "pending_refund"] } },
      { $set: { status: "refund_approved", refundApprovedAt: new Date() } },
      { strict: false }
    );
    await writeAdminLog("finance_refund", "Approved refund requests", { modifiedCount: result.modifiedCount });
    return res.status(200).send({
      success: true,
      message: "Refund approvals processed",
      result,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const paymentGatewayLogsController = async (req, res) => {
  try {
    const logs = await adminLogSchema
      .find({ type: { $regex: /^finance_/ } })
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).send({ success: true, logs });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const transactionReportsController = async (req, res) => {
  try {
    const payments = await coursePaymentSchema.find().sort({ createdAt: -1 }).limit(500).lean();
    const courseIds = payments.map((payment) => payment.courseId).filter(Boolean);
    const courses = await courseSchema.find({ _id: { $in: courseIds } }).select("_id C_price").lean();
    const courseMap = new Map(courses.map((course) => [String(course._id), course]));

    const transactions = payments.map((payment) => {
      const course = payment.courseId ? courseMap.get(String(payment.courseId)) : null;
      const amount = payment.amount ?? parseCoursePrice(course?.C_price);
      return {
        ...payment,
        amount,
        date: payment.createdAt,
      };
    });

    return res.status(200).send({
      success: true,
      totalTransactions: transactions.length,
      transactions,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

// Admin platform analytics
const totalUsersController = async (req, res) => {
  try {
    const totalUsers = await userSchema.countDocuments();
    return res.status(200).send({ success: true, totalUsers });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const activeUsersController = async (req, res) => {
  try {
    const activeUsers = await userSchema.countDocuments({
      suspended: { $ne: true },
      deleted: { $ne: true },
    });
    return res.status(200).send({ success: true, activeUsers });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const revenueReportsController = async (req, res) => {
  try {
    const payments = await coursePaymentSchema.find().lean();
    const courseIds = payments.map((payment) => payment.courseId).filter(Boolean);
    const courses = await courseSchema.find({ _id: { $in: courseIds } }).select("_id C_price").lean();
    const courseMap = new Map(courses.map((course) => [String(course._id), course]));

    const totalRevenue = payments.reduce((sum, payment) => {
      const course = payment.courseId ? courseMap.get(String(payment.courseId)) : null;
      const amount = payment.amount ?? parseCoursePrice(course?.C_price);
      return sum + Number(amount || 0);
    }, 0);
    return res.status(200).send({ success: true, totalRevenue });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const courseEnrollmentTrendsController = async (req, res) => {
  try {
    const trends = await enrolledCourseSchema.aggregate([
      { $group: { _id: "$courseId", enrollments: { $sum: 1 } } },
    ]);
    return res.status(200).send({ success: true, trends });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const teacherPerformanceStatsController = async (req, res) => {
  try {
    const stats = await courseSchema.aggregate([
      { $group: { _id: "$userId", courses: { $sum: 1 }, enrollments: { $sum: "$enrolled" } } },
    ]);
    return res.status(200).send({ success: true, stats });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const studentPerformanceStatsController = async (req, res) => {
  try {
    const stats = await enrolledCourseSchema.aggregate([
      { $group: { _id: "$userId", enrollments: { $sum: 1 } } },
    ]);
    return res.status(200).send({ success: true, stats });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const realTimeDashboardController = async (req, res) => {
  try {
    const [totalUsers, activeUsers, totalCourses, totalTransactions] = await Promise.all([
      userSchema.countDocuments(),
      userSchema.countDocuments({ suspended: { $ne: true }, deleted: { $ne: true } }),
      courseSchema.countDocuments(),
      coursePaymentSchema.countDocuments(),
    ]);

    return res.status(200).send({
      success: true,
      dashboard: { totalUsers, activeUsers, totalCourses, totalTransactions },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

// Admin course management
const approveCourseController = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findByIdAndUpdate(
      courseid,
      { approved: true },
      { new: true, strict: false }
    );
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    await notifyOneUser(course.userId, {
      type: "course",
      title: "Course Approved",
      message: `Your course "${course.C_title}" has been approved by admin.`,
      meta: { courseId: course._id, action: "approved" },
    });
    return res.status(200).send({ success: true, data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const editCourseController = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findByIdAndUpdate(courseid, req.body, { new: true, strict: false });
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    return res.status(200).send({ success: true, data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const featureCourseController = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findByIdAndUpdate(
      courseid,
      { featured: true },
      { new: true, strict: false }
    );
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    await notifyOneUser(course.userId, {
      type: "course",
      title: "Course Featured",
      message: `Your course "${course.C_title}" was marked as featured.`,
      meta: { courseId: course._id, action: "featured" },
    });
    return res.status(200).send({ success: true, data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const categorizeCourseController = async (req, res) => {
  const { courseid, category } = req.body;
  try {
    const course = await courseSchema.findByIdAndUpdate(
      courseid,
      { C_categories: category },
      { new: true }
    );
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    await notifyOneUser(course.userId, {
      type: "course",
      title: "Course Category Updated",
      message: `Admin changed category of "${course.C_title}" to "${course.C_categories}".`,
      meta: { courseId: course._id, action: "categorized" },
    });
    await notifyStudentsInCourse(course._id, {
      type: "course",
      title: "Course Updated",
      message: `Category of your enrolled course "${course.C_title}" was updated by admin.`,
      meta: { courseId: course._id, action: "categorized" },
    });
    return res.status(200).send({ success: true, data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const archiveCourseController = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findByIdAndUpdate(
      courseid,
      { archived: true },
      { new: true, strict: false }
    );
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    await notifyOneUser(course.userId, {
      type: "course",
      title: "Course Archived",
      message: `Your course "${course.C_title}" has been archived by admin.`,
      meta: { courseId: course._id, action: "archived" },
    });
    await notifyStudentsInCourse(course._id, {
      type: "course",
      title: "Course Archived",
      message: `Your enrolled course "${course.C_title}" is archived and may be unavailable.`,
      meta: { courseId: course._id, action: "archived" },
    });
    return res.status(200).send({ success: true, data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const controlPricingController = async (req, res) => {
  const { courseid, price } = req.body;
  try {
    const course = await courseSchema.findByIdAndUpdate(courseid, { C_price: price }, { new: true });
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }
    await notifyOneUser(course.userId, {
      type: "course",
      title: "Course Pricing Updated",
      message: `Admin updated pricing for "${course.C_title}" to ${price}.`,
      meta: { courseId: course._id, action: "pricing" },
    });
    await notifyStudentsInCourse(course._id, {
      type: "course",
      title: "Course Price Updated",
      message: `Pricing for your enrolled course "${course.C_title}" has been updated.`,
      meta: { courseId: course._id, action: "pricing" },
    });
    return res.status(200).send({ success: true, data: course });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const applyGlobalDiscountController = async (req, res) => {
  const { discount } = req.body;
  try {
    const result = await courseSchema.updateMany({}, { $set: { discount } }, { strict: false });
    await notifyUsersByQuery(
      { type: { $in: ["teacher", "student"] } },
      {
        type: "pricing",
        title: "Global Discount Applied",
        message: `Admin applied a global discount of ${discount}% on courses.`,
        meta: { discount },
      }
    );
    return res.status(200).send({ success: true, message: "Global discount applied", result });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

module.exports = {
  getAllUsersController,
  getAllCoursesController,
  deleteCourseController,
  deleteUserController,
  adminLoginController,
  adminLogoutController,
  adminRefreshTokenController,
  admin2FAController,
  createTeacherController,
  createStudentController,
  updateUserController,
  suspendUserController,
  assignRoleController,
  resetPasswordController,
  bulkUploadUsersController,
  softDeleteUserController,
  restoreUserController,
  userActivityLogsController,
  forceLogoutUserController,
  userLoginHistoryController,
  userAnalyticsController,
  viewReportedContentController,
  removeInappropriateCommentsController,
  blockAbusiveUserController,
  viewSystemLogsController,
  apiUsageMonitoringController,
  manageTagsController,
  enableDisableFeatureController,
  maintenanceModeController,
  announcementSystemController,
  globalNotificationsController,
  getPlatformSettingsController,
  commissionManagementController,
  withdrawApprovalController,
  refundApprovalController,
  paymentGatewayLogsController,
  transactionReportsController,
  totalUsersController,
  activeUsersController,
  revenueReportsController,
  courseEnrollmentTrendsController,
  teacherPerformanceStatsController,
  studentPerformanceStatsController,
  realTimeDashboardController,
  approveCourseController,
  editCourseController,
  featureCourseController,
  categorizeCourseController,
  archiveCourseController,
  controlPricingController,
  applyGlobalDiscountController,
};
