---
title: "SquidCloud — Doc 1: How res54 Works"
subtitle: "The Secret Code That Protects Every File — Simple, Exact, and Complete"
author: "SquidCloud Team"
date: "2026-08-27"
lang: "en"
---

# Hey, Young Cryptographer!

You already know what encryption is: turning readable data into unreadable data with a key, so only someone with the right key can turn it back. **res54** is SquidCloud's name for *how* we do that — the exact rules for locking and unlocking every chunk of every file.

No fairy tales. Just the real code, explained simply.

---

# 1. The Big Idea

SquidCloud never sends your original file anywhere. Before upload, your device:

1. Cuts the file into small pieces called **chunks** (like slices of bread).
2. Locks each chunk with **AES-256-GCM** — a super-strong lock that also checks the label on the box hasn't been swapped.
3. The locked chunks go to warehouses (cloud buckets). The key never leaves your world except in a special sealed way (see Chapter 5).

To read the file, a trusted device fetches those locked chunks and unlocks them with the same key.

> Code home: `cli/src/lib/crypto/res54.ts` — the CLI copy — and the same code is embedded inside `cli/src/lib/host/decryptor.ts` so the local decryptor daemon speaks the identical language. The server's `supabase/functions/cloudbliss-api/handlers.ts` also encrypts/decrypts the same way.

---

# 2. How a Password Becomes a Real Key

Your secret might be `0f97f40f4f83916b7583...` (64 hex characters). The computer needs exactly 32 bytes.

**The rule is always:**

```ts
deriveRawKey(keyString) = UTF8( keyString.slice(0,32).padEnd(32, '0') )
```

Take the first 32 characters. If shorter, pad with `'0'` to reach 32. Turn those 32 characters into UTF-8 bytes. That's the **raw key**. We do *not* hex-decode — we treat it as text. Every place in SquidCloud does this same slicing, so everyone agrees.

**For the newest files (v3), we level up:**

1. **File Master Key** = `HKDF-SHA256( rawKey , info="v3-file-master" + fileId )`
2. **Chunk Key for chunk i** = `HKDF-SHA256( FileMasterKey , info="v3-chunk" + littleEndian32(i) )`

HKDF is like a key factory: you feed it one master key and a label, and it safely makes a new, unrelated 32-byte key for that exact purpose. Now each chunk of each file has its own unique key, all derived from your one secret. Steal one chunk's key and you learn nothing about the next.

> Code: `hkdfExpand` in `res54.ts:37` via `hkdf(sha256, ...)`.

---

# 3. The Three Locked Box Designs

Over time we made better boxes, but we still open all old ones so your old photos never break. The computer peeks at the first few bytes to know which box it sees.

## How It Guesses

* Bytes `0x52 0x45 0x03` ("R E 0x03") at the start → **v3**.
* Otherwise, read first 4 bytes as a little-endian number. If it's 8–128 and the blob is longer than `4 + that + 12`, peek inside: does bytes 4..(4+len) parse as JSON with `version>=2` and an `ivs` list? If yes → **v2 canonical**. If not, but length checks still pass → **v2 old style**.
* Anything else → **Legacy v1**.

> Code: `detectChunkVersion` and `parseCanonicalHeader` in `res54.ts:51,64`.

## v1 Legacy — The First Box

```
[12 random bytes: IV] [ encrypted data + 16-byte tag ]
```

The simplest: one IV, one ciphertext+tag under the raw key. No label check. Still supported forever.

> Code: `decryptLegacy` in `res54.ts:138`.

## v2 Old Style — The Box With a Sticky Label

```
[4 bytes: label length] [label bytes e.g. "res54-v2-1714000000000"] [12 bytes IV] [ encrypted data + tag ]
```

The label (AAD) is authenticated together with the ciphertext. Change the label even by one letter and decryption fails. Simple and effective for one chunk = one box.

> Code: `decryptV2` in `res54.ts:128`.

## v2 Canonical — The Filing Cabinet (What Your Browser Makes Today)

This is what you actually create now when you upload:

1. Split the chunk into **64 KB sub-parts** (a 512 KB chunk → 8 parts).
2. For each part `i` of `N` parts:
   * IV = 12 fresh random bytes
   * Label = `chunk-i-N-timestamp` (e.g., `chunk-0-8-1714000000000`)
   * Encrypted = `AES-GCM(rawKey, IV, label, 64KB_plaintext)` → ciphertext+tag
3. Build a **Table of Contents**:
   ```json
   { "version": 2, "chunks": 8, "totalSize": 524288, "ivs": [[12,34,...], [56,78,...], ...] }
   ```
   IVs are stored as number arrays (or base64 strings — both work).
4. Pack it:

```
[4 bytes: header length] [JSON Table of Contents]
  for each part:
    [4 bytes: label length] [label] [4 bytes: encrypted length] [encrypted part]
```

One blob, many independently locked sub-parts. Huge files decrypt in parallel, each part's label stops swapping attacks.

> Code: server `handlers.ts:108` `encryptChunkV2`, web `src/lib/encryption.ts:197` `encryptLargeData`, CLI `cli/src/lib/transfer.ts:37` `encryptChunkCanonical`, and `decryptV2Canonical` in `res54.ts:84`.

## v3 — The Identity-Locked Safe

Future design, tied to *who* and *where*:

```
[3 bytes magic 0x52 0x45 0x03] [4 bytes: original length] [12 bytes IV] [ ciphertext + tag ]
```

*   Key is the per-chunk derived Chunk Key (section 2), not the raw key.
*   Label is `res54-v3|<your user ID>|<file ID>|<chunk index>|<total chunks>`

You can't move chunk #2 to position #5, or copy Alice's chunk into Bob's file — the label check would fail instantly.

> Code: `decryptV3` in `res54.ts:109`.

---

# 4. How Unlocking Tries Every Box

When you download, the code has no idea which box version was used years ago. So it bravely tries them in order:

1. If it smells like v3, try v3 with your user/file context.
2. If it looks like canonical v2, try canonical v2.
3. Try old v2.
4. Try legacy.

First success wins. If all fail, you get `Decryption failed (10528B, v2): ...` with the size and guessed version — the most useful clue for fixing key problems.

> Code: `decryptAny` in `res54.ts:144`.

If the key is wrong, every attempt's tag check fails — you get a clear error, not garbled data.

---

# 5. Where Does the Key Come From?

*   **Normal upload:** The server creates a fresh 32-byte random key → shows as 64 hex characters (`generateKeyHex()` → `randomBytes(32).toString('hex')`). That string is your file's secret.
*   **BYOK / Managed:** Sometimes the row says `managed_key` or `sha256:byok_encrypted` — those are *name tags*, not keys. Your device must ask the vault: `POST /functions/v1/file-key {fileId}` with your login token. The server checks "does this file belong to you?" and if yes, unwraps the real key and hands it back.
*   **The bouncer:** `isUsableKey` rejects name tags so the code knows when to go fetch the real one.

That's the whole journey: random key → lock with res54 → store locked bytes → later fetch locked bytes → unlock with same key.

---

# 6. The One-Sentence Summary

**res54 turns every file into small, labeled, locked boxes that only your key can open, and the label on each box is checked before opening — v3 even checks *whose* box it is and *where* it belongs.**

Keep this in mind and Doc 2 (the travel adventure) will make perfect sense.

