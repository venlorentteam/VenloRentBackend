const mongoose = require("mongoose")

const bookmarkSchema = new mongoose.Schema(
  {
    // User who saved the item.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Polymorphic target (Property / Request / Comment).
    targetType: {
      type: String,
      enum: ["Property", "Request"],
      required: true,
      index: true,
    },
    // The document id for the chosen targetType.
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType",
      index: true,
    },
  },
  { timestamps: true }
)

// Prevent duplicate bookmarks for the same user + target.
bookmarkSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true })

const Bookmark = mongoose.model("Bookmark", bookmarkSchema, "bookmarks")

module.exports = Bookmark
