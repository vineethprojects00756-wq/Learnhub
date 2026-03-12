const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  permissions: [{ type: String }],
}, { timestamps: true });

const Role = mongoose.model("Role", roleSchema);

module.exports = { Role };
