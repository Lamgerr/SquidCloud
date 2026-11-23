# macOS Preview → SquidCloud Instant Preview: research & reimplementation spec

**Status:** research complete, implementation not started.
**Date:** 2026-11-23
**Target:** `src/components/EnhancedInstantPreviewModal.tsx` (and the viewers it hosts).

---

## 0. Sources consulted (and what each gave me)

| Source | What I took from it |
|---|---|
| [Apple — Preview User Guide, macOS 27](https://support.apple.com/en-in/guide/preview/welcome/mac) (welcome, get-started, view, annotate, keyboard shortcuts, 3D formats) | Authoritative feature inventory, exact toolbar/sidebar behaviour, shortcuts, supported formats. |
| [Apple's own Preview screenshots](https://ipcdn-web.apple.com/assets/v2/web/b76be6bb-bf93-48ba-84c2-3b1e955b9aa0) (downloaded locally to `/tmp/opencode/preview-refs/`: `thumbnails.png`, `sidebar-modes.png`, `crop.png`, `signature.png`, `removebg.png`, `3d.png`, `markup.png`) | Pixel-level window anatomy: traffic lights, sidebar, two-row toolbar, segmented controls, inspector, selection handles. |
| [Medium — "macOS Preview Is One of the Most Powerful Apps on Your Mac"](https://medium.com/@PatrickEMcCormack/macos-preview-is-one-of-the-most-powerful-apps-on-your-mac-d46553819c73) (free portion; rest is member-only) | The design thesis: *no onboarding, no pop-ups, no upsell; opens instantly, stays out of the way; does a small set of things consistently; PDF editing without a subscription tax.* |
| Local `src/components/*Viewer*` + `package.json` | What SquidCloud already has to build on. |

**Note on your screenshots:** the `~/storage/shared/Downloads/previewapp` folder was not present on this device (nor `/sdcard/Download/previewapp`). The two recent `images*.jpeg` files I found were Spotlight-search images, not Preview. I used Apple's official screenshots instead, as you instructed. If you later add the folder, I'll reconcile it against this spec.

---

## 1. The design thesis (the part that matters most)

Preview wins because it **does not try to impress**. No splash, no tour, no upsell, no "pro" badge. It opens the file immediately, stays quiet, and gives you exactly the tools you need for that kind of file — and nothing else. Third-party apps add features; Preview removes friction.

Translated to SquidCloud's preview:
- **Open instantly.** Show a skeleton/shell in < 100ms, decrypt in the background, swap in content without a layout jump.
- **One window, no chrome theatre.** A single full-screen surface with one compact toolbar; no giant header, no decorative cards.
- **Tools adapt to file type.** PDF → page tools + markup; image → crop/filters/annotate; 3D → orbit tools; text → editor; archive → list; media → transport. The toolbar contents change, the frame does not.
- **Everything reversible.** Revert to original, undo annotations, no destructive surprise.
- **Never upsell inside the viewer.** Upgrade prompts stay in the dashboard, never here.

---

## 2. Window anatomy (from the screenshots)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ● ● ●   [▣▾]   filename.pdf        [⌕][⌕][⌕] [✎▾]  [▧][↥][▭] [A] [i][↥][⌕] │  ← title bar + main toolbar (one row)
│         Page 2 of 11                                                      │
├──────────────┬────────────────────────────────────────────────────────────┤
│  THUMBNAILS  │                                                            │
│  ┌────────┐  │              document / image canvas                       │
│  │ page 1 │  │              (continuous scroll / single / two pages)     │
│  └────────┘  │                                                            │
│  ┌────────┐  │                                                            │
│  │ page 2 │◄─┼── selected                                                 │
│  └────────┘  │                                                            │
│  ...         │                                                            │
├──────────────┴────────────────────────────────────────────────────────────┤
│  Aa  ▢  ▣  ✎  ▭▾  A▾  ◻▾  ▣▾  ☑▾  Aa▾      ← markup toolbar (PDF/image only)│
└───────────────────────────────────────────────────────────────────────────┘
```

Key details:
- **Traffic lights** top-left (red/yellow/green) — macOS window affordance.
- **Sidebar toggle** (`▣▾`) next to traffic lights; dropdown chooses *Thumbnails / Contact Sheet / Table of Contents / Bookmarks*.
- **Filename + "Page 2 of 11"** — two lines, left-aligned, small. "Edited" appears when dirty.
- **Main toolbar** is a set of **small circular/rounded controls with hairline separators**, not chunky buttons. Three zoom/search icons are a segmented group; markup is a pencil + chevron; then shape, share, annotate, **Siri/AI (blue 'A')**, info, export, search field.
- **Markup toolbar** appears as a second row only for PDF/images; thin, icon-only, with small chevrons for style/colour popovers.
- **Sidebar** is a light grey column; thumbnails have a blue selection ring + blue border; drag the separator to resize; collapse/expand per document.
- **Canvas** sits in an infinite grey/white field; page shadow; continuous scroll by default in recent macOS.
- Selection crop shows **dotted rectangular guides with 8 blue circular handles** (see `crop.png`).
- Signature flow shows a **frosted sheet** with `Trackpad | Camera | iPhone` segmented tabs and "Click Here to Begin" (see `signature.png`).
- Remove-background shows a clean before/after with the subject isolated (see `removebg.png`).
- 3D shows a satellite with a thin blue bounding box and orbit tools (see `3d.png`).

---

## 3. Sidebar modes (View menu)

| Mode | Description | SquidCloud mapping |
|---|---|---|
| **Thumbnails** | Vertical strip of page thumbnails, selected page highlighted, click to jump, drag separator to resize | Already partially in `OptimizedPDFViewer` (`sidebarTab='thumbnails'`); needs resize + polish |
| **Contact Sheet** | Grid of all pages | Add as a toggle in the same sidebar |
| **Table of Contents** | PDF outline tree, click to jump | Already exists (`outline`, `sidebarTab='outline'`) |
| **Bookmarks** | Saved page bookmarks | Exists (`bookmarks`, `sidebarTab='bookmarks'`) |
| **Hide Sidebar** | `⌥⌘S`-style toggle | Exists (`sidebarOpen`) |
| **Single Page / Two Pages / Continuous Scroll** | Page layout | `layout` state exists (`PageLayout`) — verify values |

---

## 4. File types Preview supports (and our equivalent)

**Apple:** PDF, images (JPEG/PNG/HEIC/GIF/TIFF, HDR, Live Photo), animated GIF frames, 3D (`usdz`, `usd/usda/usdc`, `ply` incl. Gaussian splats, `stl`, `abc`, `gltf/glb`, `obj`, `mtlx`, `vdb`), text, CSV, PDF forms, multiple PDFs in tabs/windows.

**SquidCloud today** (`EnhancedInstantPreviewModal` dispatch + components present):

| Kind | Current host | Gap vs Preview |
|---|---|---|
| PDF | `OptimizedPDFViewer` (pdfjs) | Good base; lacks true Preview chrome, contact-sheet, magnifier, smooth page transitions |
| Images | `AdvancedImageViewer` | Has zoom/rotate/flip + filter presets; lacks crop with handles, annotation, remove background, inspector |
| Text / code / markdown | `EnhancedTextEditor` | Editor-focused; no read-only "Preview" mode polish |
| EPUB | handoff to `DeepReadReader` | Fine, but the handoff feels like a different app |
| Spreadsheet | `SpreadsheetViewer` | Not integrated into the same chrome |
| Video / audio | `cbVideoPlayer`, `AudioPlayer`, `CustomMediaPlayer` | Not in the Preview frame |
| Fonts | `FontPreviewer` | Present |
| Archives | `ArchiveViewerModal` | Present but basic |
| 3D | `ModelViewer` | **Currently a placeholder** — it tells you to `npm install @google/model-viewer` |
| Email / ICS / HTML | none | Add generic "quick look" cards |

**Decision for the reimplementation:** keep one `EnhancedInstantPreviewModal` frame and swap *only the body*. Every body gets the same toolbar contract: `left = identity`, `center = type-specific tools`, `right = info / share / download / close`.

---

## 5. Feature inventory to port (ranked)

### Tier 1 — must have (the Preview experience)
1. **Instant open shell** — static frame renders immediately; content streams in; skeleton matches final layout (no CLS).
2. **Unified toolbar** — one row, type-aware groups, circular hairline controls, no text labels (tooltips + `aria-label`).
3. **Sidebar with modes** — thumbnails / contact sheet / outline / bookmarks, resizable, collapsible.
4. **Continuous scroll + single/two-page** with smooth spring page transitions.
5. **Zoom contract** — zoom in / out / actual size / fit width / fit page, pinch/trackpad, `Scale %` field, zoom-to-selection.
6. **Find in document** — highlight all matches, next/previous, match count, scroll-to-match.
7. **Info inspector** — filename, kind, size, dimensions/page count, dates, encryption status, storage path (user-safe fields only).
8. **Download / share / close** — always in the same place; keyboard shortcuts.
9. **Revert / undo** — every edit reversible.
10. **Navigation** — prev/next document, prev/next page, deep-link `?file=`.

### Tier 2 — Preview's "power tools"
11. **Markup toolbar** (PDF + images): text selection, rectangular selection, **sketch/draw**, shapes (rect/oval/line/arrow), highlight, text box, note/sticky, **signature**, shape style / border colour / fill colour / text style popovers.
12. **Redaction** (PDF) — selection removes text permanently on save; warn before commit.
13. **Crop / rotate / resize** with 8 blue circular handles and dotted guides.
14. **PDF form fill + signature** — Trackpad / Camera / iPhone-style segmented source picker (web: draw / type / upload).
15. **Remove background** (images) — one-click, then export subject.
16. **Combine / add / delete / reorder pages** (PDF) — thumbnail drag-reorder.
17. **Bookmark pages**, **slideshow**, **GIF frame scrubbing**.
18. **Password protect / lock / reduce size / export** (PDF).
19. **3D orbit / rotate / scale tools**, play/pause animation, bounding box.

### Tier 3 — polish
20. **Spring physics everywhere** — the dock's spring vocabulary; sheets/popovers overshoot slightly, no linear ease theatre.
21. **Progressive disclosure** — markup tools hidden until toggled; inspector hidden until toggled.
22. **Multi-file tabs** — open several files in one viewer, `Ctrl-Tab` between them.
23. **Window background colour** setting (Preview has it) — map to our theme.
24. **Copy/paste** selection to clipboard, **print**.

---

## 6. Keyboard shortcuts (Apple's, to mirror where sensible)

| Action | macOS | SquidCloud proposal |
|---|---|---|
| Save | ⌘S | ⌘/Ctrl+S (download/save edit) |
| Next / previous tab | ⌃Tab / ⌃⇧Tab | same |
| Full screen | ⌃⌘F | same |
| Print | ⌘P | ⌘/Ctrl+P |
| Copy / cut / paste | ⌘C / ⌘X / ⌘V | same |
| Next / previous image in window | Page Down / Page Up | same |
| Next / previous document | ⌥PageDown / ⌥PageUp | ⌥ + PgDn/PgUp |
| Next / previous page | ⌥↓ / ⌥↑ | same |
| Zoom actual / fit | ⌥⌘0 / ⌥⌘9 | same |
| Zoom in / out | ⌥⌘+ / ⌥⌘− | same |
| Remove background | ⇧⌘K | same |
| 3D Move / Rotate / Scale | ⌥W / ⌥E / ⌥R | same |
| Play/pause animation | Space | same |
| **Ours:** close | Esc | Esc |
| **Ours:** toggle sidebar | ⌘/Ctrl+\ | ⌘/Ctrl+\ |

Rule: **shortcuts must never fire while typing in an input** (already fixed globally in `useKeyboardShortcut`).

---

## 7. Motion & interaction notes (the "feel")

- Window/sheet open: **scale from 0.96 + fade + slight upward translate**, spring `stiffness ~380, damping ~30` — matches our dock.
- Sidebar: slides in with a spring; width changes animate; thumbnail selection thumb uses a `layoutId` spring (like our segmented control).
- Toolbar popovers: scale-in from `0.94`, origin at the button; no bounce loops.
- Page change: crossfade + 8px translate, 0.2–0.3s; continuous scroll uses native momentum.
- Crop/markup handles: appear with a tiny scale spring; selection rubber-band on drag.
- Magnifier: follows cursor with a slight lag (lerp), disappears on Esc.
- Zoom: smooth scale transition, zoom indicator pill fades after 800ms (already in `AdvancedImageViewer`).
- Fullscreen: native Fullscreen API; toolbar auto-hides after mouse idle, returns on move.
- Respect `prefers-reduced-motion` in every case.

---

## 8. Current implementation gaps (concrete, in our code)

1. `EnhancedInstantPreviewModal.tsx` — header is a plain bar with a filename + a row of generic buttons; no sidebar slot, no type-aware toolbar, no inspector; heavy decrypt spinner text; state is minimal (blob, loading, error, archive, fullscreen).
2. `CustomDialogContent` is full-screen with `bg-background`; fine as the frame, needs internal regions.
3. `ModelViewer.tsx` is a **stub** (instructs to install `@google/model-viewer`). Need either the dependency or a graceful WebGL canvas fallback.
4. `OptimizedPDFViewer.tsx` owns its own toolbar/sidebar today — must be refactored to accept `chrome="external"` so the modal owns the frame.
5. EPUB handoff closes the modal and opens `DeepReadReader` — feels like a different app; should be a body inside the same frame (or a seamless spring transition).
6. GIF frames, font, archive, spreadsheet, media are not in the same UI contract.
7. No info inspector, no find bar at frame level, no multi-file tabs, no revert/undo at frame level.

---

## 9. Implementation plan (proposed, to be approved before coding)

**Phase 0 — skeleton & contracts**
- Define `PreviewChrome` regions: `Toolbar`, `Sidebar`, `Stage`, `MarkupBar`, `Inspector`, `StatusBar`.
- Define `ViewerAdapter` interface: `{ kind, label, tools, render, onSave?, onRevert?, shortcuts }`.
- Frame renders instantly; adapters mount lazily.

**Phase 1 — unified frame + PDF + image (Tier 1)**
- Rebuild `EnhancedInstantPreviewModal` around the regions.
- Adapt `OptimizedPDFViewer` to external chrome; add thumbnails resize, contact sheet, find bar, inspector.
- Adapt `AdvancedImageViewer` with crop handles, rotate/flip, filter popover, info.
- Add spring transitions + reduced motion.

**Phase 2 — full markup**
- Implement shared annotation layer (SVG/canvas overlay) with select/sketch/shape/highlight/text/note/signature tools + style popovers.
- Redaction with confirmation.
- Save/revert through the existing file-update path (`FileUpdateService` + key vault).

**Phase 3 — remaining types**
- EPUB inside the frame; spreadsheet; media; fonts; archive; text; GIF frames.
- 3D: install `@google/model-viewer` (or document fallback) and add orbit tools.

**Phase 4 — tabs, shortcuts, polish**
- Multi-file tabs, global shortcuts, print, slideshow, window background setting, screenshot QA in both themes.

**Gates before claiming done** (per design-doctrine):
- `npx tsc --noEmit` (in a full env — Termux lacks node_modules)
- `node scripts/verify_states.mjs` on the new frame (default/hover/focus)
- `node scripts/verify_responsive.mjs` (280/320/414px)
- `node scripts/accuracy_report.mjs` → report real `N/N`
- Render and LOOK: open PDF, image, text, 3D, GIF; click every tool; confirm state changes.

---

## 10. Non-goals (to avoid scope creep)

- No PDF text editing (Preview doesn't do it either — markup only).
- No OCR beyond what the browser/pdfjs provides.
- No AI features inside the viewer other than the existing global Squid AI.
- No subscription/upsell UI in the viewer.
- No rewrite of the encryption/key-vault layer — reuse it.

---

## 11. Open questions for you (only when you're ready to implement)

1. Should 3D use `@google/model-viewer` (new dependency) or a canvas fallback?
2. Remove-background needs an API — do we call an existing edge function, or defer to Tier 3?
3. Should the viewer become a full route (`/preview/:id`) so files can be deep-linked, or stay a modal?
4. Do you want multi-file tabs in phase 1 or phase 4?

I will not start coding until you say go.
