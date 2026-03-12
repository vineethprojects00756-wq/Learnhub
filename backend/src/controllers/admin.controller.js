const fs = require("fs/promises");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/apiError");
const { User } = require("../models/User");
const { Role } = require("../models/Role");
const { ActivityLog } = require("../models/ActivityLog");
const { LoginHistory } = require("../models/LoginHistory");
const { Course } = require("../models/Course");
const { Category } = require("../models/Category");
const { Tag } = require("../models/Tag");
const { Enrollment } = require("../models/Enrollment");
const { Transaction } = require("../models/Transaction");
const { PaymentLog } = require("../models/PaymentLog");
const { Withdrawal } = require("../models/Withdrawal");
const { Report } = require("../models/Report");
const { Comment } = require("../models/Comment");
const { Announcement } = require("../models/Announcement");
const { Notification } = require("../models/Notification");
const { FeatureFlag } = require("../models/FeatureFlag");
const { Settings } = require("../models/Settings");
const { RefreshToken } = require("../models/RefreshToken");
const { ApiUsage } = require("../models/ApiUsage");
const { hashPassword } = require("../utils/passwords");

async function logActivity(actorId, targetUserId, action, details) {
  await ActivityLog.create({ actor: actorId, targetUser: targetUserId, action, details });
}

// Admin auth analytics
const getAdminStats = asyncHandler(async (_req, res) => {
  const totalUsers = await User.countDocuments({ isDeleted: false });
  const activeUsers = await User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });
  const byRole = await User.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: "$role", count: { $sum: 1 } } }]);
  const totalMessages = await Comment.countDocuments();

  const revenueAgg = await Transaction.aggregate([
    { $match: { status: "paid" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  res.json({
    users: {
      total: totalUsers,
      active: activeUsers,
      byRole: byRole.reduce((acc, row) => { acc[row._id] = row.count; return acc; }, {}),
    },
    revenue: revenueAgg[0]?.total || 0,
    moderation: { totalComments: totalMessages },
  });
});

// User management
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "Email already registered");

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: role || "student" });
  await logActivity(req.user._id, user._id, "user.create", { role: user.role });
  res.status(201).json({ user });
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  delete updates.passwordHash;
  delete updates.twoFactorSecret;

  const user = await User.findByIdAndUpdate(id, updates, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await logActivity(req.user._id, user._id, "user.update", { updates });
  res.json({ user });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByIdAndDelete(id);
  if (!user) throw new ApiError(404, "User not found");
  await RefreshToken.deleteMany({ user: id });
  await logActivity(req.user._id, id, "user.delete", {});
  res.status(204).send();
});

const softDeleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await logActivity(req.user._id, id, "user.soft_delete", {});
  res.json({ user });
});

const restoreUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByIdAndUpdate(id, { isDeleted: false, deletedAt: null }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await logActivity(req.user._id, id, "user.restore", {});
  res.json({ user });
});

const suspendUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: "suspended" }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await logActivity(req.user._id, user._id, "user.suspend", {});
  res.json({ user });
});

const banUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: "banned" }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await logActivity(req.user._id, user._id, "user.ban", {});
  res.json({ user });
});

const assignRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await logActivity(req.user._id, user._id, "user.assign_role", { role });
  res.json({ user });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const passwordHash = await hashPassword(password);
  const user = await User.findByIdAndUpdate(req.params.id, { passwordHash }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  await logActivity(req.user._id, user._id, "user.reset_password", {});
  res.json({ ok: true });
});

const forceLogout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
  await logActivity(req.user._id, user._id, "user.force_logout", {});
  res.json({ ok: true });
});

