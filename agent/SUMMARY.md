# Summary — Material 3 redesign

## Done
- M3 token engine + generated theme; contrast gate passes (200 pairs, 4 seeds x light/dark).
- M3 CSS layer (base + components) and shadcn variable bridge in index.css.
- React primitives in src/components/m3/ (primitives, navigation, theme, AppShell, index).
- /design route (DesignSystem specimen page) exercising all primitives.
- Dashboard: removed <AppTheme />; .sa-kbd -> .m3-kbd; m3-app roots; MobileNavHeader -> m3-appbar.
- SettingsRow rebuilt as M3 grouped list (light-mode safe).
- StatsPanel category colors -> M3 file-container tokens.
- DashboardOverview de-monofied (no mono kickers, neutral colors -> M3 tokens).
- Overlays pointed at M3 outline tokens; sonner uses m3-snackbar.
- Verification: tsc --noEmit passes; theme check passes; emoji clean; tokens valid.

## In progress
- AppShell component created but not wired into Dashboard desktop layout (sidebar/top bar on bridged tokens).

## Blocked (needs human)
- Full vite build unavailable in this Termux env (@swc/core native binding); tsc used as proxy.

## Queued next
- Wire AppShell into Dashboard desktop branch.
- Restyle FileItem grid/list cards to M3.
- Chromium render check at 1440/768/390/320.
- Commit the redesign.
