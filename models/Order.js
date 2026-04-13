const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },
    // Business status of the order itself.
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    // Payment progress for P2P evidence tracking.
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending_proof", "paid", "failed", "refunded", "disputed"],
      default: "unpaid",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

orderSchema.index({ buyer: 1, status: 1, createdAt: -1 })
orderSchema.index({ seller: 1, status: 1, createdAt: -1 })

const Order = mongoose.model("Order", orderSchema, "orders")

module.exports = Order
