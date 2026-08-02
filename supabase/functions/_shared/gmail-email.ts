// ---- GMAIL EMAIL HELPERS (shared across redeem-code, mxlpay-webhook, subscription-manager) ----

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function base64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64url(bytes: Uint8Array): string {
  return base64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  if (!clean) return "";
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${base64(new TextEncoder().encode(clean))}?=`;
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
  const encoder = new TextEncoder();
  const lines: string[] = [];

  lines.push(`From: ${encodeHeader(fromName) || fromEmail} <${fromEmail}>`);
  lines.push(`To: ${toEmail}`);
  lines.push(`Subject: ${encodeHeader(subject)}`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(base64(encoder.encode(textBody)));
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(base64(encoder.encode(htmlBody)));
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

export const LOGO_URL = "https://squidcloud.vercel.app/icon-512x512.png";
export const APP_URL = "https://squidcloud.vercel.app";

export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const MONO_STACK =
  "'SF Mono', 'Roboto Mono', ui-monospace, Menlo, Consolas, monospace";

export const BG = "#0A0A0A";
export const CARD = "#121212";
export const BORDER = "#27272A";
export const TEXT = "#FAFAFA";
export const TEXT_2 = "#A1A1AA";
export const MUTED = "#71717A";

export function emailShell(
  content: string,
  kicker: string,
  jsonLd?: string,
  footerExtra?: string,
): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>SquidCloud — ${kicker}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:${FONT_STACK};">
  <center role="presentation" style="width:100%;table-layout:fixed;background-color:${BG};padding:40px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;">
      <tr>
        <td align="center" style="padding:0 0 28px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center">
                <img src="${LOGO_URL}" alt="SquidCloud" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:11px;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:10px;">
                <span style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:${TEXT};line-height:1.">SquidCloud</span>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:6px;">
                <span style="font-family:${MONO_STACK};font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">${kicker}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${CARD};border:1px solid ${BORDER};border-radius:20px;overflow:hidden;">
            ${content}
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:24px;">
          <span style="font-size:13px;color:${MUTED};line-height:1.7;">© ${new Date().getUTCFullYear()} SquidCloud. All rights reserved.<br/>You received this email because of activity on your SquidCloud account.${footerExtra ? `<br/>${footerExtra}` : ""}</span>
        </td>
      </tr>
    </table>
  </center>
  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
</body>
</html>`;
}

function divider(paddingTop = 26, paddingBottom = 26): string {
  return `<tr><td style="padding:${paddingTop}px 40px ${paddingBottom}px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background-color:${BORDER};font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>`;
}

function sectionLabel(label: string): string {
  return `<tr><td style="padding:0 40px 14px 40px;"><span style="font-family:${MONO_STACK};font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTED};">${label}</span></td></tr>`;
}

function kvRow(key: string, value: string, mono = false): string {
  return `<tr>
    <td width="45%" style="padding:8px 0 8px 40px;"><span style="font-size:16px;line-height:1.6;color:${TEXT_2};">${key}</span></td>
    <td width="55%" align="right" style="padding:8px 40px 8px 16px;"><span style="font-size:16px;line-height:1.6;color:${TEXT};${mono ? `font-family:${MONO_STACK};` : ""}word-break:break-all;">${value}</span></td>
  </tr>`;
}

