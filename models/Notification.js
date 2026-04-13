// models/Notification.js
const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    // Who receives this notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Who triggered it — null for system notifications
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // What kind of event this is
    type: {
      type: String,
      enum: [
        "like_property", // someone liked your listing
        "like_request",  // someone liked your request
        "comment",  // someone commented on your listing
        "discussion", // someone commented on your request
        "bookmark", // someone bookmarked your listing/request
        "response", // an agent responded to your request
        "order_placed", // a buyer placed an order on your listing
        "order_accepted", // seller accepted your order
        "order_cancelled", // an order was cancelled
        "kyc_update", // KYC status changed
        "follow", // someone followed you
        "system", // platform-level message
      ],
      required: true,
      index: true,
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // What content was acted on (polymorphic)
    targetType: {
      type: String,
      enum: ["Property", "Request", "Order", "Comment", "Discussion"],
      default: null,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Denormalised snapshot so the UI renders without extra populates.
    // Filled at creation time from the target document.
    snapshot: {
      title: { type: String, default: "" },  // property title or request description
      image: { type: String, default: "" },  // first media URL
      price: { type: String, default: "" },  // formatted e.g. "₦700,000"
      location: { type: String, default: "" },
    },
  },
  { timestamps: true }
)

// Most common query: all notifications for a user, newest first
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 })

module.exports = mongoose.model("Notification", notificationSchema, "notifications")