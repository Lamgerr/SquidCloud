// ---- GMAIL EMAIL HELPERS (shared across redeem-code, mxlpay-webhook, subscription-manager) ----

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRfc2822Message(
  fromEmail: string,
  fromName: string,
  toEmail: string,
  subject: string,
  textBody: string,
  htmlBody: string,
): string {
  const boundary = `----=${Date.now().toString(36)}`;
  const lines: string[] = [];

  lines.push(`From: ${fromName} <${fromEmail}>`);
  lines.push(`To: ${toEmail}`);
  lines.push(`Subject: ${subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(textBody);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(htmlBody);
  lines.push("");
  lines.push(`--${boundary}--`);

  return lines.join("\r\n");
}

async function getGmailAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OAuth2 token refresh failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function sendEmail(
  toEmail: string,
  subject: string,
  textBody: string,
  htmlBody: string,
): Promise<void> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  const senderEmail = Deno.env.get("GMAIL_SENDER_EMAIL");

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    console.warn("Gmail API not configured, skipping email");
    return;
  }

  const accessToken = await getGmailAccessToken(clientId, clientSecret, refreshToken);

  const rawMessage = buildRfc2822Message(senderEmail, "SquidCloud", toEmail, subject, textBody, htmlBody);

  const encoder = new TextEncoder();
  const encoded = base64url(encoder.encode(rawMessage));

  const sendRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    },
  );

  if (!sendRes.ok) {
    const errBody = await sendRes.text().catch(() => "");
    console.error(`Gmail API error ${sendRes.status}: ${errBody}`);
    throw new Error(`Gmail API error ${sendRes.status}`);
  }
}

// ---- RECEIPT EMAIL BUILDER ----

export interface ReceiptParams {
  username: string;
  userId: string;
  planType: string;
  billingPeriod: string;
  startsAt: string;
  expiresAt: string;
  amount: number;
  currency: string;
  paymentMode: string;
  discountPercent: number;
  discountCode: string;
  txHash: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export function buildReceiptEmailHtml(params: ReceiptParams): string {
  const planName = params.planType === "supporter-plus" ? "Supporter+" : "Supporter";
  const billingLabel = params.billingPeriod === "annual" ? "Annual" : params.billingPeriod === "weekly" ? "Weekly" : "Monthly";
  const startDate = formatDate(params.startsAt);
  const expiryDate = formatDate(params.expiresAt);
  const total = params.amount.toFixed(2);
  const original = params.discountPercent > 0
    ? (params.amount / (1 - params.discountPercent / 100)).toFixed(2)
    : total;

  const orderId = `${params.planType}_${params.billingPeriod}_${params.userId}_${Date.now()}`;

  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Invoice",
    "identifier": orderId,
    "totalPaymentDue": {
      "@type": "PriceSpecification",
      "price": total,
      "priceCurrency": params.currency || "USD",
    },
    "paymentStatus": "https://schema.org/PaymentComplete",
    "paymentMethod": params.paymentMode === "crypto" ? "CryptoCurrency" : "PromotionalCode",
    "customer": {
      "@type": "Person",
      "identifier": params.userId,
      "name": params.username,
    },
    "referencesOrder": {
      "@type": "Order",
      "orderNumber": orderId,
      "description": `${planName} — ${billingLabel} Plan`,
    },
    "paymentDueDate": params.expiresAt,
  });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<script type="application/ld+json">${jsonld}</script>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;text-align:center">
              <h1 style="color:#ffffff;margin:0 0 4px;font-size:22px">Payment Successful 🎉</h1>
              <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px">${escapeHtml(planName)} — ${billingLabel} Plan</p>
            </td>
          </tr>
          <!-- Personal message -->
          <tr>
            <td style="padding:24px 32px 8px">
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.6">
                Hey <strong>${escapeHtml(params.username)}</strong> 👋
              </p>
              <p style="margin:12px 0 0;color:#374151;font-size:15px;line-height:1.6">
                Thank you so much for supporting SquidCloud! Your trust means the world to us.
                We're working hard to make every second of your subscription worth it — better
                uploads, faster speeds, and features you'll love. You're one of our favorite
                users (don't tell anyone 😉)! If you ever need anything, we're just an email away.
              </p>
            </td>
          </tr>
          <!-- Receipt header -->
          <tr>
            <td style="padding:24px 32px 8px">
              <h2 style="margin:0;color:#111827;font-size:18px;font-weight:700">Receipt</h2>
              <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Order ID: ${escapeHtml(orderId)}</p>
            </td>
          </tr>
          <!-- Details table -->
          <tr>
            <td style="padding:8px 32px">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">User ID</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:13px;font-family:monospace">${escapeHtml(params.userId)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Plan</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:13px;font-weight:600">${escapeHtml(planName)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Billing Period</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:13px">${billingLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Valid From</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:13px">${escapeHtml(startDate)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Expires On</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:13px">${escapeHtml(expiryDate)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Payment Mode</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:13px;text-transform:capitalize">${escapeHtml(params.paymentMode)}</span>
                  </td>
                </tr>
                ${params.txHash ? `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Transaction Hash</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:11px;font-family:monospace;word-break:break-all">${escapeHtml(params.txHash)}</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Subtotal</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#374151;font-size:13px">$${original} ${params.currency || "USD"}</span>
                  </td>
                </tr>
                ${params.discountPercent > 0 ? `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">
                    <span style="color:#6b7280;font-size:13px">Discount${params.discountCode ? ` (${escapeHtml(params.discountCode)})` : ''}</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">
                    <span style="color:#10b981;font-size:13px">-${params.discountPercent}%</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 0">
                    <span style="color:#374151;font-size:15px;font-weight:700">Total Charged</span>
                  </td>
                  <td style="padding:12px 0;text-align:right">
                    <span style="color:#111827;font-size:18px;font-weight:700">$${total} ${params.currency || "USD"}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb">
              <p style="margin:0 0 8px;color:#9ca3af;font-size:12px">
                SquidCloud — blazingly fast file sharing
              </p>
              <p style="margin:0;color:#9ca3af;font-size:11px">
                Need help? Reply to this email and we'll get back to you
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getDisplayName(profile: Record<string, any>): string {
  return profile?.display_name || profile?.username || profile?.full_name || profile?.email || "there";
}

export function buildWelcomeEmailHtml(planType: string, username: string, expiresAt: string): string {
  const planName = planType === "supporter-plus" ? "Supporter+" : "Supporter";
  const expiryDate = formatDate(expiresAt);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
              <h1 style="color:#ffffff;margin:0;font-size:22px">Welcome to ${escapeHtml(planName)}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6">
                Hey <strong>${escapeHtml(username)}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
                Thank you for upgrading to <strong>${escapeHtml(planName)}</strong>. Your subscription is now active.
              </p>
              <p style="margin:0 0 8px;color:#374151;font-size:14px">
                <strong>Plan:</strong> ${escapeHtml(planName)}
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:14px">
                <strong>Expires:</strong> ${escapeHtml(expiryDate)}
              </p>
              <p style="margin:0 0 8px;color:#6b7280;font-size:14px">What you get:</p>
              <ul style="color:#6b7280;font-size:13px;line-height:1.8;padding-left:20px">
                ${planType === "supporter-plus" ? `
                <li>Unlimited concurrent uploads & downloads</li>
                <li>No file size limits</li>
                <li>Unlimited API tokens per day</li>
                <li>Priority queue support</li>
                <li>Custom domains for published sites</li>
                <li>Always active sites — never archived</li>
                <li>Early access to new features</li>` : `
                <li>10 concurrent uploads & downloads</li>
                <li>25 GB max file size</li>
                <li>10,000 API tokens per day</li>
                <li>Priority queue support</li>
                <li>Custom domains for published sites</li>
                <li>Always active sites — never archived</li>
                <li>Early access to new features</li>`}
              </ul>
              <table cellpadding="0" cellspacing="0" style="margin:24px auto 0">
                <tr>
                  <td>
                    <a href="https://squidcloud.vercel.app/dashboard" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
              <p style="margin:0;color:#9ca3af;font-size:11px">SquidCloud</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
