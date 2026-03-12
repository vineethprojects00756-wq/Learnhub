const jwt = require("jsonwebtoken");
const userSchema = require("../schemas/userModel");

module.exports = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers["authorization"];
    if (!authorizationHeader) {
      return res
        .status(401)
        .send({ message: "Authorization header missing", success: false });
    }

    const token = authorizationHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_KEY, async (err, decode) => {
      if (err) {
        return res
          .status(401)
          .send({ message: "Token is not valid", success: false });
      }

      try {
        const tokenRole = (decode.role || "").toLowerCase();
        if (tokenRole !== "admin") {
          const user = await userSchema.findById(decode.id).select("type");
          const dbRole = (user?.type || "").toLowerCase();
          if (dbRole !== "admin") {
            return res
              .status(403)
              .send({ message: "Admin access required", success: false });
          }
        }

        req.body.userId = decode.id;
        req.user = decode;
        next();
      } catch (innerError) {
        console.error(innerError);
        return res.status(500).send({ message: "Internal server error", success: false });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal server error", success: false });
  }
};
