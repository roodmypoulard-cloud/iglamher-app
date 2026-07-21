# iGlamHer — Native Mobile Architecture

## Approach: Capacitor (wrap the existing app, don't rewrite it)

The instruction is to keep the existing UI, architecture, and backend. The correct
production path is **Capacitor**: it packages the *same* Next.js web app into real
native iOS and Android binaries (App Store / Play Store shippable) and exposes native
device APIs through plugins. This gives feature parity for free — every screen already
works — while adding biometrics, push, camera, maps, and Apple/Google Pay natively.

A full React Native rewrite was rejected: it would duplicate the entire UI + data
layer (months of work), violating "continue using the existing architecture."

```
┌─────────────────────────── Native shell (iOS / Android) ───────────────────────────┐
│  WKWebView / Android WebView → loads the deployed HTTPS iGlamHer web app             │
│  Capacitor plugins (native):  Biometrics · Push (APNs/FCM) · Camera · Geolocation   │
│                               · App (deep links) · Preferences (secure storage)      │
└──────────────────────────────────────┬──────────────────────────────────────────────┘
                                        │  same production APIs / Supabase / Stripe
                              existing Next.js backend (unchanged)
```

## What's already built in this repo (backend + web foundation)
- **Push backend** — `device_tokens` + `notification_preferences` tables (migration 0010),
  `registerDeviceTokenAction`, and push fan-out lookup wired in `integrations/notifications.ts`.
- **Deep linking** — Apple Universal Links + Android App Links association files served at
  `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` (env-driven IDs).
- **PWA / offline** — installable manifest (shortcuts, maskable icon), service worker
  (`public/sw.js`: network-first pages, image caching, offline fallback, Web Push handler),
  registered via `PWARegister`. iOS Safari + Android install-to-home-screen work today.
- **Capacitor config** — `capacitor.config.ts` (app id `com.iglamher.app`, splash, push).

## Generate the native projects (needs Xcode / Android SDK — manual)
```bash
npm i @capacitor/ios @capacitor/android \
      @capacitor/push-notifications @capacitor/camera @capacitor/geolocation \
      @capacitor/app @capacitor/preferences @aparajita/capacitor-biometric-auth
npx cap add ios          # requires macOS + Xcode + CocoaPods
npx cap add android      # requires Android Studio + SDK
# set server.url in capacitor.config.ts to the deployed HTTPS app, then:
npx cap sync
npx cap open ios         # build/sign/archive in Xcode → TestFlight
npx cap open android     # build AAB in Android Studio → Play Console
```

## Native capability wiring (add in the native layer, gated by Capacitor.isNativePlatform())
| Capability | Plugin | Where it plugs into this repo |
|---|---|---|
| Face ID / Touch ID | `@aparajita/capacitor-biometric-auth` | gate app open + re-auth; unlock the Supabase session from secure storage |
| Push (APNs/FCM) | `@capacitor/push-notifications` | on `registration`, call `registerDeviceTokenAction({token, platform})` |
| Apple Pay / Google Pay | Stripe Payment Sheet (Capacitor) | replaces the Checkout redirect in `BookingFlow` on native |
| Camera / photos | `@capacitor/camera` | portfolio + review photo uploads → Supabase Storage |
| Maps + location | native Google/Apple Maps + `@capacitor/geolocation` | "near me" + provider ETA |
| Deep links | `@capacitor/app` `appUrlOpen` | route `iglamher.com/...` into the in-app router |

## Auth on native
Supabase Auth works in the WebView. Google uses the native ASWebAuthenticationSession
flow; **Apple Sign In is required by App Store review** when other social logins exist —
enable the Apple provider in Supabase and add the Sign in with Apple capability in Xcode.
Sessions persist in secure storage; biometric gate on resume.

## Performance
Startup: splash + WebView warm-up; enable Capacitor's server bundle for first paint.
Images already lazy + cached (SmartImage + SW). 60fps: existing CSS animations respect
`prefers-reduced-motion`. Offline: SW shell; background sync of queued actions is a
native enhancement (Background Fetch).
