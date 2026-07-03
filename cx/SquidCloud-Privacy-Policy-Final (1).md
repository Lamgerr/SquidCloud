# SquidCloud Privacy Policy

**Version:** Universal  
**Effective Date:** 05 April 2026  
**Last Updated:** 05 April 2026
**Applies To:** All SquidCloud services, platforms, APIs, CLI tools, and web interfaces  
**Operated By:** SquidCloud, an independent project  
**Platform:** https://squidcloud.vercel.app  

---

## 1. Introduction

SquidCloud ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, how we protect it, and what rights you have over it.

By accessing or using any SquidCloud service, you acknowledge that you have read, understood, and agree to this Privacy Policy. If you do not agree, please discontinue use of our services immediately.

This policy is written to be clear and honest. We do not use legal language to obscure what we actually do.

---

## 2. Information We Collect

### 2.1 Account Information
- Name and username
- Email address
- Profile photo (optional, only if you choose to upload one)
- Account creation date and last login timestamp

### 2.2 File and Storage Metadata
- File names, sizes, types, and timestamps
- Folder structure and organization data
- Encryption status and storage usage statistics

We collect **metadata only**. We do not access, read, analyze, or process the content of your files in any way.

### 2.3 Storage Provider Information
SquidCloud supports multiple storage backends:

- **Native GitHub Storage** — SquidCloud uses GitHub repositories as a native storage backend. Your files are split into encrypted chunks and stored as JSON blob files within a GitHub repository. These chunks are fully encrypted before leaving your session — the resulting stored data is opaque and unidentifiable. Neither GitHub, SquidCloud, nor any third party can determine the nature or contents of your files from the stored chunks. GitHub's own privacy policy applies to the repository infrastructure used. You can review it at https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement.
- **Bring Your Own Storage (BYOS)** — You may connect your own external storage provider, including but not limited to Tebi.io, Cloudflare R2, or Amazon S3. When you use BYOS, your files are stored directly on your chosen provider's infrastructure. SquidCloud stores only your encrypted connection credentials and file metadata. The privacy practices of your chosen provider apply to data stored there.
- **Bring Your Own Key (BYOK)** — You may supply your own encryption keys. In this case, SquidCloud never holds or has access to your encryption key. Only you can decrypt your data.

### 2.4 API and Developer Data
- API key prefixes (we store only the first few characters — never the full key)
- API keys are stored in hashed form only
- CLI and API usage logs including endpoint accessed, timestamp, and response status
- These logs are retained for **90 days** and used solely for abuse prevention and diagnostics

### 2.5 Technical and Diagnostic Data
- IP address (used for security and rate limiting, not tracking)
- Browser type and version
- Operating system
- Session activity logs for diagnostic purposes
- Error logs

### 2.6 Session and Authentication Data
- Authentication tokens for maintaining your session
- OAuth tokens if you sign in via a third-party provider (Google, GitHub, etc.)
- These are stored securely and never shared

---

## 3. How We Use Your Information

We use the information we collect strictly for the following purposes:

- **Providing the service** — account creation, authentication, file storage management
- **Security** — detecting abuse, unauthorized access, and enforcing rate limits
- **Diagnostics** — identifying and fixing errors and performance issues
- **Communication** — sending service-related notifications, security alerts, and policy updates via email
- **Legal compliance** — meeting obligations under applicable law

We do not use your information for advertising. We do not build user profiles for commercial purposes. We do not use your data to train any artificial intelligence or machine learning model.

---

## 4. What We Never Do

- We do not sell your data to any third party, ever
- We do not share your personal information with external companies, advertisers, or data brokers
- We do not access or read the content of your uploaded files
- We do not use your files or data to train AI models
- We do not retain your data beyond what is necessary for providing the service

---

## 5. How Your Data Is Stored and Protected

### 5.1 Native Storage — GitHub Encrypted Chunks
When using native storage, your files are processed as follows before leaving your session:

- Files are split into chunks
- Each chunk is fully encrypted using the Res54 engine (AES-256-GCM)
- Encrypted chunks are serialized as JSON blob files
- These JSON blobs are stored in a GitHub repository managed by SquidCloud on your behalf

The stored JSON blobs contain no identifiable information about your files. No filename, file type, or content can be inferred from the stored chunks by any party — including GitHub and SquidCloud. Only your account, with the correct decryption credentials, can reassemble and decrypt the original files.

GitHub's infrastructure and privacy practices govern the storage of these encrypted blobs. GitHub API rate limits may occasionally affect upload or retrieval performance.

### 5.2 Bring Your Own Storage (BYOS)
When you attach an external storage provider such as Tebi.io, Cloudflare R2, or Amazon S3, your file content is stored entirely on that provider's infrastructure. SquidCloud stores only:
- Your provider credentials, encrypted at rest
- File metadata (names, sizes, timestamps) in our Supabase database

The privacy and security of your file content under BYOS is governed by your chosen provider's terms and privacy policy.

