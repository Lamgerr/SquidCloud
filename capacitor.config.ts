
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'live.squidcloud.app',
  appName: 'SquidCloud',
  webDir: 'dist',
  server: {
    // For development: comment out url to use local build
    // For production: use your deployed URL
    // url: 'https://squidcloud.inflate.live',
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#0B1220",
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
      androidSpinnerStyle: "large"
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1A202C',
      overlaysWebView: false
    }
  },
  android: {
    buildOptions: {
      keystorePath: "squidcloud.keystore",
      keystoreAlias: "squidcloud",
      keystorePassword: "YOUR_KEYSTORE_PASSWORD", // Replace with your actual keystore password
      keyPassword: "YOUR_KEY_PASSWORD", // Replace with your actual key password
      releaseType: "APK" // or "AAB" for Android App Bundle
    }
  }
};

export default config;