const bulkUploadUsers = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "CSV file required");
  const content = await fs.readFile(req.file.path, "utf8");
  const records = parse(content, { columns: true, skip_empty_lines: true });

  const created = [];
  for (const row of records) {
    const email = (row.email || "").trim();
    if (!email) continue;
    const exists = await User.findOne({ email });
    if (exists) continue;

    const passwordHash = await hashPassword(row.password || "Password@123");
    const user = await User.create({
      name: row.name || "User",
      email,
      passwordHash,
      role: row.role || "student",
    });
    created.push(user._id);
  }

  await logActivity(req.user._id, null, "user.bulk_upload", { count: created.length });
  await fs.unlink(req.file.path).catch(() => {});
  res.json({ createdCount: created.length });
});

const getUserAnalytics = asyncHandler(async (_req, res) => {
  const totalUsers = await User.countDocuments({ isDeleted: false });
  const activeUsers = await User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });
  res.json({ totalUsers, activeUsers });
});

const getUserActivity = asyncHandler(async (req, res) => {
  const logs = await ActivityLog.find({ targetUser: req.params.id }).sort({ createdAt: -1 }).limit(100);
  res.json({ logs });
});

const getLoginHistory = asyncHandler(async (req, res) => {
  const logs = await LoginHistory.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(100);
  res.json({ logs });
});

// Course management
const approveCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.json({ course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.json({ course });
});

const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date() }, { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.status(204).send();
});

const featureCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { featured: !!req.body.featured }, { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.json({ course });
});

const categorizeCourse = asyncHandler(async (req, res) => {
  const { categories = [], tags = [] } = req.body;
  const course = await Course.findByIdAndUpdate(req.params.id, { categories, tags }, { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.json({ course });
});

const archiveCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.json({ course });
});

const updatePricing = asyncHandler(async (req, res) => {
  const { price, discountPercent } = req.body;
  const course = await Course.findByIdAndUpdate(req.params.id, { price, discountPercent }, { new: true });
  if (!course) throw new ApiError(404, "Course not found");
  res.json({ course });
});

const setGlobalDiscount = asyncHandler(async (req, res) => {
  const { percent } = req.body;
  const settings = await Settings.findOneAndUpdate({}, { globalDiscountPercent: percent }, { new: true, upsert: true });
  res.json({ settings });
});

// Platform analytics
const platformAnalytics = asyncHandler(async (_req, res) => {
  const totalUsers = await User.countDocuments({ isDeleted: false });
  const totalEnrollments = await Enrollment.countDocuments();
  const enrollmentTrends = await Enrollment.aggregate([
    { $group: { _id: { $substrBytes: ["$createdAt", 0, 7] }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const teacherPerformance = await Course.aggregate([
    { $group: { _id: "$teacher", courses: { $sum: 1 } } },
    { $sort: { courses: -1 } },
  ]);
  const studentPerformance = await Enrollment.aggregate([
    { $group: { _id: "$user", enrollments: { $sum: 1 } } },
    { $sort: { enrollments: -1 } },
  ]);

  res.json({ totalUsers, totalEnrollments, enrollmentTrends, teacherPerformance, studentPerformance });
});

const revenueAnalytics = asyncHandler(async (_req, res) => {
  const revenueAgg = await Transaction.aggregate([
    { $match: { status: "paid" } },
    { $group: { _id: { $substrBytes: ["$createdAt", 0, 7] }, total: { $sum: "$amount" } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ revenue: revenueAgg });
});

// Financial controls
const listTransactions = asyncHandler(async (_req, res) => {
  const items = await Transaction.find().sort({ createdAt: -1 }).limit(200);
  res.json({ items });
});

const listPaymentLogs = asyncHandler(async (_req, res) => {
  const items = await PaymentLog.find().sort({ createdAt: -1 }).limit(200);
  res.json({ items });
});

const approveRefund = asyncHandler(async (req, res) => {
  const txn = await Transaction.findByIdAndUpdate(req.params.id, { status: "refunded" }, { new: true });
  if (!txn) throw new ApiError(404, "Transaction not found");
  res.json({ transaction: txn });
});

const listWithdrawals = asyncHandler(async (_req, res) => {
  const items = await Withdrawal.find().sort({ createdAt: -1 }).limit(200);
  res.json({ items });
});

const approveWithdrawal = asyncHandler(async (req, res) => {
  const item = await Withdrawal.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
  if (!item) throw new ApiError(404, "Withdrawal not found");
  res.json({ withdrawal: item });
});

const setCommission = asyncHandler(async (req, res) => {
  const { percent } = req.body;
  const settings = await Settings.findOneAndUpdate({}, { commissionPercent: percent }, { new: true, upsert: true });
  res.json({ settings });
});

// Platform settings
const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ name: req.body.name });
  res.status(201).json({ category });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!category) throw new ApiError(404, "Category not found");
  res.json({ category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

const createTag = asyncHandler(async (req, res) => {
  const tag = await Tag.create({ name: req.body.name });
  res.status(201).json({ tag });
});

const updateTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!tag) throw new ApiError(404, "Tag not found");
  res.json({ tag });
});

const deleteTag = asyncHandler(async (req, res) => {
  await Tag.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

const setMaintenance = asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  const settings = await Settings.findOneAndUpdate({}, { maintenanceMode: enabled }, { new: true, upsert: true });
  res.json({ settings });
});

const setFeatureFlag = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { enabled } = req.body;
  const flag = await FeatureFlag.findOneAndUpdate({ key }, { enabled }, { upsert: true, new: true });
  res.json({ flag });
});

