const { asyncHandler } = require("../utils/asyncHandler");
const { User } = require("../models/User");

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id || req.user.id).select("-passwordHash");
  res.json({ user });
});

module.exports = { getProfile };
