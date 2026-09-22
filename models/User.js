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
    pendingEmail: {
      type: String, 
      default: null 
    },
    pendingEmailOtp: { 
      type: String, 
      default: null 
    },
    pendingEmailOtpExpires: { 
      type: Date, 
      default: null 
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
    otpAttempts: { 
      type: Number, 
      default: 0 
    },
    otpLockedUntil: { 
      type: Date, 
      default: null 
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
    status: {
      type: String,
      enum: ['active', 'suspended', 'deactivated'],
      default: "active",
      index: true,
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
    },
    // Bachs subscription management fields.
    bachsCustomerId: { 
      type: String, 
      default: null 
    },
    subscription: {
      id: { 
        type: String, 
        default: null 
      }, 
      status: { 
        type: String, 
        default: null 
      },
      productId: { 
        type: String, 
        default: null 
      },
      currentPeriodEnd: { 
        type: Date, 
        default: null 
      },
    },
    isSuspended: { 
      type: Boolean, 
      default: false 
    },
    suspendedUntil: { 
      type: Date, 
      default: null 
    },
    suspensionReason: { 
      type: String, 
      default: "" 
    },
    moderationHistory: [
      { 
        action: String, 
        reason: String, 
        by: mongoose.Schema.Types.ObjectId, 
        at: Date 
      }
    ],
    // Users this account has blocked. Blocking is enforced server-side so
    // blocked chats cannot be re-opened or used to send new messages.
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    onboarding: {
      completedAt: Date,
      intent: String,
      locations: [String],
      otherLocation: String,
      category: String,
      houseTypes: [String],
      moveIn: String,
    },
    // Agent payout details are stored separately from the public profile so
    // sellers can update bank information later without re-registering.
    payoutDetails: {
      bankName: {
        type: String,
        trim: true,
        default: "",
      },
      accountName: {
        type: String,
        trim: true,
        default: "",
      },
      accountNumber: {
        type: String,
        trim: true,
        default: "",
      },
      bankCode: {
        type: String,
        trim: true,
        default: "",
      },
      payoutMethod: {
        type: String,
        enum: ["bank_transfer", "wallet", "other"],
        default: "bank_transfer",
      },
      verified: {
        type: Boolean,
        default: false,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
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

const User = mongoose.model("User", userSchema, "users")

module.exports = User