export interface ReceiptParams {
  username: string;
  userId: string;
  planType: string;
  billingPeriod: string;
  startsAt: string;
  expiresAt: string;
  amount: number;
  currency: string;
  transactionId?: string;
  paymentMode: string;
  discountPercent?: number;
  discountCode?: string;
  txHash?: string;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function billingLabel(period: string): string {
  switch (period) {
    case "weekly":
      return "Weekly";
    case "annual":
      return "Annual";
    default:
      return "Monthly";
  }
}

export function buildReceiptEmailHtml(params: ReceiptParams): string {
  const {
    username,
    userId,
    planType,
    billingPeriod,
    startsAt,
    expiresAt,
    amount,
    currency,
    paymentMode,
  } = params;

  const transactionId = params.transactionId ?? params.txHash ?? "";

  const label = billingLabel(billingPeriod);
  const planName = getDisplayName(planType);
  const orderId = `ORD-${userId.slice(0, 8).toUpperCase()}`;
  const isoDuration =
    billingPeriod === "weekly" ? "P1W" : billingPeriod === "annual" ? "P1Y" : "P1M";

  const hasDiscount =
    typeof params.discountPercent === "number" && params.discountPercent > 0;

  const discountRow = hasDiscount
    ? `<tr>
        <td width="45%" style="padding:8px 0 8px 40px;"><span style="font-size:16px;color:${TEXT_2};">Discount${params.discountCode ? ` (${escapeHtml(params.discountCode)})` : ""}</span></td>
        <td width="55%" align="right" style="padding:8px 40px 8px 16px;"><span style="font-size:16px;color:${TEXT_2};">− ${params.discountPercent}%</span></td>
      </tr>`
    : "";

  const jsonLd = `[
    {
      "@context": "http://schema.org",
      "@type": "Invoice",
      "accountId": "${escapeHtml(userId)}",
      "orderNumber": "${orderId}",
      "customer": { "@type": "Person", "name": "${escapeHtml(username)}" },
      "provider": { "@type": "Organization", "name": "SquidCloud" },
      "paymentMethod": "${escapeHtml(paymentMode)}",
      "paymentStatus": "PaymentAutomaticallyApplied",
      "paymentDue": "${new Date(startsAt).toISOString()}",
      "billingPeriod": "${isoDuration}",
      "description": "${escapeHtml(planName)} subscription (${label.toLowerCase()})",
      "totalPaymentDue": { "@type": "PriceSpecification", "price": "${escapeHtml(currency)} ${amount.toFixed(2)}" },
      "referencesOrder": {
        "@type": "Order",
        "orderNumber": "${orderId}",
        "merchant": { "@type": "Organization", "name": "SquidCloud" },
        "acceptedOffer": {
          "@type": "Offer",
          "priceCurrency": "${escapeHtml(currency)}",
          "price": "${amount.toFixed(2)}",
          "itemOffered": { "@type": "Product", "name": "${escapeHtml(planName)} subscription (${label.toLowerCase()})" }
        },
        "orderStatus": "http://schema.org/OrderPaid",
        "url": "${APP_URL}/receipts/${escapeHtml(userId)}?plan=${escapeHtml(planType)}&txn=${escapeHtml(transactionId)}"
      }
    }
  ]`;

  const content = `
    <tr>
      <td style="padding:34px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="bottom">
              <span style="font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT};">Payment receipt</span>
            </td>
            <td align="right" valign="bottom">
              <span style="font-family:${MONO_STACK};font-size:13px;letter-spacing:0.12em;color:${TEXT_2};">${orderId}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${divider(22, 28)}
    ${sectionLabel("Details")}
    <tr><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${kvRow("Plan", escapeHtml(planName))}
        ${kvRow("Billing cycle", label)}
        ${kvRow("Start date", formatDate(startsAt))}
        ${kvRow("Renewal date", formatDate(expiresAt))}
        ${kvRow("Payment method", escapeHtml(paymentMode))}
        ${kvRow("Transaction", escapeHtml(transactionId || "—"), true)}
      </table>
    </td></tr>
    ${divider()}
    ${sectionLabel("Summary")}
    <tr><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${discountRow}
        <tr>
          <td width="45%" style="padding:14px 0 28px 40px;"><span style="font-size:16px;font-weight:600;color:${TEXT};">Total paid</span></td>
          <td width="55%" align="right" style="padding:14px 40px 28px 16px;">
            <span style="font-size:24px;font-weight:600;letter-spacing:-0.01em;color:${TEXT};">${escapeHtml(currency)} ${amount.toFixed(2)}</span>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr>
      <td style="padding:0 40px 34px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:20px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:1px;background-color:${BORDER};font-size:1px;line-height:1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0 0 0;">
              <span style="font-size:14px;color:${MUTED};line-height:1.7;">Questions about this receipt? Reply to this email and our team will respond within one business day.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return emailShell(content, "Billing", jsonLd);
}

export function getDisplayName(planType: string): string {
  switch (planType) {
    case "supporter":
      return "Supporter";
    case "supporter-plus":
      return "Supporter+";
    default:
      return "Supporter";
  }
}

export function buildWelcomeEmailHtml(
  planType: string,
  username: string,
  expiresAt: string,
  billingPeriod = "monthly",
): string {
  const planName = getDisplayName(planType);
  const periodDays =
    billingPeriod === "weekly" ? 7 : billingPeriod === "annual" ? 365 : 30;
  const startDate = new Date(
    new Date(expiresAt).getTime() - periodDays * 86400000,
  ).toISOString();

  const jsonLd = `{
    "@context": "http://schema.org",
    "@type": "Subscription",
    "accountId": "${escapeHtml(username)}",
    "description": "${escapeHtml(planName)} subscription (${billingPeriod})",
    "startDate": "${new Date(startDate).toISOString()}",
    "endDate": "${new Date(expiresAt).toISOString()}",
    "potentialAction": {
      "@type": "CancelAction",
      "target": "${APP_URL}/settings/account?tab=preferences"
    }
  }`;
  const features: Record<string, string[]> = {
    supporter: [
      "Unlimited storage",
      "Priority processing queue",
      "10 concurrent uploads & downloads",
      "25 GB max upload file size",
      "10,000 API tokens per day",
      "Custom domains & always-active sites",
    ],
    "supporter-plus": [
      "Unlimited storage",
      "Top priority processing queue",
      "Unlimited concurrent uploads & downloads",
      "Unlimited upload file size",
      "Unlimited API tokens per day",
      "Priority support & early features",
    ],
  };
  const list = features[planType] ?? features.supporter;

  const content = `
    <tr>
      <td style="padding:34px 40px 0 40px;">
        <span style="font-size:26px;font-weight:600;letter-spacing:-0.02em;color:${TEXT};">Welcome, ${escapeHtml(username)}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 40px 0 40px;">
        <span style="font-size:17px;color:${TEXT_2};line-height:1.8;">Thank you for choosing SquidCloud. Your ${escapeHtml(planName)} subscription is active, and its benefits are available now.</span>
      </td>
    </tr>
    ${divider(26, 28)}
    ${sectionLabel("Subscription")}
    <tr><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${kvRow("Plan", escapeHtml(planName))}
        ${kvRow("Status", "Active")}
        ${kvRow("Renewal date", formatDate(expiresAt))}
      </table>
    </td></tr>
    ${divider()}
    ${sectionLabel("Included with your plan")}
    <tr><td style="padding:0 0 4px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${list
          .map(
            (f) => `<tr>
              <td width="24" style="padding:7px 0 7px 40px;"><span style="font-family:${MONO_STACK};font-size:14px;color:${MUTED};">+</span></td>
              <td style="padding:7px 40px 7px 0;"><span style="font-size:16px;color:${TEXT_2};">${escapeHtml(f)}</span></td>
            </tr>`,
          )
          .join("")}
      </table>
    </td></tr>
    ${divider()}
    <tr>
      <td style="padding:0 40px 8px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${TEXT}" style="border-radius:999px;">
              <a href="${APP_URL}/dashboard" target="_blank" style="display:inline-block;padding:13px 32px;font-size:16px;font-weight:600;letter-spacing:0.01em;color:${BG};text-decoration:none;border-radius:999px;">Open dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px 36px 40px;">
        <span style="font-size:14px;color:${MUTED};line-height:1.7;">Questions about your plan? Reply to this email and our team will respond within one business day.</span>
      </td>
    </tr>`;

  return emailShell(content, "Subscription", jsonLd);
}
