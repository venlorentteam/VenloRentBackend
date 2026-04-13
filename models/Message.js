const mongoose = require("mongoose")

const readBySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    attachments: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["sent", "edited", "deleted"],
      default: "sent",
      index: true,
    },
    readBy: {
      type: [readBySchema],
      default: [],
    },
  },
  { timestamps: true }
)

// Ensure each message has content or at least one attachment.
messageSchema.path("body").validate(function validateBody(value) {
  return Boolean((value && value.trim()) || (this.attachments && this.attachments.length))
}, "Message must contain body text or attachment")

messageSchema.index({ conversation: 1, createdAt: 1 })

const Message = mongoose.model("Message", messageSchema, "messages")

module.exports = Message
