// models/Chat.js
const mongoose = require("mongoose")

const chatSchema = new mongoose.Schema(
  {
    // Exactly two participants — always stored in sorted order so the
    // unique index below prevents duplicate (A↔B) and (B↔A) chats.
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator: (arr) => arr.length === 2,
        message: "A chat must have exactly 2 participants",
      },
    },

    // Denormalised snapshot of the latest message so the inbox list never
    // needs a separate aggregation pipeline just to show a preview.
    lastMessage: {
      text: { type: String, default: "" },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      sentAt: { type: Date, default: null },
    },

    // Separate field used for fast "sort inbox by most recent" queries.
    lastMessageAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
)

// Ensures two users can only ever have one shared chat.
// The unique index works because participants are always sorted before insert.
chatSchema.index({ participants: 1 }, { unique: true })

module.exports = mongoose.model("Chat", chatSchema, "chats")