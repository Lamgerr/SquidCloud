# SquidCloud Terms of Service

**Version:** 2.0  
**Effective Date:** 13 September 2026
**Last Updated:** 13 September 2026
**Applies To:** All SquidCloud services, platforms, APIs, CLI tools, and web interfaces  
**Operated By:** SquidCloud, an independent project  
**Platform:** https://squidcloud.vercel.app  

**Plain-language summary:** this document defines what words like "unlimited" actually mean on SquidCloud, what limits exist today, what limits we may add later, how safety screening works, and what happens if rules are broken. The summaries in boxes are explanations only — the binding terms are the numbered clauses.

---

## 1. Acceptance of Terms

By accessing or using any part of SquidCloud — including the web platform, API, CLI tools, or any related service — you agree to be bound by these Terms of Service ("Terms").

If you do not agree to these Terms, you must stop using SquidCloud immediately.

We may update these Terms from time to time. Material changes (new limits, new fees, new enforcement powers) are announced by dashboard notice and, where you have provided an email, by email at least 7 days before taking effect. Continued use of SquidCloud after an update means you accept the revised Terms. It is your responsibility to review them periodically. If you do not accept revised Terms, your remedy is to stop using the service and, for paid plans, cancel renewal per Section 4.

---

## 2. Eligibility

To use SquidCloud, you must:

- Be at least **13 years of age**
- If you are between 13 and 18, you must have the awareness and consent of a parent or legal guardian
- Be capable of entering into a binding agreement under applicable law
- Not be prohibited from using the service under the laws of your jurisdiction

By creating an account, you confirm that you meet these requirements.

---

## 3. Plans, Billing, and Fees

### 3.1 Tiers
SquidCloud offers a Free tier and paid Supporter tiers ("Supporter", "Supporter+"). The current feature and limit table for each tier is published on the pricing page. In case of conflict between marketing copy and these Terms, these Terms prevail, and in case of conflict between these Terms and the live plan-limits enforced by the platform, the live enforced limits prevail for technical operation while we correct any discrepancy promptly.

### 3.2 Payments
Paid plans are billed in advance on weekly, monthly, or annual cadences through our payment processor (currently MaxelPay, cryptocurrency). By purchasing, you authorize the processor to charge the displayed amount. Prices are exclusive of any taxes, which are your responsibility where applicable. We never see or store your private keys, wallet seeds, or card details.

### 3.3 Failed payments and downgrades
If a renewal payment fails, your account is downgraded to Free at the end of the paid period. Paid-tier limits stop applying immediately upon downgrade; files already stored remain stored, but uploads, shares, and features beyond Free limits will be refused until you upgrade again or come back within limits.

### 3.4 Refunds
All fees are non-refundable except where non-excludable applicable law requires otherwise. Cancelling stops future renewals; it does not refund the current period. If you believe you were charged in error, contact us within 30 days and we will review it in good faith.

---

## 4. What "Unlimited" Means on SquidCloud

> **Short version:** "Unlimited" means we have not set a fixed number on your account for that feature. It does not mean infinite, guaranteed, instant, or dedicated resources. The servers underneath are finite, shared, and operated on a best-effort basis.

### 4.1 Definition
Where SquidCloud describes a feature as "unlimited" (for example: total storage bytes on eligible tiers, concurrent transfers on Supporter+, maximum file size on Supporter+, API tokens on Supporter+), that word means exactly the following, and nothing more:

1. **No fixed numeric cap is configured on your account** for that feature at this time.
2. The feature remains subject to **fair use** (Section 5), **abuse controls** (Section 7), **safety screening** (Section 8), and **actual infrastructure capacity** (Section 6).
3. "Unlimited" is **not** a guarantee of availability, speed, durability, or infinite capacity. It is not a service-level agreement. It does not promise dedicated hardware, reserved bandwidth, or immunity from throttling, queuing, maintenance windows, or outages.

### 4.2 What is NOT unlimited today
For the avoidance of doubt, the following have numeric limits today, and "unlimited" never refers to them unless a tier table explicitly says so:

- Maximum size of a single uploaded file (Free: 1 GB; Supporter: 12 GB).
- Number of files uploaded per day (Free: 20; Supporter: 50; Supporter+: 100).
- Concurrent uploads/downloads on Free (2) and Supporter (10).
- Daily API tokens on Free (1,000) and Supporter (10,000).
- Any quota published on the pricing page with a number next to it.

### 4.3 Server-side reality
Your account may show no storage cap while the underlying infrastructure — buckets, nodes, bandwidth, database capacity — is finite and shared across users. You accept that uploads may be queued, throttled, or temporarily paused during congestion, abuse incidents, maintenance, or upstream provider failures. This is normal operation of a best-effort platform, not a service failure and not a breach of any "unlimited" statement.

