# 2026-11-24-preview-and-residual-hardening.md (SUPERSEDED)

This document has been **merged into** the single canonical security design:
`docs/superpowers/specs/2026-11-24-full-e2e-redesign-design.md` (v12).
Content preserved below for history only.

# Preview-Modal Hardening + Residual Risk Closure (v10)

Date: 2026-11-24
Status: DRAFT (awaiting approval; no code written)
Part of the canonical plan: `2026-11-24-full-e2e-redesign-design.md`

## 1. The problem in the preview modal today

`EnhancedInstantPreviewModal.tsx` currently does the wrong thing for a zero-knowledge product:

- Decryption happens in the **main thread** (`downloadFilePreview` / `smartDownload`, lines 148–182).
- Plaintext lives in a **module-level `decryptedBlobCache`** keyed by file id (line 32) and in React state (`decodedBlob`).
- `URL.createObjectURL(blob)` creates **blob URLs in the main origin** (lines 159, 172) — readable by any script in the page, including an injected extension content script.
- Viewers (PDF, image, video, markdown, spreadsheet) render that plaintext **inside the app origin**, so XSS or an extension can read pixels, text, or the blob itself.
- The markdown path uses a blocklist sanitizer + `dangerouslySetInnerHTML` — a direct script-injection path into the origin that holds keys.

Net result: if an attacker gets script execution in the app tab (or a host-permission extension), every decrypted file is theirs. That is exactly what you do not want.

## 2. Target architecture: the preview is a sealed room

```
app origin (keys, worker)
   |  postMessage: { sealed blob handle, render token, ephemeral key }
   v
preview origin (sandboxed iframe, opaque origin)
   |  decrypt inside the frame's own worker, render to canvas
   v
pixels only -> transferred canvas / compositor to app UI
```

Rules:
1. **No plaintext, keys, or blob URLs ever exist in the app origin's DOM, window, module state, or React tree.**
2. Decryption and rendering happen **inside the sandboxed preview origin** (§16.4), in that frame's own crypto worker.
3. The app sends only: ciphertext (or a stream handle), the per-file salt, an ephemeral one-time render key, and a short-lived render token. The ephemeral key is generated per preview and never reused.
4. The frame returns **only rendered output** (a `Transferable` `ImageBitmap`/canvas handle or video frame), never the underlying bytes. The app composes it into the UI.
5. The preview iframe is destroyed and its memory/state discarded when the modal closes. No `decryptedBlobCache` in the app; if caching is needed, keep **encrypted** cache only, in the preview origin.
6. `decodedBlob`, `blobUrl`, and `decryptedBlobCache` are removed from the modal entirely. The "download" action is a separate, explicit, step-up-gated operation that streams plaintext to a user-initiated save — it never populates a shared cache.

## 3. Key exposure in the modal — eliminated

- The modal **never receives MK or FK**. It holds an opaque `renderToken` issued by the crypto worker after the user's session unlock.
- The render token is scoped to one file, one operation, and a short TTL (seconds). It cannot be replayed to decrypt another file.
- The worker enforces that a token is bound to the file id and the specific preview origin; a forged `postMessage` from another tab or frame is rejected by origin check + token binding.
- The ephemeral key used to hand ciphertext to the preview frame is generated in the worker, used once, and destroyed. An extension reading the app's JS heap sees no persistent key.

## 4. Viewer-by-viewer plan

| Viewer | Today | After |
|---|---|---|
| Text / Markdown | Blob in app, `dangerouslySetInnerHTML` | Rendered in preview frame; DOMPurify inside sandbox; plain text to canvas/DOM in frame only |
| Image | `blobUrl` in app | Decoded in preview worker, drawn to canvas, transferred bitmap to app |
| PDF | Blob + worker in app origin | PDF.js runs entirely in preview origin with its own worker; pages painted to canvas there |
| Video / Audio | `blobUrl` fed to `<video>` in app | Media Source Extensions fed inside preview frame; no blob URL in app origin |
| EPUB | `DeepReadReader` in app | Moved to preview origin; same sandboxed rules as PDF |
| Spreadsheet / font / model / archive | Blob in app | Same sealed-frame pattern; each viewer gets its own disposable frame |

