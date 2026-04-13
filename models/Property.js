//Call mongoose  
const mongoose = require('mongoose')

const propertySchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: 1000,
        },
        listing_type: {
            type: String,
            required: true,
            enum: ["rent", "sale", "shortlet"],
        },
        property_type: {
            type: String,
            required: true,
            enum: ["apartment", "flat", "self-con", "duplex", "shop", "conference-room"],
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
        location: {
            town: { type: String, trim: true, default: "" },
            state: { type: String, trim: true, default: "" }
        },
        media: [
            {
                url: { type: String, required: true, trim: true },
                publicId: { type: String, required: true, trim: true },
                originalName: { type: String, trim: true },
                mimeType: { type: String, trim: true },
                size: { type: Number, min: 0 },
                resourceType: { type: String, trim: true }, // image or video
            }
        ],
        status: {
            type: String,
            enum: ["available", "rented", "archived", "reserved"],
            default: "available",
            index: true,
        },
        features: {
            type: [String],
            default: [],
        },
        commission:{
            type: Number,
            min: 0,
        },
        // Moderation of properties by agents
        moderationStatus: {
        type: String,
            enum: ["pending", "approved", "flagged", "rejected"],
            default: "approved",
            index: true,
        },
        moderationReasons: {
            type: [String],
            default: [],
        },
        // Like tracking (kept in-model for quick UI checks).
        likes: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "User",
            default: [],
        },
        likeCount: {
            type: Number,
            default: 0,
        },
        reportsCount: {
            type: Number,
            default: 0,
        }
        ,
        // Comment count for fast feed display (avoids counting comments on every read).
        commentCount: {
            type: Number,
            default: 0,
            min: 0,
        }
    },
    { timestamps: true }
)
//Create a compound index to optimize queries filtering by status, moderationStatus, and sorting by createdAt
propertySchema.index({ status: 1, moderationStatus: 1, createdAt: -1 })

// Create the model from the schema and export it
const Property = mongoose.model("Property", propertySchema, "properties")
module.exports = Property
