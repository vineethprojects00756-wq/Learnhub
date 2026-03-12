const express = require("express");
const { verifyAccessToken } = require("../middlewares/auth");
const userController = require("../controllers/user.controller");

const router = express.Router();

router.get("/me", verifyAccessToken, userController.getProfile);

module.exports = router;
