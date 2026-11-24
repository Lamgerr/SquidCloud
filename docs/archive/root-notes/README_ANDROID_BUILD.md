# Building Android APK (SquidCloud)

Quick steps to build a signed `squidcloud` APK for release.

Prerequisites

- Node.js, npm installed
- Java JDK 11+
- Android SDK and Android Studio
- Capacitor installed in project

Steps

1. Install dependencies and ensure Android platform is added:
```bash
npm install
npx cap add android || true
npx cap sync android
```

2. Copy argon2.wasm into `public/` (already done by repo helper or run manually):
```bash
cp node_modules/argon2-browser/dist/argon2.wasm public/argon2.wasm
```

3. Open Android project and configure signing & icons:
```bash
npx cap open android
```
- In Android Studio, generate launcher/adaptive icons (Image Asset).
- Configure `signingConfigs` in `android/app/build.gradle` using your keystore (alias `squidcloud`).

4. Build a signed APK in Android Studio: Build > Generate Signed Bundle / APK

Or build from CLI (requires keystore and env vars):

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (signed if signing config provided).

Background uploads

- Implement `UploadWorker` using WorkManager (see docs/ANDROID_SHARED_INTENT.md) and ensure file URIs are accessible to worker.

Notes

- Do not commit keystore files or passwords.
- Test sharing intents on a device/emulator by sharing a file into the SquidCloud app.

