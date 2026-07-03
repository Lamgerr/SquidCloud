# Agent Handoff: Build signed APK, use web favicon as launcher icon, and fix "App not installed"

Goal
- Produce a signed SquidCloud APK (or AAB) using the existing keystore, replace Android launcher icons with the web app icon (`public/favicon.ico`), and fix any "App not installed" installation errors on test devices.

Repository layout and assumptions
- Repo root contains the web app and Capacitor Android integration at `android/`.
- Keystore already created and available locally (do NOT commit keystore to git).
- Web build outputs to `dist` (see `capacitor.config.ts`).
- Use package name `live.squidcloud.app`.
- Node/npm, JDK 11+, Android SDK (API 33+), `sdkmanager`, `adb`, `zipalign`, and `apksigner` are available on the agent machine.

Step-by-step actions (run sequentially)

1) Build the web assets and ensure WASM available
```bash
# From repo root
npm ci
npm run copy:wasm
npm run build
```
Verify `dist/` exists and `public/argon2.wasm` was copied.

2) Sync Capacitor Android project
```bash
npx cap sync android
```
If Android platform is missing:
```bash
npx cap add android
npx cap sync android
```

3) Replace Android launcher icons with web favicon
- Use the repo helper (script provided) or ImageMagick:
```bash
# If ImageMagick installed
chmod +x scripts/generate-android-icons.sh
./scripts/generate-android-icons.sh
# else convert manually to required sizes and place into android/app/src/main/res/mipmap-*/
```
- Confirm files exist: `android/app/src/main/res/mipmap-*/ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`.
- Confirm `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` reference `@mipmap/ic_launcher_foreground` and `@color/ic_launcher_background`.

4) Ensure Android SDK location
```bash
# Replace with the actual SDK path on the agent machine
echo "sdk.dir=/home/USER/Android/Sdk" > android/local.properties
```

5) Ensure signing environment variables (do NOT store secrets in repo)
Set these in the shell or CI secrets:
```bash
export SQUIDCLOUD_KEYSTORE_PATH="/full/path/to/squidcloud.keystore"
export SQUIDCLOUD_STORE_PASSWORD="...storepass..."
export SQUIDCLOUD_KEY_ALIAS="squidcloud"
export SQUIDCLOUD_KEY_PASSWORD="...keypass..."
```
(Alternatively set these in `android/gradle.properties` on the agent machine only, and ensure it's gitignored.)

6) Build signed release APK
```bash
cd android
./gradlew clean assembleRelease
```
Expected artifact:
`android/app/build/outputs/apk/release/app-release.apk` (or `app-release-unsigned.apk` and a signed, aligned version depending on Gradle config).

7) Verify APK signing and alignment
```bash
# verify signing
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk

# (if necessary) align and sign manually:
zipalign -v -p 4 app-release-unsigned.apk app-release-aligned.apk
apksigner sign --ks "$SQUIDCLOUD_KEYSTORE_PATH" --ks-pass pass:"$SQUIDCLOUD_STORE_PASSWORD" --key-pass pass:"$SQUIDCLOUD_KEY_PASSWORD" --out app-release-signed.apk app-release-aligned.apk
apksigner verify app-release-signed.apk
```

8) Install on a test device and diagnose "App not installed"
- Common causes: existing installed package with different signing key, minSdk mismatch, corrupt APK, package name mismatch, or missing split/ABI.
- Steps to test:
```bash
adb devices
# uninstall previous app first (force)
adb uninstall live.squidcloud.app || true

# then install (use -r to replace)
adb install -r android/app/build/outputs/apk/release/app-release.apk

# if install fails, get device logs:
adb logcat -d | tail -n 200
# check package info on device:
adb shell pm list packages | grep squidcloud
# check min sdk on device:
adb shell getprop ro.build.version.sdk
```
If "INSTALL_FAILED_UPDATE_INCOMPATIBLE" appears, uninstall the existing app first. If "INSTALL_FAILED_NO_MATCHING_ABIS", ensure the APK supports device ABI. Include `adb logcat` output if errors persist.

9) If app installs but icon still shows Android default
- Confirm launcher icon resources updated in `android/app/src/main/res/mipmap-*`.
- Rebuild: `./gradlew clean assembleRelease` and reinstall.
- Confirm the device launcher cache updated: uninstall/reinstall and reboot device if needed.

10) If the APK is unsigned or appears unsigned
- Ensure `android/app/build.gradle` contains `signingConfigs` and `signingConfig signingConfigs.squidcloudRelease` applied to `release` buildType (this repo already has that change).
- If Gradle still produces an unsigned APK, sign manually using `apksigner` as shown above.

11) Produce artifacts and report
- Commit only the resource/icon changes and any non-secret gradle edits to the branch. Do NOT commit keystore or passwords.
- Upload the final signed APK (or AAB) and include:
  - Full Gradle build output log (last 200 lines).
  - `apksigner verify --print-certs` output.
  - `adb install` output and any `adb logcat` errors if install failed.
  - Screenshot showing launcher icon.

Checklist for success
- [ ] `android/app/build/outputs/apk/release/app-release.apk` exists and `apksigner verify` reports valid signature.
- [ ] Launcher icon updated to use `public/favicon.ico`.
- [ ] APK installs via `adb install -r` without errors on a test device (include device details: Android version and ABI).
- [ ] If previously installed version exists, installation can replace or agent uninstalls it first.
- [ ] Provide PR with resource and build config changes and the signed APK attached to the PR or CI artifact URL.

Notes / constraints for the agent
- Do not commit keystore or passwords to the repository. Use environment variables or local `gradle.properties` that are gitignored.
- If the agent cannot run native Android tools on its host (no SDK / no device), produce a step-by-step log of modifications and an artifact that can be used by the user to run the final `gradlew assembleRelease` locally.
- If adaptive icon foreground is an XML vector, prefer to leave it; ensure the generated `ic_launcher_foreground.png` matches the adaptive shape.

Deliverables
- Signed APK (or AAB) placed in `android/app/build/outputs/...`
- Short report (max 20 lines) specifying which commands were run, any errors encountered, and final verification outputs (`apksigner verify` and `adb install` success).
- A PR with committed resource/icon changes and gradle updates (no secrets).
