const express = require("express")
// const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const axios = require("axios")
const multer = require("multer")
const User = require("./models/User")
const Property = require("./models/Property")
const Request = require("./models/Request")
const Bookmark = require("./models/Bookmark")
const Comment = require("./models/Comment")
const RequestResponse = require("./models/RequestResponse")
const Discussion = require("./models/Discussion")
const KycSubmission = require("./models/KycSubmission")
const Order = require("./models/Order")
const Follow = require("./models/Follow")
const Report = require("./models/Report")
const Conversation = require("./models/Conversation")
const Message = require("./models/Messages")
const authMiddleware = require("./middleware/authMiddleware") //Token decrypter and userID extractor 
const Notification = require("./models/Notification")

// Helpers
const notify = require("./utility/notify")
const { getResendClient, renderOtpEmail, renderWelcomeEmail, renderPasswordResetEmail, renderPasswordChangedEmail } = require("./emails")
const { loginLimiter, otpLimiter, verifyLimiter, registerLimiter, passwordResetLimiter } = require('./utility/rateLimiters')
const { cloudinary, avatarUpload, kycUpload, listingUpload } = require("./utility/cloudinary");

require("dotenv").config()
const router = express.Router()

// Snapshot Builder for Notifications
const propertySnapshot = (p) => ({
  title:    p.title || "",
  image:    p.media?.[0]?.url || "",
  price:    p.amount ? `₦${Number(p.amount).toLocaleString("en-NG")}` : "",
  location: [p.location?.town, p.location?.state].filter(Boolean).join(", "),
})
const requestSnapshot = (r) => ({
  title:    r.description?.slice(0, 60) || "",
  image:    "",
  price:    r.budget || "",
  location: [r.location?.town, r.location?.state].filter(Boolean).join(", "),
})

// Dedicated upload middleware so multer errors return predictable JSON messages.
const kycUploadMiddleware = (req, res, next) => {
  const handler = kycUpload.fields([{ name: "addressProof", maxCount: 1 }])

  handler(req, res, (err) => {
    if (!err) return next()
    // Multer's own "file too large" error.
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Each file must be under 2MB" })
    }

    return res.status(400).json({ message: err.message || "Invalid upload payload" })
  })
}

// Dedicated upload middleware for listing uploads so multer errors return as JSON
const listingUploadMiddleware = (req, res, next) => {
  const handler = listingUpload.array("media", 5)

  handler(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Each file must be under 5MB" })
    }
    return res.status(400).json({ message: err.message || "Invalid upload payload" })
  })
}

// ==================================================================
// Lightweight banned-phrase list for pre-publish moderation.
// Keep this small to avoid false positives; expand gradually from real report data.
// ==================================================================
const BANNED_TERMS = [
  "wire transfer",
  "pay before inspection",
  "crypto only",
  "urgent payment",
  "whatsapp",
]

// Normalizes text for case-insensitive moderation checks.
const normalize = (value = "") => value.toString().toLowerCase().trim()

// Rule-based content moderation for title/description.
const checkContentModeration = ({ title = "", description = "" }) => {
  const haystack = `${normalize(title)} ${normalize(description)}`
  const hits = BANNED_TERMS.filter((term) => haystack.includes(term))

  return {
    isBlocked: hits.length > 0,
    reasons: hits.map((term) => `Banned phrase detected: "${term}"`),
  }
}

// Health check route
router.get("/", async (req, res) => {
  try {
    res.status(200).json({ message: "Server is listening for incoming requests" })
  } catch (error) {
    res.status(500).json({ message: "Server Error" })
  }
})

/*=========================================
  Register a new user
  =========================================*/
router.post("/auth/register", registerLimiter, async (req, res) => {
  try {
    const { fullName, email, username, password, role = "regular" } = req.body

    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ message: "Please fill all required fields" })
    }

    const fullNameText = fullName.trim()
    const emailText = email.trim()
    const usernameText = username.trim()
    const passwordText = password

    const errors = {}

    if (emailText.length > 50) {
      errors.email = "Email length cannot surpass 50 characters"
    } else if (!/^\S+@\S+\.\S+$/.test(emailText)) {
      errors.email = "Invalid email address"
    }

    if (fullNameText.length > 30) {
      errors.fullName = "Full name length cannot surpass 30 characters"
    }

    if (usernameText.length > 30) {
      errors.username = "Username length cannot surpass 30 characters"
    } else if (!/^@?[a-zA-Z0-9_]+$/.test(usernameText)) {
      errors.username = "Username can only contain letters, numbers, and underscores"
    }

    if (passwordText.length < 6) {
      errors.password = "Password must be at least 6 characters"
    } else if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(passwordText)) {
      errors.password = "Password must contain at least one letter, one number, and one special character"
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors })
    }

    if (!["regular", "agent"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" })
    }

    const existingUser = await User.findOne({
      $or: [
        { email: emailText.toLowerCase() },
        { username: usernameText.toLowerCase() },
      ],
    })

    if (existingUser) {
      return res.status(409).json({ message: "Email or username already in use" })
    }

    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000) //Valid for 10 mins

    const user = await User.create({
      fullName: fullNameText,
      email: emailText.toLowerCase(),
      username: usernameText.toLowerCase(),
      password: passwordText,
      role,
      otp,
      otpExpires,
    })

    const resend = getResendClient()
    await resend.emails.send({
      from: process.env.AUTH_EMAIL,
      to: user.email,
      subject: "Verify your email",
      html: renderOtpEmail(otp),
    })

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: { email: user.email, role: user.role },
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to register user",
      error: error.message,
    })
  }
})

// =====================================
// Login an existing user
// =====================================
router.post("/auth/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required",
      })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Compare provided password with hashed password in DB using the model's comparePassword method.
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Incorrect email or password" })
    }

    if (!user.emailVerified){
      //Generate OTP and expiration time
      const otp = crypto.randomInt(100000, 999999).toString()
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000) // OTP valid for 10 minutes
      
      //Send OTP email
      const resend = getResendClient()
      await resend.emails.send({
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Verify your email",
        html: renderOtpEmail(otp),
      })

      //Save New OTP and Expiry
      user.otp = otp
      user.otpExpires = otpExpires
      await user.save()

      return res.status(400).json({isEmailVerified: false, message: "Please verify your email. A new OTP has been sent"})
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: `Your account is currently ${user.status}. Please contact support for assistance.` })
    }
    
    //Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "168h" }
    )
    const userResponse = {
      id: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      username: user.username,
      phone: user.phone,
      bio: user.bio,
      country: user.country,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus,
      plan: user.plan,
    }
    return res.status(200).json({
      message: "Login successful",
      token,
      user: userResponse,
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to login" + error.message,
      error: error.message,
    })
  }
})

// =====================================
// Check user availability
// =====================================
router.post("/auth/check-user", async (req, res) => {
  try {
    const email = req.body?.email?.toLowerCase().trim()
    const username = req.body?.username?.toLowerCase().trim()
    // exclude user id in edit account setup
    const excludeId = req.body?.excludeId // pass current user's id when editing

    if (!email && !username) {
      return res.status(400).json({
        message: "Provide email and/or username",
      })
    }

    const query = []
    if (email) query.push({ email })
    if (username) query.push({ username })

    // Build the filter, excluding the current user if provided
    const filter = { $or: query }
    if (excludeId) filter._id = { $ne: excludeId }

    const existingUsers = await User.find(filter).select("email username")

    const emailExists = email
      ? existingUsers.some((u) => u.email === email)
      : false

    const usernameExists = username
      ? existingUsers.some((u) => u.username === username)
      : false

    return res.status(200).json({
      emailExists,
      usernameExists,
    })
  } catch (error) {
    return res.status(500).json({
      message: "Error checking user availability",
      error: error.message,
    })
  }
})

