# SquidCloud Terms of Service

**Version:** Universal  
**Effective Date:** 05 April 2026
**Last Updated:** 05 April 2026
**Applies To:** All SquidCloud services, platforms, APIs, CLI tools, and web interfaces  
**Operated By:** SquidCloud, an independent project  
**Platform:** https://squidcloud.vercel.app  

---

## 1. Acceptance of Terms

By accessing or using any part of SquidCloud — including the web platform, API, CLI tools, or any related service — you agree to be bound by these Terms of Service ("Terms").

If you do not agree to these Terms, you must stop using SquidCloud immediately.

We may update these Terms from time to time. When we do, we will notify you through the dashboard or via email. Continued use of SquidCloud after an update means you accept the revised Terms. It is your responsibility to review them periodically.

---

## 2. Eligibility

To use SquidCloud, you must:

- Be at least **13 years of age**
- If you are between 13 and 18, you must have the awareness and consent of a parent or legal guardian
- Be capable of entering into a binding agreement under applicable law
- Not be prohibited from using the service under the laws of your jurisdiction

By creating an account, you confirm that you meet these requirements.

---

## 3. Free Service

SquidCloud is currently provided **free of charge**. We do not charge for account creation, storage access, API usage, or any features available on the platform at this time.

We reserve the right to introduce paid plans or pricing in the future. If we do, we will notify existing users in advance. Any future pricing changes will be communicated clearly before taking effect and will not be applied retroactively.

Because SquidCloud is a free service operated independently, we provide it on a best-effort basis without guaranteed uptime or service level commitments.

---

## 4. Your Account

### 4.1 Responsibility
Your account is your responsibility. You are accountable for all activity that occurs under your account, whether or not you authorized it.

### 4.2 Credentials
Keep your login credentials and API keys private and secure. Do not share them with anyone. If you believe your account or API key has been compromised, revoke access immediately through your dashboard and contact us at hellosquidcloud@gmail.com.

### 4.3 Accurate Information
You agree to provide accurate and truthful information when creating your account. Do not impersonate another person or create accounts under false identities.

### 4.4 One Account Per Person
Each individual may maintain one account. Creating multiple accounts to bypass restrictions, limits, or bans is not permitted.

---

## 5. Storage Options

SquidCloud supports multiple storage configurations. You are responsible for understanding and complying with the terms of any external service you connect to SquidCloud.

### 5.1 Native GitHub Storage
SquidCloud uses GitHub repositories as a native storage backend. Files are processed before storage as follows:

- Your files are split into chunks on the client side
- Each chunk is fully encrypted using AES-256-GCM encryption via the Res54 engine
- Encrypted chunks are serialized as JSON blob files and stored in a GitHub repository managed by SquidCloud on your behalf
- The stored blobs are completely opaque — no filename, file type, or content can be identified from them by any party, including GitHub and SquidCloud

By using native GitHub storage, you authorize SquidCloud to interact with GitHub's API on your behalf. Your use of GitHub storage is also subject to GitHub's Terms of Service at https://docs.github.com/en/site-policy/github-terms/github-terms-of-service.

Please be aware that GitHub's API rate limits may occasionally affect upload or retrieval speed. This is outside SquidCloud's control and does not constitute a service failure on our part.

### 5.2 Bring Your Own Storage (BYOS)
You may connect your own external storage provider, including but not limited to Tebi.io, Cloudflare R2, and Amazon S3. When you use BYOS:

- Your file content is stored directly on your chosen provider's infrastructure
- SquidCloud stores only your encrypted provider credentials and file metadata
- You are responsible for compliance with your chosen provider's terms of service
- You are responsible for any costs incurred with your external provider — SquidCloud does not cover third-party storage costs
- Disconnecting a provider from SquidCloud does not automatically delete files stored on that provider — you must manage deletion there separately

### 5.3 Bring Your Own Key (BYOK)
You may supply your own encryption key. When using BYOK:

