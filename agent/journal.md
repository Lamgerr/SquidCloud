## 2026-10-27 - LOC analysis (interactive query)
- Task: count lines of code excluding comments and markdown.
- Method: git ls-files (ex *.md(x)) -> cloc 2.10 Perl script downloaded from AlDanial/cloc tag v2.10 (relied on raw.githubusercontent.com Availability). cloc comment handling is state-machine-based (string/template-safe), so comment counts are trustworthy.
- Corrections verified: .har capture (17,194 lines) was counted as JSON -> separated; Cargo.lock (2,115 raw lines) silently skipped by cloc -> added manually where noted; teardown confirmed language rows sum exactly to 249,950.
- Key result: 249,950 code lines across 1,142 non-md text files (+2,115 Cargo.lock raw = ~252,065 all-text); approx 206,640 lines when generated/data artifacts (lockfiles, HAR, BIP39 wordlist, l0g.txt dump, egg-info, robots) are excluded.
- Next: nothing queued (cold start; interactive query, no backlog item picked).

## 2026-11-01 - Material 3 redesign (autonomous run)
- Goal: replace CloudBliss monochrome editorial UI with Material 3 (Material You), per plan docs/superpowers/plans/2026-11-01-material3-redesign.md.
- Decisions: kept 4 runtime seeds (bliss/azure/moss/violet); dark-first; Phosphor icons with weight="fill" for active; no new runtime deps; no emoji; no hardcoded hex in new component code.
- Completed: token engine + contrast gate (200 pairs pass); M3 CSS layer (base + components); index.css bridge; tailwind m3 colors; React primitives (Button, IconButton, Fab, Card, Chip, ListItem, IconWell, Badge, Divider, Progress, Ring, Switch, SegmentedButton, TextField, SearchBar, EmptyState, Skeleton, Kbd, ListGroup); navigation (NavigationDrawer, NavItemM3, NavigationBar, TopAppBar); M3ThemeProvider + /design route; AppShell (created, not yet wired); removed <AppTheme /> from Dashboard; .sa-kbd -> .m3-kbd; SettingsRow rebuilt as M3 grouped list (light-safe); StatsPanel colors -> M3 file containers; DashboardOverview de-monofied; overlays pointed at M3 outline tokens; MobileNavHeader -> m3-appbar.
- Verification: tsc --noEmit passes; gen_m3_theme --check passes; check_no_emoji clean; validate_tokens OK; lint_hardcodes reports only px (no hex) in new code.
- Blockers: vite build unavailable in Termux (@swc/core native binding); AppShell not yet wired into Dashboard.
- Next: wire AppShell; restyle FileItem; Chromium render verification; commit.
