const { asyncHandler } = require("../utils/asyncHandler");
const { uploadFile } = require("../services/storage.service");

const upload = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const result = await uploadFile(req.file);
  res.json(result);
});

module.exports = { upload };
