# iGlamHer — Component Tree

Component architecture under `src/components`. Components are either **Server** (default, no directive — can be async, read data, run on the server) or **Client** (`"use client"` — interactivity, hooks, browser APIs). The split below is taken directly from the presence of the `"use client"` directive.

Providers are mounted once at the root: `layout.tsx` → `AppProviders` (client) → `NotificationsProvider` + `FavoritesProvider` + `PWARegister`.

---

## Root

| Component | Type | Responsibility |
|-----------|------|----------------|
| `AppProviders` | Client | Root client provider boundary — wraps app in Notifications + Favorites context and mounts `PWARegister`. |
| `PWARegister` | Client | Registers the service worker (offline + Web Push) in production; no-ops in dev / Capacitor / unsupported browsers. |

## `marketplace/` — customer-facing marketplace

| Component | Type | Responsibility |
|-----------|------|----------------|
| `Shell` | Server | Standard customer page frame: `AppHeader` + constrained `<main>` + `BottomNav`; props `wide` / `header` / `bottomNav`. Also exports `SectionHeader` & `SectionLabel`. |
| `AppHeader` | Server | Sticky top bar — logo, `NotificationBell`, `Avatar`. |
| `BottomNav` | Client | Mobile bottom tab bar (Home / Bookings / Messages / Profile) with active-path highlight (`usePathname`). |
| `DiscoverTopbar` | Client | Discover-screen top bar (logo + entry points). |
| `HeroLuxury` | Client | Cinematic Discover hero with inline search; tracks + records recent searches, routes to `/search`. Has `HeroLuxury.module.css`. |
| `DiscoverHero` | Server | Alternate full-bleed hero with `SearchBar` + trust badges (Trusted Pros / Easy Booking / Real Reviews). |
| `CategoryTiles` | Server | 2×2 grid of core category tiles. |
| `CategoryCard` | Server | Single category tile. |
| `CategoryBanner` | Server | Full-width featured category banner (used for Lashes on Discover). |
| `ProfessionalCard` | Server | Pro summary card (`list`/grid variants) — avatar, rating, location, starting price, embeds `FavoriteButton`. |
| `ProfessionalGrid` | Server | Grid of `ProfessionalCard`s with empty-state; takes `favoritedIds`. |
| `ServiceCard` | Server | Service row — name, price, duration; optional link. |
| `ReviewCard` | Server | Single review (author, rating, body). |
| `RatingBreakdown` | Server | Star-distribution histogram + average. |
| `SearchBar` | Client | Search input with autocomplete (hits `/api/search/suggest`). |
| `Filters` | Client | Filter controls — `FiltersSidebar`, `MobileFilterSheet`, `SortSelect`; syncs to URL query, tracks filter usage. |
| `FavoriteButton` | Client | Toggle favorite (inline/icon variants) backed by the Favorites store + server action. |
| `FavoritesView` | Client | Renders saved pros from the client favorites store against a full pros list. |
| `AvailabilityPreview` | Client | Read-only availability slot preview on the profile page. |
| `AvatarUpload` | Client | Customer avatar upload widget. |
| `TrackView` | Client | Fire-and-forget analytics beacon on mount (view events, optional pro-view recording). |

## `ui/` — shared primitives

| Component | Type | Responsibility |
|-----------|------|----------------|
| `Button` | Server | `Button` + `LinkButton`; variants `rose` / `ghost` / `outline`, `full` width. |
| `Card` | Server | Card container primitives (static + interactive/link variants). |
| `Input` | Server | `FieldShell` (label/error/hint wrapper) + shared field classes. |
| `Avatar` | Client | Image avatar w/ initials fallback on error. |
| `SmartImage` | Client | `next/image` wrapper with espresso blur placeholder (zero CLS) + `BLUR_DATA_URL`. |
| `Modal` | Client | Accessible modal — Escape-to-close, scroll lock, focus handling. |
| `Rating` | Server | Star rating + count display. |
| `Spinner` | Server | Inline loading spinner. |
| `PullToRefresh` | Client | Mobile pull-to-refresh gesture wrapper (used on Discover). |
| `icons` | Server | Single-source line-icon set (aria/keyboard friendly) — Home, Calendar, Chat, User, Heart, Star, Bell, Verified, Sparkle, Chevrons, Lock, etc. |
| `states` | Server | `EmptyState`, skeletons (`GridSkeleton`) and other status/empty UI. |

## `auth/`

| Component | Type | Responsibility |
|-----------|------|----------------|
| `AuthForms` | Client | Sign-in / sign-up / forgot / reset forms via `useActionState` over server actions. |
| `fields` | Client | `Field`, `PasswordField`, `FormMessage` form primitives. |
| `SubmitButton` | Client | Pending-aware submit button (`useFormStatus`). |
| `OAuthButtons` | Client | Google/Apple OAuth via Supabase; explains config when providers disabled. |
| `SignOutButton` | Server | Sign-out control (form → server action). |

## `booking/`

| Component | Type | Responsibility |
|-----------|------|----------------|
| `BookingFlow` | Client | Full interactive booking — day/slot picker (`computeDaySlots`), live pricing (`computeBooking`), creates booking draft + Stripe checkout session, analytics. |

## `pro/` — professional dashboard

