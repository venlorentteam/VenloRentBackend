const mongoose = require("mongoose")

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["user", "property", "request", "message"],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: [
        "spam",
        "fraud",
        "harassment",
        "fake_listing",
        "inappropriate_content",
        "off_platform_contact",
        "abusive_language",
        "other",
      ],
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "in_review", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },
  },
  { timestamps: true }
)

reportSchema.index({ targetType: 1, targetId: 1, status: 1, createdAt: -1 })

const Report = mongoose.model("Report", reportSchema, "reports")

module.exports = Report
