// utility/notify.js
const Notification = require("../models/Notification")

/**
 * Creates a notification. Silently swallows errors so a failed
 * notification never breaks the parent request.
 *
 * @param {object} opts
 * @param {string}  opts.recipient  - User ID receiving the notification
 * @param {string}  opts.sender - User ID who triggered it (omit for system)
 * @param {string}  opts.type - One of the notificationSchema enum values
 * @param {string}  [opts.targetType]
 * @param {string}  [opts.targetId]
 * @param {object}  [opts.snapshot] - { title, image, price, location }
 */
const notify = async ({
  recipient,
  sender = null,
  type,
  targetType = null,
  targetId = null,
  snapshot = {},
}) => {
  // Never notify someone about their own actions
  if (sender && String(sender) === String(recipient)) return

  try {
    await Notification.create({
      recipient,
      sender,
      type,
      targetType,
      targetId,
      snapshot,
    })
  } catch (err) {
    // Log but don't throw — notifications are non-critical
    console.error("Failed to create notification:", err.message)
  }
}

module.exports = notify