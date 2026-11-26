# E2E Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new uploads genuinely E2E while keeping every existing file readable, close the passkey and share authorization holes, and wire recovery/integrity enough that users can keep access after password changes.

**Architecture:** Keep legacy ciphertext formats readable. Introduce a new v4 client-only path with random per-file salt, random chunk IVs, AAD, and no server key escrow. Route sensitive metadata through the BFF with verified identity and enforcement. Use service-role admin operations only where RLS prevents legitimate reads.

**Tech Stack:** React/TypeScript, Vite, Supabase Edge Functions (Deno), Node `api/internal/vault.js` BFF, WebCrypto, `bun test`.

**Spec:** `docs/superpowers/specs/2026-11-24-full-e2e-redesign-design.md` and `docs/superpowers/specs/2026-11-26-file-pipeline-security-review.md`.

## Global Constraints

- Existing files MUST remain readable. No migration re-encrypts or deletes ciphertext.
- New uploads MUST NOT send raw AES keys to any server endpoint.
- Auth identity MUST come from a verified JWT; body `userId`/`ownerId` MUST be rejected.
- No emoji, no new UI accents, no destructive live DB operation.
- Verify with `bun test` and `vercel --prod --yes`; every commit must leave the tree clean.
- Backward-compatible reads trump format purity: legacy v2/v3 decrypt paths stay intact.

## Review Focus

- Existing ciphertext decrypts after every format change — pinned by round-trip tests using legacy fixtures.
- A wrong encryption key produces a decryption failure, not plaintext — pinned by tamper tests.
- A non-owner cannot fetch share metadata or wrapped key before password verification — pinned by BFF unit tests.
- A passkey assertion with a bad signature/origin cannot produce a login OTP — pinned by function tests.
- Password change preserves vault access — pinned by rewrap tests.

---

### Task 1: Crypto primitives for v4 and legacy compatibility

**Files:**
- Create: `src/lib/e2e-v4.ts`
- Create: `tests/e2e-v4.test.ts`
- Modify: `src/lib/encryption-v3.ts` (keep v3 read-only for legacy)

**Interfaces:**
- Consumes: WebCrypto AES-GCM/HKDF/SHA-256.
- Produces: `deriveV4FileKey(masterKeyRaw, userId, fileId, salt): Promise<CryptoKey>`, `encryptV4Chunk(key, plaintext, aad): Promise<{ciphertext, iv}>`, `decryptV4Chunk(key, ciphertext, iv, aad): Promise<ArrayBuffer>`, `makeV4Aad(userId, fileId, saltB64, version, chunkIndex, totalChunks): Uint8Array`, `randomBytes(n): Uint8Array`.

- [ ] **Step 1: Write failing tests for random IVs, AAD binding, and legacy v3 decrypt fixture**
- [ ] **Step 2: Run `bun test tests/e2e-v4.test.ts` and confirm expected failures**
- [ ] **Step 3: Implement `src/lib/e2e-v4.ts` with random 96-bit IVs and full AAD**
- [ ] **Step 4: Run the tests until green**
- [ ] **Step 5: Commit**

```bash
git add src/lib/e2e-v4.ts tests/e2e-v4.test.ts && git commit -m "feat(e2e): add v4 crypto with random IVs and AAD"
```

### Task 2: New uploads use client-only v4 key path; legacy reads preserved

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/res54.ts`
- Create: `tests/upload-path.test.ts`

**Interfaces:**
- Consumes: `e2e-v4.ts` primitives, existing `uploadFileWithRes54`.
- Produces: `isLegacyManagedUpload(metadata): boolean`, `shouldEscrowKey(metadata): boolean` returning false for v4.

- [ ] **Step 1: Write failing tests asserting no `store-file-key` call for new v4 uploads and legacy metadata remains readable**
- [ ] **Step 2: Run tests and confirm failures**
- [ ] **Step 3: Implement v4 upload branch; keep v2/v3 decrypt and server escrow only for legacy reads**
- [ ] **Step 4: Run tests and `vercel --prod --yes`**
- [ ] **Step 5: Commit**

### Task 3: BFF share metadata gate and anon key leak closure at client boundary

**Files:**
- Modify: `api/internal/vault.js`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/SharePage.tsx`
- Create: `tests/share-meta.test.ts`