- Your encryption key is never transmitted to or stored by SquidCloud
- All encryption and decryption occurs entirely on your side
- If you lose your encryption key, SquidCloud cannot recover your data under any circumstances
- We strongly recommend keeping a secure independent backup of your encryption key

---

## 6. Acceptable Use

### 6.1 Permitted Use
You may use SquidCloud to:

- Store personal, professional, developer, legal, or educational files
- Automate workflows using the CLI, API, or integrations
- Build applications and tools on top of the SquidCloud API
- Store and use AI-generated content — we fully support AI-assisted development and creation

### 6.2 Prohibited Use
You may not use SquidCloud to store, transmit, or distribute:

- Pirated software, media, or any content that infringes intellectual property rights
- Malware, viruses, ransomware, spyware, or any malicious code
- Content that is illegal under applicable Indian law or the laws of your jurisdiction
- Child sexual abuse material (CSAM) or any content that sexualizes minors — this results in immediate permanent termination and will be reported to the relevant authorities without exception and without prior notice
- Hate speech, content promoting violence, or content targeting individuals or groups based on race, religion, gender, sexuality, nationality, or disability
- Content related to terrorism, extremism, or the facilitation of violence
- Spam, bulk unsolicited communications, or content designed to deceive
- Any content used to facilitate fraud, identity theft, or financial crime

### 6.3 Platform Abuse
You may not:

- Attempt to gain unauthorized access to SquidCloud systems, servers, databases, or other users' accounts
- Conduct denial-of-service attacks or intentionally overload our infrastructure
- Reverse engineer, decompile, or attempt to extract source code from our platform
- Use automated tools to scrape or extract data from the platform beyond normal API usage
- Bypass or circumvent any rate limits, access controls, or security measures
- Use SquidCloud as infrastructure for illegal proxying, botnets, or attack tooling

---

## 7. Your Data and Files

### 7.1 Ownership
You retain full ownership of all data and files you upload to or manage through SquidCloud. We claim no intellectual property rights over your content.

### 7.2 Our Role
We are a storage coordination and infrastructure platform. We do not access, read, analyze, or use the content of your files for any purpose. In the case of native GitHub storage, your files exist only as encrypted, unidentifiable chunks that we cannot read.

### 7.3 Your Responsibility
You are solely responsible for the content you store through SquidCloud. By using the service, you confirm that you have the right to store that content and that it does not violate these Terms or applicable law.

### 7.4 No Backup Guarantee
SquidCloud is not a backup service. We do not guarantee the preservation of your data in the event of service interruption, provider failure, GitHub API changes, or account termination. You are responsible for maintaining independent backups of any data you consider important.

---

## 8. API and Developer Usage

### 8.1 API Keys
API keys are issued per account. Every API call is logged for abuse prevention and security purposes. Logs are retained for 90 days.

### 8.2 Rate Limits
We enforce rate limits to ensure fair and stable usage across all users. Repeated attempts to exceed these limits may result in temporary or permanent key suspension.

### 8.3 Third-Party Costs
If your usage results in costs from a connected external storage provider, those costs are entirely your responsibility. SquidCloud does not reimburse or cover third-party provider charges.

---

## 9. Account Suspension and Deletion

### 9.1 Suspension Request by User
If you wish to suspend your account temporarily, contact us by email:

**Email:** hellosquidcloud@gmail.com  
**Subject Line:** Account Suspension Request — [Your Username or Registered Email]

We will process your request and confirm suspension. A suspended account retains your data but disables access until you request reactivation.

### 9.2 Deletion Request by User
SquidCloud does not currently offer self-service account deletion through the dashboard. To permanently delete your account and all associated data, contact us by email:

**Email:** hellosquidcloud@gmail.com  
**Subject Line:** Account Deletion Request — [Your Username or Registered Email]

We will verify your identity and process the deletion. Upon confirmed deletion:

