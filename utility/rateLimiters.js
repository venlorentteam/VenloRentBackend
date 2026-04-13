// utils/rateLimiters.js

const rateLimit = require('express-rate-limit')

// Factory — call this with custom options per route
const createLimiter = (windowMinutes, max, message) =>
  rateLimit({
    windowMs:       windowMinutes * 60 * 1000,
    max,
    message:        { message },
    standardHeaders: true,
    legacyHeaders:  false,
  })

// Each route gets its own limiter with appropriate thresholds
module.exports = {

  // Login — generous enough for normal use, tight enough to block brute force
  loginLimiter: createLimiter(
    15,   // 15 minute window
    10,   // 10 attempts
    'Too many login attempts. Please try again in 15 minutes.'
  ),

  // OTP resend — stricter, email sending is abusable
  otpLimiter: createLimiter(
    10,   // 10 minute window
    3,    // 3 attempts
    'Too many resend attempts. Please wait before trying again.'
  ),

  // OTP verification — prevent brute forcing the 6-digit code
  verifyLimiter: createLimiter(
    10,   // 10 minute window
    5,    // 5 attempts
    'Too many verification attempts. Please request a new code.'
  ),

  // Registration — prevent mass account creation
  registerLimiter: createLimiter(
    60,   // 1 hour window
    5,    // 5 attempts
    'Too many accounts created from this IP. Please try again later.'
  ),

  // Password reset — sensitive, keep tight
  passwordResetLimiter: createLimiter(
    15,   // 15 minute window
    5,    // 5 attempts
    'Too many password reset attempts. Please try again later.'
  ),
}