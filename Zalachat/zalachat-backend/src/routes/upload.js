import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Cấu hình AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Kiểm tra biến môi trường
if (!process.env.AWS_S3_BUCKET_NAME) {
  console.error("Lỗi: AWS_S3_BUCKET_NAME không được cấu hình trong .env");
}

// Cấu hình Multer để lưu file tạm thời
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Giới hạn 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "audio/mpeg", // mp3
      "audio/wav", // wav
      "audio/ogg", // ogg
      "video/mp4", // mp4
      "video/avi", // avi
      "video/x-matroska", // mkv
      "video/webm", // webm
      "video/quicktime", // mov
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ file JPG, PNG, GIF, MP3, WAV, OGG, MP4, AVI, MKV, WEBM, MOV"), false);
    }
  },
});

// Middleware xử lý lỗi Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Lỗi Multer:", err);
    return res.status(400).json({ error: `Lỗi Multer: ${err.message}` });
  } else if (err) {
    console.error("Lỗi file filter:", err);
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Endpoint upload file
router.post("/", upload.single("file"), handleMulterError, async (req, res) => {
  try {
    console.log("Nhận yêu cầu upload:", {
      file: req.file ? req.file.originalname : "Không có file",
      mimetype: req.file ? req.file.mimetype : "N/A",
      size: req.file ? req.file.size : "N/A",
    });

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Không có file được gửi" });
    }

    const fileName = `${uuidv4()}-${file.originalname}`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    console.log("Cấu hình upload S3:", {
      Bucket: params.Bucket,
      Key: params.Key,
      ContentType: params.ContentType,
    });

    // Kiểm tra bucket tồn tại
    try {
      await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET_NAME }).promise();
      console.log("Bucket tồn tại:", process.env.AWS_S3_BUCKET_NAME);
    } catch (error) {
      console.error("Lỗi kiểm tra bucket:", {
        message: error.message,
        code: error.code,
      });
      return res.status(500).json({ error: `Bucket không tồn tại hoặc không truy cập được: ${error.message}` });
    }

    // Upload file lên S3
    const result = await s3.upload(params).promise();
    console.log("Upload S3 thành công:", result.Location);

    res.json({ fileUrl: result.Location });
  } catch (error) {
    console.error("Lỗi upload file:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: `Lỗi khi upload file: ${error.message}` });
  }
});

export default router;