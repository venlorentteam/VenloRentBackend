// models/SubscriptionPayment.js
const mongoose = require("mongoose")

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
      index: true,
    },
    bachsCustomerId: { 
      type: String, 
      required: true, 
      index: true 
    },
    bachsSubscriptionId: { 
      type: String, 
      required: true, 
      index: true 
    },
    bachsEventId: { 
      type: String, 
      required: true, 
      unique: true 
    }, // guards against double-counting a retried webhook
    amount: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    currency: { 
      type: String, 
      default: "NGN", 
      uppercase: true, 
      trim: true 
    },
    plan: { 
      type: String, 
      enum: ["pro", "premium"], 
      required: true 
    },
    status: { 
      type: String, 
      trim: true 
    }, 
  },
  { timestamps: true }
)

subscriptionPaymentSchema.index({ createdAt: -1 })

module.exports = mongoose.model("SubscriptionPayment", subscriptionPaymentSchema, "subscription_payments")