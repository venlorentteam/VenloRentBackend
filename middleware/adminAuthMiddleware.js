const jwt = require("jsonwebtoken")
const Admin = require("../models/Admin")

const adminAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" })
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded?.type !== "admin") {
      return res.status(401).json({ message: "Invalid admin token" })
    }

    const admin = await Admin.findById(decoded.id).select("fullName email role status permissions avatar lastLoginAt")
    if (!admin || admin.status !== "active") {
      return res.status(401).json({ message: "Admin account not found or disabled" })
    }

    req.admin = {
      id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      permissions: admin.permissions,
      avatar: admin.avatar,
      lastLoginAt: admin.lastLoginAt,
    }

    next()
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" })
  }
}

module.exports = adminAuthMiddleware