Download/share actions stay in the app origin but are **explicit user actions requiring step-up**; they never create a plaintext cache entry.

## 5. Closing the eight residual concerns

### 5.1 XSS in an unlocked tab
- **Cause today:** decrypted content and blob URLs live in the app origin; markdown uses a weak sanitizer.
- **Fix:** sealed preview (§2–4) means XSS in the app origin finds no plaintext and no keys — only rendered bitmaps and opaque tokens. DOMPurify + strict CSP + Trusted Types remain as defense in depth. The crypto worker is the only key holder; tokens are short-lived and per-file.
- **Remaining:** XSS can still ask the worker to decrypt *the currently open file* while the user is looking at it, if it can guess the token — token binding to a user gesture + preview-origin message channel prevents this. Residual is reduced to the single file already on screen, not the whole vault.

### 5.2 Compromised build pipeline
- Signed reproducible builds, SRI, isolated immutable asset origin, independent witnesses (§17.6).
- **Added:** release artifacts are verified in the client before first decrypt; a hash mismatch locks the vault and refuses to render. A malicious build cannot silently start harvesting keys.

### 5.3 Browser extensions / OS malware
- Web cannot stop them (§16.8). **New mitigations that reduce value even if present:**
  - No keys or plaintext in the app origin heap/DOM — an extension's content script sees only rendered pixels and opaque tokens.
  - Keys live in non-extractable WebCrypto objects inside a dedicated worker; extensions cannot call `exportKey`.
  - Maximum tier requires per-decrypt hardware assertion; OS malware without the hardware can't decrypt.
  - Native client remains the only complete answer for this threat class.

### 5.4 Physical coercion
- Duress code opens a decoy vault; travel mode strips wrapped-MK blobs (§17.4).
- **Added:** automatic sensitive-action lock — after a duress unlock, real vault writes are silently disabled and only decoy data is shown, while alerts go to contacts.

### 5.5 Losing phrase and quorum
- Unchanged and unavoidable: no backdoor (§19). Onboarding states it plainly. Social recovery + safety numbers are the mitigation.

### 5.6 Metadata
- Fixed-size blocks, constant-rate heartbeats, batched fetches, coarse timestamps, no IP persistence (§17.5).
- **Added:** preview access does not reveal the exact file to the server beyond the ciphertext request already required; filenames are decrypted only in the preview frame.

### 5.7 Legacy files server-recoverable
- Migration is background, Wi-Fi-first, silent (§4). **Added:** the legacy KEK path is firewalled to a single audited endpoint, callable only during an active, step-up-authenticated migration session; after the sunset window it is removed and CI asserts no such code path exists.

### 5.8 Old ciphertext + salt retained by server
- Deletion destroys every salt copy and produces a witnessed receipt in the KTL (§17.1). **Added:** periodic background audit re-fetches all "deleted" file ids from the user's KTL and asserts no corresponding salt remains; a mismatch triggers an alert and automatic re-shred request. A DB snapshot taken before deletion plus a later MK compromise remains the theoretical edge; documented, and mitigated by epoch ratchet (§17.2) which destroys old MK epochs.

## 6. Verification specific to preview

- Automated test: after any preview, assert no `blob:` URL, no `decodedBlob`, and no plaintext string exists in the app origin's DOM, window globals, or module state.
- Malicious-extension simulation: content script injected into app tab cannot read keys, plaintext, or blob bytes; only sees a canvas handle.
- Forged `postMessage` from another tab/frame to the crypto worker is rejected.
- Token replay to decrypt a second file fails.
- Markdown XSS payloads render as text inside the sandbox with no script execution.
- Modal close destroys the frame and zeroizes the ephemeral key; no cache residue.

## 7. UX contract

Zero change. The user sees the same full-screen preview with the floating dock. All sealing, token issuance and rendering happen behind the scenes. File open latency must not regress — the sealed frame is pre-warmed while the modal animates in.

## 8. Decision for the human

Should the sealed-preview rewrite ship as part of the main E2E rollout, or as an immediate standalone hardening pass before the rest? My recommendation: **immediate standalone pass** — it closes the most reachable leak (any preview of any file) without waiting for the full vault migration.
