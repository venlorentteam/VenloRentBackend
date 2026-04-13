// models/Message.js
const mongoose = require("mongoose")

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
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    // Per-message read flag. Only the recipient's read state matters,
    // so a simple boolean is enough for a two-person conversation.
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

// Most common query: "give me all messages in this conversation, newest first"
messageSchema.index({ conversation: 1, createdAt: -1 })

module.exports = mongoose.model("Message", messageSchema, "messages")