const createAnnouncement = asyncHandler(async (req, res) => {
  const item = await Announcement.create(req.body);
  res.status(201).json({ announcement: item });
});

const createNotification = asyncHandler(async (req, res) => {
  const item = await Notification.create(req.body);
  res.status(201).json({ notification: item });
});

// Security & moderation
const listReports = asyncHandler(async (_req, res) => {
  const items = await Report.find().sort({ createdAt: -1 }).limit(200);
  res.json({ items });
});

const resolveReport = asyncHandler(async (req, res) => {
  const report = await Report.findByIdAndUpdate(req.params.id, { status: "resolved" }, { new: true });
  if (!report) throw new ApiError(404, "Report not found");
  res.json({ report });
});

const removeComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findByIdAndUpdate(req.params.id, { isRemoved: true }, { new: true });
  if (!comment) throw new ApiError(404, "Comment not found");
  res.json({ comment });
});

const blockUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: "banned" }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  res.json({ user });
});

const systemLogs = asyncHandler(async (_req, res) => {
  const logFile = process.env.LOG_FILE || "logs/app.log";
  const absPath = path.resolve(logFile);
  try {
    const content = await fs.readFile(absPath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean).slice(-200);
    res.json({ lines });
  } catch (_err) {
    res.json({ lines: [] });
  }
});

const apiUsage = asyncHandler(async (_req, res) => {
  const items = await ApiUsage.find().sort({ createdAt: -1 }).limit(200);
  res.json({ items });
});

module.exports = {
  getAdminStats,
  createUser,
  updateUser,
  deleteUser,
  softDeleteUser,
  restoreUser,
  suspendUser,
  banUser,
  assignRole,
  resetPassword,
  forceLogout,
  bulkUploadUsers,
  getUserAnalytics,
  getUserActivity,
  getLoginHistory,
  approveCourse,
  updateCourse,
  deleteCourse,
  featureCourse,
  categorizeCourse,
  archiveCourse,
  updatePricing,
  setGlobalDiscount,
  platformAnalytics,
  revenueAnalytics,
  listTransactions,
  listPaymentLogs,
  approveRefund,
  listWithdrawals,
  approveWithdrawal,
  setCommission,
  createCategory,
  updateCategory,
  deleteCategory,
  createTag,
  updateTag,
  deleteTag,
  setMaintenance,
  setFeatureFlag,
  createAnnouncement,
  createNotification,
  listReports,
  resolveReport,
  removeComment,
  blockUser,
  systemLogs,
  apiUsage,
};
