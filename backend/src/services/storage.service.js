const fs = require("fs/promises");
const path = require("path");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { initCloudinary } = require("../config/cloudinary");
const { initS3 } = require("../config/s3");

async function uploadToS3(file) {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }

  const s3 = initS3();
  const key = `learnhub/${Date.now()}-${file.originalname}`;
  const body = await fs.readFile(file.path);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: file.mimetype,
  }));

  const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return { url, provider: "s3", key };
}

async function uploadToCloudinary(file) {
  const cloudinary = initCloudinary();
  const uploadResult = await cloudinary.uploader.upload(file.path, {
    folder: "learnhub",
    resource_type: "auto",
  });

  return { url: uploadResult.secure_url, provider: "cloudinary", publicId: uploadResult.public_id };
}

async function uploadFile(file) {
  const provider = process.env.STORAGE_PROVIDER || "cloudinary";
  try {
    if (provider === "s3") {
      return await uploadToS3(file);
    }

    return await uploadToCloudinary(file);
  } finally {
    // Best-effort cleanup of temp file
    if (file?.path) {
      await fs.unlink(file.path).catch(() => {});
    }
  }
}

module.exports = { uploadFile };
