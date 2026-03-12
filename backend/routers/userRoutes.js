const express = require("express");
const multer = require("multer");
const path = require("path");

const authMiddleware = require("../middlewares/authMiddleware");
const {
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
} = require("../controllers/teacherAdvancedController");
const {
  registerController,
  loginController,
  verifyTwoFactorLoginController,
  requestTwoFactorSetupController,
  confirmTwoFactorSetupController,
  disableTwoFactorController,
  postCourseController,
  getAllCoursesUserController,
  deleteCourseController,
  getCourseById,
  updateCourseController,
  getAllCoursesController,
  enrolledCourseController,
  sendCourseContentController,
  completeSectionController,
  sendAllCoursesUserController,
  getUserProfileController,
  updateUserProfileController,
  changePasswordController,
  searchFilterCoursesController,
  addReviewController,
  getReviewsController,
  updateReviewController,
  deleteReviewController,
  getUserNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  teacherDashboardController,
  studentDashboardController,
} = require("../controllers/userControllers");
const {
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
} = require("../controllers/studentAdvancedController");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + fileExtension);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, callback) {
    var ext = path.extname(file.originalname);
    if (ext !== ".mp4") {
      return callback(new Error("Only .mp4 videos are allowed"));
    }
    callback(null, true);
  }
});

const imageUpload = multer({
  storage,
  fileFilter: function (req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return callback(new Error("Only image files are allowed"));
    }
    callback(null, true);
  },
});

const courseAssetUpload = multer({
  storage,
  fileFilter: function (req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".mp4", ".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return callback(new Error("Only mp4/pdf/image files are allowed"));
    }
    callback(null, true);
  },
});

router.post("/register", registerController);