### 5.3 Bring Your Own Key (BYOK)
If you use BYOK, your encryption key is never transmitted to or stored by SquidCloud. All encryption and decryption happens on your end. We have no ability to access your data in this configuration.

### 5.4 Metadata Storage
File metadata for all storage configurations is stored in a Supabase database. This metadata includes file names, sizes, types, and timestamps — never file content.

### 5.5 Encryption
Where SquidCloud manages encryption, we use the Res54 encryption engine implementing:
- **AES-256-GCM** encryption standard
- Block-split architecture for enhanced security
- Optional entropy layer
- HTTPS enforced on all connections — no plaintext transmission anywhere

### 5.6 Platform Hosting
The SquidCloud web platform is hosted on Vercel. Vercel may process request and performance data as part of hosting. You can review Vercel's Privacy Policy at https://vercel.com/legal/privacy-policy.

---

## 6. Cookies and Session Technology

SquidCloud uses minimal cookies and session storage strictly for operational purposes:

- **Authentication cookies** — to keep you logged in during your session
- **Session tokens** — to maintain your active session securely
- **Preference storage** — to remember your display or settings preferences (stored locally in your browser)

We do not use tracking cookies, advertising cookies, or third-party analytics cookies. You can clear cookies at any time through your browser settings. Clearing authentication cookies will log you out of your account.

---

## 7. Third-Party Services We Use

| Service | Purpose | Data Involved |
|---|---|---|
| Supabase | Authentication and metadata database | Account info and file metadata only |
| GitHub | Native file storage backend | Encrypted chunked JSON blobs only |
| Vercel | Platform hosting and delivery | Request and performance data |
| OAuth Providers (Google, GitHub) | Optional sign-in | Only the token and profile info you authorize |
| Tebi.io / Cloudflare R2 / Amazon S3 | Optional BYOS providers | File content only if you choose to connect them |

No readable file content is sent to any service. GitHub receives only encrypted, unidentifiable JSON blobs.

---

## 8. Data Retention

| Data Type | Retention Period |
|---|---|
| Account information | Until account deletion |
| File metadata | Until file or account deletion |
| API and CLI usage logs | 90 days from creation |
| Session and authentication tokens | Until session expiry or logout |
| Error and diagnostic logs | 30 days |
| Deleted account data | Processed within a reasonable timeframe following confirmed deletion via email |

---

## 9. Account Deletion and Data Removal

SquidCloud does not currently offer self-service account deletion through the dashboard. To request deletion of your account and all associated data, contact us by email:

**Email:** hellosquidcloud@gmail.com  
**Subject Line:** Account Deletion Request — [Your Username or Registered Email]

Upon receiving your request, we will verify your identity and process the deletion. All associated data — account information, file metadata, and logs held by us — will be permanently removed. Encrypted chunks stored in GitHub repositories will also be removed. Files stored on external BYOS providers must be deleted separately through those platforms, as we do not control that infrastructure.

If you wish to suspend your account temporarily rather than delete it, contact us at the same email address with your request.

---

## 10. Your Rights and Controls

- **Access** — you may request a summary of data we hold about you by contacting us
- **Correction** — you may update or correct your account information through the dashboard or by contacting us
- **Deletion** — you may request full account and data deletion by emailing us (see Section 9)
- **API key revocation** — you may revoke any API key instantly from your dashboard
- **Storage provider disconnection** — you may disconnect any external storage provider from your dashboard at any time

---

## 11. Children's Privacy

SquidCloud services are not intended for individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a user under 13 has created an account, we will delete that account and all associated data promptly.

If you are between 13 and 18 years of age, you may use SquidCloud with the awareness and consent of a parent or legal guardian.

---

## 12. Compliance with Indian Law — DPDP Act 2023

SquidCloud operates in compliance with the **Digital Personal Data Protection Act, 2023 (DPDP Act)** of India.

Under this Act, you have the right to:
- Know what personal data is being processed and for what purpose
- Correct inaccurate or outdated personal data
- Erase your personal data where it is no longer necessary
- Nominate a representative to exercise these rights on your behalf

**Grievance Redressal**

**Email:** hellosquidcloud@gmail.com  
**Subject Line:** DPDP Grievance — [Your Username]  
**Response Time:** We will acknowledge your grievance within 72 hours and aim to resolve it within 15 days.

---

## 13. Security Incident Notification

In the unlikely event of a data breach that affects your personal information, we will notify affected users within a reasonable timeframe once the breach is confirmed and post a disclosure on our platform.

---

## 14. Changes to This Policy

We may update this Privacy Policy when new features are introduced, storage or encryption systems change, or legal requirements change. When we make material changes, we will notify you via a dashboard notice or email. Continued use of SquidCloud after a policy update constitutes acceptance of the updated policy.

---

## 15. Contact

**Email:** hellosquidcloud@gmail.com  
**Website:** https://squidcloud.vercel.app  

We aim to respond to all inquiries within 48 hours on business days.

---

*SquidCloud is an independent project. This Privacy Policy is effective as of the date listed above and supersedes all previous versions.*
