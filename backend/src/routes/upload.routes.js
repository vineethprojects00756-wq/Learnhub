const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { verifyAccessToken } = require("../middlewares/auth");
const { upload } = require("../controllers/upload.controller");

const router = express.Router();
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadMiddleware = multer({ dest: uploadDir });

router.post("/", verifyAccessToken, uploadMiddleware.single("file"), upload);

module.exports = router;
