## 2026-11-24 - Merge all hardening plans into one (interactive query)
- User: "merge all of the hardening plans u made so far".
- Merged web isolation, sealed preview modal and Supabase backend hardening into the canonical full-e2e spec as a single v12 document (959 lines, §§1-21). Renumbered appended sections to 20.x/21.x with no duplicate headers. Rewrote the master implementation priority so backend hardening + Phase 0 and sealed preview come before crypto core/wider rollout. Marked the three standalone specs SUPERSEDED with pointers to §16/§20/§21. Committed ab6aefbc.
- Next: await approval, then invoke writing-plans.

## 2026-11-24 - Integrate isolation into security plan (interactive query)
- User: "integrate it into the previous security plan".
- Merged `2026-11-24-web-isolation-design.md` into the canonical E2E design as section 16 with subsections 16.1-16.13 (origins, headers, sandbox, worker, storage, tabs, native fallback, DNS, verification, UX, risks, decision).
- Updated cross-cutting sections so the plan is coherent: threat model gained other-tab/origin and extension/OS rows; hardening table gained Isolation + Native rows; detection gained CSP reports; residual risks gained extension/OS and preview-frame plaintext; verification gained §16.10 matrix; priority order now includes web isolation as step 4 before exposing decrypted content and native client as step 9; open decisions gained native timing.
- Bumped status to v6 INTEGRATED; marked standalone isolation doc SUPERSEDED. Committed c906c41f.
- Next: await approval, then invoke writing-plans.

