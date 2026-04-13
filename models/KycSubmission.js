const mongoose = require("mongoose")

// Sub-schema for uploaded document metadata.
// We intentionally store metadata only (name, mime, size) and not raw file bytes in MongoDB.
const documentMetaSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true, trim: true },
    mimeType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "application/pdf"],
    },
    size: { type: Number, required: true, min: 1 },
    // Cloudinary metadata so the frontend can display or request the file.
    url: { type: String, default: "", trim: true },
    publicId: { type: String, default: "", trim: true },
    resourceType: { type: String, default: "", trim: true },
  },
  { _id: false }
)

// Dedicated KYC record:
// - Keeps verification workflow data separate from auth/profile concerns in User.
// - Supports auditing and future provider webhook updates without bloating User.
const kycSubmissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    officeAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    yearsExperience: {
      type: String,
      required: true,
      enum: ["0-1", "1-3", "3-5", "5-10", "10+"],
    },
    /* idDocument: { type: documentMetaSchema },*/ // For simplicity, we're only requiring address proof in this iteration.
    addressProof: { type: documentMetaSchema, required: true, },
    status: {
      type: String,
      enum: ["submitted", "in_review", "verified", "rejected"],
      default: "submitted",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    diditUrl: {
      type: String,
      default: "",
      trim: true,
    },
    diditSessionId: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

const KycSubmission = mongoose.model("KycSubmission", kycSubmissionSchema, "kyc_submissions")

module.exports = KycSubmission