**Interfaces:**
- Consumes: verified JWT, `check_share_access`, `shares` table via service role.
- Produces: BFF op `share-meta` that verifies password/country/device first and returns only allowed metadata plus wrapped key.

- [ ] **Step 1: Write tests that anonymous requests are rejected and password-gated metadata is returned after verification**
- [ ] **Step 2: Run tests and confirm failures**
- [ ] **Step 3: Implement BFF op and change SharePage to call it before unwrapping**
- [ ] **Step 4: Run tests and build**
- [ ] **Step 5: Commit**

### Task 4: Passkey authentication verification

**Files:**
- Modify: `supabase/functions/passkey-auth/index.ts`
- Create: `tests/passkey-auth.test.ts`

**Interfaces:**
- Consumes: WebAuthn credential public key and challenge from DB.
- Produces: `verifyAssertion(credential, challenge, origin): Promise<boolean>`; OTP issued only after verification.

- [ ] **Step 1: Write failing tests for bad origin, bad challenge, and bad signature**
- [ ] **Step 2: Run tests and confirm failures**
- [ ] **Step 3: Implement server-side assertion verification using WebCrypto**
- [ ] **Step 4: Run tests and deploy function**
- [ ] **Step 5: Commit**

### Task 5: Password change rewrap path

**Files:**
- Modify: `src/pages/AccountSettings.tsx`
- Modify: `src/pages/Auth.tsx`
- Modify: `src/services/secure-key-manager.ts`
- Create: `tests/password-rewrap.test.ts`

**Interfaces:**
- Consumes: current password, new password, wrapped master key metadata.
- Produces: `rewrapMasterKey(currentPassword, newPassword): Promise<boolean>` preserving file keys.

- [ ] **Step 1: Write failing tests that old password succeeds and wrong password fails without altering ciphertext**
- [ ] **Step 2: Run tests and confirm failures**
- [ ] **Step 3: Wire password change screens to rewrap before updating auth password**
- [ ] **Step 4: Run tests and build**
- [ ] **Step 5: Commit**

### Task 6: Device recovery and KTL guard wiring

**Files:**
- Modify: `src/components/VaultSecurityPanel.tsx`
- Modify: `src/lib/zk/webauthn.ts`
- Modify: `src/lib/zk/ktl-guard.ts`
- Create: `tests/recovery-wiring.test.ts`

**Interfaces:**
- Consumes: PRF salt, wrapped MK, recovery share envelopes, KTL chain.
- Produces: working device enrollment record and reconstruct flow.

- [ ] **Step 1: Write failing tests for PRF salt persistence and share reconstruction**
- [ ] **Step 2: Run tests and confirm failures**
- [ ] **Step 3: Wire enrollment/reconstruction and KTL assertion into unlock/decrypt paths**
- [ ] **Step 4: Run tests and build**
- [ ] **Step 5: Commit**

### Task 7: Sealed rendering and CSP hardening

**Files:**
- Modify: `src/components/EnhancedInstantPreviewModal.tsx`
- Modify: `src/components/SealedPreview.tsx`
- Modify: `src/components/SealedMediaFrame.tsx`
- Modify: `vercel.json`
- Create: `tests/sealed-preview.test.ts`

**Interfaces:**
- Consumes: plaintext blob inside sealed frame only.
- Produces: no app-origin blob URL for Markdown/image/video/PDF previews.

- [ ] **Step 1: Write failing tests for postMessage origin/source checks and app-origin blob URL absence**
- [ ] **Step 2: Run tests and confirm failures**
- [ ] **Step 3: Route all previews through sealed frames and harden CSP**
- [ ] **Step 4: Run tests and build**
- [ ] **Step 5: Commit**

### Task 8: CI invariants and honest docs

**Files:**
- Create: `scripts/check-e2e-invariants.mjs`
- Modify: `docs/SECURITY-MODEL.md`
- Modify: `README.md`
- Create: `tests/e2e-invariants.test.ts`

**Interfaces:**
- Consumes: source scan and migration grants.
- Produces: CI gate that fails on raw key escrow, anon key-returning RPCs, and `Math.random` in crypto paths.

- [ ] **Step 1: Write failing tests for the invariant checker**
- [ ] **Step 2: Run tests and confirm failures**
- [ ] **Step 3: Implement checker and update docs to match shipped guarantees**
- [ ] **Step 4: Run full `bun test` and build**
- [ ] **Step 5: Commit**