// =====================================
// Verify OTP
// =====================================
router.post("/auth/email-verify", verifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("-password")
    if (!user) return res.status(400).json({ message: "User not found" })

    // Check OTP validity
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" })
    if (Date.now() > user.otpExpires) return res.status(400).json({ message: "OTP expired" })

    user.emailVerified = true
    user.otp = null
    user.otpExpires = null
    await user.save()

    // Send welcome email (best-effort)
    try {
      const resend = getResendClient()
      await resend.emails.send({
        from: process.env.AUTH_EMAIL,
        to: user.email,
        subject: "Welcome to VenloRent",
        html: renderWelcomeEmail(user.fullName),
      })
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError.message)
    }

    //Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "168h" }
    )
    //Send a return object
    // const userResponse = {
    //   id: user._id,
    //   fullName: user.fullName,
    //   email: user.email,
    //   username: user.username,
    //   role: user.role,
    //   createdAt: user.createdAt,
    // }
    res.json({ success: true, token, user, message: "Email verified successfully!" })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: "Server error" })
  }
})

// =====================================
// Resend OTP (Email Verification)
// =====================================
router.post("/auth/resend-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email already verified" })
    }

    // Generate new OTP and expiry
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000)

    user.otp = otp
    user.otpExpires = otpExpires
    await user.save()

    // Send OTP email with Resend
    const resend = getResendClient()
    await resend.emails.send({
      from: process.env.AUTH_EMAIL,
      to: user.email,
      subject: "Verify your email",
      html: renderOtpEmail(otp),
    })

    const userData = {
      email: user.email,
      role: user.role,
    }

    return res.status(200).json({
      success: true,
      user: userData,
      message: "OTP resent successfully",
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to resend OTP",
      error: error.message,
    })
  }
})


// =====================================
// Profile route (protected)
// =====================================

// Fetches user data on page reload or for profile management.
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -otp -otpExpires")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const [followersCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
    ])

    return res.status(200).json({
      success: true,
      user,
      followersCount,
      followingCount,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch profile" })
  }
})

// Public profile lookup by user id (for viewing other users).
router.get("/users/:id", async (req, res) => {
  try {
    // Optional auth: include isFollowing without requiring login.
    let viewerId = null
    const authHeader = req.headers.authorization || ""
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        viewerId = decoded?.id || null
      } catch (err) {
        viewerId = null
      }
    }

    const user = await User.findById(req.params.id).select(
      "fullName username avatar plan role kycStatus createdAt"
    )

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const [followersCount, followingCount, isFollowing] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
      viewerId
        ? Follow.exists({ follower: viewerId, following: user._id })
        : Promise.resolve(false),
    ])

    return res.status(200).json({
      success: true,
      user,
      followersCount,
      followingCount,
      isFollowing: !!isFollowing,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user" })
  }
})

// Follow or unfollow a user (protected)
router.post("/users/:id/follow", authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id
    if (!targetId) {
      return res.status(400).json({ message: "User id is required" })
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ message: "You cannot follow yourself" })
    }

    const target = await User.findById(targetId).select("_id")
    if (!target) {
      return res.status(404).json({ message: "User not found" })
    }

    const { followed } = req.body
    const filter = { follower: req.user.id, following: targetId }

    let exists = await Follow.exists(filter)
    if (followed === true) {
      await Follow.updateOne(filter, { $setOnInsert: filter }, { upsert: true })
    } else if (followed === false) {
      await Follow.deleteOne(filter)
    } else {
      // Toggle if not explicitly passed.
      if (exists) {
        await Follow.deleteOne(filter)
      } else {
        await Follow.updateOne(filter, { $setOnInsert: filter }, { upsert: true })
      }
    }

    const [followersCount, followingCount, isFollowing] = await Promise.all([
      Follow.countDocuments({ following: targetId }),
      Follow.countDocuments({ follower: targetId }),
      Follow.exists(filter),
    ])
    // Send notification only when a new follow is created, not on unfollow or toggle that results in unfollow.
    if (followed === true || (!exists && followed === undefined)) {
      await notify({
        recipient:  targetId,
        sender:     req.user.id,
        type:       "follow",
      })
    }
    return res.status(200).json({
      success: true,
      isFollowing: !!isFollowing,
      followersCount,
      followingCount,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to update follow status" })
  }
})