---

## 5. Fair Use

"Unlimited" features are for normal, human-scale use of a personal cloud: storing your files, sharing them with people you choose, and building ordinary integrations. The following are not fair use, whether or not a numeric limit is configured:

- Reselling, renting, or offering SquidCloud storage, bandwidth, or API access to third parties as a service.
- Operating public download mirrors, mass-redistribution hubs, or hotlinking farms off SquidCloud infrastructure.
- Bulk automated harvesting,archival of third-party content you do not own, or using storage as a CDN for high-traffic sites.
- Cryptocurrency mining, farming, plotting, or proof-of-storage schemes.
- Splitting one logical workload across multiple accounts to evade limits, suspensions, or bans.
- Any use whose cost or load is grossly disproportionate to the tier you hold.

If we reasonably determine unfair use, we may throttle, queue, cap, suspend intake, or require you to move to an appropriate arrangement, with notice where practicable. Repeated or egregious unfair use is treated as abuse under Section 7.

---

## 6. Limits We May Introduce

Technology, costs, abuse patterns, and law change. You agree that SquidCloud may, at any time and at our reasonable discretion:

1. Introduce new quotas, rate limits, file-size caps, file-type restrictions, retention rules, or feature gates on **any** feature — including features currently described as "unlimited" — where required for stability, security, legal compliance, or economic viability.
2. Adjust existing numeric limits up or down.
3. Add or change safety-screening rules.

We will announce such changes by dashboard notice (and email where provided) at least 7 days before enforcement, except where immediate action is required for security, legal compliance, or active abuse — in which case we act first and explain promptly after. Continued use after a change takes effect constitutes acceptance. Grandfathering of prior usage is not guaranteed: files already stored are never deleted solely because of a new limit, but new uploads, shares, and operations beyond the new limits will be refused.

Nothing in Section 4 ("Unlimited") prevents this Section 6. The two sections are to be read together: "unlimited" describes the current configuration, not a promise about the future.

---

## 7. Your Account

### 7.1 Responsibility
Your account is your responsibility. You are accountable for all activity that occurs under your account, whether or not you authorized it.

### 7.2 Credentials
Keep your login credentials and API keys private and secure. Do not share them with anyone. If you believe your account or API key has been compromised, revoke access immediately through your dashboard and contact us at hellosquidcloud@gmail.com.

### 7.3 Accurate Information
You agree to provide accurate and truthful information when creating your account. Do not impersonate another person or create accounts under false identities.

### 7.4 One Account Per Person
Each individual may maintain one account. Creating multiple accounts to bypass restrictions, limits, suspensions, or bans — or to multiply free-tier quotas — is prohibited and will result in termination of all related accounts.

---

## 8. Storage Options

SquidCloud supports multiple storage configurations. You are responsible for understanding and complying with the terms of any external service you connect to SquidCloud.

### 8.1 Native and Cluster Storage
Files uploaded to SquidCloud-managed storage are chunked and encrypted on your device before transit (Res54 engine, AES-256-GCM). Stored chunks are opaque: filenames, types, and content cannot be identified from them by any party, including SquidCloud. Cluster buckets, nodes, and bandwidth are finite shared resources (see Sections 4–6).

### 8.2 Bring Your Own Storage (BYOS)
You may connect your own external storage provider, including but not limited to Tebi.io, Cloudflare R2, and Amazon S3. When you use BYOS:

- Your file content is stored directly on your chosen provider's infrastructure
- SquidCloud stores only your encrypted provider credentials and file metadata
- You are responsible for compliance with your chosen provider's terms of service
- You are responsible for any costs incurred with your external provider — SquidCloud does not cover third-party storage costs
- Disconnecting a provider from SquidCloud does not automatically delete files stored on that provider — you must manage deletion there separately

### 8.3 Bring Your Own Key (BYOK)
You may supply your own encryption key. When using BYOK:

- Your encryption key is never transmitted to or stored by SquidCloud
- All encryption and decryption occurs entirely on your side
- If you lose your encryption key, SquidCloud cannot recover your data under any circumstances
- We strongly recommend keeping a secure independent backup of your encryption key

---

## 9. Safety Screening (S-Hawk)

### 9.1 What is screened
To keep the platform lawful and operable, uploads and share links pass through S-Hawk, our automated safety-screening unit. Screening is **metadata-only**: your file content is never decrypted, read, or transmitted for screening. What is examined is a manifest your own device assembles before encryption — filename, size, declared and detected file type, media attributes (dimensions, duration), document/archive structure descriptors, and cryptographic hashes. The exact field list is disclosed in the Privacy Policy.

### 9.2 What happens on a hit
If a manifest trips screening rules (for example: executable disguised as a document, archive with path-traversal entries, filename matching piracy-release patterns or the platform denylist, or a hash matching previously removed material):

