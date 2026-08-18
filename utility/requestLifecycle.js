const Request = require("../models/Request")

const REQUEST_WINDOW_DAYS = 30
const isRequestExpired = (request, now = new Date()) => {
  if (!request) return false

  const expiresAt = request.expiresAt ? new Date(request.expiresAt) : null
  return Boolean(
    request.status === "expired" ||
    (expiresAt && expiresAt <= now)
  )
}

const expireOverdueRequests = async (now = new Date()) => {
  // Normalize any request that has passed its expiry window but is still
  // marked open, so downstream routes do not keep treating it as active.
  const result = await Request.updateMany(
    {
      status: { $ne: "expired" },
      expiresAt: { $type: "date", $lte: now },
    },
    {
      $set: { status: "expired" },
    }
  )

  return result
}

module.exports = {
  REQUEST_WINDOW_DAYS,
  isRequestExpired,
  expireOverdueRequests,
}