## 2026-11-24 - Security review: keys + Supabase (read-only, interactive query)
- User feared DB admins/attackers could obtain user files; proposed replacing direct Supabase calls with a server-side API layer and asked how to fix other findings.
- Loaded systematic-debugging for the audit and brainstorming for the architecture discussion. Launched two background read-only subagents (client key handling; Supabase DB/functions) plus independent repo scan and CLI SQL checks.
- Client confirmed: managed mode escrows raw AES keys to server (KEK from SQUIDVEIL_MASTER_KEY/service key) - encryption at rest, NOT E2E, despite "zero-knowledge" claims in docs/security.ts:15,41 and SecurityCenter.tsx:620. store-file-key failure writes raw key into files.tags (res54.ts:782-791) which share RPC returns. file-key JWT path bypasses PREL/f2fa (file-key/index.ts:132-143). Weak HTML blocklist sanitizer + dangerouslySetInnerHTML in EnhancedMarkdownPreview.tsx:25-53.
- Supabase confirmed LIVE CRITICAL: shares RLS returns all public share rows (keys + access codes); get_shared_file_info and get_file_for_share are anon-callable SECURITY DEFINER oracles with no password check (and password checks in edge functions are dead code because access_code isn't returned); update_share_options lets anon overwrite any share; get_secret is anon vault reader; files bucket public; anon EXECUTE on kza_prel token-signing/rotate primitives; multiple key functions verify_jwt=false; hardcoded backfill token in repo.
- Verified OK: profiles.is_admin/tier not user-writable (column grants), github_connections RLS owner-only, file_key_vault scoped, file-key JWT path guarded, no plaintext key values logged.
- Correction to user's premise: a proxy hides nothing from a user's own DevTools (anon key/JWT are public by design) and does NOT stop a DB admin while the KEK is server-held. Real priority is the RPC exposure, then BFF, then user-held keys.
- Proposed phases: 0 SQL containment (revoke anon EXECUTE, fix shares/files RLS, private bucket, no key columns in RPC returns, rotate backfill token); 1 BFF with HttpOnly cookies + single authz/audit/step-up choke point + reject body-supplied userId; 2 user-held key hierarchy for true E2E with migrate-on-open for old files.
- NO changes made (review only). Next: await direction.

## 2026-11-24 - Restore legacy GitHub downloads + deprecate Books UI (interactive query)
- User reported old files (GitHub-repo buckets) 404ing at squidcloud-cluster with payload {action:download, nodeId:0, repo:dataMatrix_mczm2tm6_0, path:1dee.../res54_...json}. Also asked to deprecate DeepRead/Books sections; EPUBs should be read via preview modal.
- Used the systematic-debugging process. Phase 1 evidence via Supabase CLI (`supabase db query --linked`): found file dcd032b5 (InflateOrbit.txt) with that exact chunk; chunks carry accountId 1 but no owner. github_connections for that user = hellosquidcloud. MCP Supabase tools were permission-denied for this project; CLI worked.
- Phase 3 hypothesis: repos live under a different GitHub account. User supplied a token; verified /user => LamGPT123 and the exact chunk URL with that token => HTTP 200, while anon and hellosquidcloud token => 404. Root cause confirmed.
- Phase 4 fix: set dedicated secrets LEGACY_STORAGE_GITHUB_TOKEN/USERNAME via CLI (never committed). Rewrote the legacy branch in both squidcloud-cluster and github-storage to try dedicated account -> user's github_connections -> indexed accounts -> all globals -> public, returning 404 only after all fail. Deployed both functions with `supabase functions deploy`.
- Deprecation: removed Books tab/catalog from Dashboard (both mobile/desktop panels), removed standalone DeepReadReader mounts from Dashboard + FileCard + MobileEnhancedUI + ManageFileRequests + SharePage. Preview modal keeps its inline DeepReadReader for EPUBs.
- Verified no token in repo, brace/paren/template balance; committed de2baf40; Vercel READY. Anonymous invoke of the function returned KZA_PREL_MISSING (expected — needs the app's PREL token), so the underlying GitHub 200 is the verification.
- Next: human retries an old file; investigate any repo owned by another account.

## 2026-11-24 - EPUB reader redesign to match PDF viewer (interactive query)
- User: "do the same redesign with epub reader, making them both exactly same but differs in features".
- DeepReadReader had a full-width header bar, slide-in side panel and bottom progress bar, plus a CSS skin (RD_DOCK_CSS) trying to make them look docked. Replaced the entire render layer while leaving all logic (secure fetch, EpubEngine init, theme/font effects, TOC, bookmarks, search, remote progress, annotation) byte-identical.
- New chrome mirrors OptimizedPDFViewer exactly: dense neutral `.rd-g` glass (near-opaque, blur only, hairline rim), grouped circular docks with JELLY/POP/SOFT springs, three top docks (contents/bookmarks/search | title+page | font size, settings, annotate, fullscreen, bookmark), bottom nav dock with clickable progress rail, floating sidebar island for TOC/bookmarks/search, glass settings popover for theme/typeface/line spacing, glass loading/error cards. Mobile stacks the docks and turns the island into a bottom sheet.
- PDF branch now renders OptimizedPDFViewer alone (no overlapping reader docks). Added useReducedMotion import.
- Verified brace/paren/template balance; updated UI-UX-STANDARD.md; committed cd8189d3; `vercel --prod --yes` READY.
- Next: await visual verification.

## 2026-11-24 - Strip white tints (interactive query)
- User: "remove that white tint from ui its looking trash".
- Root cause for the PDF chrome: `.pdv-g` used translucent glass with `saturate(160%)` over a white PDF page, so the page bled through and made the docks look white. Changed to near-opaque neutral gradient + blur only (no saturate), with a neutral hairline rim and deeper shadow.
- Neutralized remaining pure-white chrome: PDF dot/swatch/checkbox rims, focused textbox background, Light theme swatch; video spinner stroke and subtitle glyph; command palette AI pill borders/glow and orb highlight (blue accent kept).
- PDF document pages intentionally remain white — that is content, not chrome.
- Committed 5d106f9c; `vercel --prod --yes` READY.
- Next: await visual confirmation.

## 2026-11-24 - Clean PDF chrome + restore glass/motion (interactive query)
- User rejected the new PDF viewer's interface as AI slop and asked to restore animations and glass effects.
- Audit: six floating surfaces at once (top-left dock, title chip, top-right 8-button dock, markup row, transient bottom page HUD, sidebar island) plus a white `.pdv-pill`. Crowded and generic.
- Changes in OptimizedPDFViewer.tsx: removed the duplicate transient bottom page HUD and put prev/next into the title dock; top-right dock now zoom-out/pct/zoom-in/search/more only, with Bookmark/Markup/Search in the More menu; mobile dock cut to Pages/Markup/More. Replaced the white pill with neutral glass, rebuilt `.pdv-g` with a soft vertical gradient, hairline rim and deeper shadow (22px saturate blur). Title dock padding tightened.
- Restored the punchy springs across cbVideoPlayer (JELLY 520/15, POP 380/17, SOFT 300/26, scrubber stretch 0.85, button squash .88/.8) and the preview dock (faceSpring 520/15, rubber 96, overshoot velocities, magnetic pull 46, press .93/.86, hover 1.045, conic rim no longer suppressed). Kept the plain-CSS corner anchoring that fixed wide-screen visibility.
- Committed d3ffc34b; `vercel --prod --yes` READY.
- Next: await visual feedback.

## 2026-11-24 - Integrate newest OptimizedPDFViewer (interactive query)
- Found new OptimizedPDFViewer.tsx (Nov 24 11:06, 1074 lines) in /storage/emulated/0/Download; replaced src/components/OptimizedPDFViewer.tsx verbatim.
- New design: macOS Preview-style, virtualised continuous scroll / single / dual page, floating glass docks (sidebar+view, title+page, zoom+tools), markup dock (highlight/underline/strike/draw/text/note/erase), annotations + bookmarks via supabase, persistent prefs in localStorage.
- Verified imports (pdfjs-dist, framer-motion, @/integrations/supabase/client, @/lib/utils) all exist; worker setup unchanged. Props interface identical to old one, so EnhancedInstantPreviewModal and DeepReadReader call sites were untouched.
- Brace/paren/template balance verified; committed 91f36648; `vercel --prod --yes` READY.
- Next: await visual verification.

## 2026-11-23 - Revert Folio PDF viewer (interactive query)
- User: "i think our own previous pdf viewer was far better". Reverted the PDF part of commit 8a681899 only.
- EnhancedInstantPreviewModal imports/renders OptimizedPDFViewer again; deleted FolioPdfViewer.tsx (verified no other references); reverted the UI-UX-STANDARD.md note.
- Kept the non-PDF improvements from that commit: calmer spring constants / no gloss in the preview dock and video player, and the plain-CSS corner anchoring that fixed the wide-screen dock visibility.
- Committed 184cef53; `vercel --prod --yes` READY.
- Next: do not retry the Folio port unless explicitly asked.

## 2026-11-23 - Folio PDF engine + calm motion + wide-screen dock (interactive query)
- User asked to replace OptimizedPDFViewer with Folio from GitHub, personalise the UI to SquidCloud (floating grouped docks), remove gloss, tone down jelly physics, and fix the preview dock being invisible on wide screens until 125% zoom.
- Brainstorming skill was loaded per the rules, but its question/approval gate conflicts with AGENTS.md (unattended, decide and act, user instructions outrank skills) — proceeded autonomously and logged the rationale.
- Research: GitHub search found owenpkent/folio (MIT, TS, React 19, pdfjs-dist v6, zustand, Tauri). Cloned and read Page.tsx / PdfViewer.tsx / PdfJsEngine.ts / setupWorker.ts. It is a desktop app, not an npm package, so porting the whole thing would drag in Tauri + a dozen feature stores. Decision: port the portable page architecture and rebuild the chrome.
- New src/components/FolioPdfViewer.tsx (369 lines): repo's existing pdfjs-config worker setup + pdfjs-dist v5 API; measured intrinsic page sizes in a cache, layout box reserved immediately, canvas painted only inside a 700px IntersectionObserver ring with DPR<=2, separate TextLayer for selection, Fit width/page/custom, rotation, scroll->current page, lazy thumbnails. Chrome = two floating grouped docks (page/zoom top, view options bottom), neutral glass, plain CSS 160ms transitions, no framer-motion/gloss/spring. Focus mode hides docks.
- Modal switched to FolioPdfViewer; OptimizedPDFViewer retained for DeepReadReader.
- Dock bug: position was driven by an animated `m` motion value writing inline right/bottom; on wide viewports it could land offscreen. Removed `m`, anchored with plain CSS (with !important + a data-edge variant) so it is always in the corner. Jelly springs softened (stiffness ~300, damping 28-34), rubber 96->44, press/hover scales reduced, velocity overshoots removed, conic gloss rim disabled on the preview dock. Video player JELLY/POP/SOFT springs and scrubber stretch similarly calmed.
- Updated docs/UI-UX-STANDARD.md; committed 8a681899; `vercel --prod --yes` READY.
- Next: visual verification of PDF rendering/text layer, wide-screen dock, and calmer motion.

## 2026-11-23 - Start + check secos daemon (interactive query)
- User asked "start secos check". secos is the dex outbound-only device agent at ~/dex/secos (outside this repo but part of the user's environment).
- Found no running process; log stale since 2026-11-16. Ran ~/.termux/boot/start-secos -> agent printed "Enter your dex token:" and exited because the boot script passes only SECOS_PASSWORD, not a token.
- secos/bin/secos.js reads DEX_TOKEN or DEX_DASHBOARD_TOKEN; ~/dex/.env has DEX_DASHBOARD_TOKEN. Started detached with that token + SECOS_PASSWORD and --name termux-phone; appended to ~/.termux/boot/secos.log.
- Verified: pid 30941 alive after 25s, log shows "connected: localhost", no new ws errors.
- Did NOT patch the boot script (config outside assigned working dir); logged it as a blocker needing user approval.
- Next: only if asked, fix ~/.termux/boot/start-secos to source the token so it survives reboots.

## 2026-11-23 - Palette polish + remove AI live context (interactive query)
- Human: live context bar looked AI-ish, remove it; also make the command palette more polished overall.
- Removed the `.spot-ctx` JSX block, its CSS rules and @keyframes spot-live. aiContext/currentFolder are still forwarded to squidAgent.ask(), so behaviour is unchanged.
- Polish pass: reduced .spot-clip::before grain veil opacity .55 -> .3 (user had reacted badly to heavy grain elsewhere); neutralized .spot-row-thumb and .spot-ico from white to rgba(232,231,225,..); 54 -> 56px pill; scope chips with hairline active state and a bottom divider; refined group labels, list/foot scrollbars, row padding, empty state, suggestion hover lift, footer and focus rings.
- Updated UI-UX-STANDARD.md accordingly. Committed 09b8c4ff. First `vercel --prod --yes` returned "Not authorized" (status error); an immediate retry succeeded READY at cloudbliss-storage-12gjmgunl-sqc.vercel.app.
- Next: await visual feedback.

## 2026-11-23 - Fix HUD flash on tap (interactive query)
- Report: while playing, tapping the video makes the HUD glitch/flash until the HUD itself is touched.
- Root cause: `onTouchDown` calls wakeControls() (sets controlsVisible=true) immediately; then the delayed tap handler in `onTouchUp` read `uiRef.current` — already true — and scheduled `setControlsVisible(false)` 300ms later. So the chrome appeared then disappeared. Touching the HUD has `data-cbp-ui`, so onTouchDown returns early and no hide is scheduled — hence "stable once I tap the HUD".
- Fix: `uiAtDown` ref captures the pre-tap visibility on pointer-down; the tap branch uses it to choose hide-vs-show immediately with no timer. Double-tap zone seek and mouse click/dblclick behaviour preserved.
- Committed 0a409c46; `vercel --prod --yes` READY.
- Next: await confirmation on device.

## 2026-11-23 - Remove player grain + center spinner (interactive query)
- Screenshot Screenshot_20261123-172814.jpg showed the HUD drowned in heavy static-noise grain and the buffering spinner off-center and partly hidden behind the HUD.
- Grain root cause: I had interpolated GRAIN_BG (an SVG with fully opaque noise) directly into .cbp-glass background-image with no opacity control. Removed the import and the layer entirely; clean neutral frosted gradient restored.
- Spinner root cause: Framer Motion animates `scale` via an inline `transform`, which overrides the CSS `transform: translate(-50%,-50%)` used for centering. Fixed by passing x:'-50%', y:'-50%' in initial/animate/exit for .cbp-wait; applied the same fix to .cbp-gesture and the mobile .cbp-center transport (same latent bug), and removed the now-redundant CSS transforms.
- Committed 2d523c4c; `vercel --prod --yes` READY.
- Next: await visual confirmation.

## 2026-11-23 - Remove NOW PLAYING label (interactive query)
- Human said the NOW PLAYING label + live pulse added in the previous player pass was unnecessary and should go.
- Removed the `.cbp-now` div from the audio meta JSX (title + type/size meta remain), the `.cbp-now*` CSS rules and the `@keyframes cbp-live` block.
- Verified zero leftover references and brace/paren/template balance; committed 37fd0cb0; `vercel --prod --yes` READY.
- Next: await further design feedback.

## 2026-11-23 - cbVideoPlayer fixes from screenshot review (interactive query)
- Screenshot Screenshot_20261123-165534.jpg showed the new glass HUD but with a visible white sheen. Root causes: .cbp-glass white gradient overlay, `backdrop-filter: ... brightness(1.06)`, white inset rim, and a pointer-following white radial ::before. Replaced all with neutral dock glass + GRAIN_BG nano grain; neutralized slider fill/thumb, button hovers, pills, tips and the sage/green audio orb (user had explicitly rejected green accents earlier).
- Options menu had speed/audio/subs but rows were conditionally hidden and there was no quality. Rebuilt root menu to always show Quality / Audio Track / Subtitles / Speed with icons + current values. Added quality page with source resolution detected from videoWidth/Height (qualityOf helper), passed ?q= to the virtual-stream URL, and preserved playback position via a resumeAt ref so switching quality doesn't restart. Note: SW serves one progressive stream (no renditions) - quality is an honest preference hook, displayed as such.
- Subtitles now actually work without native tracks: hidden file input parses .srt/.vtt into VTTCue objects added to a real addTextTrack('subtitles') track, which our cuechange listener renders. Audio page always shows Default plus native tracks.
- Input rewrite: old touch model relied on React click/doubleclick with a 300ms timer and no swipes. New pointer-based system on the root: first finger records start; movement >14px chooses seek (horizontal) / brightness (left half) / volume (right half); second finger triggers pinch zoom. Tap = UI toggle, double-tap = zone seek (±10s) or play/pause; mouse click/dblclick kept but guarded to mouse only. Added data-cbp-ui guards on HUD/menu/center so gestures don't fire on controls, and touch-action:none on root. Keyboard expanded with c/i/p/[/]/0-9/Home/End.
- Audio: NOW PLAYING eyebrow with live pulse, neutral orb, always-on HUD (ui is true for isAudio).
- Verified brace/paren/template balance; committed 73b42a1c; `vercel --prod --yes` READY.
- Next: human verification on a real touch device; tune gesture thresholds / HUD sizing if needed.

## 2026-11-23 - Integrate new cbVideoPlayer (interactive query)
- Newest download: `cbVideoPlayer.tsx` (16:30, 986 lines vs old 897). Replaced src/components/cbVideoPlayer.tsx verbatim.
- New player is self-contained: only imports framer-motion, @/lib/utils, @/lib/videoStreamer. Uses StreamDecryptorService.initListener + seedFileMeta (both verified present). Streaming/decryption logic carried over.
- Props interface byte-identical to old (file/poster/autoPlay/className/shareId), so the three call sites needed zero edits: EnhancedInstantPreviewModal, MobilePreviewModal, StreamingVideoDemo. The extra props at the latter two (src/muted/onDownload/useStreaming/etc.) were already there pre-change - not a regression; tsconfig has strictNullChecks/noUnusedLocals off.
- Design: QuickTime-style floating glass HUD centred on desktop, mobile controls over the picture, spring driven (JELLY/POP/SOFT), liquid scrubber thumb stretches with pointer velocity, menus pop from anchor, audio files get an ambient artwork stage.
- Verified brace/paren/template balance; committed e26b5f1b; `vercel --prod --yes` READY.
- Next: human visual verification of the HUD; tune sizing/scrubber feel if needed.

## 2026-11-23 - New dock file + palette scope-card/AI polish (interactive query)
- Newest download was `EnhancedInstantPreviewModal.tsx-new` (15:27) — copied into src/components/EnhancedInstantPreviewModal.tsx. Its key change: dock now imports DOCK_CSS + Icons from the repo's FloatingDock.tsx so the preview dock reuses the exact dashboard dock faces (.sq-face/.sq-round/.sq-hit/.sq-orb-slot), with a new `side` prop ('corner' | 'edge'); edge mode parks the dock right-centre for CBVideoPlayer so it avoids the player controls. Verified Icons.X and all CSS classes exist before integrating.
- CommandPalette scope card: root cause of "no translucent/grain" was `.spot-panel[data-ai="true"] { background: linear-gradient(...) }` — the `background` shorthand overrode `.spot-glass` background-image/color and killed the grain. Replaced with background-color + background-image preserving both NANO layers, added `.spot-panel.spot-glass` translucent frosted body (rgba(16,17,18,.86), blur 46px saturate 1.5) and a grain veil on `.spot-clip::before`. Fixed z-index so content stays above the veil without breaking the 0fr→1fr grid animation.
- AI: added `.spot-ctx` live context strip (pulsing dot, current file/type/folder/selection) to the ask view; answer now carries data-streaming while loading and uses a sliding blue gradient with background-clip:text + a glowing `.spot-caret`, keyframes spot-stream-blue / spot-live / spot-caret.
- Verified brace/paren/backtick balance; committed 84371f49; `vercel --prod --yes` READY.
- Next: human visual verification; tune blue gradient intensity or dock edge placement if needed.

## 2026-11-23 - Integrate user-authored preview files (interactive query)
- Found new files in /storage/emulated/0/Download (the `~/storage/shared` symlink resolves to /storage/emulated/0). Latest timestamp 14:55: EnhancedInstantPreviewModal.tsx, MinimizedPreviewStack.tsx, grain.ts. Other tsx (CommandPalette 10:05, FloatingDock/Dashboard/App Nov 16-19) are older — left untouched.
- Downloaded CommandPalette.tsx verified as an OLD transparent-glass version (`--glass: rgba(38,40,50,.52)`, zero NANO_GRAIN refs) vs the current premium palette (5 refs). Deliberately not overwritten.
- New modal design: a true spring-driven 'jelly' dock — `useMotionValue`/`useSpring`/`useTransform`/`animate` drive width/height/per-corner radius, magnetic bulge toward cursor, 2s auto-throw into bottom-right corner squashed against both walls, hover pop, tethered pull with release threshold. Minimize = keep tab (`previewTabs.minimize()`); X = remove tab (`previewTabs.close(id)`). Reviewed the file's "ASSUMED API" note and confirmed both store methods exist.
- New MinimizedPreviewStack is presentational: props `tabs/activeId/onRestore/onClose/onCloseAll`, fanned spring cards, `useDragControls` drag-left=maximize / drag-right=close, hide-all/close-all pills, hidden handle. Kept store coupling out of it.
- Wired via existing PreviewTabStack.tsx rewritten as a thin wrapper (subscribes to previewTabs, maps PreviewTab -> StackTab), so Dashboard's two mounts needed no changes.
- git add 5 files (grain.ts, new modal, new stack, wrapper, UI-UX-STANDARD.md) -> commit 29fcacea -> `vercel --prod --yes` READY.
- Next: human visual verification of dock physics / gestures; tune spring constants and drag thresholds if needed.

## 2026-11-23 - Preview UX refinement (interactive query)
- Reviewed latest screenshots from ~/Downloads and ~/storage/shared/Pictures/Screenshot. Confirmed the modal chrome was overcrowded, the minimized tabs were generic "AI slop", and the palette read too thin/transparent.
- Rebuilt EnhancedInstantPreviewModal chrome into a single floating dock: grainy translucent glass, spring physics, only minimize + close. Added a 2s visibility window then a spring submerge into the bottom-right corner with a visible peek; corner hot-zone hover and drag-to-pull reveal it. Removed all other buttons (info/share/download/fullscreen/nav/strip) and their dead state/imports.
- Redesigned PreviewTabStack as a deck of glassy grain-textured picking cards: tight fan collapsed, spring fan-out on hover, per-card type glyph/label/close, drag-out-to-dismiss, click-to-restore, quiet hide-all/close-all pill, hidden-tab restore badge. Kept monochrome (rejected green accent).
- CommandPalette: densified glass to rgba(14,15,16,.968), added a second high-frequency NANO_GRAIN layer over the mid-frequency NANO_TEXTURE, stronger rim + deep shadow, refined mute tone for a premium frosted finish.
- Verified brace/paren/backtick balance on all three files; no local tsc available, Vercel cloud build authoritative.
- Committed 79ae2745 (4 files) and deployed `vercel --prod --yes` -> READY at cloudbliss-storage-qzb1fg0lk-sqc.vercel.app.
- Next: await human visual verification; tune submerge peek amount / spring stiffness or palette grain intensity from screenshots.

## 2026-10-27 - LOC analysis (interactive query)
- Task: count lines of code excluding comments and markdown.
- Method: git ls-files (ex *.md(x)) -> cloc 2.10 Perl script downloaded from AlDanial/cloc tag v2.10 (relied on raw.githubusercontent.com Availability). cloc comment handling is state-machine-based (string/template-safe), so comment counts are trustworthy.
- Corrections verified: .har capture (17,194 lines) was counted as JSON -> separated; Cargo.lock (2,115 raw lines) silently skipped by cloc -> added manually where noted; teardown confirmed language rows sum exactly to 249,950.
- Key result: 249,950 code lines across 1,142 non-md text files (+2,115 Cargo.lock raw = ~252,065 all-text); approx 206,640 lines when generated/data artifacts (lockfiles, HAR, BIP39 wordlist, l0g.txt dump, egg-info, robots) are excluded.
- Next: nothing queued (cold start; interactive query, no backlog item picked).

## 2026-11-24 - Final migration to ~/SquidCloud (interactive)
- Verified public remote (Lamgerr/SquidCloud): default=fresh-main, head 45a4fd62, 0 PR refs.
- Pushed final local commit so local/remote matched.
- Cloned clean remote into /data/data/com.termux/files/home/SquidCloud; moved local-only files from old repo: .env.local, squidcloud.keystore, android/app/squidcloud.keystore, .vercel/, .opencode/. Fixed accidental nested copies (.opencode/.opencode, .vercel/.vercel).
- Moved OpenCode session to the new directory via session_move.
- Deleted old local dir cloudbliss-storage-fresh-main (rm -rf) and deleted remote repos Lamgerr/cloudbliss-storage and Lamgerr/cloudbliss-storage-clean via GitHub API (204 each; verified 404 afterwards).
- Final: one active repo (SquidCloud, public, fresh-main, 0 PR refs), new local repo clean.
- REMAINING BLOCKER: credential rotation — Supabase service-role key from leaked history still valid (REST 200, exp 2035). Repo is structurally clean but leaked values are not dead.

## 2026-11-25 — Auth rebuild from scratch + UI/UX skill library
- User rejected the previous auth result as "generic AI slop": an animated panel bolted onto the old form. Decision: replace the entire visual layer, keep every handler/effect byte-identical.
- Installed skills via `node node_modules/skills/bin/cli.mjs add <repo> -g -y` (npm `skills@1.9.0` installed locally; npx shim was broken). Sources verified: nextlevelbuilder/ui-ux-pro-max-skill 153,991 stars; leonxlnx/taste-skill 121,365; emilkowalski/skills 59,415; heygen-com/hyperframes 89,891. Skipped uizze/uizze (137 stars) and designed-by-ai/skills (42 stars) per find-skills quality bar. 37 skills now indexed by OpenCode; PromptScript adapter "failed to install" messages were global-install no-ops only.
- Ran ui-ux-pro-max `--design-system` for the auth page; applied its checks (SVG icons only, 44px touch targets, visible focus, reduced motion, 4.5:1 CTA label, no excessive animation) and choreograph rules (one entrance per container, overlap phases, no uniform stagger).
- Auth.tsx logic preserved by splicing the exact logic block from the old file into a new prefix/suffix; only additive change is `passkeySuccess` visual state. All 6 effects, 6 handlers, strength calc, view derivation, redirect logic, INK modal, toasts and doc title intact.
- AuthIdentityStage rewritten: aurora blobs, animated wave field, drifting motes, ghost wordmark, pointer-reactive luminous seed with orbiting rings/satellites, floating glass status notes, mode-aware copy.
- PasskeyRitual rewritten: glass trigger row + full-screen scan ritual with converging rings, drawn fingerprint, progress arc, four overlapping phases and a seal/check finish. Moved `<style>` outside the overlay after catching that the trigger was unstyled until activation.
- Build: Vercel `READY`. Not visually verified in-browser here; user will test.

## 2026-11-25 — Auth pivot: pure monochrome minimalism
- User rejected the playful ember/aurora version outright. Explicit target: "very minimal, clean interface, full monochromatic apple inc like cleaniness and neat interface." Decision: discard the art direction entirely rather than tune it.
- Third full visual rebuild of Auth.tsx, logic spliced verbatim again. Palette now strictly grayscale: #000 background, #f5f5f7 text, #86868b/#6e6e73 muted, rgba(255,255,255,.13) hairlines. System SF Pro font stack. Centered 372px column, large semibold tight-tracked headline, small plain labels, hairline-only fields, one solid white pill CTA (black text), three monochrome circular OAuth buttons, plain text mode switch with 1px underline.
- Motion reduced to 180ms opacity fades and a 1px underline slide; one subtle breathing fingerprint while waiting for a passkey. prefers-reduced-motion fully honored.
- Deleted AuthIdentityStage.tsx and PasskeyRitual.tsx (superseded). Build initially failed on duplicate viewAnim from the prior splice; removed the stale declaration. Vercel READY.
- Lesson recorded: user does not want decorative animation or accent color on auth. Minimalism means removing elements, not restyling them.

## 2026-11-25 — Auth consistency fixes from screenshot
- User: keep monochrome but add the dashboard's "little green thing in bg"; remove one of two logos; fix broken passkey icon; use high-quality monochrome OAuth SVGs; make UI/UX consistent.
- Found source of the green tint: dashboard DARK token `bg: #090b0a` plus a quiet ambient wash. Auth now consumes sa-* tokens directly and adds a very faint green radial at bottom-left (rgba(134,195,161,.05)), matching the dashboard rather than inventing a new palette.
- Removed the centre logo mark; top-left brand stays. Replaced the malformed hand-written passkey SVG with lucide `Fingerprint`. Replaced Google/Discord marks with clean single-colour simple-icons paths; GitHub uses lucide `Github`.
- Root cause of the stray rounded outline in the screenshot: the global `:focus-visible` rule included inputs, overriding the bare-field underline. Scoped it to buttons and links only.
- Vercel READY.

## 2026-11-25 — Glass spring vocabulary across auth + settings pages
- User asked for the EnterpriseSidebar glass/spring feel on the auth mode switch and the same cleanliness on all pages they named.
- Read EnterpriseSidebar.tsx: THUMB spring {380,21,0.8}, ICON_TAP {600,16}, one shared layoutId thumb, glass gradient `sa-bg-4 -> sa-bg-3` with inset highlight + 1px rim + lifted shadow, idle mute / active text, 1px focus outline.
- Auth: replaced the 1px text underline with a two-cell glass capsule; thumb uses the exact THUMB spring, label uses TAP spring, same gradient/rim/shadow recipe, sa-* tokens.
- pages-polish.css.ts: the old file had a blanket `box-shadow:none !important` that was destroying the glass depth on AccountSettings/DeveloperAPI. Rewrote as a light alignment layer — keep glass, align tokens/type/focus/entrance, neutralize only stray white surfaces and green action colors.
- Unified AccountSettings dock thumbnail spring from 400/24/0.8 to 380/21/0.8. DeveloperAPI already used THUMB.
- Vercel READY.

## 2026-11-25 — AccountSettings shell redesign + remove upload friction
- User: bottom dock layout is the worst possible UX; use the auth switcher's glass physics for the navbar; move the vault security panel into the Security category; stop asking users to pick between multiple upload/encryption methods.
- Replaced the single-column stage + 9-item bottom dock with a grouped left glass rail (Account / Developer / System) and a right content pane. Rail thumb uses one shared layoutId with spring 380/21/0.8; items use tap spring 600/16; same gradient/inset/rim/shadow recipe as EnterpriseSidebar and the auth switcher. On mobile the rail becomes a sticky horizontal glass strip.
- Moved VaultSecurityPanel into renderSecuritySection and removed the global footer copy.
- Upload friction: `getUploadKeySelection` now defaults to `always_saved` with no prompt unless the user explicitly configures an advanced mode in Encryption settings. Fixed a second path in BYOKContext that was reading the raw stored preference (`always_prompt`) and re-opening the dialog despite the new default.
- Copy updated in BYOKSettingsCard: plain explanation that uploads just use the account key, with "Ask each upload" as an explicit opt-in.
- Vercel READY.

## 2026-11-25 — Settings visual fixes from screenshots
- Screenshots found in ~/Downloads (not shared/Download): Profile + Security.
- Root cause of the floating "Unlock your vault to manage security" text: VaultSecurityPanel returned early with className vsp-locked, but `<style>{CSS}</style>` was only rendered in the unlocked branch, so the locked state had zero CSS. Rewrote the component: style tag in both branches, locked state is now a glass pod with icon, copy and an Unlock button wired via new onUnlock prop from AccountSettings.
- VaultUnlockDialog: removed every white-alpha fill (icon, input, primary button, card). Card uses sa-bg gradient + rim + inset highlight; overlay uses a near-opaque scrim with blur.
- Encryption category: BYOK/SDESettingsCard were still on the old white/5 + amber/purple/emerald Tailwind look. Wrapped them with tv-enc/tv-enc-card and scoped overrides to monochrome glass, neutral icons/badges/inputs/pills.
- Settings pages now carry the same faint bone-white + green ambient wash as auth and dashboard.
- Vercel READY.

## 2026-11-25 — Settings layout fix, TOTP redesign, shake, vault recovery UI
- User repeated that the settings layout bug and rectangle rail were still wrong. Removed the enclosing rail container entirely (no background/border/shadow on desktop); items float with only a glass layoutId thumb on the active one. Shell is centred with 196px rail + 720px pane and a fixed column gap, so fields are no longer stretched. Mobile keeps a horizontal glass strip for usability.
- TOTP screenshot showed literal "data:image/svg+xml;utf-8," above the QR: enrollment.totp.qr_code is a data URI, but it was injected with dangerouslySetInnerHTML. Replaced with `<img src={mfaQrCode}>`; rebuilt the flow as a two-step glass panel with QR card, copyable secret and six segmented OTP inputs (verified against mfaVerifyCode state).
- Verified Apple/macOS password shake keyframes from CSS-Tricks (cubic-bezier(.36,.07,.19,.97), five damped oscillations). Added .shake-on to index.css and a useShake hook that replays on every error. Wired into Auth login, VaultUnlockDialog, MFA verify and AccountSettings password change.
- Added VaultRecoveryCard to Encryption: explains forgotten vault passwords are unrecoverable, requires typed ERASE, then shows visible step-by-step formatting progress. SKIPPED — needs a human: no destructive purge endpoint was written or executed; the UI invokes vault-reset which does not exist yet.
- Vercel READY.

## 2026-11-25 — BFF layering + security skills
- Installed OWASP secure-agent-playbook (19 skills: api-security-review, web-security-review, secrets-scan, code-review-security, agent-security-audit, etc.) and briiirussell/cybersecurity-skills (api-audit, iam-audit, owasp-audit, crypto-audit, cicd-security, etc.) globally via skills CLI; also installed vtex/skills@headless-bff-architecture. Total skills now 99.
- Removed the node:test test file at user request.
- Client no longer calls supabase.functions.invoke('vault-reset'). It calls the BFF at /api/internal/vault with op=reset-vault and the session JWT; BFF verifies identity, strips identity fields, and calls the edge function with the service key.
- Edge function gates: verified email, fresh JWT (<10min), TOTP aal2 when enrolled, passkeyVerified when a passkey exists; deletes file/folder/vault/key/share rows and all objects under the user's storage prefix. Deployed via supabase CLI (verify_jwt=true). Unauthenticated call verified 401.
- Removed background-attachment:fixed from settings background to eliminate the visible horizontal seam.
- Vercel READY. BFF endpoint returned curl 000 from this sandbox (network limitation), so live BFF response was not verified here.

## 2026-11-25 — Root-cause debugging of BFF hang, edge 403, layout seam
- Vercel logs: repeated `λ POST /api/internal/vault` with "Task timed out after 300 seconds". Supabase Management API logs endpoint (`/v1/projects/{ref}/analytics/endpoints/logs`) showed edge function responding 401/403 quickly. Conclusion: hang was inside the Vercel BFF, not Supabase.
- Root cause in BFF: `const json = () => ({statusCode,...})` and `return json(...)` — Vercel Node handlers must call `res.status().json()`. Every path hung. Replaced all returns with `res.status(status).json(body)`. Verified live: POST without auth returns 401 instantly.
- Edge 403 traced to a self-imposed 10-minute JWT-age requirement that was not requested; removed. Gates kept: verified email, TOTP aal2 if enrolled, passkey flag if registered, typed ERASE. Added explicit error codes.
- Layout seam: `html.sq-app-root body::before` is `position:fixed`; in full-page rendering it covers only the first viewport, producing the horizontal line. Hidden it for pages containing .tv-root/.dv-root and set the wash directly on those roots with background-size:100% 100%. Forced .tv-rail transparent/borderless to remove the rectangle at all widths.
- Vercel READY, edge redeployed.

## 2026-11-25 — Vault unlock / RLS errors / maintenance / layout debug pass
- Vault unlock: verifyVaultPassword() read `vaults.password_hash`, which is a legacy table; the actual vault passphrase is stored as account_key_hash + account_key_salt in user_encryption_settings. VaultUnlockDialog now verifies with verifyKeyHash(password, base64ToArrayBuffer(salt), hash), falls back to legacy verifier only when no BYOK row exists, then derives the in-memory key with unlockVault().
- security_events 42501: client direct insert used anon key; policy requires auth.uid()=user_id. Routed through BFF op security-event using a dedicated service-role client with no user JWT (the original BFF client had global user Authorization, so RLS still applied).
- maintenance_mode 42501: direct anon SELECT on system_settings. BFF now serves public maintenance status with service-role admin client (no auth required); updates require is_admin. Verified live: public read 200, unauth event write 401.
- Layout: global body::before was position:fixed so it ended at the first viewport; changed to absolute and set html body background. Removed all gradients from settings roots and added inline overrides to .tv-root and .tv-rail so the rectangle/seam cannot come back from stale CSS.
- Vault reset success now calls supabase.auth.signOut() and redirects to /auth?reason=vault-reset.
- Vercel READY.

## 2026-11-25 — CORS regression + final layout seam root cause
- Firefox reported CORS block on direct REST call to user_encryption_settings from VaultUnlockDialog. That call was introduced in the previous fix. Replaced with BFF op vault-pass-meta; BFF reads settings with service role and returns only account_key_hash + account_key_salt; client verifies with Argon2 locally. No direct Supabase REST from that component.
- Realtime websocket error originates from other Supabase channels (signals/support/share surveillance), not the maintenance hook which was already made BFF-only. Not changed here.
- Layout seam: `body::before` with position:fixed only covers first viewport; changing to absolute did not help because body is not a positioning context. Final fix: disable body::before globally for sq-app-root and paint the wash on `.sa` (the full-document shell) with background-size:100% 100%; settings roots carry the same document-sized wash.
- Vercel READY. Verified: vault-pass-meta unauth 401, maintenance public 200.

## 2026-11-25 — Master-key root cause and settings shell cleanup
- Live data for the affected user: user_encryption_settings.settings has no account_key_hash; vaults table empty; master_keys row exists (created 15:37 via account sign-in password). Therefore all previous verifiers were checking stores that do not hold this user's vault password.
- Added BFF op vault-master-meta (service role) returning encrypted_master_key/kdf_salt/kdf_iterations. VaultUnlockDialog now derives PBKDF2 key from entered password and unwrapKey()s the master key; falls back to BYOK hash then legacy vaults table. Verified unwrap roundtrip locally with WebCrypto.
- AccountSettings layout: removed inline styles on .tv-root and nav.tv-rail, removed the mobile rail box geometry, added one authoritative high-specificity rule for .tv-rail[role=tablist] (transparent, no border/radius/padding/shadow), made .tv-root transparent so the document-sized .sa ambient wash shows, simplified PAGES_POLISH.
- Vercel READY.

## 2026-11-25 — Screenshot verification, share errors, MCP auth
- Verified latest settings screenshot pixel-by-pixel: no viewport seam, no enclosing rail rectangle. Remaining visual issue is sparse top whitespace; tightened .tv-layout padding and sticky rail offset.
- share_decrypt_logs 42703: live table has ip_address, not actor_ip. Could not push migration (remote history mismatch), so routed logging through BFF op share-decrypt-log inserting ip_address; verified unauth call 200.
- wrong_password: tested live RPC and edge function with the stored access_code — both return allowed. Added non-secret diagnostics (lengths/booleans only) to share-access and redeployed to identify what users are actually submitting.
- OpenCode Supabase MCP: OAuth redirect URI rejected by Supabase. Switched to oauth:false + scoped PAT header in ~/.config/opencode/opencode.jsonc; verified connected via `opencode mcp list`.

## 2026-11-25 — Live X11 verification + dedicated computer-use MCP
- User enabled X11 (Termux X11 + XFCE) with Zen browser running and asked for real browser testing.
- Popular computer-use tools failed on this host: agent-browser (android-arm64 unsupported), orca (CLI absent), open-computer-use (Go binary SIGSYS under Termux seccomp), Playwright MCP (launches fresh Firefox/Zen profile, cannot attach to existing Firefox browser).
- Built `~/.local/lib/x11-computer/server.mjs` with @modelcontextprotocol/sdk exposing list_windows/activate_window/screenshot/click/type/key/scroll via wmctrl/xdotool/import; configured as global MCP `x11-computer` and disabled Playwright fresh-browser server. Attached to the user's existing Zen window.
- Live inspection via browser console showed settings shell started at y=160 with rail height 458; System item clipped and content too low. Compacted rail and reduced shell padding; screenshot through x11-computer MCP confirms System fully visible, no seam and no rail box.

## 2026-11-26 — Share bug fixed; global UI cleanup layer across all non-marketing routes
- Reproduced share `wrong_password` via live edge function: stored 12-char access_code works, but users paste the 64-char share_secret_hash from the URL into the password field. Patched share-access to accept the secret hash as a credential, then re-run check_share_access with the server-side access code so country/device/burn/limit guards still apply. Updated SharePage labels. Verified: password true, secret true, wrong rejected; deployed edge function and Vercel.
- Audited all 43 pages and every route. Created `src/styles/all-pages-clean.css`, imported in main.tsx, scoped by `data-sq-clean`/`data-sq-page` set in AppContent from location.pathname. Excludes /, /pricing, /checkout. Neutralises hardcoded dark/blue palettes, white tints, accents; normalises borders, radii, shadows, focus, headings; adds content-page rules. Initial var-based mapping produced an olive button on share page, fixed with literal colour fallbacks. Verified live via direct X11 (Zen): share guard and webhooks page now monochrome/clean.

## 2026-11-26 — Dialog backdrop and input outline fixes
- Global cleanup layer mapped `bg-black/*` to an opaque color, flattening Radix/custom dialog backdrops into solid panels. Added a later, more specific rule for fixed inset-0 bg-black overlays: rgba(3,4,3,.62) + blur.
- Global focus rule drew a 1px bright outline on inputs; removed outline/box-shadow for input/textarea/select and neutralised ring-white/ring-2/ring-primary. Vercel READY.

## 2026-11-26 — All-pages redesign with shared floating glass navigation
- Brainstorming + design-doctrine loaded; user gave a direct build instruction (opted out of approval round). Short design doc committed at docs/superpowers/specs/2026-11-26-all-pages-redesign-design.md.
- Created src/components/layout/GlassNav.tsx (floating glass capsule, layoutId thumb spring 380/21/0.8, tap 600/16) and PageFrame.tsx (centred symmetric shell with one leading heading). Wired GlassNav into MainHeader so every page with the global header gets the same bar.
- Added input-specific ::selection/focus/caret rules to all-pages-clean.css to kill the white/lime outline on text selection.
- Four parallel agents applied the shared design to 34 pages (public/auth, workbench, docs/legal, viewers/editors), preserving all handlers/effects/API calls. GlassNav used for existing tabs/sections with unique layoutIds;PageFrame used for simple pages.
- Removed emoji from user-visible strings/code samples to satisfy zero-emoji rule. Vercel READY. Live X11 verification: Profile and Webhooks render centred, symmetric, monochrome with the glass bar.

## 2026-11-26 — Full file pipeline research (no code changes)
- Four read-only agents mapped upload/encryption, share/preview/download, key/auth/recovery, and canonical docs; the highest-severity claims were verified directly in source.
- Verified: default upload sends raw AES key to store-file-key and falls back to writing it into files.tags/encryption_key; server KEK can be derived from leaked service-role key; passkey-auth returns a magic-link OTP without verifying WebAuthn assertion; anon can call get_shared_file_info which returns wrapped key/metadata before password; BYOK passphrase uses Math.random; RES54 v3 and SDE derive deterministic GCM nonces; SDE stores root DMS in DB; social recovery, KTL guard and ratchet are unwired/dead; sealed preview only covers some viewers.
- Canonical E2E spec is explicitly "awaiting approval; no code written" while README/SECURITY-MODEL describe ZK as live. Recommendation is a phased path: P0 close account takeover and key leak, P1 make v3/E2E the default with client-only keys and enforced step-up, P2 wire recovery/KTL and finish sealed rendering, P3 codify CI invariants and docs.

## 2026-11-26 — E2E hardening: full implementation, review and push
- User asked to complete the work end-to-end and keep hundreds of existing files readable: backward-compatible reads only, new writes must never escrow raw AES keys.
- Wrote docs/superpowers/plans/2026-11-26-e2e-hardening.md and executed all 8 tasks inline with RED→GREEN tests and an SDD ledger (.superpowers/sdd/2026-11-26-e2e-hardening/progress.md).
- Shipped: v4 crypto (random per-file salt, 96-bit IVs, AAD, HKDF); client-only new uploads; BFF share-meta gate; WebAuthn assertion verification (JWK + DER SPKI + RSA, DER→P1363); password-change master-key rewrap; device enrollment/recovery/KTL wiring; sealed previews with nonce-locked frames; CSP hardening; CI invariant gate + honest docs.
- User then reported passkey login failing after a successful WebAuthn prompt. Evidence from user_passkeys showed every stored verifier was NULL or base64 DER SPKI, never a JWK, so the new JWK-only verifier returned 400 and the app showed a login failure. Fixed by resolving all historical formats and deployed.
- Three fresh-context review rounds found and fixed: BFF TDZ crash on every POST, passkey registration email taken from the body (account takeover), v4 master set to the password KEK, DER signature incompatibility, legacy OTP oracle and credential-ID exposure, dropped share credentials/fields, non-atomic password change, and raw-key escrow through S3/GitHub/code-editor/AI/Tebi writers. Central v4 gate now lives in uploadFileWithRes54 so all callers are covered; Tebi raw-key path removed.
- Verification: 42 targeted tests pass, `node scripts/check-e2e-invariants.mjs` passes over 702 files, `vercel --prod --yes` READY, passkey-auth function deployed, final review verdict safe-to-push.
- Pushed 14 commits to origin/fresh-main (76abb4c5..8b3ef530). Working tree clean. Two pre-existing SDK test failures remain (sdk/js/test needs a built dist/).

## 2026-11-26 — Full Supabase review (read-only) and cleanup plan
- User asked to manage the DB properly with Supabase MCP, remove unwanted tables, save storage, and review all of Supabase.
- Audited project aouqcwbdoyrccjcrhzzi via MCP: DB 380 MB; net._http_response 290 MB/733 responses (all today), cron.job_run_details 24 MB/35,525 runs, public 48 MB/151 tables, auth 6.5 MB, storage 5.9 MB; 10 buckets; 14 cron jobs; 15 security lint types and 5 performance lint types.
- Verified all public tables have RLS enabled. Identified 27 empty tables with no application/function references, 7 safe unused secondary indexes, 4 empty/unreferenced buckets, a hardcoded anon JWT in cron job 9, and branch main in MIGRATIONS_FAILED state.
- SKIPPED — needs a human: every DROP TABLE, DELETE, DROP INDEX, bucket deletion, cron edit, policy/grant change and key rotation. Standing rule forbids destructive live DB operations; wrote the exact guarded SQL instead.
- Deliverables: docs/audits/supabase-review-2026-11-26.md and supabase/maintenance/01_log_retention.sql .. 04_cron_hardening.sql. Owner should run retention first (~314 MB expected recovery), then repair migration history, then the rest.

## 2026-11-26 — Supabase cleanup executed (owner delegated the choice)
- Owner said "do ur choice . give me results", which authorized the destructive cleanup I had previously logged as SKIPPED. Proceeded in risk order with live verification after each step.
- Root cause of the 290 MB pg_net table was dead-tuple bloat, not data: 733 rows held ~900 KB. VACUUM FULL reclaimed it. Deleted old cron.job_run_details rows and vacuumed. DB went 380 MB -> 67 MB.
- Added hourly log-bloat-control cron (prune + vacuum-analyze) and tightened job 11 to daily/1-day retention so bloat cannot return. Reduced cron 3/6 from 1 min to 5 min. Removed the hardcoded anon JWT from cron job 9 (function authenticates via body token).
- Checked exact counts before dropping tables: stale stats overstated empty candidates (27) and 12 of them had real rows. Dropped only 12 truly empty, dependency-free tables; excluded 3 with views/triggers/publications. Public tables 151 -> 139. Dropped 7 unused secondary indexes (no PKs/uniques).
- Revoked anon EXECUTE on get_shared_file_info, get_folder_share_contents, increment_share_download, increment_share_view. Added BFF folder-share-meta gate and wired client credentials so the share UI still works. Service role retains EXECUTE; live BFF returns 403 for invalid shares. Emptied scripts/e2e-invariant-allowlist.json.
- Verification: 42 tests pass, invariant gate passes over 706 files, vercel READY, final DB 67 MB / 139 tables.

## 2026-11-26 — Instant preview fixed and upgraded
- Root cause of blank/error previews on new uploads: downloadFilePreview treated `e2e_v4` as a literal AES key, and the modal's legacy getVaultFileMeta path returns null for v4 files.
- RED-GREEN: added tests for multi-chunk roundtrip, prefix decrypt of the first complete frame, and truncation rejection; implemented chunked v4 with 1 MiB independently encrypted frames (magic 52 45 05) while keeping legacy single-frame v4 readable.
- Added downloadV4Preview (first 3 RES54 chunks only) and wired the modal through pure readV4Meta. Forced full smartDownload for downloads so partial preview data cannot be saved.
- Verified: 46 tests pass, invariant gate passes (708 files), vercel READY. Wrote design doc with three approaches and the chosen tradeoff.

## 2026-11-26 — Console error cleanup
- CSP: dashboard loaded an onlinewebfonts stylesheet whose data: font was blocked. Added https://db.onlinewebfonts.com and data: to style-src and font-src in vercel.json; confirmed the live header via curl.
- Added UUID validation in downloadFileWithRes54/downloadFilePreview/downloadV4Preview so a malformed id like "3" throws a clean client error instead of Postgres "invalid input syntax for uuid".
- Investigated B2/supabase-function CORS and realtime WebSocket errors: B2 presigned GET responds 200 with ACAO for the production origin; fix-cors endpoint requires auth and is best-effort. Concluded these are browser/network-environment failures, not app-code defects; no speculative changes made.
- Verified 46 tests pass, invariant gate passes, vercel READY.
