# SquidCloud Web Isolation System — Design (SUPERSEDED)

This document has been **merged into** the single canonical security design:
`docs/superpowers/specs/2026-11-24-full-e2e-redesign-design.md` (v6, §16).
Refer to that document for the integrated plan. The content below is preserved
for history only.

# SquidCloud Web Isolation System — Design

Date: 2026-11-24
Status: DRAFT (awaiting approval; no code written)
Related: `2026-11-24-full-e2e-redesign-design.md` (v5)

## 1. Intent and honest limits

Goal: make other tabs, scripts, injected content, and user-run code unable to read or influence SquidCloud's vault, keys, or decrypted data — without changing normal user behavior.

**What a web app cannot defend against:**
- OS-level malware (keyloggers, memory scraping, screenshots).
- A malicious browser extension with host permissions for the SquidCloud origin — content scripts run in a separate world but can read the DOM and network responses.
- The user opening DevTools on their own unlocked SquidCloud tab.
- A fully compromised browser.

Those require a **native client** (section 9). The web design below stops everything short of that: other origins, other tabs, untrusted file content, postMessage abuse, Spectre-class side channels, storage bleed, and malicious server-supplied JS.

## 2. Attack surfaces and controls

| Surface | Threat | Control |
|---|---|---|
| Other tabs / origins | Read vault data via DOM, storage, opener | Separate origins, COOP, no opener, partitioned storage |
| Untrusted file content (markdown, PDF, EPUB, SVG, video) | Script in vault origin, read keys | Sandboxed iframe on a dedicated untrusted origin |
| Extensions | Inject scripts, read DOM | CSP + isolated worlds limit but do not stop; native client for full defense |
| postMessage | Forge messages to crypto worker or app | Strict targetOrigin, schema validation, per-message nonce, no `*`. |
| Spectre / side channels | Cross-origin memory reads | `crossOriginIsolated` via COOP+COEP, CORP on all assets |
| Storage | Steal session/key via localStorage | HttpOnly/`__Host-` cookies, no keys in JS storage, Storage Buckets |
| Navigation | Tabnabbing, reverse tabjacking | `rel=noopener,noreferrer`, COOP, `frame-ancestors 'none'` |
| Third-party scripts | Supply-chain key theft | Zero third-party JS; SRI; signed reproducible builds |
| DNS / TLS | Domain takeover, MITM | HSTS preload, CAA, CT monitoring, TLS 1.3 only |

## 3. Origin topology

```
app.squidcloud.com        → vault UI, session cookie, crypto worker. No untrusted content.
preview.squidcloud.net    → sandboxed rendering of PDF/EPUB/markdown/SVG. Unique origin, no cookies.
media.squidcloud.net      → images/video/audio decoding. No DOM access to app.
share.squidcloud.net      → public share pages. Separate site; never shares cookies with app.
api.squidcloud.com        → BFF only; HttpOnly session cookie scoped to api origin.
```

Separate **sites** (different registrable domains where practical) so cookies and storage are partitioned by the browser itself. `app` never iframes `share`, and `share` never loads app scripts.

- Each origin gets its own CSP, Permissions-Policy, and deploy pipeline.
- No wildcard subdomains with live DNS records (prevents takeover).
- `app` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless` where third-party media is unavoidable).
- All first-party assets send `Cross-Origin-Resource-Policy: same-site` or `same-origin`.

## 4. Strict headers on `app` and `api`

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self' 'sha256-...' ;   /* per-build hashes, no unsafe-inline/eval */
  style-src 'self' 'sha256-...';
  img-src 'self' media.squidcloud.net blob: data:;
  media-src 'self' media.squidcloud.net blob:;
  worker-src 'self';
  connect-src 'self' api.squidcloud.com;
  frame-src preview.squidcloud.net;
  frame-ancestors 'none';
  form-action 'none';
  base-uri 'none';
  object-src 'none';
  require-trusted-types-for 'script';
  upgrade-insecure-requests
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), serial=(),
  hid=(), bluetooth=(), payment=(), accelerometer=(), gyroscope=(),
  magnetometer=(), ambient-light-sensor=(), autoplay=(), encrypted-media=(),
  display-capture=(), idle-detection=(), local-fonts=(), xr=(), wake-lock=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Cookies: `Set-Cookie: __Host-sqsession=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=...` scoped to the API origin. No JS-readable session token.

## 5. Untrusted content sandbox

All decrypted file rendering happens in a sandboxed iframe on `preview.squidcloud.net`:

```html
<iframe src="https://preview.squidcloud.net/..." sandbox="allow-scripts"
        csp="default-src 'none'; script-src 'self'; connect-src 'none';
             img-src blob: data:; style-src 'self' 'unsafe-inline';
             frame-ancestors https://app.squidcloud.com" />
