const jwt = require("jsonwebtoken");
const { User } = require("../models/User");

async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash").lean();
    if (user && !user.isDeleted && user.status === "active" && (user.tokenVersion || 0) === (payload.tokenVersion || 0)) {
      req.user = user;
    }
  } catch (_err) {
    // ignore invalid tokens
  }

  next();
}

module.exports = { optionalAuth };
