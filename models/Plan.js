const mongoose = require("mongoose")

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },
    interval: {
      type: String,
      enum: ["monthly", "yearly", "one_time"],
      default: "monthly",
    },
    features: {
      type: [String],
      default: [],
    },
    limits: {
      maxListings: {
        type: Number,
        default: 1,
        min: 0,
      },
      boostCredits: {
        type: Number,
        default: 0,
        min: 0,
      },
      prioritySupport: {
        type: Boolean,
        default: false,
      },
      verifiedBadge: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

const Plan = mongoose.model("Plan", planSchema, "plans")

module.exports = Plan
