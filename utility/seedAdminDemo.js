require("dotenv").config()

const mongoose = require("mongoose")
const connectDB = require("../connect")
const Admin = require("../models/Admin")

const demoAdmins = [
  {
    fullName: "Super Admin",
    email: "admin@venlorent.com",
    password: "VenloRent_2026$",
    role: "superadmin",
    status: "active",
    permissions: ["*"],
    mustChangePassword: true,
  },
  {
    fullName: "Admin",
    email: "admin@example.com",
    password: "Admin123!",
    role: "admin",
    status: "active",
    permissions: [
      "dashboard.read",
      "users.read",
      "users.update",
      "requests.read",
      "requests.update",
    ],
    mustChangePassword: true,
  },
  {
    fullName: "Moderator",
    email: "moderator@example.com",
    password: "Admin123!",
    role: "moderator",
    status: "active",
    permissions: [
      "requests.read",
      "requests.update",
      "reports.read",
      "reports.update",
    ],
    mustChangePassword: true,
  },
]

const seedAdmins = async () => {
  await connectDB()

  try {
    const demoEmails = demoAdmins.map((admin) => admin.email)

    await Admin.deleteMany({ email: { $in: demoEmails } })
    await Admin.create(demoAdmins)

    //console.log("Admin collection seeded successfully.")
    demoAdmins.forEach((admin) => {
      console.log(`- ${admin.email} / ${admin.password}`)
    })
  } catch (error) {
    console.error("Failed to seed admins:", error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seedAdmins()