router.post("/login", loginController);
router.post("/login/verify-2fa", verifyTwoFactorLoginController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

router.post(
  "/addcourse",
  authMiddleware,
  // upload.single('C_image'),
  upload.array("S_content"),
  postCourseController
);

router.get("/getallcourses", getAllCoursesController);

router.get(
  "/getallcoursesteacher",
  authMiddleware,
  getAllCoursesUserController
);

router.delete(
  "/deletecourse/:courseid",
  authMiddleware,
  deleteCourseController
);

router.get(
  "/getcourse/:courseid",
  authMiddleware,
  getCourseById
);

router.put(
  "/updatecourse/:courseid",
  authMiddleware,
  upload.array("S_content"),
  updateCourseController
);

router.post(
  "/enrolledcourse/:courseid",
  authMiddleware,
  enrolledCourseController
);

router.get(
  "/coursecontent/:courseid",
  authMiddleware,
  sendCourseContentController
);

router.post("/completemodule", authMiddleware, completeSectionController);

router.get("/getallcoursesuser", authMiddleware, sendAllCoursesUserController);

router.post("/get-profile", authMiddleware, getUserProfileController);

router.put("/update-profile", authMiddleware, imageUpload.single("profileImage"), updateUserProfileController);

router.put("/change-password", authMiddleware, changePasswordController);

router.post("/2fa/request-setup", authMiddleware, requestTwoFactorSetupController);
router.post("/2fa/confirm-setup", authMiddleware, confirmTwoFactorSetupController);
router.post("/2fa/disable", authMiddleware, disableTwoFactorController);

router.get("/search-courses", searchFilterCoursesController);

// Review Routes
router.post("/add-review", authMiddleware, addReviewController);

router.get("/reviews/:courseId", getReviewsController);

router.put("/update-review/:reviewId", authMiddleware, updateReviewController);

router.delete("/delete-review/:reviewId", authMiddleware, deleteReviewController);

router.get("/notifications", authMiddleware, getUserNotificationsController);

router.put("/notifications/:notificationId/read", authMiddleware, markNotificationReadController);

router.put("/notifications/read-all", authMiddleware, markAllNotificationsReadController);

router.get("/teacher/dashboard", authMiddleware, teacherDashboardController);

router.get("/student/dashboard", authMiddleware, studentDashboardController);
router.get("/student/summary", authMiddleware, getStudentSummaryController);
router.patch("/student/reminders", authMiddleware, updateReminderSettingsController);
router.get("/student/leaderboard", authMiddleware, getStudentLeaderboardController);

router.get("/courses/:courseId/preview", getPreviewLessonsController);
router.get("/student/wishlist", authMiddleware, getWishlistController);
router.get("/student/wishlist/course-ids", authMiddleware, getWishlistCourseIdsController);
router.post("/student/wishlist/:courseId/toggle", authMiddleware, toggleWishlistController);

router.patch("/student/courses/:courseId/continue", authMiddleware, updateContinueLearningController);
router.get("/student/courses/:courseId/progress", authMiddleware, getCourseProgressController);
router.post("/student/courses/:courseId/quizzes/:quizIndex/attempt", authMiddleware, submitQuizAttemptController);
router.get("/student/courses/:courseId/quizzes/scores", authMiddleware, getQuizScoresController);
router.get("/student/courses/:courseId/assignments/grades", authMiddleware, getAssignmentGradesController);
router.get("/student/courses/:courseId/certificate", authMiddleware, getCertificateController);

router.post("/student/messages/:teacherId", authMiddleware, sendStudentMessageController);
router.get("/student/messages/:teacherId", authMiddleware, getStudentMessageThreadController);
router.post("/student/report-content", authMiddleware, reportContentController);

router.put("/teacher/profile", authMiddleware, imageUpload.single("profileImage"), updateTeacherProfileAdvancedController);
router.get("/teacher/advanced/dashboard", authMiddleware, teacherAdvancedDashboardController);
router.post("/teacher/courses", authMiddleware, createCourseAdvancedController);
router.put("/teacher/courses/:courseId", authMiddleware, updateCourseAdvancedController);
router.delete("/teacher/courses/:courseId", authMiddleware, deleteCourseAdvancedController);
router.patch("/teacher/courses/:courseId/autosave", authMiddleware, autosaveDraftController);
router.patch("/teacher/courses/:courseId/publish-state", authMiddleware, setPublishStateController);
router.get("/teacher/courses/:courseId/versions", authMiddleware, listCourseVersionsController);
router.post(
  "/teacher/courses/:courseId/assets",
  authMiddleware,
  courseAssetUpload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "lessonVideos", maxCount: 20 },
    { name: "pdfFiles", maxCount: 20 },
  ]),
  uploadCourseAssetsController
);

router.post("/teacher/assignments", authMiddleware, createAssignmentController);
router.get("/teacher/assignments", authMiddleware, listTeacherAssignmentsController);
router.get("/teacher/assignments/:assignmentId/submissions", authMiddleware, listAssignmentSubmissionsController);
router.patch("/teacher/submissions/:submissionId/grade", authMiddleware, gradeSubmissionController);
router.post("/student/assignments/:assignmentId/submit", authMiddleware, submitAssignmentController);

router.get("/teacher/students", authMiddleware, getEnrolledStudentsController);
router.get("/teacher/students/export", authMiddleware, exportPerformanceController);

router.post("/teacher/messages/direct", authMiddleware, sendDirectMessageController);
router.get("/teacher/messages/private", authMiddleware, getPrivateMessagesController);
router.post("/teacher/messages/bulk", authMiddleware, sendBulkMessageController);
router.post("/teacher/announcements", authMiddleware, createAnnouncementController);

router.get("/courses/:courseId/discussions", authMiddleware, listDiscussionMessagesController);
router.post("/courses/:courseId/discussions", authMiddleware, postDiscussionMessageController);

router.get("/teacher/earnings", authMiddleware, teacherEarningsOverviewController);
router.post("/teacher/withdrawals", authMiddleware, createWithdrawalRequestController);
router.get("/teacher/performance-stats", authMiddleware, teacherPerformanceStatsController);

module.exports = router;