router.post('/auth/password-recovery', passwordResetLimiter, async (req, res) =>{
  try{
    const { email } = req.body

    if (!email){
      return res.status(400).json({message: "Email is required"})
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if(!user){
      return res.status(400).json({success: false, message: "Email is not registered with VenloRent"})
    }

    // Generate a secure random token — this is what goes in the email link
    // We store only the HASHED version in the DB (same principle as passwords)
    const rawToken    = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expires     = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    user.resetPasswordToken =  hashedToken
    user.resetPasswordExpires = expires
    await user.save()

    // The raw token goes in the URL — never the hashed one
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`

    const resend = getResendClient()
    await resend.emails.send({
      from:    process.env.AUTH_EMAIL,
      to:      user.email,
      subject: 'Reset your VenloRent password',
      html:    renderPasswordResetEmail(user.fullName, resetUrl),
    })

    return res.status(200).json({success: true, message: "If email exists, reset link has been sent to it"})
  }catch(error){
    return res.status(500).json({message: "Failed to process request"})
  }
})

router.get('/auth/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({ message: 'Token is required' })
    }

    // Hash the incoming raw token to compare with what's stored
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },   // not expired
    })

    if (!user) {
      return res.status(400).json({
        valid:   false,
        message: 'This reset link is invalid or has expired.',
      })
    }

    return res.status(200).json({
      valid:   true,
      message: 'Token is valid',
    })

  } catch (error) {
    console.error('Token validation error:', error)
    return res.status(500).json({ message: 'Failed to validate token' })
  }
})

router.post('/auth/password-reset', async (req, res) =>{
  try{
    const { token, password, confirmPassword } = req.body
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' })
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }

    // Hash the incoming token to look up in DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        message: 'This reset link is invalid or has expired. Please request a new one.',
      })
    }

    // Set the new password — pre-save hook handles hashing
    user.password = password
    user.resetPasswordToken = null // invalidate immediately
    user.resetPasswordExpires = null
    await user.save() // pre-save hook fires here

    // Notify user that their password changed
    const resend = getResendClient()
    await resend.emails.send({
      from: process.env.AUTH_EMAIL,
      to: user.email,
      subject: 'Your VenloRent password was changed',
      html: renderPasswordChangedEmail(user.fullName),
    })

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in.',
    })
  }catch(error){
    return res.status(500).json({message: "Failed to process this request"})
  }
})

/* ==================================================
    Password Change Endpoint
   =================================================*/
   router.patch('/change-password', authMiddleware, async (req, res) => {
    try{
      const userId = req.user?.id
      const { oldpass, pass1, pass2 } = req.body
      
      if(!oldpass || !pass1 || !pass2) return res.status(400).json({message: "Please enter all required fields"})
  
      if (pass1.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" })
      if(pass1 !== pass2) return res.status(400).json({message: "Both new passwords don't match"})
      if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(pass1)) {
        return res.status(400).json({
          message: "Password must contain at least one letter, one number, and one special character",
        })
      }
      const user = await User.findById(userId).select("fullName email password")
      if (!user) return res.status(404).json({ message: "User not found" })
  
      const passwordMatch = await bcrypt.compare(oldpass, user.password)
      if(!passwordMatch) return res.status(400).json({message: "Incorrect password"})

      const isSamePassword = await bcrypt.compare(pass1, user.password)
      if (isSamePassword) {
        return res.status(400).json({ message: "New password must be different from your current password" })
      }
      user.password = pass1
      await user.save()
      
      const resend = getResendClient()
      await resend.emails.send({
        from:    process.env.AUTH_EMAIL,
        to:      user.email,
        subject: 'Your VenloRent password was changed',
        html:    renderPasswordChangedEmail(user.fullName),
      })

      return res.status(200).json({success: true, message: "Password changed successfully"})
    }catch(error){
      return res.status(500).json({
        error: error.message
      })
    }
   })

router.patch('/edit-account', authMiddleware, avatarUpload.single("avatar"), async (req, res) =>{
  try{
    const { fullName, username, email, phone, bio, country } = req.body
    const userId = req.user?.id

    //Check for errors
    const errors = {}
    if (!fullName?.trim()) errors.fullName = "Full name is required"
    if (!username?.trim()) errors.username = "Username is required"
    else if (!/^@?[a-zA-Z0-9_]+$/.test(username)) errors.username = "Username can only contain letters, numbers, and underscores"
    if (!email?.trim()) errors.email = "Email is required"
    else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Invalid email address"
    if (!phone?.trim()) errors.phone = "Phone number is required"
    if (!country?.trim()) errors.country = "Country is required"
    if (bio?.trim().length > 100) errors.bio = "Bio mustn't exceed 100 characters"

    if (Object.keys(errors).length > 0) {
      // Rollback Cloudinary upload if validation fails
      if (req.file?.filename) {
        await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      }
      return res.status(400).json({ message: "Validation failed", errors });
    }

    // Conflict check (exclude current user) in addition to check-user route check
    const conflict = await User.findOne({
      _id: { $ne: userId },
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ],
    });

    if (conflict) {
      if (req.file?.filename) {
        await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      }
      const conflictErrors = {};
      if (conflict.email === email.toLowerCase())
        conflictErrors.email = "Email is already taken";
      if (conflict.username === username.toLowerCase())
        conflictErrors.username = "Username is already taken";
      return res.status(409).json({ message: "Conflict", errors: conflictErrors });
    }

    //Create the data object
    const updateData = { fullName, username, email, phone, bio, country };

    if (req.file?.path) {
      // Delete old avatar from Cloudinary before replacing
      const currentUser = await User.findById(userId).select("avatar");
      if (currentUser?.avatar) {
        const publicId = currentUser.avatar
          .split("/")
          .slice(-2)
          .join("/")
          .replace(/\.[^/.]+$/, "");
        await cloudinary.uploader.destroy(publicId).catch(() => {}); // non-fatal
      }
      updateData.avatar = req.file.path;
    }

    //Validate required fields
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      updateData,
      {
        new: true,
        runValidators: true,
      }).select("-password -otp -otpExpires -resetPasswordToken -resetPasswordExpires")

    return res.status(200).json({
      message: "Account updated successfully",
      success: true,
      user: updatedUser
    })
  }catch(error){
    if(req.file?.filname){
      await cloudinary.uploader.destroy(req.file.filename).catch(() =>{})
    }
    return res.status(500).json({
      message: "Failed to edit account",
      error: error.message,
    })
  }
})

/*==================================================
  KYC submission route
  ==================================================*/
// Receives business info + 1 multipart file from KycFlow.
// Expected payload shape:
// - text fields: businessName, officeAddress, yearsExperience
// - file fields: addressProof
router.post("/auth/kyc/submit-documents", authMiddleware, kycUploadMiddleware, async (req, res) => {
  try {
    const { businessName, officeAddress, yearsExperience } = req.body
    const validExperienceValues = new Set(["0-1", "1-3", "3-5", "5-10", "10+"])

    // Pull uploaded files out of multipart payload.
    // Multer uses arrays because each field can accept multiple files.
    //const idDocument = req.files?.idDocument?.[0]
    const addressProof = req.files?.addressProof?.[0]

    // Validate required text fields.
    if (!businessName?.trim() || !officeAddress?.trim() || !yearsExperience) {
      return res.status(400).json({
        message: "businessName, officeAddress and yearsExperience are required",
      })
    }

    // Keep accepted values synchronized with frontend dropdown options.
    if (!validExperienceValues.has(yearsExperience)) {
      return res.status(400).json({ message: "Invalid Years of Experience value" })
    }

    // Validate required upload fields.
    if (!addressProof) {
      return res.status(400).json({
        message: "Proof of Business file is required",
      })
    }

    // Guard against duplicate submissions.
    // We block if a submission is already active (submitted/in_review) or already verified to prevent unnecessary re-submits.
    const existing = await KycSubmission.findOne({
      user: req.user.id,
      status: { $in: ["submitted", "in_review", "verified"] },
    })
    if (existing) {
      const message = existing.status === "verified"
        ? "KYC already verified"
        : "A KYC submission is already in progress"
      return res.status(409).json({ message })
    }

    // Persist one KYC submission record.
    // For now we store document metadata only. File binary is intentionally not stored in MongoDB.
    const submission = await KycSubmission.create({
      user: req.user.id,
      businessName: businessName.trim(),
      officeAddress: officeAddress.trim(),
      yearsExperience,
      addressProof: {
        originalName: addressProof.originalname,
        mimeType: addressProof.mimetype,
        size: addressProof.size,
        url: addressProof.path || "",
        publicId: addressProof.filename || "",
        resourceType: addressProof.resource_type || "",
      },
      status: "submitted",
    })

    // Update user summary fields so the app can gate features quickly.
    // This avoids scanning KycSubmission for every auth check or UI render.
    await User.findByIdAndUpdate(
      req.user.id,
      {
        kycStatus: "submitted",
        kycCurrentSubmission: submission._id,
      },
      { new: false }
    )

    // ================================================================
    // DIDIT Session Creation:
    //=================================================================
    const diditResponse = await axios.post(
      "https://verification.didit.me/v3/session/",  // Didit's actual API endpoint, https://verify.didit.me/u/K78Tz2mgSKyDrskQp_O0hQ
      {
        workflow_id: process.env.DIDIT_WORKFLOW_ID,       // Workflow ID from Didit console
        callback: process.env.DIDIT_CALLBACK_URL,         // Redirect user to this after KYC completion 
        vendor_data: submission._id.toString(),            // Internal ID — Didit echoes this back in the webhook so we know which user finished
      },
      {
        headers: {
          "x-api-key": process.env.DIDIT_API_KEY,         // API key from Didit console
          "Content-Type": "application/json",
        },
      }
    )

    console.log("Didit response:", JSON.stringify(diditResponse.data, null, 2)) // Log the full response for debugging, remove in production

    const { url: verification_url, session_id } = diditResponse.data

    // Guard for missing URL 
    if (!verification_url) {
      return res.status(502).json({
        message: "Didit session created but no verification URL was returned",
        diditResponse: diditResponse.data,  // helpful for debugging, remove in production
      })
    }

    // Save the real URL and session ID to your submission record
    submission.diditUrl = verification_url
    submission.diditSessionId = session_id  // important: needed to match webhook callbacks
    await submission.save()

    return res.status(201).json({
      success: true,
      message: "KYC documents submitted successfully",
      diditUrl: verification_url,   // Didit URL is returned to FE for user's next step in verification flow
      kycSubmission: {
        id: submission._id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        addressProofUrl: submission.addressProof.url,
      },
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to submit KYC documents",
      error: error.message,
    })
  }
})

// ==================================================
//  Didit webhook endpoint to receive KYC verification results
// ==================================================

router.post("/auth/kyc/didit-webhook",  
  async (req, res) => {
    try {
      const signature = req.headers["x-signature-v2"]
      const timestamp = req.headers["x-timestamp"]

      if (!signature || !timestamp) {
        return res.status(401).json({ message: "Missing signature headers" })
      }

      const ts = Number.parseInt(timestamp, 10)
      if (!Number.isFinite(ts)) {
        return res.status(401).json({ message: "Invalid timestamp" })
      }

      // Reject stale requests (older than 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000)
      if (Math.abs(currentTime - ts) > 300) {
        return res.status(401).json({message: "Request too old" })
      }

      // Verify the signature using your webhook secret
      const expectedSig = crypto
        .createHmac("sha256", process.env.DIDIT_WEBHOOK_SECRET)
        .update(req.body)           // req.body is the raw Buffer here
        .digest("hex")

      const expectedBuf = Buffer.from(expectedSig, "hex")
      const receivedBuf = Buffer.from(signature, "hex")

      if (expectedBuf.length !== receivedBuf.length) {
        return res.status(401).json({ message: "Invalid signature" })
      }

      if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
        return res.status(401).json({ message: "Invalid signature" })
      }

      // Parse and handle the payload
      const payload = JSON.parse(req.body.toString("utf-8"))
      const { status, vendor_data } = payload
      // vendor_data is the submission._id passed when creating the session

      const statusMap = {
        "Approved":  "verified",
        "Declined":  "rejected",
        "In Review": "in_review",
        "In Progress": "in_review",
        "Abandoned": "rejected",
        "Expired":   "rejected",
      }
      const newStatus = statusMap[status] || "in_review"

      // Find submission by _id (vendor_data)
      const submission = await KycSubmission.findById(vendor_data)
      if (!submission) {
        console.error(`Webhook: no submission found for vendor_data=${vendor_data}`)
        return res.status(200).json({ received: true })
      }

      // Update submission status
      submission.status = newStatus
      await submission.save()


      // Update user's kycStatus on User and Submission Schema
      await User.findByIdAndUpdate(submission.user, {
        kycStatus: newStatus,
        ...(newStatus === "verified" ? { kycVerifiedAt: new Date() } : {}),
      })
      await notify({
        recipient: submission.user,
        sender: null,              // system notification — no sender
        type: "kyc_update",
        snapshot: {
          title: newStatus === "verified"
            ? "Your KYC verification was approved"
            : newStatus === "rejected"
              ? "Your KYC submission was declined"
              : "Your KYC submission is under review",
        },
      })
      //===================================================
      //Incase we plan to update just the Submission status 
      //and leave the user kycStatus for manual update...
      //We'll use the commented code below
      //==============================

      /**
      if (newStatus === "verified") {
        await User.findByIdAndUpdate(submission.user, {
          kycStatus: "verified",
          kycVerifiedAt: new Date(),
        })
      }
      */
      return res.status(200).json({ received: true })
    } catch (err) {
      console.error("Webhook error:", err.message)
      return res.status(200).json({ message: "Webhook handling failed" })
    }
  }
)

/*===================================================
  Property routes and other property related endpoints
  ===================================================*/

// Create a new property (protected)
router.post("/create-listing", authMiddleware, listingUploadMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      listing_type, //whether rent, sale or short-time
      property_type, //type of property, formally category
      bedrooms, //optional
      commission,
      amount,
      //currency = "NGN",
      location = {},
      media = [],
      features = [],
      status = "available",
    } = req.body

    const validationErrors = {}
    if (!title.trim()) validationErrors.title = "Title is required"
    if (!description.trim()) validationErrors.description = "Description is required"
    if (!property_type.trim()) validationErrors.property_type = "Property type is required"
    if (!listing_type.trim()) validationErrors.listing_type = "Listing type is required"
    if (!amount || isNaN(amount)) validationErrors.amount = "Valid amount is required"
    if (!location?.state.trim()) validationErrors["location?.state"] = "State is required"
    if (!location?.town.trim()) validationErrors["location?.town"] = "Town is required"
    if (title.length > 100) validationErrors.title = "Title cannot exceed 100 characters"
    if (description.length > 1000) validationErrors.description = "Description cannot exceed 1000 characters"
    if (!["rent", "sale", "shortlet"].includes(listing_type)) validationErrors.listing_type = "Invalid listing type"
    if (!["apartment", "flat", "self-con", "duplex", "shop", "office", "conference-room"].includes(property_type)) validationErrors.property_type = "Invalid property type"
    // Normalize features: accept array, JSON string, or comma-separated string.
    const normalizedFeatures = (() => {
      if (Array.isArray(features)) return features
      if (typeof features === "string") {
        const trimmed = features.trim()
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed)
            return Array.isArray(parsed) ? parsed : [parsed]
          } catch (err) {
            // fall through to comma split
          }
        }
        return trimmed.split(",").map((s) => s.trim()).filter(Boolean)
      }
      return []
    })()

    if (normalizedFeatures.length > 10) validationErrors.features = "Maximum 10 features allowed"
    
    const ALLOWED_BEDROOMS = ["studio", "1", "2", "3", "4+"]
    const normalizedAmount = Number(amount)

    if (normalizedAmount <= 0) validationErrors.amount = "Amount must be greater than zero"
    if (bedrooms && !ALLOWED_BEDROOMS.includes(bedrooms)) validationErrors.bedrooms = "Invalid bedrooms value"
    
      if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({ message: "Validation failed", errors: validationErrors })
    }

    const mediaItems = (req.files || []).map((f) => (
      {
        url: f.path || "",
        publicId: f.filename || "",
        originalName: f.originalname || "",
        mimeType: f.mimetype || "",
        size: f.size || 0,
        resourceType: f.resource_type || "",
      })
    )

    if (mediaItems.length === 0) {
      return res.status(400).json({ message: "At least one media file is required" })
    }

    if (mediaItems.length > 5) {
      return res.status(400).json({ message: "Maximum 5 media files allowed" })
    }

    // Check user eligibility to post (e.g., KYC verified, not blocked, etc.)
    const user = await User.findById(req.user.id).select("kycStatus")
    if (!user || user.kycStatus !== "verified") {
      return res.status(403).json({ message: "Only verified agents can create listings" })
    }

    // Step 1: Pre-publish moderation checks.
    const moderation = checkContentModeration({ title, description })

    // Duplicate detection (same owner, same category/address/amount within 24h).
    const duplicate = await Property.findOne({
      owner: req.user.id,
      property_type: property_type,
      location: { state: location.state, town: location.town },
      amount: normalizedAmount,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })

    let moderationStatus = "approved"
    const moderationReasons = []

    if (moderation.isBlocked) {
      moderationStatus = "rejected"
      moderationReasons.push(...moderation.reasons)
    } else if (duplicate) {
      moderationStatus = "flagged"
      moderationReasons.push("Possible duplicate listing in last 24h")
    }

    const property = await Property.create({
      owner: req.user.id,
      title: title.trim(),
      description: description.trim(),
      listing_type,
      property_type,
      amount: normalizedAmount,
      location:{
        town: location.town,
        state: location.state, 
      },
      media: mediaItems,
      status,
      features: normalizedFeatures,
      commission,
      // These fields are used by moderation flow.
      moderationStatus,
      moderationReasons,
    })

    return res.status(201).json({
      success: true,
      message: "Property created",
      property,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to create property", error: error.message })
  }
})

// List properties (public)
router.get("/properties", async (req, res) => {
  try {
    // Optional auth: allow likedByMe without forcing login.
    let userId = null
    const authHeader = req.headers.authorization || ""
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        userId = decoded?.id || null
      } catch (err) {
        // Ignore invalid token for public listing fetch.
        userId = null
      }
    }

    const { category, status, minAmount, maxAmount, page = 1, limit = 20 } = req.query

    // Show approved properties; also include docs where moderationStatus doesn't exist yet.
    const query = {
      $or: [
        { moderationStatus: "approved" },
        { moderationStatus: { $exists: false } },
      ],
    }

    if (category) query.category = category
    if (status && status !== "all") {
      query.status = status
    } else if (!status) {
      // Feed should never surface rented / archived / reserved properties.
      query.status = "available" //Only available properties are shown in feed by default.
    }

    if (minAmount || maxAmount) {
      query.amount = {}
      if (minAmount) query.amount.$gte = Number(minAmount)
      if (maxAmount) query.amount.$lte = Number(maxAmount)
    }

    const safeLimit = Math.min(Number(limit) || 20, 50)
    const safePage = Math.max(Number(page) || 1, 1)
    const skip = (safePage - 1) * safeLimit

    const [items, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("owner", "fullName username avatar kycStatus plan"),
      Property.countDocuments(query),
    ])

    let bookmarkedSet = new Set()
    if (userId && items.length > 0) {
      const bookmarks = await Bookmark.find({
        user: userId,
        targetType: "Property",
        targetId: { $in: items.map((item) => item._id) },
      }).select("targetId")
      bookmarkedSet = new Set(bookmarks.map((b) => b.targetId.toString()))
    }

    const enrichedItems = items.map((item) => {
      const obj = item.toObject()
      return {
        ...obj,
        likedByMe: userId ? item.likes.some((id) => id.equals(userId)) : false,
        bookmarkedByMe: userId ? bookmarkedSet.has(item._id.toString()) : false,
      }
    })

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      items: enrichedItems,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch properties", error: error.message })
  }
})

// ==================================================
// Agent listings (for attaching to request responses)
// ==================================================
router.get("/my-listings", authMiddleware, async (req, res) => {
  try {
    const items = await Property.find({ owner: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("title amount location media listing_type property_type")

    return res.status(200).json({ success: true, items })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch listings", error: error.message })
  }
})

// Get a single property by id (public)
router.get("/properties/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate("owner", "fullName username avatar kycStatus plan")

    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }

    // Hide non-approved properties from public view, unless moderation field is not yet defined.
    if (property.moderationStatus && property.moderationStatus !== "approved") {
      return res.status(404).json({ message: "Property not found" })
    }

    return res.status(200).json({ success: true, property })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch property", error: error.message })
  }
})

// ==================================================
// Property comments
// ==================================================

// List comments for a property (public)
router.get("/properties/:id/comments", async (req, res) => {
  try {
    // Optional auth: allow likedByMe without forcing login.
    let userId = null
    const authHeader = req.headers.authorization || ""
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        userId = decoded?.id || null
      } catch (err) {
        userId = null
      }
    }

    const comments = await Comment.find({
      property: req.params.id,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .populate("author", "fullName username avatar role plan kycStatus")

    const items = comments.map((item) => ({
      ...item.toObject(),
      likedByMe: userId ? item.likes.some((id) => id.equals(userId)) : false,
    }))

    return res.status(200).json({ success: true, items })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch comments", error: error.message })
  }
})

// Create a comment for a property (protected)
router.post("/properties/:id/comments", authMiddleware, async (req, res) => {
  try {
    const text = req.body?.text?.toString().trim()
    if (!text){
      return res.status(400).json({ message: "Comment text is required" })
    }

    const property = await Property.findById(req.params.id).select("_id owner title media amount location")
    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }

    const comment = await Comment.create({
      property: property._id,
      author: req.user.id,
      text,
    })

    // Increment cached comment count for fast feed display.
    await Property.updateOne({ _id: property._id }, { $inc: { commentCount: 1 } })

    await notify({// Send notification to property owner about new comment.
      recipient:  property.owner,   // property.owner must be selected — add it to the findById select
      sender:     req.user.id,
      type:       "comment",
      targetType: "Property",
      targetId:   property._id,
      snapshot:   propertySnapshot(property),
    })

    const populated = await comment.populate("author", "fullName username avatar plan kycStatus")

    return res.status(201).json({ success: true, comment: populated })
  } catch (error) {
    return res.status(500).json({ message: "Failed to create comment", error: error.message })
  }
})

// POST /properties/:id/report
router.post("/properties/:id/report", authMiddleware, async (req, res) => {
  try {
    const { reason, details = "" } = req.body

    const validReasons = ["spam", "fraud", "harassment", "fake_listing", "inappropriate_content", "other"]
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ message: "A valid report reason is required" })
    }

    if (details && details.length > 300) {
      return res.status(400).json({ message: "Report details exceed the maximum length of 300 characters" })
    }

    const property = await Property.findById(req.params.id).select("owner reportsCount moderationStatus moderationReasons")
    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }

    if (property.owner.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot report your own listing" })
    }

    await Report.create({
      reporter: req.user.id,
      targetType: "property",
      targetId: property._id,
      reason,
      details: details.toString().trim().slice(0, 300),
    })

    property.reportsCount = Number(property.reportsCount || 0) + 1

    if (property.reportsCount >= 3 && property.moderationStatus === "approved") {
      property.moderationStatus = "flagged"
      property.moderationReasons = [
        ...(property.moderationReasons || []),
        "Auto-flagged due to user reports",
      ]
    }

    await property.save()

    return res.status(200).json({ success: true, message: "Report submitted" })
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit report", error: error.message })
  }
})

// Toggle bookmark on a property (expects { bookmarked: true/false })
router.post("/properties/:id/bookmark", authMiddleware, async (req, res) => {
  try {
    const { bookmarked } = req.body

    const property = await Property.findById(req.params.id).select("_id")
    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }

    if (bookmarked) {
      // Create bookmark if it does not exist.
      await Bookmark.updateOne(
        { user: req.user.id, targetType: "Property", targetId: property._id },
        { $setOnInsert: { user: req.user.id, targetType: "Property", targetId: property._id } },
        { upsert: true }
      )
    } else {
      // Remove bookmark if it exists.
      await Bookmark.deleteOne({
        user: req.user.id,
        targetType: "Property",
        targetId: property._id,
      })
    }

    return res.status(200).json({ success: true, bookmarked: !!bookmarked })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update property bookmark",
      error: error.message,
    })
  }
})

/*===================================================
  Request routes
  ===================================================*/

// Create a new request (protected)
router.post("/create-request", authMiddleware, async (req, res) => {
  try {
    const {
      description,
      category = "",
      location = {},
      budget = "",
    } = req.body

    if (!description || !description.toString().trim()) {
      return res.status(400).json({ message: "description is required" })
    }
    if (description.length > 200) return res.status(400).json({message: "Maximum length for description is exceeded"})
    
    // Allow legacy string location or structured location object.
    const normalizedLocation = typeof location === "string"
      ? { state: "", town: "" }
      : {
          state: location.state || "",
          town: location.town || "",
        }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // default to 30 days from now

    const request = await Request.create({
      requester: req.user.id,
      description: description.toString().trim(),
      category: category.toString().trim(),
      location: normalizedLocation,
      budget: budget.toString().trim(),
      expiresAt,
      status: "open",
    })

    return res.status(201).json({
      success: true,
      message: "Request created successfully",
      request,
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create request",
      error: error.message,
    })
  }
})

// List requests (public)
router.get("/requests", async (req, res) => {
  try {
    // Optional auth: allow likedByMe without forcing login.
    let userId = null
    const authHeader = req.headers.authorization || ""
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        userId = decoded?.id || null
      } catch (err) {
        // Ignore invalid token for public request fetch.
        userId = null
      }
    }

    const { status, page = 1, limit = 20 } = req.query

    const query = {}
    if (status) query.status = status

    const safeLimit = Math.min(Number(limit) || 20, 50)
    const safePage = Math.max(Number(page) || 1, 1)
    const skip = (safePage - 1) * safeLimit

    const [items, total] = await Promise.all([
      Request.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("requester", "fullName username avatar plan kycStatus"),
      Request.countDocuments(query),
    ])

    let bookmarkedSet = new Set()
    if (userId && items.length > 0) {
      const bookmarks = await Bookmark.find({
        user: userId,
        targetType: "Request",
        targetId: { $in: items.map((item) => item._id) },
      }).select("targetId")
      bookmarkedSet = new Set(bookmarks.map((b) => b.targetId.toString()))
    }

    const enrichedItems = items.map((item) => {
      const obj = item.toObject()
      return {
        ...obj,
        likedByMe: userId ? item.likes.some((id) => id.equals(userId)) : false,
        bookmarkedByMe: userId ? bookmarkedSet.has(item._id.toString()) : false,
      }
    })

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      items: enrichedItems,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch requests", error: error.message })
  }
})

// ==================================================
// Request responses (agent offers)
// ==================================================

// List agent responses for a request (public)
router.get("/requests/:id/agent-responses", async (req, res) => {
  try {
    const responses = await RequestResponse.find({
      request: req.params.id,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .populate("author", "fullName username avatar role plan kycStatus")

    return res.status(200).json({ success: true, items: responses })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch responses", error: error.message })
  }
})

// Create an agent response (protected, agent only)
router.post("/requests/:id/agent-responses", authMiddleware, async (req, res) => {
  try {
    const text = req.body?.text?.toString().trim()
    if (!text) {
      return res.status(400).json({ message: "Response text is required" })
    }

    const user = await User.findById(req.user.id).select("role kycStatus")
    if (!user || (user.role !== "agent" && user.kycStatus !== "verified")) {
      return res.status(403).json({ message: "Only verified agents can post responses" })
    }

    const request = await Request.findById(req.params.id).select("_id requester description budget location")
    if (!request) {
      return res.status(404).json({ message: "Request not found" })
    }

    const response = await RequestResponse.create({
      request: request._id,
      author: req.user.id,
      text,
      listingSnapshot: {
        listingId: req.body?.listingSnapshot?.listingId || null,
        title: req.body?.listingSnapshot?.title || "",
        price: req.body?.listingSnapshot?.price || "",
        location: req.body?.listingSnapshot?.location || "",
        image: req.body?.listingSnapshot?.image || "",
      },
    })

    await notify({
      recipient: request.requester,
      sender: req.user.id,
      type: "response",
      targetType: "Request",
      targetId: request._id,
      snapshot: requestSnapshot(request),
    })

    // Increment cached response count for fast feed display.
    await Request.updateOne({ _id: request._id }, { $inc: { responseCount: 1 } })

    const populated = await response.populate("author", "fullName username avatar role plan kycStatus")

    return res.status(201).json({ success: true, response: populated })
  } catch (error) {
    return res.status(500).json({ message: "Failed to create response", error: error.message })
  }
})

// ==================================================
// Request discussions (public thread)
// ==================================================

// List discussion comments for a request (public)
router.get("/requests/:id/discussions", async (req, res) => {
  try {
    // Optional auth: allow likedByMe without forcing login.
    let userId = null
    const authHeader = req.headers.authorization || ""
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        userId = decoded?.id || null
      } catch (err) {
        userId = null
      }
    }

    const comments = await Discussion.find({
      request: req.params.id,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .populate("author", "fullName username avatar role plan kycStatus")

    const items = comments.map((item) => ({
      ...item.toObject(),
      likedByMe: userId ? item.likes.some((id) => id.equals(userId)) : false,
    }))

    return res.status(200).json({ success: true, items })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch discussion", error: error.message })
  }
})

// Create discussion comment (protected)
router.post("/requests/:id/discussions", authMiddleware, async (req, res) => {
  try {
    const text = req.body?.text?.toString().trim()
    if (!text) {
      return res.status(400).json({ message: "Comment text is required" })
    }

    const request = await Request.findById(req.params.id).select("_id requester status description budget location")
    if (!request) {
      return res.status(404).json({ message: "Request not found" })
    }
    if (request.status === "expired") {
      return res.status(400).json({ message: "Request has expired" })
    }

    const comment = await Discussion.create({
      request: request._id,
      author: req.user.id,
      text,
    })
    await notify({// Send notification to requester about new discussion comment.
      recipient:  request.requester,
      sender:     req.user.id,
      type:       "discussion",
      targetType: "Request",
      targetId:   request._id,
      snapshot:   requestSnapshot(request),
    })
    // Increment cached discussion count for fast feed display.
    await Request.updateOne({ _id: request._id }, { $inc: { discussionCount: 1 } })

    const populated = await comment.populate("author", "fullName username avatar plan kycStatus")

    return res.status(201).json({ success: true, comment: populated })
  } catch (error) {
    return res.status(500).json({ message: "Failed to create discussion comment", error: error.message })
  }
})

// ==================================================
// Orders
// ==================================================

// List orders for the current user (protected)
router.get("/orders", authMiddleware, async (req, res) => {
  try {
    const { status, role } = req.query

    const baseFilter =
      role === "buyer"
        ? { buyer: req.user.id }
        : role === "seller"
          ? { seller: req.user.id }
          : { $or: [{ buyer: req.user.id }, { seller: req.user.id }] }

    const query = { ...baseFilter }
    if (status) {
      query.status = status
    }

    const items = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("property", "title amount commission listing_type property_type location media")
      .populate("buyer", "fullName username avatar role kycStatus plan")
      .populate("seller", "fullName username avatar role kycStatus plan")

    return res.status(200).json({ success: true, items })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch orders", error: error.message })
  }
})

// Create a new order (protected)
router.post("/orders", authMiddleware, async (req, res) => {
  try {
    const { propertyId, note = "" } = req.body
    if (!propertyId) {
      return res.status(400).json({ message: "propertyId is required" })
    }

    const property = await Property.findById(propertyId).select("owner amount commission")
    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }
    if (property.owner.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot order your own listing" })
    }

    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

    const order = await Order.create({
      property: property._id,
      buyer: req.user.id,
      seller: property.owner,
      amount: Number(property.amount) || 0,
      note: note.toString().trim(),
      expiresAt,
    })

    await notify({// Send notification to seller about new order.
      recipient: property.owner,   // the seller
      sender: req.user.id, // the buyer
      type: "order_placed",
      targetType: "Order",
      targetId: order._id,
      snapshot: {
        title: "",   // populated by the seller's order management UI
        price: `₦${Number(property.amount).toLocaleString("en-NG")}`,
        image: "",
        location: "",
      },
    })

    return res.status(201).json({ success: true, order })
  } catch (error) {
    return res.status(500).json({ message: "Failed to create order", error: error.message })
  }
})

/*===================================================
  Likes + bookmarks for Requests and Properties
  ===================================================*/

// Toggle like on a request (expects { liked: true/false })
router.post("/requests/:id/like", authMiddleware, async (req, res) => {
  try {
    const { liked } = req.body
    const request = await Request.findById(req.params.id)

    if (!request) {
      return res.status(404).json({ message: "Request not found" })
    }

    const userId = req.user.id
    const alreadyLiked = request.likes.some((id) => id.equals(userId))

    if (liked && !alreadyLiked) {
      request.likes.push(userId)
      request.likeCount = Number(request.likeCount || 0) + 1
    }

    if (!liked && alreadyLiked) {
      request.likes = request.likes.filter((id) => !id.equals(userId))
      request.likeCount = Math.max(0, Number(request.likeCount || 0) - 1)
    }

    await request.save()
    if (liked && !alreadyLiked) {
      await notify({
        recipient:  request.requester,
        sender:     req.user.id,
        type:       "like_request",
        targetType: "Request",
        targetId:   request._id,
        snapshot:   requestSnapshot(request),
      })
    }
    return res.status(200).json({
      success: true,
      likedByMe: !!liked,
      likeCount: request.likeCount,
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update request like",
      error: error.message,
    })
  }
})

// Toggle like on a property comment (expects { liked: true/false })
router.post("/comments/:id/like", authMiddleware, async (req, res) => {
  try {
    const { liked } = req.body
    const comment = await Comment.findById(req.params.id)

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" })
    }

    const userId = req.user.id
    const alreadyLiked = comment.likes.some((id) => id.equals(userId))

    if (liked && !alreadyLiked) {
      comment.likes.push(userId)
      comment.likeCount = Number(comment.likeCount || 0) + 1
    }

    if (!liked && alreadyLiked) {
      comment.likes = comment.likes.filter((id) => !id.equals(userId))
      comment.likeCount = Math.max(0, Number(comment.likeCount || 0) - 1)
    }

    await comment.save()

    return res.status(200).json({
      success: true,
      likedByMe: !!liked,
      likeCount: comment.likeCount,
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update comment like",
      error: error.message,
    })
  }
})

// Toggle like on a request discussion comment (expects { liked: true/false })
router.post("/discussions/:id/like", authMiddleware, async (req, res) => {
  try {
    const { liked } = req.body
    const discussion = await Discussion.findById(req.params.id)

    if (!discussion) {
      return res.status(404).json({ message: "Discussion comment not found" })
    }

    const userId = req.user.id
    const alreadyLiked = discussion.likes.some((id) => id.equals(userId))

    if (liked && !alreadyLiked) {
      discussion.likes.push(userId)
      discussion.likeCount = Number(discussion.likeCount || 0) + 1
    }

    if (!liked && alreadyLiked) {
      discussion.likes = discussion.likes.filter((id) => !id.equals(userId))
      discussion.likeCount = Math.max(0, Number(discussion.likeCount || 0) - 1)
    }

    await discussion.save()

    return res.status(200).json({
      success: true,
      likedByMe: !!liked,
      likeCount: discussion.likeCount,
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update discussion like",
      error: error.message,
    })
  }
})

// Toggle bookmark on a request (expects { bookmarked: true/false })
router.post("/requests/:id/bookmark", authMiddleware, async (req, res) => {
  try {
    const { bookmarked } = req.body

    const request = await Request.findById(req.params.id).select("_id")
    if (!request) {
      return res.status(404).json({ message: "Request not found" })
    }

    if (bookmarked) {
      // Create bookmark if it does not exist.
      await Bookmark.updateOne(
        { user: req.user.id, targetType: "Request", targetId: request._id },
        { $setOnInsert: { user: req.user.id, targetType: "Request", targetId: request._id } },
        { upsert: true }
      )
    } else {
      // Remove bookmark if it exists.
      await Bookmark.deleteOne({
        user: req.user.id,
        targetType: "Request",
        targetId: request._id,
      })
    }

    return res.status(200).json({ success: true, bookmarked: !!bookmarked })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update request bookmark",
      error: error.message,
    })
  }
})

// Toggle like on a property (expects { liked: true/false })
router.post("/properties/:id/like", authMiddleware, async (req, res) => {
  try {
    const { liked } = req.body
    const property = await Property.findById(req.params.id)

    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }

    const userId = req.user.id
    const alreadyLiked = property.likes.some((id) => id.equals(userId))

    if (liked && !alreadyLiked) {
      property.likes.push(userId)
      property.likeCount = Number(property.likeCount || 0) + 1
    }

    if (!liked && alreadyLiked) {
      property.likes = property.likes.filter((id) => !id.equals(userId))
      property.likeCount = Math.max(0, Number(property.likeCount || 0) - 1)
    }

    await property.save()

    if (liked && !alreadyLiked) {// Send notification to property owner about new like.
      await notify({
        recipient:  property.owner,
        sender:     req.user.id,
        type:       "like_property",
        targetType: "Property",
        targetId:   property._id,
        snapshot:   propertySnapshot(property),
      })
    }
    return res.status(200).json({
      success: true,
      likedByMe: !!liked,
      likeCount: property.likeCount,
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update property like",
      error: error.message,
    })
  }
})


/*===================================================
  Bookmarks (polymorphic)
  ===================================================*/

// Fetch bookmarks for the current user. Optionally filter by ?type=Property|Request|Comment
router.get("/bookmarks", authMiddleware, async (req, res) => {
  try {
    const { type } = req.query
    const filter = { user: req.user.id }
    if (type) filter.targetType = type

    const rawBookmarks = await Bookmark.find(filter).sort({ createdAt: -1 })

    const propertyIds = []
    const requestIds = []

    rawBookmarks.forEach((bookmark) => {
      const type = (bookmark.targetType || "").toLowerCase()
      if (type === "property" || type === "listing") {
        propertyIds.push(bookmark.targetId)
      }
      if (type === "request") {
        requestIds.push(bookmark.targetId)
      }
    })

    const [properties, requests] = await Promise.all([
      propertyIds.length > 0
        ? Property.find({ _id: { $in: propertyIds } })
            .populate("owner", "fullName username avatar kycStatus plan role")
            .lean()
        : Promise.resolve([]),
      requestIds.length > 0
        ? Request.find({ _id: { $in: requestIds } })
            .populate("requester", "fullName username avatar kycStatus plan role")
            .lean()
        : Promise.resolve([]),
    ])

    const propertyMap = new Map(properties.map((item) => [item._id.toString(), item]))
    const requestMap = new Map(requests.map((item) => [item._id.toString(), item]))

    const bookmarks = rawBookmarks.map((bookmark) => {
      const type = (bookmark.targetType || "").toLowerCase()
      const targetId = bookmark.targetId?.toString()
      const target =
        type === "request"
          ? requestMap.get(targetId)
          : propertyMap.get(targetId)

      return {
        ...bookmark.toObject(),
        target,
      }
    })

    return res.status(200).json({ success: true, bookmarks })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch bookmarks",
      error: error.message,
    })
  }
})

/*=========================================================
  Search endpoint for properties and requests (basic text search on title/description)
  ===========================================================*/
  router.get("/search", async (req, res) => {
  try {
    const {
      q            = "",
      type         = "listing",
      minPrice,
      maxPrice,
      location:    locationFilter,
      propertyType,
      listingType,
      sort         = "relevance",
      page         = 1,
      limit        = 20,
    } = req.query
 
    // Clamp pagination to safe bounds
    const safeLimit = Math.min(Number(limit) || 20, 50)
    const safePage  = Math.max(Number(page)  || 1,  1)
    const skip      = (safePage - 1) * safeLimit
 
    // Normalise the search term once 
    const term = q.trim()
 
    // Sort map for property queries 
    const sortMap = {
      "price-low":  { amount: 1 },
      "price-high": { amount: -1 },
      "newest":     { createdAt: -1 },
      "relevance":  { createdAt: -1 }, // fallback; swap for text-score when Atlas Search is added
    }
    const sortObj = sortMap[sort] || sortMap["relevance"]
 
    // Shared location sub-query (reused in both property and request) 
    const locationConditions = (field = "location") =>
      locationFilter
        ? [
            { [`${field}.town`]:  { $regex: locationFilter, $options: "i" } },
            { [`${field}.state`]: { $regex: locationFilter, $options: "i" } },
          ]
        : null
 
    //  PROPERTY QUERY
    let listings = []
 
    if (type === "listing" || type === "all") {
      // Only surface approved, available properties
      const propertyQuery = {
        status: "available",
        $or: [
          { moderationStatus: "approved" },
          { moderationStatus: { $exists: false } },
        ],
      }
 
      // Free-text: title, description, location, property_type
      if (term) {
        propertyQuery.$and = [
          {
            $or: [
              { title:             { $regex: term, $options: "i" } },
              { description:       { $regex: term, $options: "i" } },
              { "location.town":   { $regex: term, $options: "i" } },
              { "location.state":  { $regex: term, $options: "i" } },
              { property_type:     { $regex: term, $options: "i" } },
            ],
          },
        ]
      }
 
      // Filter: property type
      if (propertyType) propertyQuery.property_type = propertyType
 
      // Filter: listing type
      if (listingType) propertyQuery.listing_type = listingType
 
      // Filter: location (town or state)
      const locConds = locationConditions()
      if (locConds) {
        propertyQuery.$and = [...(propertyQuery.$and || []), { $or: locConds }]
      }
 
      // Filter: price range
      if (minPrice || maxPrice) {
        propertyQuery.amount = {}
        if (minPrice) propertyQuery.amount.$gte = Number(minPrice)
        if (maxPrice) propertyQuery.amount.$lte = Number(maxPrice)
      }
 
      // When type === "all", split the limit between listings (70%) and requests (30%)
      const listingLimit = type === "all" ? Math.ceil(safeLimit * 0.7) : safeLimit
 
      listings = await Property.find(propertyQuery)
        .sort(sortObj)
        .skip(type === "all" ? 0 : skip) // pagination only applies to single-type queries
        .limit(listingLimit)
        .populate("owner", "fullName username avatar kycStatus")
        .lean() 
 
      // Tag each result so the frontend knows which card type to render
      listings = listings.map((p) => ({ ...p, _type: "listing" }))
    }
    //  REQUEST QUERY
    let requests = []
 
    if (type === "request" || type === "all") {
      const requestQuery = {
        status: { $ne: "expired" },
      }
 
      if (term) {
        requestQuery.$or = [
          { description:       { $regex: term, $options: "i" } },
          { category:          { $regex: term, $options: "i" } },
          { "location.town":   { $regex: term, $options: "i" } },
          { "location.state":  { $regex: term, $options: "i" } },
        ]
      }
 
      const locConds = locationConditions()
      if (locConds) {
        // Merge with existing $or if term search already set one
        if (requestQuery.$or) {
          requestQuery.$and = [{ $or: requestQuery.$or }, { $or: locConds }]
          delete requestQuery.$or
        } else {
          requestQuery.$or = locConds
        }
      }
 
      const requestLimit = type === "all" ? Math.floor(safeLimit * 0.3) : safeLimit
 
      requests = await Request.find(requestQuery)
        .sort({ createdAt: -1 })
        .skip(type === "all" ? 0 : skip)
        .limit(requestLimit)
        // role and plan are needed for isAgent and isPremium badges
        .populate("requester", "fullName username avatar kycStatus role plan")
        .lean()
 
      requests = requests.map((r) => ({ ...r, _type: "request" }))
    }

    let items = []
    //  MERGE + RESPOND 
    if (type === "all") {
      // Interleave: sort combined results newest-first
      items = [...listings, ...requests].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )
    } else if (type === "listing") {
      items = listings
    } else {
      items = requests
    }
 
    return res.status(200).json({
      success: true,
      page:    safePage,
      limit:   safeLimit,
      total:   items.length, // NOTE: replace with countDocuments() for accurate pagination
      items,
    })
  } catch (error) {
    console.error("Search error:", error)
    return res.status(500).json({ message: "Search failed", error: error.message })
  }
})

/*============================================
  Chats / Inbox Conversations
 ============================================*/
 router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
    })
      .sort({ lastMessageAt: -1 }) // most recently active first
      .populate("participants", "fullName username avatar kycStatus plan")

    return res.status(200).json({ success: true, conversations })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch conversations", error: error.message })
  }
})
/**
 * POST /conversations
 * Find-or-create a 1-to-1 conversation between the caller and { recipientId }.
 * Called by the frontend when the user taps "Contact Agent" on a listing —
 * if a conversation already exists it is returned instead of duplicated.
 */
router.post("/conversations", authMiddleware, async (req, res) => {
  try {
    const { recipientId } = req.body

    if (!recipientId) {
      return res.status(400).json({ message: "recipientId is required" })
    }
    if (recipientId === req.user.id) {
      return res.status(400).json({ message: "You cannot message yourself" })
    }

    const recipient = await User.findById(recipientId).select("_id")
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" })
    }

    // Sort participant IDs so the unique index is order-independent.
    const participants = [req.user.id.toString(), recipientId.toString()].sort()

    // upsert=true → create if absent, return existing if present.
    const conversation = await Conversation.findOneAndUpdate(
      { participants },
      { $setOnInsert: { participants, lastMessageAt: null } },
      { upsert: true, new: true }
    ).populate("participants", "fullName username avatar kycStatus plan")

    return res.status(200).json({ success: true, conversation })
  } catch (error) {
    return res.status(500).json({ message: "Failed to create conversation", error: error.message })
  }
})

/* ==========================================================
 * GET /CONVERSATIONS/:ID/MESSAGES
 * Returns paginated messages for a conversation oldest-first (good for a chat window).
 * Only participants may read the messages.
 * ==========================================================*/
router.get("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).select("participants")
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" })
    }

    // Guard: only the two participants may access this thread.
    const isMember = conversation.participants.some((p) => p.equals(req.user.id))
    if (!isMember) {
      return res.status(403).json({ message: "Access denied" })
    }

    const { page = 1, limit = 50 } = req.query
    const safeLimit = Math.min(Number(limit) || 50, 100)
    const safePage  = Math.max(Number(page)  || 1,  1)
    const skip      = (safePage - 1) * safeLimit

    const messages = await Message.find({ conversation: req.params.id })
      .sort({ createdAt: 1 }) // oldest → newest (natural chat order)
      .skip(skip)
      .limit(safeLimit)
      .populate("sender", "fullName username avatar")

    // Mark unread messages from the other person as read now that the user opened the chat.
    await Message.updateMany(
      {
        conversation: req.params.id,
        sender: { $ne: req.user.id }, // messages NOT sent by me
        read: false,
      },
      { $set: { read: true } }
    )

    return res.status(200).json({ success: true, messages })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch messages", error: error.message })
  }
})

/**
 * POST /conversations/:id/messages
 * Send a new message inside a conversation.
 * Updates the conversation's lastMessage snapshot atomically.
 */
router.post("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const text = req.body?.text?.toString().trim()
    if (!text) {
      return res.status(400).json({ message: "Message text is required" })
    }

    const conversation = await Conversation.findById(req.params.id).select("participants")
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" })
    }

    const isMember = conversation.participants.some((p) => p.equals(req.user.id))
    if (!isMember) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Persist the message.
    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user.id,
      text,
    })

    // Keep the conversation's lastMessage snapshot fresh for the inbox list.
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: {
            text,
            sender: req.user.id,
            sentAt: message.createdAt,
          },
          lastMessageAt: message.createdAt,
        },
      }
    )

    const populated = await message.populate("sender", "fullName username avatar")

    return res.status(201).json({ success: true, message: populated })
  } catch (error) {
    return res.status(500).json({ message: "Failed to send message", error: error.message })
  }
})


/* =========================================================
  NOTIFICATIONS
 * GET /NOTIFICATIONS
 * Returns paginated notifications for the logged-in user, newest first.
 * =========================================================*/
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query
    const safeLimit = Math.min(Number(limit) || 30, 50)
    const safePage  = Math.max(Number(page)  || 1,  1)
    const skip      = (safePage - 1) * safeLimit

    const [items, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("sender", "fullName username avatar kycStatus"),

      // Unread badge count — returned separately so the UI can show it
      // in the header bell icon without re-counting from the items array.
      Notification.countDocuments({ recipient: req.user.id, read: false }),
    ])

    return res.status(200).json({ success: true, items, unreadCount })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications", error: error.message })
  }
})

/* ===================================================
 * PATCH /NOTIFICATIONS/READ-ALL
 * Marks all of the current user's notifications as read.
   ===================================================*/
router.patch("/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true } }
    )

    return res.status(200).json({ success: true, message: "All notifications marked as read" })
  } catch (error) {
    return res.status(500).json({ message: "Failed to mark all as read", error: error.message })
  }
})

/* =======================================
 * PATCH /NOTIFICATIONS/:ID/READ
 * Marks a single notification as read.
   =======================================*/
router.patch("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id }, // recipient guard prevents other users marking yours
      { $set: { read: true } },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    return res.status(200).json({ success: true, notification })
  } catch (error) {
    return res.status(500).json({ message: "Failed to mark notification as read", error: error.message })
  }
})

/* ========================================================
 * DELETE /NOTIFICATIONS/:ID
 * Deletes a single notification. Only the recipient may delete it.
   ========================================================*/
router.delete("/notifications/:id", authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id,
    })

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    return res.status(200).json({ success: true, message: "Notification deleted" })
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete notification", error: error.message })
  }
})

// DELETE /properties/:id (owner only)
router.delete("/properties/:id", authMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).select("owner media")
    if (!property) {
      return res.status(404).json({ message: "Property not found" })
    }
    if (property.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own listings" })
    }

    // Delete all media from Cloudinary before removing the DB record
    if (property.media?.length > 0) {
      await Promise.allSettled(
        property.media.map((m) =>
          cloudinary.uploader.destroy(m.publicId, {
            resource_type: m.resourceType || "image",
          })
        )
      )
    }

    await Property.findByIdAndDelete(req.params.id)

    // Clean up related data
    await Promise.allSettled([
      Comment.deleteMany({ property: req.params.id }),
      Bookmark.deleteMany({ targetType: "Property", targetId: req.params.id }),
    ])

    return res.status(200).json({ success: true, message: "Listing deleted successfully" })
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete listing", error: error.message })
  }
})

// DELETE /requests/:id (owner only)
router.delete("/requests/:id", authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).select("requester")
    if (!request) {
      return res.status(404).json({ message: "Request not found" })
    }
    if (request.requester.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own requests" })
    }

    await Request.findByIdAndDelete(req.params.id)

    // Clean up related data
    await Promise.allSettled([
      Discussion.deleteMany({ request: req.params.id }),
      RequestResponse.deleteMany({ request: req.params.id }),
      Bookmark.deleteMany({ targetType: "Request", targetId: req.params.id }),
    ])

    return res.status(200).json({ success: true, message: "Request deleted successfully" })
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete request", error: error.message })
  }
})

// POST /requests/:id/report
router.post("/requests/:id/report", authMiddleware, async (req, res) => {
  try {
    const { reason, details = "" } = req.body

    const validReasons = ["spam", "fraud", "harassment", "fake_listing", "inappropriate_content", "other"]
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ message: "A valid report reason is required" })
    }

    if (details && details.length > 300) {
      return res.status(400).json({ message: "Report details exceed the maximum length of 300 characters" })
    }
    
    const request = await Request.findById(req.params.id).select("requester")
    if (!request) {
      return res.status(404).json({ message: "Request not found" })
    }

    if (request.requester.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot report your own request" })
    }

    // Request schema has no reportsCount or reports array — only create the Report document
    await Report.create({
      reporter: req.user.id,
      targetType: "request", 
      targetId: request._id,
      reason,
      details: details.toString().trim().slice(0, 300),
    })

    return res.status(200).json({ success: true, message: "Report submitted" })
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit report", error: error.message })
  }
})

module.exports = router
