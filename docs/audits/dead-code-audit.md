# Dead-Code & Deprecation Audit — CloudBliss / SquidCloud

**Repo:** `/data/data/com.termux/files/home/cloudbliss-storage-fresh-main`
**HEAD at audit time:** `18b6e245` (2026-11-01) · working tree dirty only by untracked `supabase/functions/send-diwali/`
**Audit type:** read-only static analysis. **No source file was modified, moved or deleted by this audit.** This document is the only file created.
**Stack:** React 18 + Vite + TypeScript + Tailwind + Supabase edge functions (Deno).

---

## 0. Method (and its limits)

Reachability was computed as a graph, not by per-file grep:

1. **Roots:** `src/main.tsx` (referenced from `index.html:156`), `index.html`, and `*.test.*` files.
2. **Edges:** every `from "…"`, `import("…")`, `require("…")`, bare `import "…"`, and `new URL("…", import.meta.url)` specifier.
3. **Resolution:** `@/` → `src/`, `sde/` → `packages/sde/src/`, relative paths, `path-browserify`/`browserify-fs` aliases ignored, with extension probing (`.ts .tsx .js .jsx .css .json`) and `/index` fallback.
4. **Result:** 540 files under `src/`, 149,746 LOC → **326 reachable**, **214 unreachable (39.6% of files, 46,245 LOC ≈ 30.9% of src)**.
5. **Known blind spots** (checked explicitly, no false "dead" claimed):
   - No `import.meta.glob`, no template-literal dynamic imports, no string-keyed component registry that reaches live code.
   - CSS-only imports are *not* JS edges — `@fontsource/*` is consumed by `src/index.css:2-7` and is therefore **live** (the naive scanner would misreport it; corrected below).
   - `src/workers/upload-worker.ts` is reachable via `new Worker(new URL(...))` at `src/lib/res54.ts:90`.
   - Only real false-positive risk: `public/pdf-test.html:91` mentions `PDFViewerModal` in a string; it is a dev artifact, not a live importer.
   - Edge functions are a separate root set (Supabase deploys by directory, not by import).

Re-runnable scanners live at `/data/data/com.termux/files/usr/tmp/opencode/` (`import-graph.mjs`, `dep3.mjs`, `funcs.mjs`). They are throwaway analysis tools, not part of the repo.

**Verdict legend**

| Verdict | Meaning |
|---|---|
| `safe-to-delete` | Zero inbound references from live code **and** no build/config/CI/deploy coupling found. Removal is mechanical. |
| `verify-first` | Dead by static analysis, but something external may still need it (DB cron, dashboard config, mobile build, docs/API contract, runtime alias). Check the cited command before deleting. |
| `keep` | Referenced, or required by build/deploy/public contract. Do not remove. |

---

## 1. Executive summary

| Metric | Value |
|---|---|
| Files under `src/` | 540 (149,746 LOC) |
| Unreachable from `src/main.tsx` | **214 files / 46,245 LOC** (213 deletable; `vite-env.d.ts` is not) |
| …as share of src | 39.6% of files, **30.9% of LOC** |
| Duplicate implementation pairs | 9 (see §5) |
| npm dependencies declared | 158 |
| …imported by live `src/` | 69 |
| …imported only by dead `src/` | **21** |
| …referenced only by config/CLI/tooling/CSS | 21 |
| …referenced nowhere at all | **47** |
| Edge functions | 87 dirs / 21,335 LOC |
| …with zero references anywhere | 8 (but 2 must be kept — DB cron/PREL) |
| TODO/FIXME/HACK/XXX in `src/` | 4 |
| `console.log` in `src/` | 157 (plus 49 in `supabase/functions/`) |
| Files untouched since repo start (2026-07-03) | 0 — **the ">6 months" criterion is impossible** (§9) |
| Build-breaking risk from deleting dead files | **None today**: `noUnusedLocals:false`, `strict:false`, and `npm run build` is `vite build` only (no `tsc`) |

**Three findings that are bugs, not just bloat:**

1. **`sonner` toasts are silent no-ops.** `src/components/ApiKeyManagement.tsx:12` imports `toast as sonnerToast` and calls `sonnerToast.success(...)` at lines 175/178; `StorageProviderManager.tsx`, `StorageSettingsPanel.tsx`, `StorageProviderAddDialog.tsx` and `pages/DeveloperAPI.tsx` do the same. But the only toast host mounted is `<Toaster />` (`src/App.tsx:2`, `:237`), and the `<Sonner />` wrapper it would need (`src/components/ui/sonner.tsx`) is itself **dead/unmounted**. Every sonner call is discarded.
2. **`get-r2-presigned-url` does not exist.** It is invoked at `src/lib/res54-r2-pipeline.ts:570,705,977` — all in a dead file, so harmless today, but `src/pages/docs/architecture.ts:83` already documents it as "Stubbed — not deployed". Anyone resurrecting the R2 pipeline inherits a runtime 404.
3. **`backfill-file-keys` is dead to the repo but alive in production.** `supabase/migrations/20260804030000_file_key_sweep.sql:8` does `net.http_post` against `functions/v1/backfill-file-keys` on a 6-hour pg_cron. Deleting it because "grep finds no caller" breaks the key sweep. Same trap for `kza-enforce`, registered in the PREL registry at `supabase/migrations/20260913040000_spike_reset_fallback_and_prel.sql:24`.

---

## 2. Summary table

