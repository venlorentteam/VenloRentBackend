// utility/bachs.js
const Bachs = require('@bachs/sdk')
const crypto = require('crypto')

function createBachsClient() {
  const apiKey = process.env.BACHS_KEY

  // The published @bachs/sdk package is currently a placeholder that exports {}
  // instead of a constructor. Keep the app bootable and fail gracefully on the
  // billing endpoints until the real SDK is available.
  if (typeof Bachs === 'function') {
    return new Bachs({ key: apiKey })
  }

  if (Bachs && typeof Bachs.Bachs === 'function') {
    return new Bachs.Bachs({ key: apiKey })
  }

  const unavailable = new Error(
    'Bachs SDK is not available in this install. The published @bachs/sdk package currently exports a placeholder object.'
  )

  return {
    checkout: {
      create: async () => {
        throw unavailable
      },
    },
    customers: {
      create: async () => {
        throw unavailable
      },
    },
  }
}

const bachs = createBachsClient()

async function getOrCreateBachsCustomer(user) {
  if (user.bachsCustomerId) return user.bachsCustomerId
  const customer = await bachs.customers.create({ email: user.email })
  user.bachsCustomerId = customer.id
  await user.save()
  return customer.id
}

function verifyBachsSignature(rawBody, secret, timestampHeader, signatureHeader, toleranceSeconds = 300) {
  const timestamp = parseInt(timestampHeader, 10)
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false

  const message = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  } catch {
    return false
  }
}

const PLAN_PRODUCTS = {
  pro: 'process.env.PRO_MONTHLY',
  premium: 'process.env.PREMIUM_MONTHLY',
}

const PRODUCT_TO_PLAN = Object.fromEntries(
  Object.entries(PLAN_PRODUCTS).map(([plan, product]) => [product, plan])
)

// Plans caching and fetching helper
let plansCache = { data: null, expiresAt: 0 }
const PLANS_CACHE_TIME = 5 * 60 * 1000 // 5 minutes — prices rarely change

async function getPlanPricing() {
  if (plansCache.data && Date.now() < plansCache.expiresAt) {
    return plansCache.data
  }

  const entries = await Promise.all(
    Object.entries(PLAN_PRODUCTS).map(async ([key, productId]) => {
      const product = await bachs.products.retrieve(productId)
      return [
        key,
        {
          key,
          name: product.name,
          price: Number(product.price ?? product.amount), // adjust to actual SDK field name once confirmed
          currency: product.currency || 'NGN',
          interval: product.recurring?.interval || 'month',
        },
      ]
    })
  )

  plansCache = {
    data: Object.fromEntries(entries),
    expiresAt: Date.now() + PLANS_CACHE_TIME,
  }
  return plansCache.data
}

module.exports = { bachs, getOrCreateBachsCustomer, verifyBachsSignature, getPlanPricing, PLAN_PRODUCTS, PRODUCT_TO_PLAN }
