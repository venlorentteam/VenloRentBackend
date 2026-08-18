require("dotenv").config()
const express = require("express")
const apiRoutes = require("./routes")
const connectDB = require("./connect")
const cors = require("cors")
const { expireOverdueOrders } = require("./utility/orderLifecycle")

const app = express()
const PORT = process.env.PORT || 4000

// Call Express Middlewares
app.use(cors())
app.use("/auth/kyc/didit-webhook", express.raw({ type: "application/json" })) // raw body required for HMAC verification in KYC webhook
app.use("/billing/webhook", express.raw({ type: "application/json" })) // raw body required for HMAC verification in Bachs webhook
// Raw body parsing is required to be placed before the general JSON parser, otherwise the webhook signature verification will fail due to altered request body.
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))
app.use("/", apiRoutes)

// Start the server only after database connection succeeds.
const startServer = async () => {
  await connectDB()
  app.listen(PORT, () => {
    console.log(`Server is running on ${PORT} and listening for requests`)
  })

  // Run once on boot so overdue orders are corrected immediately,
  // then keep checking on a fixed interval in the background.
  const ORDER_LIFECYCLE_POLL_MS = 15 * 60 * 1000

  const runOrderLifecycleSweep = async () => {
    try {
      await expireOverdueOrders()
    } catch (error) {
      console.error("Order lifecycle sweep failed:", error)
    }
  }

  await runOrderLifecycleSweep()
  setInterval(runOrderLifecycleSweep, ORDER_LIFECYCLE_POLL_MS)
}

startServer()
