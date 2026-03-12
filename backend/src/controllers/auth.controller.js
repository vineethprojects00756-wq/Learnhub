const { asyncHandler } = require("../utils/asyncHandler");
const authService = require("../services/auth.service");

function getMeta(req) {
  return {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  };
}

function setRefreshCookie(res, token) {
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: Boolean(process.env.COOKIE_SECURE) || process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    maxAge,
  });
}

const register = asyncHandler(async (req, res) => {
  const tokens = await authService.register(req.body, getMeta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json(tokens);
});

const login = asyncHandler(async (req, res) => {
  const tokens = await authService.login(req.body, getMeta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  const tokens = await authService.refresh(token, getMeta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json(tokens);
});

const logout = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  await authService.logout(token);
  res.clearCookie("refreshToken");
  res.status(204).send();
});

const setupTwoFactor = asyncHandler(async (req, res) => {
  const result = await authService.setupTwoFactor(req.user._id || req.user.id);
  res.json(result);
});

const enableTwoFactor = asyncHandler(async (req, res) => {
  const result = await authService.enableTwoFactor(req.user._id || req.user.id, req.body.token);
  res.json(result);
});

const disableTwoFactor = asyncHandler(async (req, res) => {
  const result = await authService.disableTwoFactor(req.user._id || req.user.id);
  res.json(result);
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
};
