const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { verifyAccessToken } = require("../middlewares/auth");
const { authorizeRoles } = require("../middlewares/rbac");
const adminController = require("../controllers/admin.controller");

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

router.use(verifyAccessToken, authorizeRoles("admin"));

// Auth stats
router.get("/stats", adminController.getAdminStats);

// User management
router.post("/users", adminController.createUser);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);
router.patch("/users/:id/soft-delete", adminController.softDeleteUser);
router.patch("/users/:id/restore", adminController.restoreUser);
router.patch("/users/:id/suspend", adminController.suspendUser);
router.patch("/users/:id/ban", adminController.banUser);
router.patch("/users/:id/role", adminController.assignRole);
router.post("/users/:id/reset-password", adminController.resetPassword);
router.post("/users/:id/force-logout", adminController.forceLogout);
router.post("/users/bulk-upload", upload.single("file"), adminController.bulkUploadUsers);
router.get("/users/analytics", adminController.getUserAnalytics);
router.get("/users/:id/activity", adminController.getUserActivity);
router.get("/users/:id/login-history", adminController.getLoginHistory);

// Course management
router.patch("/courses/:id/approve", adminController.approveCourse);
router.patch("/courses/:id/archive", adminController.archiveCourse);
router.patch("/courses/:id/feature", adminController.featureCourse);
router.patch("/courses/:id/categories", adminController.categorizeCourse);
router.patch("/courses/:id/pricing", adminController.updatePricing);
router.put("/courses/:id", adminController.updateCourse);
router.delete("/courses/:id", adminController.deleteCourse);

// Analytics
router.get("/analytics/platform", adminController.platformAnalytics);
router.get("/analytics/revenue", adminController.revenueAnalytics);

// Financial controls
router.get("/transactions", adminController.listTransactions);
router.get("/payment-logs", adminController.listPaymentLogs);
router.patch("/transactions/:id/refund", adminController.approveRefund);
router.get("/withdrawals", adminController.listWithdrawals);
router.patch("/withdrawals/:id/approve", adminController.approveWithdrawal);
router.patch("/commission", adminController.setCommission);

// Platform settings
router.post("/categories", adminController.createCategory);
router.put("/categories/:id", adminController.updateCategory);
router.delete("/categories/:id", adminController.deleteCategory);
router.post("/tags", adminController.createTag);
router.put("/tags/:id", adminController.updateTag);
router.delete("/tags/:id", adminController.deleteTag);
router.patch("/settings/maintenance", adminController.setMaintenance);
router.patch("/settings/discount", adminController.setGlobalDiscount);
router.patch("/features/:key", adminController.setFeatureFlag);
router.post("/announcements", adminController.createAnnouncement);
router.post("/notifications", adminController.createNotification);

// Security & moderation
router.get("/reports", adminController.listReports);
router.patch("/reports/:id/resolve", adminController.resolveReport);
router.patch("/comments/:id/remove", adminController.removeComment);
router.patch("/block-user/:id", adminController.blockUser);
router.get("/logs/system", adminController.systemLogs);
router.get("/api-usage", adminController.apiUsage);

module.exports = router;
