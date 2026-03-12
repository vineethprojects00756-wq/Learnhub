const { signAccessToken, signRefreshToken } = require("../utils/jwt");
const { RefreshToken } = require("../models/RefreshToken");

async function issueTokens(user, meta = {}) {
  const claims = { role: user.role, tokenVersion: user.tokenVersion || 0 };
  const accessToken = signAccessToken(user._id, claims);
  const refreshToken = signRefreshToken(user._id, claims);

  await RefreshToken.create({
    user: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { accessToken, refreshToken };
}

module.exports = { issueTokens };
