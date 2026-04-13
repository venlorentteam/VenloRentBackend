const mongoose = require("mongoose")

// Follow relationship between two users.
const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

// Prevent duplicate follows.
followSchema.index({ follower: 1, following: 1 }, { unique: true })

const Follow = mongoose.model("Follow", followSchema, "follows")

module.exports = Follow