1. The upload or share is **refused before anything is stored or distributed**.
2. You are told **exactly why**, with machine-readable reason codes and a human-readable explanation, in the app and in your account notices.
3. A case file is opened (signals, score, and manifest metadata only — never content) and forwarded to KZA, our security adjudication pipeline, for review.
4. Depending on severity and repetition, uploads may be temporarily suspended. Suspensions state their reason and duration.

### 9.3 Appeal
Every refusal can be appealed from Settings → Security (Upload Appeals) or the Security Center. Appeals go to human review. Filing an appeal never counts against you, and material under appeal stays blocked until a reviewer decides.

### 9.4 No screening is perfect
Automated screening can err in both directions: legitimate files can be refused (appeal them), and violating material can pass (report it). Screening is a reasonable-efforts safety measure, not a guarantee, and not legal advice about your content. You remain solely responsible for the lawfulness of what you store and share.

---

## 10. Acceptable Use

### 10.1 Permitted Use
You may use SquidCloud to:

- Store personal, professional, developer, legal, or educational files
- Automate workflows using the CLI, API, or integrations
- Build applications and tools on top of the SquidCloud API
- Store and use AI-generated content — we fully support AI-assisted development and creation

### 10.2 Prohibited Use
You may not use SquidCloud to store, transmit, or distribute:

- Pirated software, media, or any content that infringes intellectual property rights
- Malware, viruses, ransomware, spyware, or any malicious code
- Content that is illegal under applicable Indian law or the laws of your jurisdiction
- Child sexual abuse material (CSAM) or any content that sexualizes minors — this results in immediate permanent termination and will be reported to the relevant authorities without exception and without prior notice
- Hate speech, content promoting violence, or content targeting individuals or groups based on race, religion, gender, sexuality, nationality, or disability
- Content related to terrorism, extremism, or the facilitation of violence
- Spam, bulk unsolicited communications, or content designed to deceive
- Any content used to facilitate fraud, identity theft, or financial crime

### 10.3 Platform Abuse
You may not:

- Attempt to gain unauthorized access to SquidCloud systems, servers, databases, or other users' accounts
- Conduct denial-of-service attacks or intentionally overload our infrastructure
- Reverse engineer, decompile, or attempt to extract source code from our platform
- Use automated tools to scrape or extract data from the platform beyond normal API usage
- Bypass or circumvent any rate limits, access controls, quotas, safety screening, or security measures
- Evade a suspension or ban by creating new accounts, using others' accounts, or masking identity
- Use SquidCloud as infrastructure for illegal proxying, botnets, or attack tooling
- Resell or commercially exploit "unlimited" features in violation of Section 5

---

## 11. Your Data and Files

### 11.1 Ownership
You retain full ownership of all data and files you upload to or manage through SquidCloud. We claim no intellectual property rights over your content.

### 11.2 Our Role
We are a storage coordination and infrastructure platform. We do not access, read, analyze, or use the content of your files for any purpose, including for safety screening, which operates on metadata only (Section 9).

### 11.3 Your Responsibility
You are solely responsible for the content you store through SquidCloud. By using the service, you confirm that you have the right to store that content and that it does not violate these Terms or applicable law.

### 11.4 No Backup Guarantee; No Durability SLA
SquidCloud is not a backup service and provides no durability or availability service-level agreement. We do not guarantee preservation of your data against service interruption, provider failure, upstream API changes, account termination, or your own key loss. Maintain independent backups of anything important. Storage described as "unlimited" (Section 4) does not alter this clause.

---

## 12. API and Developer Usage

### 12.1 API Keys
API keys are issued per account. Every API call is logged for abuse prevention and security purposes. Logs are retained per the Privacy Policy retention schedule.

### 12.2 Rate and Quota Limits
We enforce rate limits, daily quotas (including API tokens, file counts, and file sizes per tier), and concurrency limits to keep the platform stable and fair. Attempting to exceed or evade them may result in throttling, temporary suspension, or permanent key revocation.

### 12.3 Third-Party Costs
If your usage results in costs from a connected external storage provider, those costs are entirely your responsibility. SquidCloud does not reimburse or cover third-party provider charges.

---

## 13. Suspension, Termination, Deletion, and Appeal

### 13.1 Enforcement ladder
Rule-breaking is met with proportionate enforcement: warning notice → upload suspension (time-boxed) → account suspension → permanent termination. CSAM, active attacks on the platform, and ban evasion skip the ladder and result in immediate permanent termination plus reporting to authorities where the law requires.

### 13.2 What suspension means
A suspended account cannot upload, share, or use API/CLI write operations until the suspension lapses or is lifted. Stored files are not deleted by suspension alone. Temporary suspensions state their duration; appealing does not shorten them automatically.

