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
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "trialing", "past_due", "cancelled", "expired"],
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
    // provider: {
    //   type: String,
    //   default: "manual",
    //   trim: true,
    // },
    // providerReference: {
    //   type: String,
    //   trim: true,
    //   default: "",
    // },
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