| Component | Type | Responsibility |
|-----------|------|----------------|
| `ProShell` | Server | Pro dashboard frame — Pro-badged header, tab nav (Services / Availability / Earnings / Profile), demo-mode banner. |
| `ProfileForm` | Client | Edit public profile via `saveProfileAction` (`useActionState`). |
| `ServiceForm` | Client | Create/edit a service via `saveServiceAction`. |
| `ServiceRowActions` | Client | Per-service actions (archive/edit) on the services list. |
| `AvailabilityEditor` | Client | Weekly-hours + timezone editor via `saveAvailabilityAction`. |
| `PortfolioManager` | Client | Manage portfolio media items. |
| `ConnectPayouts` | Client | Stripe Connect onboarding + payout status (start/refresh actions). |

## `admin/`

| Component | Type | Responsibility |
|-----------|------|----------------|
| `AdminProRow` | Client | Pro moderation row (approve/verify actions) in the admin queue. |
| `CampaignManager` | Client | CRUD UI for marketing campaigns/coupons. |

## `notifications/`

| Component | Type | Responsibility |
|-----------|------|----------------|
| `NotificationBell` | Client | Header bell with unread badge from `NotificationsProvider`. |
| `NotificationList` | Client | Full notifications list from the client store. |

## `rewards/`

| Component | Type | Responsibility |
|-----------|------|----------------|
| `RewardsPanel` | Client | `RedeemBox` (redeem points → credit) + `ReferralBox` (share referral code). |

## `trust/`

| Component | Type | Responsibility |
|-----------|------|----------------|
| `TrustBadges` | Server | Renders trust badges; exports `professionalBadges(pro)` helper deriving badges (verified, experience, reliability) from a `Professional`. |

## `legal/`

| Component | Type | Responsibility |
|-----------|------|----------------|
| `LegalLayout` | Server | Shared prose layout (`title` + `updated` date) for about / how-it-works / legal pages; exports `H2`. |

---

## Key screen composition

### Discover — `src/app/discover/page.tsx` (server, `force-dynamic`)

Data (parallel): `listCategories()`, `searchProfessionalViews({ sort:"rating" })`, `getFavoriteProfessionalIds()`, `getRecommendedForYou(4)`.

```
Shell (header={false})                     ← server frame (AppHeader hidden, BottomNav shown)
└─ PullToRefresh                           ← client gesture wrapper
   ├─ DiscoverTopbar                       ← client top bar
   ├─ HeroLuxury                           ← client hero + inline search
   ├─ SectionLabel "Categories" (→ /search)
   ├─ CategoryTiles                        ← server, 4 core categories (Lashes excluded)
   │  └─ (CategoryCard × 4)
   ├─ CategoryBanner                       ← server, featured Lashes banner
   ├─ SectionLabel "Recommended for you"   ← rendered when recommended.length > 0
   │  └─ ProfessionalCard (variant="list") × recommended   ← each embeds FavoriteButton (client)
   └─ SectionLabel "Popular near you" (→ /search?sort=rating)
      └─ EmptyState  OR  ProfessionalCard (variant="list") × popular
```

`favoritedIds` is turned into a `Set` and passed to each card as `favorited`.

### Professional profile — `src/app/professionals/[slug]/page.tsx` (server, `force-dynamic`)

Data: `getProfessionalBySlug(slug)` (→ `notFound()` if missing), `getFavoriteProfessionalIds()`, then `publicServices` / `publicPortfolio` / `publicReviews` visibility filters. Has `generateMetadata`.

```
<div> profile root
├─ AppHeader                               ← server
├─ TrackView (professional_viewed)         ← client analytics beacon
├─ Hero cover (next/image ken-burns + gradient/vignette overlays)
├─ grid
│  ├─ Main column
│  │  ├─ header: avatar, name + VerifiedIcon, Rating, city, location label
│  │  ├─ TrustBadges (professionalBadges(pro))        ← server
│  │  ├─ meta chips (verified / years / jobs / languages)
│  │  ├─ About (bio + specialty chips)
│  │  ├─ Services      → ServiceCard × publicServices  (href /services/[id])
│  │  ├─ Portfolio     → next/image grid × publicPortfolio
│  │  ├─ Availability  → AvailabilityPreview            ← client (when hours + services exist)
│  │  ├─ Reviews       → RatingBreakdown + ReviewCard × publicReviews
│  │  ├─ Business info  (InfoRow rows + Instagram link)
│  │  └─ Cancellation policy
│  └─ aside (desktop sticky panel): starting price, LinkButton "Book now" (→ /book/[slug]), FavoriteButton
└─ Mobile sticky CTA: price + FavoriteButton + LinkButton "Book now"
```

Shared primitives used: `Rating`, `VerifiedIcon`, `LinkButton` (Button), `FavoriteButton`, `next/image`.

### Booking — `src/app/book/[slug]/page.tsx` (server) → `BookingFlow` (client)

Server page loads the pro + `publicServices` + availability `config`, orders services (pre-selected `?service=` first), then hands everything to the client `BookingFlow`, which owns the slot picker, live pricing, and Stripe checkout kickoff. Framed by `AppHeader`.

### Pro dashboard pages — `/pro/*`

Each server page: `getProContext()` guard → `ProShell` (server frame w/ tab nav + demo banner) wrapping a single client form (`ProfileForm` / `ServiceForm` / `AvailabilityEditor` / `ConnectPayouts` + `PortfolioManager`).
