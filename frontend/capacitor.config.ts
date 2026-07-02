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
    // "never" = don't let WKWebView auto-adjust its own top inset. The web
    // layer already pads for the notch via body { padding-top: env(safe-area-inset-top) }.
    // "always" double-counted the status bar and left a stuck gap at the top
    // after a pull-down/rubber-band overscroll.
    contentInset: "never",
    backgroundColor: "#1a1108",
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