| Area | Item | Evidence | Verdict |
|---|---|---|---|
| `src/types` | `supabase.ts` (2,918 LOC) | zero inbound imports; live schema types come from `src/integrations/supabase/types.ts` (3,178 LOC) | `safe-to-delete` |
| `src/lib` | `res54-r2.ts` + `res54-r2-pipeline.ts` (3,042) | zero inbound; live path is `res54.ts` | `safe-to-delete` |
| `src/components/ui` | 34 non-squidset files (5,225) | zero inbound; Radix-era leftovers | `verify-first` — these files are the **only** consumers of 12 Radix packages, so file + package go together |
| `src/components/ui/squidset` | 19 files (1,309) | zero inbound, whole design-system fork unused | `safe-to-delete` |
| `src/components/landing` | 18 files (3,675) | zero inbound; nothing under `src/` imports this directory, and `index.html:156` loads only `src/main.tsx` | `verify-first` |
| `src/components` | pipeline cluster (2,451) | only reachable from each other | `safe-to-delete` |
| `src/components` | squid-ai cluster (2,128) | only from each other; live AI is `supabase/functions/squid-ai-chat` | `safe-to-delete` |
| `src/components` | vault cluster (1,630) | zero inbound | `verify-first` (routing may exist in plans; no route today) |
| `src/components` | SmartDrop/Transfer cluster (1,801) | zero inbound; live upload path is `services/backgroundUpload.ts` | `safe-to-delete` |
| `src/components` | `SquidDashboardUI.tsx` (1,276) | zero inbound; `Dashboard.tsx` is the live page | `safe-to-delete` |
| `src/components` | `AdvancedTextEditor.tsx` (977) | zero inbound | `safe-to-delete` |
| `src/components` | games (1,034) | zero inbound | `verify-first` (feature-flagged off?) |
| `src/pages` | `PublicFileView.tsx` (301) | routes `/s/:shareId` → `SharePage` (`App.tsx:54,431`) | `safe-to-delete` |
| `src/pages` | `Onboarding.tsx` (232) | route uses `OnboardingSetup` (`App.tsx:51,443`) | `safe-to-delete` |
| `src/pages` | `BlockedPage.tsx` (84) | block HTML is inlined in `middleware.ts` | `safe-to-delete` |
| `src/pages` | `Dashboard-bkp11-10-26` (2,913, extensionless) | 95.2% line overlap with `Dashboard.tsx`; not imported (can't be) | `safe-to-delete` |
| `src/hooks` | 11 files (1,168) | 3 are cluster-internal, 8 zero-inbound | `safe-to-delete` |
| `src/services` | 11 files (3,596) | 4 cluster-internal, 7 zero-inbound | `safe-to-delete` |
| `src/lib` | remainder after pipeline + res54-r2 + kza clusters (1,508) | ao56fj3/book/ebook/spreadsheet-utils helpers, all zero-inbound | `safe-to-delete` |
| `src` | CSS/`App.css`/`globals.css` (1,601) | `App.css` and `styles/globals.css` never imported (`main.tsx:4` imports `index.css` only) | `safe-to-delete` |
| `src/api` | `pdf-proxy.ts` (212) | zero inbound | `safe-to-delete` |
| `src/utils` | `cacheManager`, `initSupport`, `platform` (312) | zero inbound | `safe-to-delete` |
| deps | 21 dead-only packages | see §4.2 | `safe-to-delete` (after §4.5 check) |
| deps | 47 unreferenced packages | `@radix-ui/*` migration leftovers, `monaco-editor`, `helia`, `otplib`, `qrcode`, `hls.js`, `react-pdf`, `argon2-browser` — full triage in §4.4 | `verify-first` |
| deps | `electron` | imported only by `electron/main.js`, `electron/preload.js`; not part of web build | `verify-first` (desktop build target) |
| deps | `@fontsource/geist-*` | **live** via `src/index.css:2-7` | `keep` |
| deps | `browserify-fs`, `path-browserify`, `buffer` | zero direct imports; used via `vite.config.ts:25-26` aliases + `optimizeDeps` | `verify-first` |
| deprecated | `@codemirror/basic-setup@^0.20.0` (`package.json:38`) | npm registry flags it `deprecated: "In version 6.0, this package has been renamed to just 'codemirror'"`; zero imports | `safe-to-delete` |
| deprecated | `xlsx@^0.18.5` (`:158`) | live via `src/lib/spreadsheet-engine/workbook.ts:11`; latest npm release 2022-03-24, no 0.19+ on npm | `keep` (migrate to `exceljs`/SheetJS CDN build) |
| deprecated | `epubjs@^0.3.93` (`:122`) | live via `src/lib/deepread-service.ts:126`; latest 0.3.93, 2022-02-16 | `keep` (maintained fork needed) |
| deprecated | `react-helmet@^6.1.0` (`:143`) | live; last publish 6.1.0 (2020), superseded by `react-helmet-async`/React 19 metadata | `verify-first` |
| deprecated | `crypto-js@^4.2.0` (`:118`) | live; unmaintained, disables tree-shaking, weak-by-default | `verify-first` |
| deprecated | `monaco-editor@^0.52.2` (`:131`) | zero imports; CodeMirror 6 is the actual editor | `safe-to-delete` |
| stale | `bun.lockb` (180K) + `package-lock.json` (764K) | both tracked; CI uses only `package-lock.json` (`.github/workflows/build-squidcloud-android-apk.yml:15`) | `safe-to-delete` (`bun.lockb`) |
| stale | `publlic/_redirects` | typo'd twin of `public/_redirects` (24 bytes) | `safe-to-delete` |
| stale | `tailwind.config.ts:7-12` | `content` globs point at non-existent `./pages`, `./components`, `./app` | `keep` + fix (harmless no-op today) |
| edge fn | 8 zero-reference functions | §6 | 2 `keep`, 6 `verify-first` |
| edge fn | `cloudbliss-api/index-selfcontained.ts` (3,064) | 60.4% line-overlap with `handlers.ts`, unreferenced | `safe-to-delete` |
| edge fn | `cloudbliss-api/index-minimal.ts` (7) | unreferenced stub | `safe-to-delete` |
| artifacts | `keplr` 13.5MB binary, `.keplr/index.json` 260K, `*.har` 552K, `deploy_payload.json` 104K, `test-*`, `l0g.txt` | see §7 | `safe-to-delete` (add to `.gitignore`) |

---

## 3. Unreachable files — detail by area

All 214 files are listed in **Appendix A**. Highlights and the reasoning for each cluster follow.

### 3.1 `src/components` — 83 files, 19,810 LOC

The single biggest sink. Sub-clusters, all mutually-referencing but never entered from a route:

**Pipeline cluster (2,451 LOC)** — `pipeline/PipelineCanvas.tsx` (396), `pipeline/VariableReferencePanel.tsx` (84), `lib/component-registry.ts` (831), `lib/variable-registry.ts` (371), `lib/pipeline-templates.ts` (488), `lib/yaml-sync.ts` (189), `lib/squid-variables.ts` (92).
`component-registry.ts` has exactly three inbound edges, all from dead files: `PipelineCanvas.tsx`, `yaml-sync.ts`, and `PipelineCanvas` again. No route, no `/scripts` page import (the live `pages/Scripts.tsx` does not touch it).

**Squid-AI cluster (2,128 LOC)** — `SquidAIChat.tsx` (239), `SquidAISpotlight.tsx` (248), `SquidSpotlight.tsx` (289), `services/squid-ai.ts` (711), `services/squid-ai-tools.ts` (641). Live AI traffic goes to the `squid-ai-chat` edge function; nothing in a route imports these.

**Transfer cluster (1,801 LOC)** — `SmartDropZone.tsx` (520), `TransferProgressOverlay.tsx` (179), `services/SmartTransferQueue.ts` (745), `hooks/useTransferGameSuggestion.ts` (103), `hooks/use-transfer-integrity.ts` (254), plus `SquidAIChat`-adjacent helpers. `SmartTransferQueue` is imported only by `SmartDropZone` and `TransferProgressOverlay` — a closed triangle.

**Vault cluster (1,630 LOC)** — `SquidVault.tsx` (861), `SquidVaultCard.tsx` (394), `SquidVaultFolder.tsx` (144), `SquidVaultView.tsx` (231). No `/vault` route exists in `App.tsx`.

**File-card / mobile-PDF cluster (1,932 LOC)** — `FileCard.tsx` (472), `FileCardMenu.tsx` (261), `EnhancedFileCard.tsx` (180), `MobilePDFViewer.tsx` (707), `MobilePreviewModal.tsx` (312). Live file rows are `FileItem.tsx` / `MobileFileActionSheet.tsx`; live preview is `OptimizedPDFViewer.tsx`.

**Editors (2,309 LOC)** — `SquidDashboardUI.tsx` (1,276), `AdvancedTextEditor.tsx` (977), `editor/MilkdownEditor.tsx` (56). The live editor is `CodeEditor.tsx` (CodeMirror 6) and `EnhancedTextEditor.tsx`.

**Shell/nav duplicates (944 LOC)** — `MobileBottomNav.tsx` (199, dead) vs `MobileBottomNavbar.tsx` (live, used by `App.tsx`); `MobileTopNavbar.tsx` (223, dead) vs `MobileNavHeader.tsx` (live); `DashboardSidebar.tsx`, `DashboardLayout.tsx`, `DashboardHeader.tsx`, `Navbar.tsx`, `WelcomeScreen.tsx` all zero-inbound after the M3 shell landed (`src/components/m3/AppShell.tsx`, 2026-11-01).

**CLI UI (731 LOC)** — `cli/CLIProcessor.ts` (452), `cli/Terminal.tsx` (243), `cli/CLIButton.tsx` (36). The CLI itself lives in `cli/` (separate package) and is unaffected.

**Games (1,034 LOC)** — `games/PerfectTearGame.tsx` (485), `GamesModal.tsx` (310), `GamesIntegration.tsx` (239). `GamesIntegration` is the only importer of `sonner` outside storage settings, and it is dead.

**Other notable singletons:** `DownloadManager.tsx` (660), `QuickJumpModal.tsx` (431), `APIKeyAnalytics.tsx` (403), `FilePeekSidebar.tsx` (401), `UniversalContextMenu.tsx` (456 — imported only by dead `FileContextMenu`/`EnterpriseFolderCard`), `FileGrouping.tsx` (345), `SmartPathNavigator.tsx` (339), `MobileEnhancedUI.tsx` (314), `CloudFileBrowser.tsx` (309), `ShareLinkAnalytics.tsx` (139), `TermsAcceptanceModal.tsx` (248), `UploadDialog.tsx` (240).

Also dead but *small and worth deleting for clarity*: `ExtensionCard.disabled.tsx`, `ExtensionLoader.disabled.tsx`, `ExtensionRunner.disabled.tsx` (5 LOC stubs each), `ExtensionLoader.tsx.backup` (227), `SharedUploadBanner.tsx` (18), `HelpIcon.tsx` (27), `ThemeToggle.tsx` (25), `dashboard/TabEmpty.tsx` (36).

### 3.2 `src/components/ui` — 53 files, 6,534 LOC

This is the residue of a **Radix → Base UI migration**. Live primitives import `@base-ui/react` (e.g. `ui/dialog.tsx`, `ui/select.tsx`, `ui/popover.tsx`, `ui/checkbox.tsx`); 34 files still import Radix and are no longer reachable.

Dead non-squidset (5,225): `sidebar.tsx` (728), `ProviderSetupModal.tsx` (413), `chart.tsx` (364), `combobox.tsx` (298), `carousel.tsx` (261), `EnterpriseFolderCard.tsx` (242), `menubar.tsx` (235), `command.tsx` (199), `context-menu.tsx` (199), `item.tsx` (180), `PremiumSkeleton.tsx` (178), `form.tsx` (177), `input-group.tsx` (157), `navigation-menu.tsx` (129), `segmented-control.tsx` (122), `pagination.tsx` (118), `drawer.tsx` (118), `breadcrumb.tsx` (116), `package-manager-icons.tsx` (112), `code-block-command.tsx` (214), `button-group.tsx` (88), `input-otp.tsx` (70), `skeleton.tsx` (14), `sonner.tsx` (31), `use-toast.ts` (4), `PremiumEmptyState.tsx` (167), `toggle-group.tsx` (60), `accordion.tsx` (57), `hover-card.tsx` (28), `collapsible.tsx` (10), `resizable.tsx` (44), `toggle.tsx` (44), `aspect-ratio.tsx` (6), `ThemedComponents.tsx` (42).

Dead squidset fork (1,309, 19 files): the whole `ui/squidset/` directory including its `index.ts` barrel. Nothing imports `@/components/ui/squidset`.

> **Caution:** `is-dead` here means "no live importer", not "safe to uninstall the package blindly". `accordion`, `aspect-ratio`, `collapsible`, `context-menu`, `hover-card`, `menubar`, `navigation-menu`, `toggle`, `toggle-group` are the *only* consumers of their Radix packages, so those packages become removable **together**. `resizable.tsx` is the only `react-resizable-panels` consumer, `carousel.tsx` the only `embla-carousel-react`, `form.tsx` the only `react-hook-form` + `@hookform/resolvers` (resolvers is imported by nothing at all), `input-otp.tsx` the only `input-otp`, `command.tsx` the only `cmdk`, `sonner.tsx` the only `next-themes`. Delete file + package in the same commit.

### 3.3 `src/components/landing` — 18 files, 3,675 LOC

`videolanding.css` (858), `SealDemo.tsx` (394), `landing-tokens.css` (306), `TerminalDemo.tsx` (280), `ShowcaseSticky.tsx` (250), `ProtocolTrace.tsx` (219), `landing.css` (186), `AsciiWordmark.tsx` (171), `PricingSheet.tsx` (155), `AuroraField.tsx` (150), `CliShowcase.tsx` (133), `HeroSection.tsx` (125), `crypto.ts` (103), `LandingNav.tsx` (79), `ToolManifest.tsx` (75), `NightSky.tsx` (72), `useScramble.ts` (61), `Shell.tsx` (58).

**Why `verify-first`:** these were committed in bulk on 2026-08-26 and 2026-10-12 and look like a landing-page redesign staged ahead of wiring (`landing.css` has no importer, `index.html` loads only `src/main.tsx`). Before deleting, confirm with the product owner that the new landing isn't about to be mounted; the earlier `SealDemo`/`videolanding` work may be intentional WIP.

### 3.4 `src/lib` — 27 files, 7,176 LOC

`res54-r2.ts` (1,657) and `res54-r2-pipeline.ts` (1,385) are complete alternative transports for the R2 backend, superseded by `res54.ts` (live). Line overlap vs `res54.ts`: 28.2% and 37.1% respectively — different implementations, same purpose.

`component-registry.ts` (831), `variable-registry.ts` (371), `pipeline-templates.ts` (488), `yaml-sync.ts` (189), `squid-variables.ts` (92) — pipeline cluster, see §3.1.

Spreadsheet engine leftovers (545): `clipboard.ts` (66), `conditional-formatting.ts` (65), `data-operations.ts` (175), `data-validation.ts` (51), `index.ts` (11), `macros.ts` (109), `styles.ts` (68). Only `workbook.ts`, `cell-operations.ts`, `formula-engine.ts`, `types.ts` are live (via `SpreadsheetViewer`).

Others: `kza-prel-client.ts` (397), `kzaClient.ts` (164), `kza-locale.ts` (94), `res54-ao56fj3.ts` (198), `ao56fj3-client.ts` (78), `book-suggestions.ts` (158), `ebook-utils.ts` (90), `spreadsheet-utils.ts` (90), `videoStreamCache.ts` (70), `motion.ts` (69), `icons.css` (26), `package-manager.ts` (24), `squidveil/schema.ts` (160 — the only `zod` consumer, and it is dead).

### 3.5 `src/hooks` (1,168) / `src/services` (3,596)

Hooks: `useVideoAnalytics.ts` (302), `use-transfer-integrity.ts` (254), `use-pin-auth.ts` (153), `use-folder-history.ts` (113), `useTransferGameSuggestion.ts` (103), `useQuickLook.ts` (92), `useSharedReceiver.ts` (63), `use-copy-to-clipboard.ts` (30), `use-mobile.tsx` (22), `use-squid-ai-shortcut.ts` (20), `useGameShortcut.ts` (16).

> `hooks/use-mobile.tsx` is a dead duplicate of `hooks/use-mobile.ts` (the `.ts` one is live from 2026-07-17). Same export name — a genuine copy/paste hazard.

Services: `SmartTransferQueue.ts` (745), `squid-ai.ts` (711), `squid-ai-tools.ts` (641), `security-service-real.ts` (407), `VideoAnalyticsService.ts` (364), `byok-file-service.ts` (262), `dataExport.ts` (163), `ipReputation.ts` (103), `github.ts` (90), `secure-upload.ts` (57), `gemini.ts` (53).

### 3.6 `src/pages`, `src/utils`, `src/api`, CSS

| File | LOC | Note |
|---|---|---|
| `pages/Dashboard-bkp11-10-26` | 2,913 | extensionless backup, 95.2% overlap with `Dashboard.tsx`. Cannot be imported by Vite; delete with confidence. |
| `pages/PublicFileView.tsx` | 301 | superseded by `SharePage.tsx` (`App.tsx:54`) |
| `pages/Onboarding.tsx` | 232 | superseded by `OnboardingSetup.tsx` (`App.tsx:51`) |
| `pages/BlockedPage.tsx` | 84 | block HTML inlined in `middleware.ts` |
| `utils/cacheManager.ts` | 201 | zero inbound |
| `utils/initSupport.ts` | 65 | zero inbound |
| `utils/platform.ts` | 46 | zero inbound |
| `api/pdf-proxy.ts` | 212 | zero inbound (Vercel functions are in `api/` at repo root, not `src/api/`) |
| `App.css` | 45 | not imported; `main.tsx:4` imports `index.css` |
| `styles/globals.css` | 180 | not imported; `index.css` imports `premium-motion`, `premium-spacing`, `squircle`, `animations`, `toast` only |
| `vite-env.d.ts` | 2 | standard Vite ambient-types file; unreachable by graph construction only — **not** deletable, listed for completeness |

---

## 4. Dependencies (158 declared)

### 4.1 Live (69)

`@base-ui/react`, `@capacitor/{app,camera,core,filesystem,haptics,share,splash-screen,status-bar}`, 22 × `@codemirror/*` (commands, 14 language packs, language, state, theme-one-dark, view), `@ffmpeg/{ffmpeg,util}`, `@phosphor-icons/react`, 9 × `@radix-ui/*` (avatar, dropdown-menu, label, progress, scroll-area, slider, switch, tabs, toast), `@supabase/supabase-js`, `@tanstack/{react-query,react-virtual}`, `@xyflow/react`, `class-variance-authority`, `clsx`, `crypto-js`, `date-fns`, `epubjs`, `framer-motion`, `jszip`, `katex`, `lenis`, `lucide-react`, `papaparse`, `pdfjs-dist`, `perfect-freehand`, `react`, `react-day-picker`, `react-dom`, `react-helmet`, `react-markdown`, `react-router-dom`, `react-syntax-highlighter`, `recharts`, `sonner`, `tailwind-merge`, `vaul`, `xlsx`.

> `sonner` is "live" only in the sense that live files import it — see the bug in §1. Fix or remove, don't just delete the package.

### 4.2 Dead-only (21) — imported exclusively by unreachable files

| Package | Only importer (dead) | `package.json` |
|---|---|---|
| `@milkdown/kit` | `components/editor/MilkdownEditor.tsx` | line 40 |
| `@milkdown/theme-nord` | same | line 42 |
| `@radix-ui/react-accordion` | `ui/accordion.tsx` | 66 |
| `@radix-ui/react-aspect-ratio` | `ui/aspect-ratio.tsx` | 68 |
| `@radix-ui/react-collapsible` | `ui/collapsible.tsx` | 70 |
| `@radix-ui/react-context-menu` | `ui/context-menu.tsx` | 72 |
| `@radix-ui/react-hover-card` | `ui/hover-card.tsx` | 74 |
| `@radix-ui/react-menubar` | `ui/menubar.tsx` | 76 |
| `@radix-ui/react-navigation-menu` | `ui/navigation-menu.tsx` | 78 |
| `@radix-ui/react-slot` | `ui/breadcrumb.tsx`, `ui/form.tsx` | 88 |
| `@radix-ui/react-toggle` | `ui/toggle.tsx` | 94 |
| `@radix-ui/react-toggle-group` | `ui/toggle-group.tsx` | 96 |
| `cmdk` | `ui/command.tsx` | 117 |
| `embla-carousel-react` | `ui/carousel.tsx` | 121 |
| `input-otp` | `ui/input-otp.tsx` | 127 |
| `jspdf` | `services/dataExport.ts` | 126 |
| `motion` | `components/custom/copy-button.tsx` | 132 |
| `next-themes` | `ui/sonner.tsx` | 133 |
| `react-hook-form` | `ui/form.tsx` | 137 |
| `react-resizable-panels` | `ui/resizable.tsx` | 142 |
| `zod` | `lib/squidveil/schema.ts` | 159 |

Verdict: `safe-to-delete` **as a set with their dead files** (§3.2 note). Removing packages while leaving dead files will break `vite build` import resolution only if those files are ever included — they aren't, but the files should go first anyway.

### 4.3 Config/CLI/CSS-only (21) — keep

`@capacitor/cli` (`capacitor.config.ts`), `@eslint/js` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` + `globals` + `typescript-eslint` (`eslint.config.js`), `@vitejs/plugin-react-swc` + `lovable-tagger` + `vite-plugin-static-copy` + `vite-plugin-top-level-await` + `vite-plugin-wasm` + `vite` (`vite.config.ts`), `tailwindcss` + `tailwindcss-animate` (`tailwind.config.ts`), `electron` (`electron/main.js`, `electron/preload.js`), `@noble/curves` + `@noble/hashes` (`cli/src/lib/…`, `packages/sde/…`), `multiformats` (`packages/sde/src/substrates/deep/DHT.ts`), `squidlab-sdk` (its own `bin/cli.js`, `tests/test-extension/src/index.ts`).

Including two that a JS-only scanner wrongly flags: **`@fontsource/geist-sans` and `@fontsource/geist-mono` are live** — consumed through CSS `@import` at `src/index.css:2-7`, invisible to a JS import graph. Do not remove.

### 4.4 Never referenced (47) — triage

**Migration leftovers, zero uses (delete):** `@radix-ui/react-alert-dialog`, `-checkbox`, `-dialog`, `-popover`, `-radio-group`, `-select`, `-separator`, `-tooltip`, `@hookform/resolvers`, `@tailwindcss/typography` (no `require` in `tailwind.config.ts` plugins — only `tailwindcss-animate` at line 208), `@tanstack/react-query-devtools`, `codemirror` (v6 metapackage; the code imports the individual `@codemirror/*` packages), `@codemirror/{autocomplete,basic-setup,lint,search}`.

**Big binaries/bloat with zero uses:** `monaco-editor` (replaced by CodeMirror), `helia`, `otplib`, `qrcode`, `hls.js`, `react-pdf`, `argon2-browser`, `terser` (Vite 7 uses esbuild/rolldown; no minify config references it), `vercel` (CLI, not needed in CI — deploy is via the Vercel GitHub app), `concurrently`, `supabase` (CLI — check `scripts:` before removing; `npx supabase` may be used), `electron` is in the config group above.

**Type-only, harmless but mostly unneeded:** `@types/{hls.js,qrcode}` describe packages that aren't used at all. `@types/jszip` and `@types/katex` are redundant with the typings their packages already ship (confirm with `tsc --noEmit` before removing). `@types/{node,react,react-dom,react-syntax-highlighter}` are required by `tsc` — keep.

**Mobile-build question:** `@capacitor/android` / `@capacitor/ios` have zero JS references because they are platform projects, consumed by `npx cap sync`. `verify-first` — see §7.

### 4.5 Verification before uninstall

```bash
cd /data/data/com.termux/files/home/cloudbliss-storage-fresh-main
# any reference at all (src + configs + scripts + css + html)?
for p in monaco-editor helia otplib qrcode hls.js react-pdf jspdf cmdk input-otp \
         embla-carousel-react react-hook-form zod motion next-themes @milkdown/kit; do
  printf '%-24s ' "$p"
  grep -rIl --exclude-dir={node_modules,.git,dist} --exclude={package.json,package-lock.json,bun.lockb} \
    -- "$p" . | tr '\n' ' '; echo
done
# then, and only then:
# npm uninstall <pkgs> && npx vite build
```
Because there is no `node_modules/` in this checkout, **bundle-size impact could not be measured — unverified.**

---

## 5. Duplicate implementations

| Pair | Overlap | LOC at risk | Verdict |
|---|---|---|---|
| `src/pages/Dashboard-bkp11-10-26` ↔ `src/pages/Dashboard.tsx` | 95.2% of lines | 2,913 | `safe-to-delete` (backup) |
| `src/types/supabase.ts` ↔ `src/integrations/supabase/types.ts` | same generated schema, 2,918 vs 3,178 | 2,918 | `safe-to-delete` (nothing imports the former) |
| `supabase/functions/cloudbliss-api/index-selfcontained.ts` ↔ `handlers.ts` | 60.4% | 3,064 | `safe-to-delete` |
| `src/lib/res54-r2.ts` / `res54-r2-pipeline.ts` ↔ `src/lib/res54.ts` | 28.2% / 37.1% | 3,042 | `safe-to-delete` (alternative transport) |
| `src/lib/encryption.orig.ts.backup` ↔ `src/lib/encryption.ts` | **byte-identical** | 601 | `safe-to-delete` |
| `src/hooks/use-mobile.tsx` ↔ `src/hooks/use-mobile.ts` | same API | 22 | `safe-to-delete` |
| `src/components/MobileBottomNav.tsx` ↔ `MobileBottomNavbar.tsx` | same role | 199 | `safe-to-delete` |
| `CLOUDBLISS-API-GUIDE.md` ↔ `CLOUDBLISS_API_GUIDE.md` | 3.7% (same topic, different content) | 2 docs | `verify-first` — merge, don't blind-delete |
| `public/_redirects` ↔ `publlic/_redirects` | identical 24 B | — | `safe-to-delete` (`publlic/`) |

Two "duplicate" risks that are **not** duplicates:
- `src/lib/encryption.ts` vs `encryption-v3.ts` — **both live, different layers**: v1 is used for share-link payloads (`SharePage.tsx:18`, `EnhancedShareDialog.tsx:17`), v3 for chunk encryption (`res54.ts:7`). Neither is a duplicate — do not "consolidate" them.
- `src/components/EnhancedTextEditor.tsx` (live) vs `AdvancedTextEditor.tsx` (dead) — ~different implementations; check feature parity before deleting if INK editing matters.

---

## 6. Edge functions — 87 dirs, 21,335 LOC

`supabase/config.toml` declares 58 `[functions.*]` entries (from `L21 api-file-upload` to `L103 download-manager`). Client calls use `supabase.functions.invoke("name")`; 87 directories exist.

### 6.1 Zero references anywhere (8)

| Function | LOC | Extra evidence | Verdict |
|---|---|---|---|
| `backfill-file-keys` | 145 | **invoked by pg_cron** via `net.http_post` — `supabase/migrations/20260804030000_file_key_sweep.sql:8` | **`keep`** |
| `kza-enforce` | 74 | **registered in PREL registry** — `supabase/migrations/20260913040000_spike_reset_fallback_and_prel.sql:24` | **`keep`** |
| `process-migration` | 448 | only a comment reference (`..._exempt_bulk_imports_from_upload_quota.sql:5`); no route calls it | `verify-first` (migration flow may be dashboard-driven) |
| `send-beta-invite` | 169 | no refs, not untracked | `verify-first` (admin-invoked?) |
| `storage-cleanup` | 146 | no refs; no cron in migrations | `verify-first` (may be a dashboard cron) |
| `backfill-provider-credentials` | 123 | no refs | `verify-first` (one-shot admin op) |
| `set-b2-cors` | 117 | no refs | `verify-first` (one-shot ops script) |
| `send-diwali` | 193 | **untracked in git** (`?? supabase/functions/send-diwali/`) | `verify-first` — decide whether to commit or drop; it is not part of HEAD |

### 6.2 Config-only, docs-referenced (28) — `keep`

`add-app-update`, `admin-auth`, `admin-data-access`, `api-file-delete`, `api-file-metadata`, `api-file-upload`, `check-admin-status`, `cli-operations`, `download-manager`, `download-shared-file`, `generate-pdf-url`, `hls-generation`, `kza-admin`, `kza-heartbeat`, `kza-oracle`, `kza-phantom`, `kza-verdict`, `media-master-manifest`, `media-playlist`, `media-segment`, `migration-oauth`, `serve-pdf`, `serve-pdf-secure`, `start-migration`, `trash-operations`, `validate-share`, `verify-admin`, `video-stream-proxy`.

`api-file-*` are a **public API contract** (documented in `src/pages/docs/api.ts` and the `CLOUDBLISS*API*GUIDE` docs). Deleting them breaks external clients even though no `src/` file calls them.

`kza-heartbeat` is config-only but also scheduled in `20260806000200_kza_hardening_v2.sql:178` — live, keep.

### 6.3 Naming/contract defects found

- `get-r2-presigned-url` is invoked at `src/lib/res54-r2-pipeline.ts:570,705,977` but **no such directory exists**. Dead path today; documented as stubbed in `src/pages/docs/architecture.ts:83`.
- `cloudbliss-api/` ships `index.ts`, `handlers.ts`, `lib.ts`, `utils.ts`, `import_map.json`, plus **`index-selfcontained.ts` (3,064) and `index-minimal.ts` (7)** — dead alternates. Whichever is deployed is chosen by the `[functions.cloudbliss-api]` entrypoint (`config.toml:55`); verify before deleting.

---

## 7. Stale build/config files & artifacts

| Path | Size | Issue | Verdict |
|---|---|---|---|
| `bun.lockb` | 180 K | second lockfile, tracked, no `bun` in CI | `safe-to-delete` |
| `package-lock.json` | 764 K | the one CI uses (`.github/workflows/…apk.yml:15`) | `keep` |
| `publlic/_redirects` | 24 B | typo dir, duplicate of `public/_redirects` | `safe-to-delete` |
| `tailwind.config.ts:7-12` | — | `content` includes `./pages`, `./components`, `./app` which do not exist | fix (harmless, but hides misses) |
| `tailwind.config.ts:208` | — | only `tailwindcss-animate`; `@tailwindcss/typography` never registered | remove dep |
| `vite.config.ts:25-26` | — | `path` → `path-browserify`, `fs` → `browserify-fs` aliases; **no direct imports of either** | `verify-first` — transitive (some `@codemirror`/`jszip` path may need it). Test by removing aliases and running `vite build`. |
| `vite.config.ts:20-50` | — | `optimizeDeps.include: ['buffer','pdfjs-dist']` — `buffer` has no direct import | `verify-first` |
| `keplr` (root) | 13.5 MB | binary committed | `safe-to-delete` |
| `.keplr/index.json` | 260 K | generated index | `safe-to-delete`, gitignore |
| `squidcloud.vercel.app_Archive [26-10-12 23-39-13].har` | 552 K | browser capture | `safe-to-delete` |
| `deploy_payload.json` | 104 K | deploy artifact | `safe-to-delete` |
| `l0g.txt`, `test-sde.ts`, `test-sde.mjs`, `test_write.txt`, `test-spreadsheet.csv`, `script.js`, `deploy_fn.py`, `_tsccheck.json` | — | scratch files at root | `safe-to-delete` |
| `.backups/Index.20260926-120210.tsx` | 686 | editor backup | `safe-to-delete` |
| `src/lib/encryption.orig.ts.backup` | 601 | byte-identical to `encryption.ts` | `safe-to-delete` |
| `src/components/ExtensionLoader.tsx.backup` | 227 | superseded by `.disabled` stubs | `safe-to-delete` |
| `.glasscn-backup/` | — | whole backup dir | `safe-to-delete` |
| `squidlab-sdk/` (local) | v1.1.0 | `package.json` asks for `^1.0.2`; no `src/` import; only its own CLI + a test import it | `verify-first` — this is the published SDK, likely a workspace vendoring; don't delete casually |
| 104 root `*.md` files | 1.7 MB | docs sprawl, several superseded (`*_FIX.md`, `*_REPORT.md`) | `verify-first` — archive to `docs/` |
| `.github/workflows/build-squidcloud-android-apk.yml` | — | hard-coded keystore filename + password env names in the workflow | **security note, out of scope for deletion** |

`.gitignore` currently has 153 bytes and does not cover `.backups/`, `keplr`, `*.har`, `deploy_payload.json`.

---

## 8. Hygiene counters

### 8.1 TODO / FIXME / HACK / XXX in `src/` — **4 total**

| File | Line | Text |
|---|---|---|
| `src/components/AdvancedSearch.tsx` | 195 | `// TODO: Handle custom collections when implemented` |
| `src/pages/PatchNotes.tsx` | 355 | `(TODO: add \`-y\` flag)` |
| `src/services/pdfSecurity.ts` | 59 | `// TODO: Implement proper file sharing table when available` |
| `src/services/squid-ai-tools.ts` | 604 | `// TODO: Implement with Gemini API` |

Zero in `lib/`, `hooks/`, `contexts/`, `supabase/functions/`, `cli/`. This is unusually clean; the debt here is **dead volume**, not unresolved annotations.

### 8.2 `console.log` in `src/` — **157**

| Area | Count |
|---|---|
| `src/services` | 55 |
| `src/components` | 25 |
| `src/api` | 19 |
| `src/lib` | 16 |
| `src/utils` | 15 |
| `src/App.tsx` | 6 |
| `src/hooks` | 4 |
| `src/pwaInstall.ts` | 3 |
| `src/contexts` | 2 |
| `src/main.tsx` | 2 |
| `src/pages` | 10 |
| `supabase/functions` | 49 |

Note: `src/main.tsx:14-17` neuters `console.log`/`console.debug` in production builds, so this is cleanliness, not leakage — **except** in edge functions, where the 49 calls do reach Supabase logs (some may contain user/file metadata; not verified line-by-line).

---

## 9. Git staleness — the 6-month criterion is not applicable

- Oldest commit in the repo: **2026-07-03** (`src/App.tsx`, `cli/src/bin/squidcloud.ts`, `supabase/functions/*` — 539 files landed in the initial import).
- Newest: **2026-11-01** (`src/components/m3/*`, `src/styles/m3/*`, `pages/DesignSystem.tsx`).
- Total tracked source-ish files measured: 816.

**No file can be ">6 months untouched" in a repo whose history is 4 months old.** Substituted measurements:

| Last touched on/before | Files |
|---|---|
| 2026-07-31 | 669 |
| 2026-08-10 | 690 |
| 2026-08-31 | 771 |
| 2026-09-30 | 782 |
| 2026-10-31 | 807 |
| 2026-11-01 | 816 |

Practical reading: **669 files (82%) have not been touched since the July import.** Staleness is uniform, so "old file" is a weak signal here — use the reachability verdicts in §3 instead. The only files with meaningful recent churn are the M3 design system, the signals platform (`lib/signals-client.ts`, `components/Signals*`), the CLI, and the book/DeepRead feature.

---

## 10. Ranked removals (top 25 by measured LOC)

Non-overlapping units. "Files" = files deleted; LOC = sum of measured line counts.

| # | Remove | Files | LOC | Verdict | Blocker / note |
|---|---|---|---|---|---|
| 1 | `src/components/ui/**` dead non-squidset set | 34 | 5,225 | `verify-first` | these files hold the last references to most `@radix-ui/*` packages (§4.2) — delete file and package in one commit |
| 2 | `src/components/landing/**` | 18 | 3,675 | `verify-first` | confirm the redesign isn't imminent; includes 3 CSS files |
| 3 | `cloudbliss-api/index-selfcontained.ts` + `index-minimal.ts` | 2 | 3,071 | `safe-to-delete` | check `config.toml:55` entrypoint first |
| 4 | `src/lib/res54-r2.ts` + `res54-r2-pipeline.ts` | 2 | 3,042 | `safe-to-delete` | also removes the 3 dead `get-r2-presigned-url` calls |
| 5 | `src/types/supabase.ts` | 1 | 2,918 | `safe-to-delete` | canonical types live in `integrations/supabase/types.ts` |
| 6 | `src/pages/Dashboard-bkp11-10-26` | 1 | 2,913 | `safe-to-delete` | extensionless backup |
| 7 | Pipeline cluster (`PipelineCanvas`, `VariableReferencePanel`, `component-registry`, `variable-registry`, `pipeline-templates`, `yaml-sync`, `squid-variables`) | 7 | 2,451 | `safe-to-delete` | `@xyflow/react` becomes removable |
| 8 | Editor cluster (`SquidDashboardUI`, `AdvancedTextEditor`, `editor/MilkdownEditor`) | 3 | 2,309 | `safe-to-delete` | `@milkdown/*` removable |
| 9 | File-card / mobile-PDF cluster (`FileCard`, `FileCardMenu`, `EnhancedFileCard`, `MobilePDFViewer`, `MobilePreviewModal`) | 5 | 1,932 | `safe-to-delete` | live equivalents: `FileItem`, `OptimizedPDFViewer` |
| 10 | SmartDrop/Transfer cluster (`SmartDropZone`, `TransferProgressOverlay`, `SmartTransferQueue`, 2 hooks) | 5 | 1,801 | `safe-to-delete` | live upload path is `services/backgroundUpload.ts` |
| 11 | Vault cluster (`SquidVault`, `SquidVaultCard`, `SquidVaultFolder`, `SquidVaultView`) | 4 | 1,630 | `verify-first` | no `/vault` route today |
| 12 | `src/lib` remainder (ao56fj3, book/ebook, spreadsheet-utils, motion, icons.css, package-manager, squidveil/schema) | 17 | 1,508 | `safe-to-delete` | `zod` removable |
| 13 | squidset design-system fork | 19 | 1,309 | `safe-to-delete` | whole dir + `index.ts` barrel |
| 14 | Backups: `.backups/Index…tsx`, `encryption.orig.ts.backup` | 2 | 1,287 | `safe-to-delete` | second is byte-identical to `encryption.ts` |
| 15 | `QuickJumpModal` + `APIKeyAnalytics` + `FilePeekSidebar` | 3 | 1,235 | `safe-to-delete` | standalone features, no routes |
| 16 | Legacy services (`security-service-real`, `byok-file-service`, `ipReputation`, `github`, `dataExport`, `secure-upload`, `gemini`) | 7 | 1,135 | `safe-to-delete` | `jspdf` removable |
| 17 | Games cluster (`PerfectTearGame`, `GamesModal`, `GamesIntegration`) | 3 | 1,034 | `verify-first` | feature may be intentionally switched off |
| 18 | Shell/nav dead set (`MobileBottomNav`, `MobileTopNavbar`, `DashboardSidebar`, `DashboardLayout`, `DashboardHeader`, `Navbar`) | 6 | 944 | `safe-to-delete` | M3 `AppShell` superseded them |
| 19 | Dead spreadsheet engine files + panels | 11 | 916 | `safe-to-delete` | keep `workbook`, `cell-operations`, `formula-engine`, `types`, `SpreadsheetViewer` |
| 20 | CLI UI components (`CLIProcessor`, `Terminal`, `CLIButton`) | 3 | 731 | `safe-to-delete` | not the `cli/` package |
| 21 | kza client trio (`kza-prel-client`, `kzaClient`, `kza-locale`) | 3 | 655 | `verify-first` | edge functions `kza-*` are live; only the client is dead |
| 22 | Dead pages (`PublicFileView`, `Onboarding`, `BlockedPage`) | 3 | 617 | `safe-to-delete` | routes verified in `App.tsx:51,54,431,443` |
| 23 | `src/utils/*` + `src/api/pdf-proxy.ts` | 4 | 524 | `safe-to-delete` | |
| 24 | Dead hooks remainder | 8 | 509 | `safe-to-delete` | includes the `use-mobile.tsx` duplicate |
| 25 | `App.css` + `styles/globals.css` + `lib/icons.css` | 3 | 251 | `safe-to-delete` | `main.tsx:4` imports `index.css` only |

**Cumulative:** 174 files, **43,622 LOC** in the top 25 (94.3% of all dead LOC). The remaining 40 files (2,623 LOC) are small stubs, `.disabled` artifacts and unused single-purpose components listed in Appendix A. (Landing CSS and `vite-env.d.ts` are excluded from this ranking to avoid double counting / because they are not deletable.)

---

## 11. Re-verification commands

Run from the repo root. Each block is independent and read-only.

```bash
# 0) Snapshot before you touch anything
git rev-parse --short HEAD && git status --porcelain

# 1) Confirm a specific file is truly unreferenced (repeat per candidate)
f=src/components/SquidDashboardUI.tsx
grep -rnI --exclude-dir={node_modules,.git,dist} \
  -- "$(basename "$f" .tsx)" src supabase cli index.html | grep -v "^$f:"

# 2) Rebuild the full reachability graph (~1s)
node /data/data/com.termux/files/usr/tmp/opencode/import-graph.mjs . | head -30
# prints: total / reachable / unreachable + per-file inbound edges

# 3) Re-check every dependency's importer set
node /data/data/com.termux/files/usr/tmp/opencode/dep3.mjs . | sed -n '/NO LIVE src IMPORTER/,$p'

# 4) Re-check edge-function references (src/CLI/docs/config/migrations)
node /data/data/com.termux/files/usr/tmp/opencode/funcs.mjs .

# 5) Prove the DB-cron trap before deleting any function
grep -rn "functions/v1/" supabase/migrations
grep -rn "http_post\|cron.schedule" supabase/migrations | grep -i "$FN_NAME"

# 6) Prove a route really points elsewhere
grep -n "lazy(() => import" src/App.tsx | grep -Ei "onboarding|share|vault|dashboard|games"

# 7) Build must stay green after each batch
npm ci && npx vite build   # NOTE: no node_modules/ in this checkout; ~2-4 min
npx tsc -p tsconfig.app.json --noEmit   # currently passes with strict:false; dead files don't fail it

# 8) Lockfile / CI consistency
grep -n "package-lock\|npm ci\|bun " .github/workflows/*.yml
```

**Suggested sequencing (each step is one commit, build must pass before the next):**

1. Backups, `.backups/`, `.orig.ts.backup`, `.disabled.tsx`, `Dashboard-bkp11-10-26`, `encryption.orig.ts.backup` — zero risk.
2. `src/types/supabase.ts`, `src/App.css`, `src/styles/globals.css`, `src/api/pdf-proxy.ts`, `src/utils/*`, dead pages.
3. Dead `src/components` clusters (pipeline → squid-ai → transfer → filecard → shell/nav → editors → games).
4. Dead `src/components/ui` + `squidset` **together with** their packages (§4.2), then `npx vite build`.
5. `src/lib` + `src/services` + `src/hooks` remainders, then the never-referenced dependency list (§4.4), split into 3 commits.
6. Edge functions: only the ones cleared by §11.5. Never `backfill-file-keys`, `kza-enforce`, or the `api-file-*` contract.

---

## 12. Unverified / needs a human

| Item | Why unverified |
|---|---|
| Bundle-size savings from dep removal | no `node_modules/` in this checkout; sizes not measurable |
| `supabase` + `vercel` CLI packages | may be invoked by `npm scripts` or developer habit; `package.json` scripts not exhaustively traced |
| `@capacitor/android` / `@capacitor/ios` | required by `npx cap sync` even with zero JS imports |
| `browserify-fs` / `path-browserify` / `buffer` | aliased in `vite.config.ts`; removing requires an actual build to confirm no transitive consumer |
| `xlsx` CVE / 0.18.5 provenance | latest npm publish is 2022-03-24; **security advisory details not verified in this environment** (web search returned HTTP 402). Treat as "known-abandoned on npm", not "known-vulnerable". |
| `react-helmet` | not formally deprecated by npm; unmaintained since 2020. Replacement decision is a product call. |
| 8 zero-reference edge functions | Supabase dashboard cron/webhooks are invisible to the repo; `storage-cleanup` and `send-beta-invite` may be dashboard-scheduled |
| `squidlab-sdk/` vendored v1.1.0 vs `^1.0.2` dep | unclear which is authoritative |
| Whether `components/landing/*` is imminent WIP | commit dates (2026-08-26, 2026-10-12) suggest staged work |
| `console.log` in edge functions leaking metadata | 49 sites not audited line-by-line for PII |

---

## Appendix A — full unreachable list (214 files, 46,245 LOC · 213 deletable)

Legend: `path (LOC)`. All paths relative to `src/` unless prefixed.

### A.1 `components/` — 83 files, 19,810 LOC
```
AdvancedTextEditor.tsx(977)  APIKeyAnalytics.tsx(403)  AudioPlayer.tsx(239)
BiometricProtectedContent.tsx(55)  cbCodeFolderViewer.tsx(209)
cli/CLIButton.tsx(36)  cli/CLIProcessor.ts(452)  cli/Terminal.tsx(243)
CloudFileBrowser.tsx(309)  CloudProviderImport.tsx(191)  CreateButton.tsx(114)
custom/copy-button.tsx(90)  dashboard/TabEmpty.tsx(36)
DashboardHeader.tsx(142)  DashboardLayout.tsx(63)  DashboardSidebar.tsx(221)
DownloadManager.tsx(660)  DragDropBreadcrumbs.tsx(282)  editor/MilkdownEditor.tsx(56)
EnhancedFileCard.tsx(180)  EnhancedPDFViewer.tsx(226)
ExtensionCard.disabled.tsx(5)  ExtensionLoader.disabled.tsx(5)  ExtensionRunner.disabled.tsx(5)
FileCard.tsx(472)  FileCardMenu.tsx(261)  FileContextMenu.tsx(23)  FileGrouping.tsx(345)
FilePeekSidebar.tsx(401)  FileVersionModal.tsx(200)
games/PerfectTearGame.tsx(485)  GamesIntegration.tsx(239)  GamesModal.tsx(310)
GeoBlockOverlay.tsx(87)  GitHubRepositories.tsx(214)  HelpContent.tsx(131)  HelpIcon.tsx(27)
LazyPDFPreview.tsx(120)  MediaBackupSettings.tsx(169)
MobileBottomNav.tsx(199)  MobileEnhancedUI.tsx(314)  MobileFileMenu.tsx(204)
MobilePDFViewer.tsx(707)  MobilePreviewModal.tsx(312)  MobileTopNavbar.tsx(223)
motion/index.tsx(123)  Navbar.tsx(96)  PDFViewerModal.tsx(383)  PebbleFileIcon.tsx(145)
PinProtectedAction.tsx(75)  PinSetupModal.tsx(149)  PinVerificationModal.tsx(129)
pipeline/PipelineCanvas.tsx(396)  pipeline/VariableReferencePanel.tsx(84)
publish/PublishedSitesManager.tsx(120)  PwaInstallPrompt.tsx(142)
QuickJumpModal.tsx(431)  SharedUploadBanner.tsx(18)  ShareLinkAnalytics.tsx(139)
SmartDropZone.tsx(520)  SmartPathNavigator.tsx(339)  SmoothScroll.tsx(38)
spreadsheet/ChartPanel.tsx(72)  spreadsheet/FormatPanel.tsx(145)
spreadsheet/FormulaPanel.tsx(64)  spreadsheet/PivotTablePanel.tsx(90)
SquidAIChat.tsx(239)  SquidAISpotlight.tsx(248)  SquidDashboardUI.tsx(1276)
SquidsetThemeToggle.tsx(78)  SquidSpotlight.tsx(289)
SquidVault.tsx(861)  SquidVaultCard.tsx(394)  SquidVaultFolder.tsx(144)  SquidVaultView.tsx(231)
StreamingVideoDemo.tsx(182)  TermsAcceptanceModal.tsx(248)  ThemeToggle.tsx(25)
TransferProgressOverlay.tsx(179)  UniversalContextMenu.tsx(456)  UploadDialog.tsx(240)
VideoPlayer.tsx(96)  WelcomeScreen.tsx(284)
```

### A.2 `components/ui/` — 34 files, 5,225 LOC
```
accordion.tsx(57)  aspect-ratio.tsx(6)  breadcrumb.tsx(116)  button-group.tsx(88)
carousel.tsx(261)  chart.tsx(364)  code-block-command.tsx(214)  collapsible.tsx(10)
combobox.tsx(298)  command.tsx(199)  context-menu.tsx(199)  drawer.tsx(118)
EnterpriseFolderCard.tsx(242)  form.tsx(177)  hover-card.tsx(28)
icons/package-manager-icons.tsx(112)  input-group.tsx(157)  input-otp.tsx(70)
item.tsx(180)  menubar.tsx(235)  navigation-menu.tsx(129)  pagination.tsx(118)
PremiumEmptyState.tsx(167)  PremiumSkeleton.tsx(178)  ProviderSetupModal.tsx(413)
resizable.tsx(44)  segmented-control.tsx(122)  sidebar.tsx(728)  skeleton.tsx(14)
sonner.tsx(31)  ThemedComponents.tsx(42)  toggle-group.tsx(60)  toggle.tsx(44)
use-toast.ts(4)
```
> `sonner.tsx` must not be deleted until the live `sonner` callers are fixed or removed — it is the only component that would mount the sonner host (§1, finding 1).

### A.3 `components/ui/squidset/` — 19 files, 1,309 LOC
```
Alert.tsx(75)  Avatar.tsx(59)  Badge.tsx(45)  Button.tsx(63)  Card.tsx(120)
Checkbox.tsx(49)  Dialog.tsx(111)  Dropdown.tsx(104)  index.ts(48)  Input.tsx(60)
Progress.tsx(47)  Select.tsx(52)  Skeleton.tsx(41)  Switch.tsx(53)  Table.tsx(101)
Tabs.tsx(104)  Textarea.tsx(46)  Toast.tsx(72)  Tooltip.tsx(59)
```

### A.4 `components/landing/` — 18 files, 3,675 LOC
```
AsciiWordmark.tsx(171)  AuroraField.tsx(150)  CliShowcase.tsx(133)  crypto.ts(103)
HeroSection.tsx(125)  landing-tokens.css(306)  landing.css(186)  LandingNav.tsx(79)
NightSky.tsx(72)  PricingSheet.tsx(155)  ProtocolTrace.tsx(219)  SealDemo.tsx(394)
Shell.tsx(58)  ShowcaseSticky.tsx(250)  TerminalDemo.tsx(280)  ToolManifest.tsx(75)
useScramble.ts(61)  videolanding.css(858)
```

### A.5 `lib/` — 27 files, 7,176 LOC
```
ao56fj3-client.ts(78)  book-suggestions.ts(158)  component-registry.ts(831)
ebook-utils.ts(90)  icons.css(26)  kza-locale.ts(94)  kza-prel-client.ts(397)
kzaClient.ts(164)  motion.ts(69)  package-manager.ts(24)  pipeline-templates.ts(488)
res54-ao56fj3.ts(198)  res54-r2-pipeline.ts(1385)  res54-r2.ts(1657)
spreadsheet-engine/clipboard.ts(66)  spreadsheet-engine/conditional-formatting.ts(65)
spreadsheet-engine/data-operations.ts(175)  spreadsheet-engine/data-validation.ts(51)
spreadsheet-engine/index.ts(11)  spreadsheet-engine/macros.ts(109)
spreadsheet-engine/styles.ts(68)  spreadsheet-utils.ts(90)  squid-variables.ts(92)
squidveil/schema.ts(160)  variable-registry.ts(371)  videoStreamCache.ts(70)
yaml-sync.ts(189)
```

### A.6 `services/` — 11 files, 3,596 LOC
```
byok-file-service.ts(262)  dataExport.ts(163)  gemini.ts(53)  github.ts(90)
ipReputation.ts(103)  secure-upload.ts(57)  security-service-real.ts(407)
SmartTransferQueue.ts(745)  squid-ai-tools.ts(641)  squid-ai.ts(711)
VideoAnalyticsService.ts(364)
```

### A.7 `hooks/` — 11 files, 1,168 LOC
```
use-copy-to-clipboard.ts(30)  use-folder-history.ts(113)  use-mobile.tsx(22)
use-pin-auth.ts(153)  use-squid-ai-shortcut.ts(20)  use-transfer-integrity.ts(254)
useGameShortcut.ts(16)  useQuickLook.ts(92)  useSharedReceiver.ts(63)
useTransferGameSuggestion.ts(103)  useVideoAnalytics.ts(302)
```

### A.8 `pages/`, `types/`, `utils/`, `api/`, `styles/`, root — 11 files, 4,286 LOC
```
pages/BlockedPage.tsx(84)  pages/Onboarding.tsx(232)  pages/PublicFileView.tsx(301)
types/supabase.ts(2918)
utils/cacheManager.ts(201)  utils/initSupport.ts(65)  utils/platform.ts(46)
api/pdf-proxy.ts(212)  styles/globals.css(180)  App.css(45)
```
> `vite-env.d.ts` is counted in the graph's 214/46,245 totals but is **not deletable** (standard Vite ambient types). Effective deletable set: **213 files / 46,243 LOC**.
*Area totals reconcile: 83 + 34 + 19 + 18 + 27 + 11 + 11 + 11 = 214 files; 19,810 + 5,225 + 1,309 + 3,675 + 7,176 + 3,596 + 1,168 + 4,286 = 46,245 LOC.*
> A.8 now prints 10 deletable files + the non-deletable `vite-env.d.ts`; the 4,286 LOC total above still includes that file's 2 lines.

---

### Reproducibility note

Raw artifacts from this audit (not committed, outside the repo):
`/data/data/com.termux/files/usr/tmp/opencode/{graph.json, dep3.json, funcs.json, lastcommit.json}` and the three `.mjs` scripts that regenerate them. They can be regenerated at any time with the commands in §11 and will reflect the tree at that moment.
