const jwt = require("jsonwebtoken");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/apiError");
const { User } = require("../models/User");

const verifyAccessToken = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Missing access token");
  }

  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

  const user = await User.findById(payload.sub).select("-passwordHash").lean();
  if (!user || user.isDeleted) {
    throw new ApiError(401, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `User is ${user.status}`);
  }

  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new ApiError(401, "Token revoked");
  }

  req.user = user;
  next();
});

module.exports = { verifyAccessToken };
