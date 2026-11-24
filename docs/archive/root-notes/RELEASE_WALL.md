# CloudBliss / SquidCloud Release Wall

Auto-generated from repository commit history (`git log` + file-diff version extraction).

## Project timeline at a glance

- **Project start commit:** `2025-03-26|d3df822|Use tech stack vite_react_shadcn_ts [skip gpt_engineer]`
- **Latest commit in this branch:** `2026-04-05|d1f3188|Initial plan`
- **Branding pivot commit:** `2025-09-29|743e030|rebranding` ("rebranding")
- **Brand eras:**
  - **CloudBliss era:** from project start to before `2025-09-29` rebranding commit
  - **SquidCloud era:** from `2025-09-29` onward

## Release types legend

- **Feature**: `feat:` prefix
- **Fix**: `fix:` prefix
- **Chore**: `chore:` prefix
- **Refactor**: `refactor:` prefix
- **Revert**: revert commits
- **Other**: everything else (including short/manual subjects)

## A) CloudBliss / SquidCloud main app releases (from `package.json`)

| # | Date | Version change | Release type | Commit | Note |
|---:|---|---|---|---|---|
| 1 | 2025-08-01 | `0.0.0 → 6.0.0` | Other | `467629e` | Update package.json |
| 2 | 2025-09-14 | `6.0.0 → 7.5.2` | Other | `2ab5c9a` | 7.5.2 |
| 3 | 2025-09-15 | `7.5.2 → 7.5.5` | Other | `399b929` | v7.4 |
| 4 | 2025-09-28 | `7.5.5 → 7.5.7` | Feature | `99ffbec` | feat: update version numbers and enhance mobile navigation with upload functionality |
| 5 | 2025-10-01 | `7.5.7 → 7.5.8` | Chore | `6774b25` | chore: Bump version to 7.5.8 and update related cache names in service worker and version files |
| 6 | 2025-10-02 | `7.5.8 → 7.5.11` | Chore | `98b2c17` | chore: Bump version to 7.5.11 and update related cache names in service worker and version files refactor: Simplify CreateButton and MobileBottomNavbar components with new CreateItemDialog and useCreateItem hook |
| 7 | 2025-10-05 | `7.5.11 → 7.5.12` | Other | `46123c4` | saw |
| 8 | 2025-10-11 | `7.5.12 → 8.3.5` | Other | `356514c` | lk9 |
| 9 | 2025-10-11 | `8.3.5 → 8.3.6` | Other | `485c54a` | cds |
| 10 | 2025-10-11 | `8.3.6 → 8.3.7` | Other | `619018f` | cds |
| 11 | 2025-10-20 | `8.3.7 → 8.5.4` | Other | `b7de6b4` | Update package.json |
| 12 | 2025-10-25 | `8.5.4 → 8.3.7` | Revert | `2ed39c1` | Reverted to commit 44106ed7f28b7ba06d2cf941b040555673c5f734 |
| 13 | 2025-10-25 | `8.3.7 → 8.5.4` | Revert | `407c7fa` | Reverted to commit 81c6a625260a2feb748177d08fa3c5c95f1d9972 |
| 14 | 2025-11-05 | `8.5.4 → 8.5.7` | Feature | `58f43f7` | feat: Implement upload/download performance analysis and fixes |
| 15 | 2025-11-05 | `8.5.7 → 8.5.10` | Feature | `33a918e` | feat: Update version numbers and optimize chunk sizes for edge function compatibility |
| 16 | 2025-11-05 | `8.5.10 → 8.5.11` | Feature | `c1007e7` | feat: Bump version to 8.5.11 and update chunk sizes for edge function compatibility |
| 17 | 2025-11-05 | `8.5.11 → 8.5.13` | Feature | `2896b58` | feat: Update version to 8.5.13 and enhance error handling and logging in download functions |
| 18 | 2025-11-05 | `8.5.13 → 8.5.14` | Feature | `36b34ef` | feat: Bump version to 8.5.14 and optimize chunk sizes for reliability in file uploads |
| 19 | 2025-11-05 | `8.5.14 → 8.5.15` | Feature | `e755cf7` | feat: Bump version to 8.5.15 and enhance logging for upload operations |
| 20 | 2026-02-02 | `8.5.15 → 8.5.19` | Fix | `e488477` | Fix mobile bottom navbar: remove blue colors and repair upload button (#2) |
| 21 | 2026-02-03 | `8.5.19 → 8.5.22` | Fix | `d01d377` | Fix JSX syntax errors in Dashboard.tsx (#4) |
| 22 | 2026-02-06 | `8.5.22 → 8.5.23` | Chore | `be50261` | chore: update version numbers and improve argon2 integration |
| 23 | 2026-02-10 | `8.5.23 → 8.5.25` | Other | `6d57519` | aw2 |
| 24 | 2026-03-28 | `8.5.25 → 8.5.28` | Other | `c09b1eb` | Added DESIGN_BEFORE_AFTER.md |
| 25 | 2026-04-01 | `8.5.28 → 8.5.30` | Refactor | `65f86c6` | Refactor code structure for improved readability and maintainability |
| 26 | 2026-04-01 | `8.5.30 → 8.5.31` | Fix | `69957e3` | Fix mobile UI issues and BYOK setup dialog auto-close bug (#6) |
| 27 | 2026-04-02 | `8.5.31 → 8.5.33` | Other | `4083f7c` | Harden BYOK setup, restore mobile upload notifications, and enforce backend PIN authorization for share/delete flows (#7) |
| 28 | 2026-04-02 | `8.5.33 → 8.5.34` | Other | `4b4c472` | Add GitHub Actions workflow for signed SquidCloud Android APK with favicon-based launcher icons (#8) |
| 29 | 2026-04-02 | `8.5.34 → 8.5.36` | Feature | `c13987d` | feat: update version to 8.5.36 and modify service worker cache name; add build script for local signed APK |
| 30 | 2026-04-02 | `8.5.36 → 8.5.37` | Feature | `5217ac7` | feat: implement upload worker with notification support and file handling |
| 31 | 2026-04-02 | `8.5.37 → 8.5.38` | Feature | `7ff0281` | feat: update version to 8.5.38 in package.json, service-worker.js, and version.json |
| 32 | 2026-04-02 | `8.5.38 → 11.0.0` | Feature | `3500db0` | feat: update version to 11.0.0 in package.json and package-lock.json; add web asset build process to build-android-local.sh |
| 33 | 2026-04-02 | `11.0.0 → 11.0.8` | Other | `babc2a0` | icr |
| 34 | 2026-04-02 | `11.0.8 → 11.0.11` | Other | `c213a21` | aa |
| 35 | 2026-04-02 | `11.0.11 → 11.0.13` | Feature | `268c7da` | feat: update Kotlin version to 1.9.24; refactor PDF.js worker configuration; update version to 11.0.13 |
| 36 | 2026-04-02 | `11.0.13 → 11.0.15` | Other | `311b7f6` | o |
| 37 | 2026-04-02 | `11.0.15 → 11.0.19` | Other | `9a1d339` | c |
| 38 | 2026-04-02 | `11.0.19 → 11.0.21` | Other | `567e8b3` | s |
| 39 | 2026-04-02 | `11.0.21 → 11.0.24` | Other | `952399d` | b |
| 40 | 2026-04-02 | `11.0.24 → 11.0.28` | Fix | `b3fdaea` | Fix mobile OAuth state validation by switching to HTTPS redirects and PKCE flow (#10) |
| 41 | 2026-04-03 | `11.0.28 → 11.0.29` | Other | `5307cf9` | c |
| 42 | 2026-04-03 | `11.0.29 → 11.0.30` | Other | `8433daf` | aq |
| 43 | 2026-04-03 | `11.0.30 → 11.0.31` | Other | `d5ce35d` | v |
| 44 | 2026-04-03 | `11.0.31 → 11.0.35` | Other | `ef786a5` | l |
| 45 | 2026-04-03 | `11.0.35 → 11.0.37` | Feature | `c363d2a` | feat: update version to 11.0.37 and enhance file sharing functionality across components |

## B) Android app releases (from `android/app/build.gradle`)

| # | Date | Version change | Release type | Commit | Note |
|---:|---|---|---|---|---|
| 1 | 2026-04-02 | `11.0.8 → 11.0.22` | Other | `567e8b3` | s |
| 2 | 2026-04-05 | `11.0.22 → 11.1.0` | Other | `a8715ae` | Rebuild legal pages as first-class UI (Privacy + TOS) and bump Android app version to 11.1.0 (#25) |

## C) SquidLab SDK releases (squidcloud ecosystem)

| # | Date | Version change | Release type | Commit | Note |
|---:|---|---|---|---|---|
| 1 | 2025-10-05 | `1.0.0 → 1.0.2` | Feature | `d0167db` | feat: add squidlab-sdk dependency and update to version 1.0.2 |
| 2 | 2025-10-05 | `1.0.2 → 1.0.3` | Feature | `4b1e19d` | feat: Complete integration of .sqe format support in SquidLab SDK |
| 3 | 2025-10-05 | `1.0.3 → 1.0.4` | Feature | `7a1db56` | feat: update version to 1.0.4 and add file preview cards example with manifest |
| 4 | 2025-10-07 | `1.0.4 → 1.0.6` | Feature | `2ed4b67` | feat: Release v1.0.6 - Major authentication fixes and enhancements |
| 5 | 2025-10-07 | `1.0.6 → 1.1.0` | Fix | `6d51d06` | fix: update API base URL and increment version to 1.1.0 |

## D) Current versions snapshot (HEAD)

- **Main app (`package.json`)**: `11.0.37`
- **Android (`versionName`)**: `11.1.0`
- **SquidLab SDK (`squidlab-sdk/package.json`)**: `1.1.0`

## Notes

- This wall lists **version-change commits** (actual old→new version diffs), not every single repo commit.
- Some commits have short/manual messages (`c`, `s`, `aa`, etc.); they are preserved exactly as in git history.
- `0.0.0 → 6.0.0` marks the first explicit semantic version set in `package.json` (initial baseline in git history for this file).
- `8.5.38 → 11.0.0` is a major-version jump recorded in commit `3500db0` during a large update cycle.
