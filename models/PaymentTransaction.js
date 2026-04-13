const mongoose = require("mongoose")

const paymentTransactionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    payee: {
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
    method: {
      type: String,
      enum: ["bank_transfer", "cash", "card", "wallet", "other"],
      default: "bank_transfer",
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "proof_submitted",
        "confirmed",
        "rejected",
        "cancelled",
        "refunded",
        "disputed",
      ],
      default: "initiated",
      index: true,
    },
    reference: {
      type: String,
      trim: true,
      default: "",
    },
    proofUrl: {
      type: String,
      trim: true,
      default: "",
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
    failureReason: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

paymentTransactionSchema.index({ order: 1, status: 1, createdAt: -1 })
paymentTransactionSchema.index({ payer: 1, createdAt: -1 })
paymentTransactionSchema.index({ payee: 1, createdAt: -1 })

const PaymentTransaction = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema,
  "payment_transactions"
)

module.exports = PaymentTransaction
