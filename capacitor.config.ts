import type { CapacitorConfig } from "@capacitor/cli";

const isAdmin = process.env.CAPACITOR_APP === "admin";

const gameConfig: CapacitorConfig = {
  appId: "com.dima.starfall",
  appName: "Starfall",
  webDir: "dist/public",
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0a0e18",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0e18",
    },
  },
};

const adminConfig: CapacitorConfig = {
  appId: "com.starfall.admin",
  appName: "Starfall Admin",
  webDir: "admin-panel/dist",
  android: {
    path: "android-admin",
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0b0f17",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0f17",
    },
  },
};

export default isAdmin ? adminConfig : gameConfig;
