# iGlamHer — App Store & Google Play Submission Package

Everything needed for submission except the assets that require a design export and
the accounts/builds that require Apple/Google developer memberships.

## Accounts required (manual, paid)
| Account | Cost | For |
|---|---|---|
| Apple Developer Program | $99/yr | App Store Connect, TestFlight, APNs push, Sign in with Apple |
| Google Play Console | $25 once | Play Store, Internal Testing, App Links verification |
| APNs auth key (.p8) | included w/ Apple | iOS push (`APNS_KEY_ID`/`APNS_TEAM_ID`/`APNS_PRIVATE_KEY`) |
| Firebase project | free | Android push (`FCM_SERVER_KEY`) |

## Identity
- **Bundle ID / Package:** `com.iglamher.app`
- **App name:** iGlamHer
- **Subtitle:** Book beauty, beautifully
- **Category:** Lifestyle (secondary: Shopping)
- **Age rating:** 17+ / Teen — user-generated content + in-app messaging.

## Store listing copy
- **Promo:** Discover and book trusted beauty pros near you — hair, makeup, lashes & styling.
- **Description:** iGlamHer is a luxury beauty marketplace. Browse verified professionals,
  see real portfolios and transparent prices, book in seconds, pay securely, and message
  your stylist in-app — no phone numbers shared. Earn iGlam Rewards on every booking.
  For pros: a storefront, calendar, secure payouts, and growth analytics.
- **Keywords:** beauty, makeup artist, hair stylist, lashes, braids, MUA, booking, salon,
  mobile beauty, glam, bridal, appointment, beauty near me.

## Privacy labels (App Privacy / Data safety)
| Data | Collected | Linked to user | Purpose |
|---|---|---|---|
| Contact info (name, email, phone) | yes | yes | account, bookings |
| Location (approximate) | yes | yes | "near me" search, ETA |
| Payment info | via Stripe (not stored by app) | no | payments |
| Photos | yes | yes | portfolios, reviews, verification |
| User content (messages, reviews) | yes | yes | app functionality |
| Identifiers (device token) | yes | yes | push notifications |
| Diagnostics | if Sentry on | no | crash/error reporting |
Not sold. Not used for third-party advertising.

## Permission usage strings
**iOS (Info.plist):**
- `NSFaceIDUsageDescription` — "Use Face ID to securely sign in to iGlamHer."
- `NSCameraUsageDescription` — "Take photos of your work or attach photos to a booking."
- `NSPhotoLibraryUsageDescription` — "Attach photos to your portfolio, reviews, or verification."
- `NSLocationWhenInUseUsageDescription` — "Find beauty professionals near you and see arrival times."
- `NSUserTrackingUsageDescription` — not used (no tracking).

**Android (AndroidManifest):** `INTERNET`, `CAMERA`, `ACCESS_FINE_LOCATION` (in-use),
`POST_NOTIFICATIONS`, `USE_BIOMETRIC`. Justify each in the Play data-safety form.

## Assets required (design export — placeholders in /public/brand today)
| Asset | Spec |
|---|---|
| App icon | 1024×1024 (iOS), 512×512 (Play), adaptive icon (Android fg+bg) — from the iGlamHer logomark |
| iPhone screenshots | 6.7" + 6.5" + 5.5", ≥3 each (Discover, Profile, Booking, Rewards) |
| iPad screenshots | 12.9", ≥1 |
| Android phone/tablet | ≥2 phone, ≥1 tablet + 1024×500 feature graphic |
| Splash / launch | 2732×2732 centered logo on `#0B0909` (config: `SplashScreen.backgroundColor`) |
> The current `/public/brand/logo-word.png` is a starting point; export sized PNGs before submission.

## Deep-link verification
- iOS: host `/.well-known/apple-app-site-association` (already served) + add the Associated
  Domains capability `applinks:iglamher.com`. Set `APPLE_APP_ID=<TEAMID>.com.iglamher.app`.
- Android: host `/.well-known/assetlinks.json` (already served) with your signing SHA-256
  (`ANDROID_SHA256`), then `autoVerify` intent filters in the manifest.

## Beta distribution
- **TestFlight:** archive in Xcode → App Store Connect → TestFlight → add internal/external testers.
- **Play Internal Testing:** upload the AAB → Internal testing track → tester list.
- Crash reporting: Sentry (`SENTRY_DSN`) for JS; native crashes via Xcode Organizer / Play vitals.

## Legal (already in-app, needs counsel review)
- Privacy: `/legal/privacy` · Terms: `/legal/terms` · Cancellation: `/legal/cancellation`.
- Link these in both store listings.

## Submission checklist
- [ ] Apple + Google accounts active; certs/keystore created & backed up.
- [ ] `server.url` in `capacitor.config.ts` = production HTTPS.
- [ ] `npx cap add ios/android` → sync → build signed release.
- [ ] APNs + FCM configured; push permission prompt + `registerDeviceTokenAction` verified on device.
- [ ] Universal Links / App Links verified (paste your team id + SHA-256 into env).
- [ ] Icons, splash, screenshots exported at required sizes.
- [ ] Privacy labels + permission strings entered.
- [ ] TestFlight + Play Internal builds distributed to testers; device QA passed.
- [ ] Submit for review.
