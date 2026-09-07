const mongoose = require("mongoose")

const requestSchema = new mongoose.Schema(
  {
    // User that created the request.
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Core request fields used in the feed UI.
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    // Structured location (matches CreateList for consistent filtering).
    location: {
      town: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
    },
    budget: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["open", "closed", "expired", "removed"],
      default: "open",
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Like tracking (kept in-model for quick UI checks).
    likes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    // Cached counts for feed display.
    responseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discussionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    moderationStatus: {
      type: String,
      enum: ["approved", "flagged", "rejected"],
      default: "approved",
      index: true,
    },
    moderationReasons: {
      type: [String],
      default: [],
    },
    reportsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
)

const Request = mongoose.model("Request", requestSchema, "requests")

module.exports = Request
