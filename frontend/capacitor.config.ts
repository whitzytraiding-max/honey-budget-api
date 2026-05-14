import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.whitzy.honeybudget",
  appName: "Honey Budget",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false, // we hide it manually after init
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      backgroundColor: "#1a1108",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1a1108",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#1a1108",
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
