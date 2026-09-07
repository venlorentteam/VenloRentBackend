const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  type: String,
  processedAt: { type: Date, default: Date.now },
})
module.exports = mongoose.model('ProcessedWebhookEvent', schema)