const express = require("express");
const adminMiddleware = require("../middlewares/adminMiddleware");
const {
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
} = require("../controllers/adminController");

const router = express.Router();

// Admin authentication
router.post("/login", adminLoginController);
router.post("/logout", adminMiddleware, adminLogoutController);
router.post("/refresh-token", adminRefreshTokenController);
router.post("/2fa", adminMiddleware, admin2FAController);

// Admin user and course management
router.get("/getallusers", adminMiddleware, getAllUsersController);
router.get("/getallcourses", adminMiddleware, getAllCoursesController);
router.post("/create-teacher", adminMiddleware, createTeacherController);
router.post("/create-student", adminMiddleware, createStudentController);
router.put("/update-user/:userid", adminMiddleware, updateUserController);
router.put("/suspend-user/:userid", adminMiddleware, suspendUserController);
router.put("/assign-role", adminMiddleware, assignRoleController);
router.put("/reset-password", adminMiddleware, resetPasswordController);
router.post("/bulk-upload-users", adminMiddleware, bulkUploadUsersController);
router.delete("/soft-delete-user/:userid", adminMiddleware, softDeleteUserController);
router.put("/restore-user/:userid", adminMiddleware, restoreUserController);
router.get("/user-activity-logs/:userid", adminMiddleware, userActivityLogsController);
router.post("/force-logout-user", adminMiddleware, forceLogoutUserController);
router.get("/user-login-history/:userid", adminMiddleware, userLoginHistoryController);
router.get("/user-analytics", adminMiddleware, userAnalyticsController);
router.delete("/deletecourse/:courseid", adminMiddleware, deleteCourseController);
router.delete("/deleteuser/:userid", adminMiddleware, deleteUserController);

// Admin security and moderation
router.get("/view-reported-content", adminMiddleware, viewReportedContentController);
router.delete("/remove-inappropriate-comments", adminMiddleware, removeInappropriateCommentsController);
router.put("/block-abusive-user", adminMiddleware, blockAbusiveUserController);
router.get("/view-system-logs", adminMiddleware, viewSystemLogsController);
router.get("/api-usage-monitoring", adminMiddleware, apiUsageMonitoringController);

// Admin platform settings
router.post("/manage-tags", adminMiddleware, manageTagsController);
router.post("/enable-disable-feature", adminMiddleware, enableDisableFeatureController);
router.post("/maintenance-mode", adminMiddleware, maintenanceModeController);
router.post("/announcement-system", adminMiddleware, announcementSystemController);
router.post("/global-notifications", adminMiddleware, globalNotificationsController);
router.get("/platform-settings", adminMiddleware, getPlatformSettingsController);

// Admin financial controls
router.post("/commission-management", adminMiddleware, commissionManagementController);
router.post("/withdraw-approval", adminMiddleware, withdrawApprovalController);
router.post("/refund-approval", adminMiddleware, refundApprovalController);
router.get("/payment-gateway-logs", adminMiddleware, paymentGatewayLogsController);
router.get("/transaction-reports", adminMiddleware, transactionReportsController);

// Admin platform analytics
router.get("/total-users", adminMiddleware, totalUsersController);
router.get("/active-users", adminMiddleware, activeUsersController);
router.get("/revenue-reports", adminMiddleware, revenueReportsController);
router.get("/course-enrollment-trends", adminMiddleware, courseEnrollmentTrendsController);
router.get("/teacher-performance-stats", adminMiddleware, teacherPerformanceStatsController);
router.get("/student-performance-stats", adminMiddleware, studentPerformanceStatsController);
router.get("/real-time-dashboard", adminMiddleware, realTimeDashboardController);

// Admin course management
router.put("/approve-course/:courseid", adminMiddleware, approveCourseController);
router.put("/edit-course/:courseid", adminMiddleware, editCourseController);
router.put("/feature-course/:courseid", adminMiddleware, featureCourseController);
router.put("/categorize-course", adminMiddleware, categorizeCourseController);
router.put("/archive-course/:courseid", adminMiddleware, archiveCourseController);
router.put("/control-pricing", adminMiddleware, controlPricingController);
router.put("/apply-global-discount", adminMiddleware, applyGlobalDiscountController);

module.exports = router;
