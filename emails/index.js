const { Resend } = require("resend")

// ==========================================================
// Brand tokens — single source of truth for all email styles.
// Matches the VenloRent design system (emerald-500 primary).
// ==========================================================
const B = {
  name: "VenloRent",
  primary: "#059669", // emerald-600
  primaryDark: "#047857", // emerald-700
  dark: "#1f2937", // gray-800
  soft: "#f9faf8", // app bg
  muted: "#6b7280", // gray-500
  border: "#e5e7eb", // gray-200
  white: "#ffffff",
  helpUrl: `${process.env.APP_URL}/help`,
  privacyUrl: `${process.env.APP_URL}/privacy`,
  appUrl: process.env.APP_URL,
}

const getResendClient = () => new Resend(process.env.RESEND_API_KEY)

// ===================================================
// Base shell — every email shares this outer chrome.
// ===================================================
const shell = (bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${B.name}</title>
</head>
<body style="margin:0;padding:0;background:${B.soft};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:${B.soft};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="max-width:560px;background:${B.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Logo bar -->
          <tr>
            <td style="background:${B.dark};padding:22px 36px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="width:10px;height:10px;background:${B.primary};border-radius:50%;"></td>
                  <td style="padding-left:10px;font-size:17px;font-weight:700;color:${B.white};letter-spacing:0.3px;">
                    ${B.name}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${B.soft};border-top:1px solid ${B.border};padding:20px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">
                <a href="${B.helpUrl}" style="color:${B.primary};text-decoration:none;">Help Center</a>
                &nbsp;&middot;&nbsp;
                <a href="${B.privacyUrl}" style="color:${B.primary};text-decoration:none;">Privacy Policy</a>
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;">
                &copy; ${new Date().getFullYear()} ${B.name}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

// ========================================
// Reusable inner pieces
// ========================================

// Emerald CTA button
const btn = (text, url) => `
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto;">
    <tr>
      <td style="background:${B.primary};border-radius:8px;">
        <a href="${url}"
           style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;
                  color:${B.white};text-decoration:none;letter-spacing:0.2px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>
`

// Section heading
const h1 = (text) =>
  `<h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:${B.dark};letter-spacing:-0.3px;">${text}</h1>`

// Lead paragraph
const lead = (text) =>
  `<p style="margin:0 0 24px;font-size:15px;color:${B.muted};line-height:1.65;">${text}</p>`

// Small note paragraph
const note = (text) =>
  `<p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">${text}</p>`

// Thin divider
const divider =
  `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:24px 0;">
    <tr><td style="border-top:1px solid ${B.border};"></td></tr>
  </table>`

// ========================================
// 1. OTP / Email Verification
// ========================================
const renderOtpEmail = (otp) => shell(`
  ${h1("Verify your email address")}
  ${lead("You're almost there! Enter the code below to verify your email and activate your VenloRent account.")}

  <!-- OTP block -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="background:${B.soft};border:1.5px solid ${B.border};border-radius:12px;margin:0 0 24px;">
    <tr>
      <td align="center" style="padding:24px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${B.muted};letter-spacing:1px;text-transform:uppercase;">
          Your verification code
        </p>
        <p style="margin:8px 0 0;font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:700;
                  color:${B.primary};letter-spacing:14px;line-height:1;">
          ${otp}
        </p>
      </td>
    </tr>
  </table>

  <!-- Timer pill -->
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 24px;">
    <tr>
      <td style="background:#fef3c7;border-radius:99px;padding:6px 16px;">
        <p style="margin:0;font-size:12px;font-weight:600;color:#92400e;">⏱ Expires in 10 minutes</p>
      </td>
    </tr>
  </table>

  ${divider}
  ${note(`Didn't request this? You can safely ignore this email — your account won't be affected.<br/>Never share this code with anyone, including ${B.name} support.`)}
`)

// =========================================================
// // 2. Welcome email (sent after successful OTP verification)
// =========================================================
const renderWelcomeEmail = (fullName) => shell(`
  <!-- Hero accent bar -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 28px;">
    <tr>
      <td style="background:linear-gradient(135deg,${B.primary},${B.primaryDark});
                 border-radius:10px;padding:28px 24px;text-align:center;">
        <p style="margin:0;font-size:32px;">🏠</p>
        <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:${B.white};">
          Welcome${fullName ? `, ${fullName}` : ""}!
        </p>
        <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">
          Your account is ready to go.
        </p>
      </td>
    </tr>
  </table>

  ${lead("You've joined a growing community of property seekers, owners, and verified agents. Here's what you can do on VenloRent:")}

  <!-- Feature list -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 28px;">
    ${[
      ["🔍", "Browse verified listings",    "Search apartments, flats, duplexes and more across Nigeria."],
      ["🔔", "Post a property request",     "Tell agents exactly what you're looking for and get responses."],
      ["✅", "Get agent-verified",           "Submit your KYC to list properties and unlock agent features."],
      ["💬", "Chat directly with agents",   "Message agents and negotiate directly inside the app."],
    ].map(([icon, title, desc]) => `
      <tr>
        <td style="padding:8px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                 style="background:${B.soft};border-radius:10px;border:1px solid ${B.border};">
            <tr>
              <td style="padding:14px 16px;width:40px;vertical-align:top;font-size:20px;">${icon}</td>
              <td style="padding:14px 16px 14px 0;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:${B.dark};">${title}</p>
                <p style="margin:0;font-size:13px;color:${B.muted};line-height:1.5;">${desc}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("")}
  </table>

  ${btn("Explore Listings", B.appUrl)}

  ${divider}
  ${note("Questions? Visit our <a href='${B.helpUrl}' style='color:${B.primary};text-decoration:none;'>Help Center</a> or reply to this email and we'll be happy to help.")}
`)

// ========================================
// 3. Password reset link email
// ========================================
const renderPasswordResetEmail = (fullName, resetUrl) => shell(`   
  <!-- Lock icon -->
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 24px;">
    <tr>
      <td style="background:#fef2f2;border-radius:50%;width:56px;height:56px;text-align:center;vertical-align:middle;">
        <p style="margin:0;font-size:28px;line-height:56px;">🔒</p>
      </td>
    </tr>
  </table>

  ${h1("Reset your password")}
  ${lead(`Hi${fullName ? ` ${fullName}` : ""}, we received a request to reset the password for your VenloRent account. Click the button below to choose a new password.`)}

  ${btn("Reset My Password", resetUrl)}

  <!-- Security note box -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="margin:24px 0 0;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
          ⚠️ <strong>This link expires in 30 minutes.</strong><br/>
          If you didn't request a password reset, please ignore this email.
          Your password will remain unchanged and your account stays secure.
        </p>
      </td>
    </tr>
  </table>

  ${divider}
  ${note("For security, never share this link. If you need help, contact us via our <a href='${B.helpUrl}' style='color:${B.primary};text-decoration:none;'>Help Center</a>.")}
`)   // ← return added by removing the curly-brace body

// ========================================
// 4. Password changed confirmation email
// ========================================
const renderPasswordChangedEmail = (fullName) => shell(`
  <!-- Shield icon -->
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 24px;">
    <tr>
      <td style="background:#d1fae5;border-radius:50%;width:56px;height:56px;text-align:center;vertical-align:middle;">
        <p style="margin:0;font-size:28px;line-height:56px;">🛡️</p>
      </td>
    </tr>
  </table>

  ${h1("Your password was changed")}
  ${lead(`Hi${fullName ? ` ${fullName}` : ""}, this is a confirmation that the password for your VenloRent account was successfully updated.`)}

  <!-- Timestamp row -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="background:${B.soft};border:1px solid ${B.border};border-radius:10px;margin:0 0 24px;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:${B.muted};">
          🕐 Changed on <strong style="color:${B.dark};">${new Date().toUTCString()}</strong>
        </p>
      </td>
    </tr>
  </table>

  <!-- Warning if not you -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin:0 0 24px;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.6;">
          🚨 <strong>Didn't make this change?</strong><br/>
          If you didn't update your password, your account may be compromised.
          <a href="${B.appUrl}/password-recovery"
             style="color:#dc2626;font-weight:600;text-decoration:underline;">
            Reset your password immediately
          </a>.
        </p>
      </td>
    </tr>
  </table>

  ${btn("Go to My Account", B.appUrl)}

  ${divider}
  ${note("If you have questions or concerns, visit our <a href='${B.helpUrl}' style='color:${B.primary};text-decoration:none;'>Help Center</a>.")}
`)

// ========================================
// 5. Listing ordered email
// ========================================
const renderListingOrderedEmail = ({
  agentName = "",
  buyerName = "",
  listingTitle = "",
  listingPrice = "",
  listingLocation = "",
  orderUrl = B.appUrl,
}) => shell(`
  <!-- Status pill -->
  <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 20px;">
    <tr>
      <td style="background:#ecfdf5;border-radius:99px;padding:6px 16px;">
        <p style="margin:0;font-size:12px;font-weight:600;color:${B.primaryDark};">New order received</p>
      </td>
    </tr>
  </table>

  ${h1("Your listing has been ordered")}
  ${lead(`Hi${agentName ? ` ${agentName}` : ""}, one of your listings just received a new order. We have included the key details below so you can review it right away.`)}

  <!-- Listing summary -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="background:${B.soft};border:1px solid ${B.border};border-radius:12px;margin:0 0 24px;">
    <tr>
      <td style="padding:18px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:${B.muted};letter-spacing:0.8px;text-transform:uppercase;">
          Listing details
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:${B.muted};width:130px;">Listing</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:${B.dark};">${listingTitle || "Untitled listing"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:${B.muted};width:130px;">Price</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:${B.dark};">${listingPrice || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:${B.muted};width:130px;">Location</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:${B.dark};">${listingLocation || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:${B.muted};width:130px;">Ordered by</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:${B.dark};">${buyerName || "A buyer"}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  ${btn("Review Order", orderUrl)}

  ${divider}
  ${note("If this order was unexpected, log in to your account to review the listing and order activity.")}
`)

module.exports = {
  getResendClient,
  renderOtpEmail,
  renderWelcomeEmail,
  renderPasswordResetEmail,
  renderPasswordChangedEmail,
  renderListingOrderedEmail,
}
