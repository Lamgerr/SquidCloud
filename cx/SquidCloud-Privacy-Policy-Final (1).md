# SquidCloud Privacy Policy

**Version:** 2.0  
**Effective Date:** 13 September 2026
**Last Updated:** 13 September 2026
**Applies To:** All SquidCloud services, platforms, APIs, CLI tools, and web interfaces  
**Operated By:** SquidCloud, an independent project  
**Platform:** https://squidcloud.vercel.app  

**Plain-language summary:** we cannot read your files — they are encrypted on your device before they reach us. We do collect account data, file metadata, security telemetry, and (since v2.0) safety-screening manifests. This policy lists exactly what, why, and for how long. Summaries in boxes explain; the numbered clauses bind.

---

## 1. Introduction

SquidCloud ("we", "us", "our") is committed to protecting your privacy. This policy applies to all SquidCloud services, platforms, APIs, CLI tools, and web interfaces.

By accessing or using SquidCloud, you acknowledge that you have read and understood this Privacy Policy. If you do not agree, please discontinue use immediately.

Material changes are announced by dashboard notice and, where you provided an email, by email at least 7 days before taking effect.

---

## 2. Information We Collect

### 2.1 Account and identity
Username, email address, profile fields you set, account timestamps, authentication events, session tokens, MFA/passkey enrollment facts (never private keys or secrets), and linked OAuth provider identifiers.

### 2.2 File and storage metadata
Filenames, sizes, MIME types, folder structure, timestamps, share settings, storage locations, chunk maps, and encryption parameters needed to reassemble your files. This is coordination metadata — it describes your files without revealing their content.

### 2.3 Safety-screening manifests (S-Hawk)
Before encryption, your own device assembles a metadata manifest for each upload or share, which our S-Hawk screening unit evaluates. A manifest contains only the following, and nothing else:

- Filename, byte size, declared file type, file extension
- First-bytes file signature ("magic bytes") and detected type
- Media attributes where applicable: image dimensions, audio/video duration, codec label
- Document/archive structure descriptors: archive entry names and sizes, macro presence flag, document producer/author strings where present
- Cryptographic hashes: SHA-256 of the plaintext (files up to 256 MB), perceptual hash (images), audio fingerprint (reserved for future use)

Manifests of cleared files are stored alongside file metadata so shares can be re-screened later. Manifests of refused files are kept in the case file described in Section 4. **Manifests never contain file content, and screening never decrypts your files.**

### 2.4 Security and abuse telemetry
IP address, approximate geolocation (country level), device and session identifiers, request rates, authentication failures, screening decisions and scores, suspension and ban records, appeal records, and audit trails of administrative actions. This telemetry exists to keep the platform and its users safe.

### 2.5 API and CLI diagnostics
Per-key usage counters, operation logs, error traces, and performance timings, retained for abuse prevention and reliability.

### 2.6 Billing metadata
Plan tier, billing cadence, payment timestamps, transaction references, and payment status from our processor (MaxelPay). We do not receive or store card numbers, wallet seeds, or private keys.

### 2.7 Communications
Support emails, appeal texts, and abuse reports you send us.

> **Metadata-only principle.** We collect metadata only. We do not read, decrypt, analyze, or derive insights from the content of your files — including for safety screening, which operates exclusively on the manifests described in Section 2.3.

---

## 3. How We Use Your Information

- **Service delivery:** account access, authentication, storage operations, subscription enforcement.
- **Safety screening:** evaluating upload/share manifests, refusing violating material, notifying you with reasons, and maintaining case files and appeals.
- **Security:** abuse prevention, intrusion detection, rate limiting, suspensions, and bans.
- **Diagnostics:** error tracking, performance analysis, reliability improvements.
- **Billing:** provisioning paid tiers, handling renewals, downgrades, and disputes.
- **Communications:** policy notices, security alerts, screening decisions, and support replies.
- **Compliance:** meeting applicable legal obligations, including responding to lawful authority requests per Section 8.

Our legal bases include your consent (account creation and use), performance of the contract (the Terms), our legitimate interests (security, abuse prevention, platform integrity), and legal obligation.

---

## 4. Screening Case Files: What Happens on a Refusal

When S-Hawk refuses an upload or share, we open a case file containing: your account identifier, the manifest (Section 2.3), the triggered signals with their scores, the decision, and any suspension applied. Case files are forwarded to our KZA adjudication pipeline for human review where required, and you receive a notice stating the exact reasons plus an appeal path (Settings → Security → Upload Appeals). Filing an appeal adds your appeal text to the case file. Case files contain no file content — refused material is never stored.

---

## 5. What We Never Do

