const mongoose = require("mongoose")

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["free", "pro", "premium"],
      required: true,
      index: true,
    },
    bachsSubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bachsCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    bachsProductId: {
      type: String,
      required: true,
    },
    providerStatus: {
      type: String,
      trim: true, // raw string from Bachs — not enum-constrained, vocabulary unconfirmed
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

subscriptionSchema.index({ user: 1, status: 1, currentPeriodEnd: -1 })

const Subscription = mongoose.model("Subscription", subscriptionSchema, "subscriptions")

module.exports = Subscription