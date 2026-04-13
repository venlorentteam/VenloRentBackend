const mongoose = require("mongoose")

// Generic comment model for both Property and Request threads.
// Use targetType + targetId so one collection can serve multiple feeds.
const commentSchema = new mongoose.Schema(
  {
    property:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // Optional parent for threaded replies.
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    // Like tracking for comments.
    likes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "hidden", "deleted"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
)

commentSchema.index({ property: 1, createdAt: -1 })

const Comment = mongoose.model("Comment", commentSchema, "comments")

module.exports = Comment