- Your account information, metadata, and logs held by us will be permanently removed
- Encrypted chunks stored in GitHub repositories associated with your account will be removed
- Files stored on external BYOS providers must be deleted separately through those platforms — we do not control that infrastructure
- Account deletion is permanent and irreversible
- We will confirm deletion by email once complete

### 9.3 Termination by Us
We reserve the right to suspend or permanently terminate your account without prior notice if you:

- Violate any provision of these Terms
- Engage in activity that poses a security risk to the platform or other users
- Use SquidCloud for illegal activity
- Provide false information during registration

Upon termination for cause, your right to access SquidCloud ceases immediately.

---

## 10. Availability and Uptime

SquidCloud is a free, independently operated service. We do not guarantee any specific level of uptime, availability, or performance. We are not liable for:

- Planned or unplanned downtime
- Vercel platform outages or limitations
- GitHub API rate limits or outages affecting native storage functionality
- Outages or issues with any third-party BYOS provider you have connected

---

## 11. Limitation of Liability

SquidCloud is provided on an **"as is"** and **"as available"** basis. To the fullest extent permitted by applicable law:

- We make no warranties, express or implied, regarding the reliability, availability, accuracy, or fitness of the service for any particular purpose
- We are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use SquidCloud
- We are not liable for any loss of data, loss of files, or loss of access resulting from provider outages, GitHub API changes, account termination, or encryption key loss
- We are not responsible for interruptions caused by internet outages, DNS failures, Vercel or GitHub platform issues, or third-party provider failures
- We are not liable for any consequences resulting from your exposure of your own API keys, login credentials, or encryption keys
- Since SquidCloud is a free service, our total liability to you for any claim shall not exceed INR 500

Nothing in these Terms limits liability for fraud, willful misconduct, or any liability that cannot be excluded under applicable law.

---

## 12. Indemnification

You agree to indemnify and hold harmless SquidCloud and its operators from and against any claims, damages, losses, or expenses (including reasonable legal fees) arising out of or related to:

- Your use of SquidCloud in violation of these Terms
- Content you store or manage through the platform
- Your violation of any applicable law or the rights of a third party
- Your use of any connected third-party storage provider

---

## 13. Intellectual Property

### 13.1 SquidCloud Platform
All rights in the SquidCloud platform — including its code, design, branding, and infrastructure — are owned by SquidCloud and its operators. You may not copy, reproduce, or create derivative works from our platform without explicit written permission.

### 13.2 Your Content
You retain all rights to your content. By using SquidCloud, you grant us a limited, non-exclusive license to interact with your content solely for the purpose of providing the service to you. This license ends when you remove your content or delete your account.

---

## 14. Privacy

Your use of SquidCloud is also governed by our Privacy Policy, available at:

**https://squidcloud.vercel.app/privacy**

---

## 15. Governing Law and Disputes

These Terms are governed by and construed in accordance with the laws of India, without regard to conflict of law principles.

Any dispute arising from or relating to these Terms or your use of SquidCloud shall first be attempted to be resolved through direct communication at hellosquidcloud@gmail.com. If a resolution cannot be reached informally, disputes shall be subject to the jurisdiction of the competent courts of India.

---

## 16. Severability

If any provision of these Terms is found to be invalid or unenforceable, that provision will be modified to the minimum extent necessary or severed if modification is not possible. The remaining provisions continue in full force and effect.

---

## 17. Entire Agreement

These Terms, together with the Privacy Policy, constitute the entire agreement between you and SquidCloud regarding your use of the service and supersede all prior agreements and understandings.

---

## 18. Contact

**Email:** hellosquidcloud@gmail.com  
**Platform:** https://squidcloud.vercel.app  

We aim to respond to all inquiries within 48 hours on business days.

---

*SquidCloud is an independent project. These Terms of Service are effective as of the date listed above and supersede all previous versions.*