```

- **No `allow-same-origin`** — the frame gets an opaque origin and cannot read app cookies, storage, or DOM.
- **No `allow-top-navigation`, no `allow-popups`, no `allow-forms`.**
- `connect-src 'none'` — the frame cannot exfiltrate to arbitrary hosts. It receives the file as a `MessageChannel` port from the parent; only the channel is allowed.
- The parent passes only the decrypted blob and a render token; the frame never receives MK or FK.
- Viewer code (PDF.js, EPUB engine) is served from the preview origin with SRI hashes and runs only there.
- Markdown sanitization still uses DOMPurify inside the sandbox as defense in depth.
- The iframe is recreated per file; no state persists between files.

For images/video/audio, use `media.squidcloud.net` with the same rules and no DOM scripting at all where possible.

## 6. Crypto worker isolation

- All key derivation, encryption and decryption runs in a dedicated `Worker` on `app`, with `worker-src 'self'` and no `importScripts`.
- Raw keys exist only inside the worker; the main thread receives plaintext only for the specific file being displayed, and hands it directly to the sandboxed preview frame via a transferred `MessagePort`.
- The worker enforces a per-operation authorization token issued by the BFF after step-up; a script injected into the main thread cannot call decrypt without that token.
- Messages are schema-validated with a runtime validator; any unknown field or wildcard origin is rejected. No `postMessage('*')` anywhere.

## 7. Storage and state isolation

- No vault data in `localStorage`, `sessionStorage`, `IndexedDB` on `app` except encrypted local cache blobs with no keys.
- Use the Storage Buckets API to partition cache per vault version; evict on lock/logout.
- Each preview origin has no persistent storage (`storage` permissions denied); file data is ephemeral per iframe.
- `__Host-` cookie prefix prevents subdomain injection; no cookie on `preview`/`media`/`share`.
- Service worker on `app` only; no service workers on preview/share origins. It caches only signed static assets, never decrypted data.

## 8. Cross-tab and navigation hardening

- `window.opener` is always null for any opened link; all external links use `rel="noopener noreferrer nofollow"`.
- `Cross-Origin-Opener-Policy: same-origin` prevents other tabs from holding a reference to the app window.
- No `window.name` use; no broad `postMessage` listeners — only channel-based, origin-checked handlers.
- If a second SquidCloud tab unlocks, the first is notified and locks immediately (single-active-vault policy) to reduce exposure.
- Share links open in a new tab on `share.squidcloud.net`, never in the app frame.

## 9. Extension and OS-level threat — native fallback

Web controls cannot stop a malicious extension with host permissions or OS malware. To meet the "hackers cry" bar for those threats, ship an **optional hardened native client**:

- Desktop/mobile app with the same E2E protocol; keys in OS keystore (Secure Enclave / Keystore / DPAPI), never in a browser.
- WebView2/WKWebView with host app enforcing TLS pinning and disabling devtools in production.
- No browser extensions in-process; OS sandbox + hardened runtime + code signing + notarization.
- Optional: dedicated kiosk/PWA window with browser profile that has all extensions disabled, managed by enterprise policy.
- The web app remains the convenience path; the native client is the "high security" path. Both share the same vault and protocol.

Document clearly: for users facing targeted attacks, the native client is required; the browser cannot promise the same guarantee.

## 10. Network/DNS hardening

- HSTS preload submission; CAA records limiting certificate issuance; Certificate Transparency monitoring with alerts.
- TLS 1.3 only on all origins; no mixed content.
- Separate API egress allowlist; BFF cannot reach arbitrary hosts.
- No third-party analytics, fonts, CDNs, or support widgets on any SquidCloud origin.
- CSP violation reports and `report-to` endpoint with anomaly alerts.

## 11. Verification

- Automated header/CSP checks in CI for all origins.
- Cross-origin test suite: hostile tab attempts DOM/read/storage/opener access → all fail.
- Sandbox escape tests: `<script>`, `srcdoc`, `form`, `top.location`, `window.open`, `fetch` from preview → all blocked.
- postMessage fuzzing: forged origins, wildcard targets, extra fields → rejected.
- `crossOriginIsolated === true` on app; Spectre-style probe against preview fails.
- Extension simulation: content-script-like DOM injection cannot read worker keys (it can read rendered plaintext — documented).
- Storage inspection after lock: no keys, no plaintext, no session tokens in JS storage.
- Native client: keystore extraction attempt fails; devtools disabled in release build.

## 12. UX contract

None of the above adds taps. Sign in → unlock → files appear. Preview opens in-place via the invisible sandboxed frame. Native client, if used, is a separate install choice with the same UI.

## 13. Residual risks

- Browser/OS compromise or host-permission extension defeats web isolation.
- XSS in the unlocked app can still request decryption through the worker token path; step-up per op limits but does not eliminate.
- Rendered plaintext exists briefly in the preview frame; a compromised browser can screenshot it.
- Native client reduces but does not eliminate OS-level risk.

## 14. Open decision

Should the native hardened client be built in this project, or should the web isolation ship first with the native client as a later phase? My recommendation: web isolation first (it protects the existing user base immediately), native client in the following phase for high-risk users.
