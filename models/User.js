const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

// This schema defines what a User document must look like in MongoDB.
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 50,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 30,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
    },
    bio: {
      type: String,
      maxlength: 100,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    // Password comes in plain text but is hashed in the pre-save hook below.
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    country: {
      type: String,
      trim: true,
      default: "Nigeria",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
      maxlength: 6,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ['agent', 'regular'],
      default: 'regular',
      required: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free',
    },
    // KYC summary fields live on the user to make gating simple (UI/authorization).
    // Detailed KYC records live in the KycSubmission collection.
    kycStatus: {
      type: String,
      enum: ['unsubmitted', 'submitted', 'in_review', 'verified', 'rejected'],
      default: 'unsubmitted',
    },
    // Points to the most recent KYC submission (optional).
    kycCurrentSubmission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KycSubmission",
      default: null,
    },
    // Timestamp of when the user was verified (if applicable).
    kycVerifiedAt: {
      type: Date,
      default: null,
    }
  },
  {
    // Automatically adds createdAt and updatedAt fields.
    timestamps: true,
  }
)

// Hash password before saving a user document.
// `isModified("password")` prevents re-hashing an already-hashed password.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const saltRounds = 10
    this.password = await bcrypt.hash(this.password, saltRounds)
    next()
  } catch (error) {
    next(error)
  }
})

// Helper for login: compares plain text password with stored hash.
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password)
}

const User = mongoose.model("User", userSchema, "users")//First=> Model Name, Second=>Schema, Third=>Collection Name (optional, defaults to pluralized model name)

module.exports = User
