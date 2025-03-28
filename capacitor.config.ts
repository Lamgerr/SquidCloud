
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.59166b9a282e4b28b4607aa9d6ed0864',
  appName: 'cloudbliss-storage',
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
      keystorePath: "android.keystore",
      keystoreAlias: "lovable",
    }
  }
};

export default config;
