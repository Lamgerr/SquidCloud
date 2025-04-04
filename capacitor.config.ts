
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.59166b9a282e4b28b4607aa9d6ed0864',
  appName: 'CloudBliss',
  webDir: 'dist',
  server: {
    url: 'https://59166b9a-282e-4b28-b460-7aa9d6ed0864.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1A202C",
      showSpinner: true,
      spinnerColor: "#38B2AC",
      androidSpinnerStyle: "large"
    }
  },
  android: {
    buildOptions: {
      keystorePath: "cloudbliss.keystore",
      keystoreAlias: "cloudbliss",
      keystorePassword: "YOUR_KEYSTORE_PASSWORD", // Replace with your actual keystore password
      keyPassword: "YOUR_KEY_PASSWORD", // Replace with your actual key password
      releaseType: "APK" // or "AAB" for Android App Bundle
    }
  }
};

export default config;
