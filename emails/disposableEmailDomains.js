// utility/disposableEmailDomains.js

// Hand-picked list of the most commonly abused disposable/temp-mail domains.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "tempmail.dev",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "trashmail.com",
  "trashmail.net",
  "getnada.com",
  "moakt.com",
  "fakeinbox.com",
  "mytemp.email",
  "dispostable.com",
  "mintemail.com",
  "mailnesia.com",
  "mailcatch.com",
  "spamgourmet.com",
  "maildrop.cc",
  "emailondeck.com",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "tempinbox.com",
  "burnermail.io",
  "instant-mail.de",
  "mohmal.com",
  "tempr.email",
  "einrot.com",
  "test.com",
  "example.com",
])

const isDisposableEmailDomain = (domain = "") =>
  DISPOSABLE_DOMAINS.has(domain.toLowerCase().trim())

module.exports = { DISPOSABLE_DOMAINS, isDisposableEmailDomain }