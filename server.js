require("dotenv").config()
const express = require("express")
const apiRoutes = require("./routes")
const connectDB = require("./connect")
const cors = require("cors")

const app = express()
const PORT = process.env.PORT || 4000

//Call Express Middlewares
app.use(cors())
app.use("/auth/kyc/didit-webhook", express.raw({ type: "application/json" })) // raw body required for HMAC verification in KYC webhook
// Raw body parsing is required to be placed before the general JSON parser, otherwise the webhook signature verification will fail due to altered request body.
app.use(express.json())
app.use("/", apiRoutes)

// Start the server only after database connection succeeds.
const startServer = async () => {
  await connectDB()
  app.listen(PORT, () => {
    console.log(`Server is running on ${PORT} and listening for requests`)
  })
}

startServer()