### 13.3 Appeal
Suspensions and screening refusals can be appealed from Settings → Security (Upload Appeals). Appeals are reviewed by a human. We aim to decide appeals within 7 business days. Filing an appeal never worsens the outcome.

### 13.4 Deletion by you
To permanently delete your account and associated data, contact hellosquidcloud@gmail.com with subject "Account Deletion Request — [Your Username or Registered Email]". After identity verification:

- Your account information, metadata, and logs held by us are permanently removed per the retention schedule
- Encrypted chunks in repositories associated with your account are removed
- Files on external BYOS providers must be deleted separately through those platforms
- Deletion is permanent and irreversible; paid fees are not refunded (Section 3.4)

### 13.5 Termination by us
We may suspend or terminate accounts for Terms violations, security risk, illegal activity, false registration information, chronic non-payment, or sustained unfair use. Termination for cause ends access immediately. Where practicable and lawful, we give notice and a chance to retrieve lawful files first — except for CSAM, attacks, and evasion, where there is no notice and no retrieval.

---

## 14. Availability and Uptime

SquidCloud is an independently operated service provided on a best-effort basis. We do not guarantee any level of uptime, availability, throughput, or performance. We are not liable for:

- Planned or unplanned downtime or degraded performance
- Hosting, network, or DNS outages or limitations
- Upstream storage API rate limits, changes, or outages
- Outages or issues with any third-party BYOS provider you connected
- Congestion-driven queuing or intake pauses under Section 4.3

---

## 15. Limitation of Liability

SquidCloud is provided on an **"as is"** and **"as available"** basis. To the fullest extent permitted by applicable law:

- We make no warranties, express or implied, regarding reliability, availability, accuracy, durability, or fitness for any particular purpose
- We are not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use SquidCloud
- We are not liable for loss of data, files, or access resulting from provider outages, upstream API changes, account termination or suspension, screening refusals, or encryption key loss
- We are not liable for interruptions caused by internet outages, DNS failures, hosting or storage platform issues, or third-party provider failures
- We are not liable for consequences of your own exposure of API keys, credentials, or encryption keys
- Our total aggregate liability for any claim is capped at the fees you actually paid us in the 3 months preceding the claim, or INR 500 if you paid less than that or nothing

Nothing in these Terms limits liability for fraud, willful misconduct, or any liability that cannot be excluded under applicable law. Some jurisdictions do not allow certain exclusions; where that is the case, our liability is limited to the greatest extent the law permits.

---

## 16. Indemnification

You agree to indemnify and hold harmless SquidCloud and its operators from and against any claims, damages, losses, or expenses (including reasonable legal fees) arising out of or related to:

- Your use of SquidCloud in violation of these Terms
- Content you store, share, or manage through the platform
- Your violation of any applicable law or the rights of a third party
- Your use of any connected third-party storage provider

---

## 17. Intellectual Property

### 17.1 SquidCloud Platform
All rights in the SquidCloud platform — including its code, design, branding, and infrastructure — are owned by SquidCloud and its operators. You may not copy, reproduce, or create derivative works from our platform without explicit written permission.

### 17.2 Your Content
You retain all rights to your content. By using SquidCloud, you grant us a limited, non-exclusive license to interact with your content solely for the purpose of providing the service to you (storing, retrieving, and transmitting opaque encrypted chunks at your direction). This license ends when you remove your content or delete your account.

---

## 18. Privacy

Your use of SquidCloud is also governed by our Privacy Policy, available at:

**https://squidcloud.vercel.app/privacy**

---

## 19. Governing Law and Disputes

These Terms are governed by and construed in accordance with the laws of India, without regard to conflict of law principles.

Any dispute arising from or relating to these Terms or your use of SquidCloud shall first be attempted to be resolved through direct communication at hellosquidcloud@gmail.com within 30 days of the dispute arising. If a resolution cannot be reached informally, disputes shall be subject to the jurisdiction of the competent courts of India.

---

## 20. Severability

If any provision of these Terms is found to be invalid or unenforceable, that provision will be modified to the minimum extent necessary or severed if modification is not possible. The remaining provisions continue in full force and effect.

---

## 21. Entire Agreement

These Terms, together with the Privacy Policy, constitute the entire agreement between you and SquidCloud regarding your use of the service and supersede all prior agreements and understandings.

---

## 22. Contact

**Email:** hellosquidcloud@gmail.com  
**Platform:** https://squidcloud.vercel.app  

We aim to respond to all inquiries within 48 hours on business days.

---

*SquidCloud is an independent project. These Terms of Service v2.0 are effective as of the date listed above and supersede all previous versions, including v1.0 (05 April 2026). Nothing in these Terms is legal advice; if you need it, consult a lawyer in your jurisdiction.*
