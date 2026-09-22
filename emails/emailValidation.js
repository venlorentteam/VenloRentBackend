// utility/emailValidation.js
const dns = require("dns").promises
const { isDisposableEmailDomain } = require("./disposableEmailDomains")

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

const isValidEmailFormat = (email = "") => EMAIL_REGEX.test(email.trim())

const getDomain = (email = "") => email.split("@")[1]?.toLowerCase().trim() || ""

const domainCanReceiveMail = async (domain) => {
  if (!domain) return false

  try {
    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error("DNS timeout")), 3000)),
    ])
    if (Array.isArray(mxRecords) && mxRecords.length > 0) return true

    // Fallback: some domains accept mail via A/AAAA record with no explicit MX.
    const aRecords = await dns.resolve4(domain).catch(() => [])
    return aRecords.length > 0
  } catch (err) {
    return false
  }
}

// Single entry point — runs all three checks in order, cheapest first.
// Returns { valid: boolean, reason?: string } so callers can surface a specific message.
const validateEmailThoroughly = async (email) => {
  const trimmed = (email || "").trim()

  if (!isValidEmailFormat(trimmed)) {
    return { valid: false, reason: "Invalid email address" }
  }

  const domain = getDomain(trimmed)

  if (isDisposableEmailDomain(domain)) {
    return { valid: false, reason: "Temporary or disposable email addresses are not allowed" }
  }

  const hasMx = await domainCanReceiveMail(domain)
  if (!hasMx) {
    return { valid: false, reason: "This email domain cannot receive mail" }
  }

  return { valid: true }
}

module.exports = { isValidEmailFormat, domainCanReceiveMail, validateEmailThoroughly }