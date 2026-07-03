# 📱 SquidCloud Mobile App Setup Guide

This guide will help you build and deploy the SquidCloud native mobile app for Android and iOS.

## ✅ Features

The mobile app includes:
- 📸 **Camera Integration** - Take photos and upload directly
- 🖼️ **Gallery Access** - Pick images from photo library
- 📤 **Native Sharing** - Share files using device share sheet
- 🔔 **Push Notifications** - (Coming soon)
- 📲 **Haptic Feedback** - Tactile responses for actions
- 🌙 **Status Bar Theming** - Matches app theme
- 🚀 **Splash Screen** - Professional launch experience
- 📡 **Network Status** - Detect online/offline
- 📁 **File System Access** - Save files to device

## 🛠️ Prerequisites

### For Android Development
- [Android Studio](https://developer.android.com/studio) installed
- Android SDK (API 22+)
- Java JDK 17 or higher
- Android device or emulator

### For iOS Development (macOS only)
- [Xcode](https://developer.apple.com/xcode/) 14+ installed
- CocoaPods (`sudo gem install cocoapods`)
- iOS device or simulator
- Apple Developer account (for physical device testing)

## 📦 Installation Steps

### 1. Build the Web App

```bash
# Build the production web app
npm run build
```

### 2. Initialize Capacitor Platforms

```bash
# Add Android platform
npx cap add android

# Add iOS platform (macOS only)
npx cap add ios
```

### 3. Sync Web Assets to Native Projects

```bash
# Sync all platforms
npx cap sync

# Or sync specific platform
npx cap sync android
npx cap sync ios
```

## 📱 Android Development

### Run on Android Device/Emulator

```bash
# Open Android Studio
npm run mobile:android

# Or run directly
npm run mobile:run:android
```

### Build Android APK

1. Open in Android Studio: `npx cap open android`
2. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. APK will be in `android/app/build/outputs/apk/`

### Sign Android App for Release

1. Generate keystore (if not exists):
```bash
keytool -genkey -v -keystore squidcloud.keystore -alias squidcloud -keyalg RSA -keysize 2048 -validity 10000
```

2. Update `capacitor.config.ts` with your keystore passwords

3. Build signed release:
```bash
cd android
./gradlew assembleRelease
```

## 🍎 iOS Development

### Run on iOS Simulator

```bash
# Open Xcode
npm run mobile:ios

# Or run directly
npm run mobile:run:ios
```

### Build for iOS Device

1. Open in Xcode: `npx cap open ios`
2. Select your development team in signing settings
3. Connect iOS device
4. Click **Run** or **Product** → **Build**

### Submit to App Store

1. In Xcode: **Product** → **Archive**
2. Click **Distribute App**
3. Follow App Store Connect workflow

## 🔧 Configuration

### App Icons

Place app icons in:
- Android: `android/app/src/main/res/mipmap-*/`
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

Or use a generator like [Icon Kitchen](https://icon.kitchen/)

### Splash Screens

Configure in `capacitor.config.ts`:
```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 2000,
    backgroundColor: "#1A202C",
    showSpinner: true,
    spinnerColor: "#38B2AC"
  }
}
```

### Permissions

#### Android Permissions
Edit `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.INTERNET" />
```

#### iOS Permissions
Edit `ios/App/App/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>SquidCloud needs camera access to capture photos</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>SquidCloud needs photo library access to upload images</string>
```

## 🎨 Custom Features

### Camera Upload

```typescript
import { takePhoto, pickFromGallery } from '@/services/mobileUploadService';

// Take photo
const photo = await takePhoto();

// Pick from gallery
const photos = await pickFromGallery(true); // true for multiple
```

### Native Sharing

```typescript
import { shareLink, shareFile } from '@/services/mobileShareService';

// Share link
await shareLink(url, 'Check this out!');

// Share file
await shareFile(blob, 'filename.pdf');
```

### Haptic Feedback

```typescript
import { haptics } from '@/utils/mobile';

await haptics.light();   // Light tap
await haptics.medium();  // Medium tap
await haptics.heavy();   // Heavy tap
await haptics.success(); // Success notification
await haptics.error();   // Error notification
```

## 🚀 Deployment

### Development Build

```bash
# Build and sync
npm run mobile:sync

# Run on device
npm run mobile:run:android  # Android
npm run mobile:run:ios      # iOS
```

### Production Build

1. Update version in `package.json`
2. Update app version in native projects
3. Build release APK/IPA
4. Submit to stores

## 🐛 Troubleshooting

### Android Issues

**Gradle build fails:**
```bash
cd android
./gradlew clean
./gradlew build
```

**App crashes on startup:**
- Check `android/app/src/main/AndroidManifest.xml` permissions
- Verify `capacitor.config.ts` is correct
- Check Logcat in Android Studio

### iOS Issues

**Pod install fails:**
```bash
cd ios/App
pod repo update
pod install
```

**Build fails:**
- Clean build folder: Xcode → Product → Clean Build Folder
- Check signing certificates
- Update Xcode to latest version

### General Issues

**White screen on app launch:**
- Ensure `npm run build` completed successfully
- Run `npx cap sync` again
- Check browser console in dev tools

**Camera/Photos not working:**
- Check permissions in `AndroidManifest.xml` / `Info.plist`
- Request permissions at runtime
- Test on physical device (not emulator)

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [iOS Developer Guide](https://developer.apple.com/ios/)
- [SquidCloud Docs](./README.md)

## 🔄 Update Flow

When you make changes to the web app:

```bash
# 1. Build web app
npm run build

# 2. Sync to native projects
npx cap sync

# 3. Open in IDE and run
npm run mobile:android  # or mobile:ios
```

---

**Need help?** Contact hellosquidcloud@gmail.com
