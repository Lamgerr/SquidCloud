# Instant preview for E2E v4 files — design

## Problem

`EnhancedInstantPreviewModal` used `downloadFilePreview`, which treats the
stored `encryption_key` as a legacy AES key string. New uploads store
`e2e_v4` there and keep the real metadata in `files.tags[0].v4`, so:
- the literal string `e2e_v4` was fed to `decryptData` as a key, and
- the modal's fallback `getVaultFileMeta` lookup returns nothing for v4 files.

Result: newly uploaded files showed an error instead of a preview.

## Immediate fix

- Added `readV4Meta()` (pure, tested) to detect v4 metadata in file tags.
- The modal now calls `downloadV4Preview()` before any legacy decrypt path.
- Downloads always use `smartDownload()` for v4 files, so the preview blob
  (which is only the first chunks) can never be saved as a truncated file.

## Better workaround: independently decryptable frames

The previous v4 format encrypted the whole file with one AES-GCM operation,
so any preview required downloading and reassembling every chunk. New writes
now use 1 MiB frames:

```
[magic 52 45 05][salt 32][chunkSize u32][totalChunks u32]
[iv 12][ciphertext+tag] ... repeated per frame
```

Each frame is encrypted with the same HKDF-derived file key but a fresh random
IV and AAD binding `(userId, fileId, salt, version, frameIndex, totalFrames)`.
A tampered or reordered frame fails authentication independently.

`downloadV4Preview()` fetches only the first three RES54 chunks, concatenates
them, and `decryptV4Prefix()` decrypts every *complete* frame in that prefix.
For a multi-megabyte image or document this is ~6 MB of transfer instead of
the entire file, and there is no whole-file reconstruction step.

Old single-frame v4 files (`magic 52 45 04`) remain readable through the
original path — no re-encryption or migration of existing ciphertext.

## Approaches considered

1. **Keep whole-file v4, decrypt all chunks in the modal.** Correct but slow;
   rejected — it is exactly the download-and-reconstruct behavior to avoid.
2. **Generate a separate low-res preview at upload.** Fast reads but doubles
   storage and needs a second key/object lifecycle; rejected as unnecessary
   complexity.
3. **Per-frame AEAD (chosen).** No extra objects, no key duplication, and the
   same ciphertext serves both preview and full download. Cost: a slightly
   larger header and per-frame IVs (28 bytes per MiB), negligible.

## What is left

- The preview currently fetches a fixed three chunks; a size-aware budget
  (e.g. stop after the first complete frame) would reduce transfer further.
- PDF/EPUB viewers still fetch the full file because their renderers need the
  complete document; only text/image/Markdown benefit from prefix preview.
