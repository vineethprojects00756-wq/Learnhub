const { Settings } = require("../models/Settings");

async function maintenanceMode(req, res, next) {
  const settings = await Settings.findOne().lean();
  if (!settings?.maintenanceMode) return next();

  // Allow admins to bypass if authenticated
  if (req.user?.role === "admin") return next();

  return res.status(503).json({ message: "Platform in maintenance mode" });
}

module.exports = { maintenanceMode };
