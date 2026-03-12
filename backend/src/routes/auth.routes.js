const express = require("express");
const { validate } = require("../middlewares/validate");
const { verifyAccessToken } = require("../middlewares/auth");
const { registerSchema, loginSchema, refreshSchema, twoFactorSchema } = require("../validation/auth.validation");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", authController.logout);

router.post("/2fa/setup", verifyAccessToken, authController.setupTwoFactor);
router.post("/2fa/enable", verifyAccessToken, validate(twoFactorSchema), authController.enableTwoFactor);
router.post("/2fa/disable", verifyAccessToken, authController.disableTwoFactor);

module.exports = router;
