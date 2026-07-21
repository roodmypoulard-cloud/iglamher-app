import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps the EXISTING iGlamHer web app into native iOS/Android shells,
// preserving the current UI, architecture, and backend. In production the shell
// loads the deployed HTTPS app; native plugins add biometrics, push, camera,
// maps, and Apple/Google Pay. Run `npx cap add ios` / `npx cap add android`
// (needs Xcode / Android SDK) to generate the native projects. See
// docs/MOBILE_ARCHITECTURE.md.
const config: CapacitorConfig = {
  appId: "com.iglamher.app",
  appName: "iGlamHer",
  // Native shell loads the deployed web app (server-rendered). For a static
  // export instead, set webDir to the export output and remove `server.url`.
  webDir: "public",
  server: {
    // Set to your production/staging HTTPS URL when building the native app.
    // url: "https://iglamher.com",
    androidScheme: "https",
    iosScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    SplashScreen: { backgroundColor: "#0B0909", showSpinner: false, launchAutoHide: true },
  },
};

export default config;
