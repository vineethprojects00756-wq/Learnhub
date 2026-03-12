const { ApiError } = require("../utils/apiError");
const { Role } = require("../models/Role");

function authorizeRoles(...allowed) {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return next(new ApiError(403, "Forbidden"));
    }
    return next();
  };
}

function authorizePermissions(...permissions) {
  return async (req, _res, next) => {
    const roleName = req.user?.role;
    if (!roleName) return next(new ApiError(403, "Forbidden"));

    const role = await Role.findOne({ name: roleName }).lean();
    if (!role) return next(new ApiError(403, "Forbidden"));

    const allowed = role.permissions || [];
    const ok = permissions.every((perm) => allowed.includes(perm));
    if (!ok) return next(new ApiError(403, "Forbidden"));

    return next();
  };
}

module.exports = { authorizeRoles, authorizePermissions };
