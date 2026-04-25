// config/cloudinary.js
const cloudinary = require("cloudinary").v2
const { CloudinaryStorage } = require("multer-storage-cloudinary")
const multer = require("multer")

// ===================================================================================
// Configure multipart handling and Cloudinary upload for avatar and kyc.
// ====================================================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})
// === Avatar upload (public, auto-cropped to face) ===
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         "avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 300, height: 300, crop: "fill", gravity: "face" }],
  },
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or WEBP files allowed"))
    }
    cb(null, true);
  },
})

// --- KYC document upload (private folder, no transformation) ---
const kycStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:         "kyc-documents",       // separate private folder
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    // Tell Cloudinary to store PDFs as raw files, images as images
    resource_type:  file.mimetype === "application/pdf" ? "raw" : "image",
    // Prefix filename with userId for easy lookup/audit
    public_id:      `${req.user.id}_${Date.now()}_${file.fieldname}`,
  }),
})

const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf", "image/jpg"]
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, or PDF files allowed"))
    }
    cb(null, true)
  },
})

const listingStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith("image/")
    const isVideo = file.mimetype.startsWith("video/")

    return {
      folder: "listing-media",
      resource_type: isVideo ? "video" : "image",  // ← explicit, never "auto"
      public_id: `${req.user.id}_${Date.now()}_${file.fieldname}`, // ← also changed originalname to fieldname to avoid special chars breaking the public_id

      ...(isImage && {
        transformation: [
          { width: 1600, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
        eager: [
          { width: 500, height: 500, crop: "fill", quality: "auto", fetch_format: "auto" },
        ],
        eager_async: true,
      }),

      ...(isVideo && {
        transformation: [
          { width: 1280, crop: "limit" },
          { quality: "auto" },
          { duration: 30 },
        ],
      }),
    }
  }
})

const listingUpload = multer({
  storage: listingStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/webp",
      "video/mp4", "video/quicktime",
    ]
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP, MP4, or MOV files allowed"))
    }
    cb(null, true)
  },
})

module.exports = { cloudinary, avatarUpload, kycUpload, listingUpload };