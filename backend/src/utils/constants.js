const roles = ["admin", "instructor", "student"];

const tokenTtl = {
  access: "15m",
  refresh: "30d",
};

module.exports = { roles, tokenTtl };
