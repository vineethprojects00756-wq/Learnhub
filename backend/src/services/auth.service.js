const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { ApiError } = require("../utils/apiError");
const { User } = require("../models/User");
const { RefreshToken } = require("../models/RefreshToken");
const { LoginHistory } = require("../models/LoginHistory");
const { hashPassword, verifyPassword } = require("../utils/passwords");
const { issueTokens } = require("./token.service");

async function recordLogin(user, meta, success) {
  if (!user) return;
  await LoginHistory.create({
    user: user._id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    success,
  });
}

async function register({ name, email, password }, meta = {}) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, "Email already registered");
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash });

  return issueTokens(user, meta);
}

async function login({ email, password, twoFactorToken }, meta = {}) {
  const user = await User.findOne({ email });
  if (!user || user.isDeleted) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `User is ${user.status}`);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordLogin(user, meta, false);
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.twoFactorEnabled) {
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: twoFactorToken || "",
    });

    if (!verified) {
      await recordLogin(user, meta, false);
      throw new ApiError(401, "Invalid 2FA token");
    }
  }

  user.lastLoginAt = new Date();
  await user.save();
  await recordLogin(user, meta, true);

  return issueTokens(user, meta);
}

async function refresh(refreshToken, meta = {}) {
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required");
  }

  const stored = await RefreshToken.findOne({ token: refreshToken, revokedAt: null });
  if (!stored || stored.expiresAt < new Date()) {
    throw new ApiError(401, "Refresh token invalid");
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (_err) {
    throw new ApiError(401, "Refresh token invalid");
  }

  const user = await User.findById(stored.user);
  if (!user || user.isDeleted) {
    throw new ApiError(401, "User not found");
  }

  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
    throw new ApiError(401, "Token revoked");
  }

  // Rotate: revoke current token and issue a new pair
  stored.revokedAt = new Date();
  await stored.save();

  return issueTokens(user, meta);
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await RefreshToken.updateOne({ token: refreshToken }, { $set: { revokedAt: new Date() } });
}

async function setupTwoFactor(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const secret = speakeasy.generateSecret({ name: "LearnHub" });
  user.twoFactorSecret = secret.base32;
  user.twoFactorEnabled = false;
  await user.save();

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  return { secret: secret.base32, qrDataUrl };
}

async function enableTwoFactor(userId, token) {
  const user = await User.findById(userId);
  if (!user || !user.twoFactorSecret) throw new ApiError(404, "User not found");

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token,
  });

  if (!verified) throw new ApiError(400, "Invalid 2FA token");

  user.twoFactorEnabled = true;
  await user.save();
  return { enabled: true };
}

async function disableTwoFactor(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();
  return { enabled: false };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
};
