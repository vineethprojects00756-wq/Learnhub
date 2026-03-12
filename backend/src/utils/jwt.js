const jwt = require("jsonwebtoken");
const { tokenTtl } = require("./constants");

function signAccessToken(userId, claims = {}) {
  return jwt.sign(
    { ...claims },
    process.env.JWT_ACCESS_SECRET,
    { subject: String(userId), expiresIn: tokenTtl.access }
  );
}

function signRefreshToken(userId, claims = {}) {
  return jwt.sign(
    { ...claims },
    process.env.JWT_REFRESH_SECRET,
    { subject: String(userId), expiresIn: tokenTtl.refresh }
  );
}

module.exports = { signAccessToken, signRefreshToken };