- We do not sell your personal data.
- We do not share your information with advertisers or data brokers.
- We do not read, decrypt, or analyze your uploaded file contents — for any purpose, including screening and law-enforcement cooperation (we can only ever produce the ciphertext and metadata we hold).
- We do not use your files to train AI models.
- We do not retain data beyond operational necessity and the retention schedule in Section 9.
- We do not access your BYOK encryption keys (we never receive them).

---

## 6. Storage and Protection

- Native and cluster storage holds only client-side encrypted chunks (AES-256-GCM via the Res54 engine); chunks are opaque blobs.
- BYOS stores content on your provider; SquidCloud stores encrypted credentials and metadata only.
- BYOK keeps key management entirely with you.
- Data in transit is protected with HTTPS; secrets at rest are vault-encrypted.
- Access to production data is limited to what is strictly necessary to operate the service, and administrative access is logged.

Third-party infrastructure references:

- GitHub Privacy Statement: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement
- Vercel Privacy Policy: https://vercel.com/legal/privacy-policy

---

## 7. Cookies and Session Technology

- Authentication cookies and session tokens for secure sign-in continuity.
- Local preference storage for display and settings preferences.
- No advertising or third-party tracking cookies.

---

## 8. Third-Party Services and Disclosures

| Service | Purpose | Data Involved |
|---|---|---|
| Supabase | Authentication and metadata database | Account information and file metadata |
| GitHub | Native storage backend | Encrypted chunked JSON blobs only |
| Vercel | Platform hosting and delivery | Request and performance data |
| OAuth providers (Google, GitHub) | Optional sign-in | Authorized token and profile data |
| Tebi.io / Cloudflare R2 / Amazon S3 | Optional BYOS providers | File content, only if connected by you |
| MaxelPay | Payment processing for paid tiers | Billing metadata only (Section 2.6); no card/wallet secrets touch our systems |

We disclose personal data to authorities only where required by applicable law (for example, a valid court order), limited to the data we actually hold — account metadata, manifests, and ciphertext — and we will notify you unless legally prohibited. CSAM and other illegal content coming to our attention through screening reports is reported to the relevant authorities as the law requires.

---

## 9. Data Retention

| Data Type | Retention Period |
|---|---|
| Account information | Until account deletion |
| File metadata and manifests of stored files | Until file or account deletion |
| Screening case files and findings | 12 months after case closure, then deleted |
| Threat and abuse telemetry | 12 months |
| Active ban records | Duration of the ban plus 12 months |
| Screening notices and appeals | Until account deletion; appeals 12 months after decision |
| API and CLI usage logs | 90 days |
| Daily quota counters | Until the next UTC-midnight reset |
| Billing metadata | 7 years for tax and accounting compliance, or as the law requires |
| Session and authentication tokens | Until session expiry or logout |
| Error and diagnostic logs | 30 days |
| Support and grievance correspondence | 24 months |

Backups, if any, age out on the same schedule as the source data. Aggregated, de-identified statistics (counts with no identifiers) may be kept indefinitely.

---

## 10. Account Deletion and Your Rights

Deletion requests are handled via email (hellosquidcloud@gmail.com, subject "Account Deletion Request — [Your Username or Registered Email]") and verified for account security. On confirmed deletion, account data and metadata are permanently removed per Section 9. External BYOS data must be deleted on your provider platform separately.

Under India's Digital Personal Data Protection Act, 2023, and as a matter of policy wherever you live, you may:

- **Access** a copy of the personal data we hold about you, including your screening case files.
- **Correct** inaccurate or incomplete personal data.
- **Delete** your personal data, subject to Section 9 retention required by law (billing, security).
- **Nominate** another person to exercise your rights in case of death or incapacity.
- **Grievance redressal:** write to hellosquidcloud@gmail.com with subject "Privacy Grievance — [brief topic]". We acknowledge within 48 hours on business days and resolve within 30 days. If unsatisfied, you may approach the Data Protection Board of India once constituted and operational.

---

## 11. Children

Services are not intended for children under 13, and we do not knowingly collect their data. Accounts found to belong to under-13 users are terminated and their data deleted. Users 13–18 must have parent or guardian awareness and consent.

---

## 12. Changes to This Policy

Material changes are announced by dashboard notice and email at least 7 days before taking effect. Continued use after the effective date constitutes acceptance. Archived versions are available on request.

---

## 13. Contact

**Email:** hellosquidcloud@gmail.com  
**Platform:** https://squidcloud.vercel.app  

We aim to respond within 48 hours on business days; privacy grievances per Section 10.

> **Zero-tolerance policy.** CSAM and other illegal content are strictly prohibited and may result in immediate account termination and reporting to relevant authorities. Screening reports contain metadata only — we cannot and do not inspect file content.

---

*SquidCloud is an independent project. This Privacy Policy v2.0 is effective as of the date listed above and supersedes all previous versions, including v1.0 (05 April 2026). Nothing in this policy is legal advice; if you need it, consult a lawyer in your jurisdiction.*
