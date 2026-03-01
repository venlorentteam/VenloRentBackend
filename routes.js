const express = require("express")
const nodemailer = require("nodemailer")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const User = require("./models/User")
const authMiddleware = require("./middleware/authMiddleware")
require("dotenv").config()

const router = express.Router()

// Health check route
router.get("/", async (req, res) => {
  try {
    res.status(200).json({ message: "Server is listening for incoming requests" })
  } catch (error) {
    res.status(500).json({ message: "Server Error" })
  }
})

// Register a new user
router.post("/auth/register", async (req, res) => {
  try {
    const { fullName, email, username, password, role = "regular" } = req.body

    if (!fullName || !email || !username || !password) {
      return res.status(400).json({
        message: "Please fill all required fields",
      })
    }

    // Validate role
    if (!["regular", "agent"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" })
    }

    // Check if email or username already exists.
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.toLowerCase().trim() },
      ],
    })

    if (existingUser) {
      return res.status(409).json({
        message: "Email or username already in use",
      })
    }

    //Generate OTP and expiration time
    const otp = crypto.randomInt(100000, 999999).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000) // OTP valid for 10 minutes

    //lconfigure nodemailer transporter (using EGmail for testing)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,       //Gmail address
        pass: process.env.EMAIL_APP_PASSWORD // Gmail App Password (Gmail logins for testing)
      }
    });
    // Password hashing happens automatically in the User model pre-save hook.
    const user = await User.create({
      fullName,
      email,
      username,
      password,
      role,
      otp,
      otpExpires,
    })

    //Send OTP email
    await transporter.sendMail({
      from: `"VenloRent Email Verification" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your email",
      html: `<p>Your verification code is</p> <h1>${otp}</h1> <p>It expires in 10 minutes.</p>`
    });

    // Creating a return object
    const userResponse = {
      email: user.email,
      role: user.role,
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: userResponse,
    })

  } catch (error) {
    return res.status(500).json({
      message: "Failed to register user",
      error: error.message,
    })
  }
})

// Login an existing user
router.post("/auth/login", async (req, res) => {
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

    const isPasswordValid = await user.comparePassword(password)

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" })
    }
    //Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
      },
    })
  } catch (error) {
    return res.status(500).json({
      message: "Failed to login",
      error: error.message,
    })
  }
})

//Check user availability
router.post("/auth/check-user", async (req, res) => {
  try {
    const email = req.body?.email?.toLowerCase().trim()
    const username = req.body?.username?.toLowerCase().trim()

    if (!email && !username) {
      return res.status(400).json({
        message: "Provide email and/or username",
      })
    }

    const query = []
    if (email) query.push({ email })
    if (username) query.push({ username })

    const existingUsers = await User.find({ $or: query }).select("email username")

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
    })
  }
})

//Verify OTP
router.post("/auth/email-verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Check OTP validity
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    if (Date.now() > user.otpExpires) return res.status(400).json({ message: "OTP expired" });

    user.emailVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    //Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    //Send a return object
    const userResponse = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    }
    res.json({ success: true, token, user: userResponse, message: "Email verified successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
})

//Profile route (protected)
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -otp -otpExpires")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    return res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch profile" })
  }
})

module.exports = router


