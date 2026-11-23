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
