const mongoose = require("mongoose")

// Agent responses to a request (offers).
// Stored separately so responses can grow without bloating Request docs.
const requestResponseSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
      required: true,
      index: true,
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
      maxlength: 2000,
    },
    // Optional listing snapshot attached at response time.
    listingSnapshot: {
      listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
      title: { type: String, trim: true },
      price: { type: String, trim: true, default: "" },
      location: { type: String, trim: true, default: "" },
      image: { type: String, trim: true, default: "" },
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

requestResponseSchema.index({ request: 1, createdAt: -1 })

const RequestResponse = mongoose.model("RequestResponse", requestResponseSchema, "request_responses")

module.exports = RequestResponse
