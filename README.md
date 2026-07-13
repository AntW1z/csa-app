# CSA app

A four-role (user / member / moderator / admin) events + announcements app
for Georgia Tech CSA, built with Expo Router and Firebase. Everything here
runs on Firebase's free Spark tier and Expo's free tier — no credit card
needed for anything currently implemented. See
[Costs to expect before production](#costs-to-expect-before-production) for
what changes that.

## What's in here

```
app/
  _layout.tsx                 root layout, wraps everything in AuthProvider
  (tabs)/
    _layout.tsx                tab bar (Home/Calendar/Links[/Manage]) + the
                                 header profile icon shared across every tab
    index.tsx                   Home: carousel, quick actions, this week's
                                  events, launch popup
    calendar.tsx                 Month calendar with event dots, tap a day
                                   to see that day's events, search by title
    links.tsx                     Instagram / Discord / etc
    profile.tsx                    Sign in / create account / status — the
                                     ONLY login screen, reachable via the
                                     header icon, not a bottom tab
    moderator.tsx                   Manage dashboard: pending requests,
                                      member management, posts, home
                                      carousel, notifications, audit log
src/
  firebase.ts                 Firebase init (reads from .env)
  notifications.ts             Push token registration + sending via
                                 Expo's push API (no backend)
  theme.ts                    Shared design tokens (colors, spacing,
                                radius) — every screen pulls from here
  types.ts                    Shared TypeScript types
  utils.ts                    Event date/time formatting + all-day/
                                multi-day window math
  context/AuthContext.tsx     Tracks signed-in user + their Firestore role,
                                registers this device for push notifications
  components/
    PostCard.tsx               Compact feed/calendar card
    PostDetailModal.tsx         Full-screen post detail popup, shared by
                                  PostCard and Home's carousel/featured-post
    PostGrid.tsx                Responsive 1/2/3-column layout (phones get
                                 one column, wider viewports get more)
    PromoCarousel.tsx           Auto-advancing image strip at the top of
                                 Home, moderator-curated
    PromoPopup.tsx              Launch popup (full-screen featured post)
                                  with a "Skip Ns" countdown
    InfoModal.tsx                Generic popup (used for "What is CSA?")
firestore.rules              Security rules — enforces role boundaries
                               server-side
.env.example                 Firebase config template
```

## 1. Clone & install

```bash
git clone <this repo>
cd csa-app
npm install
```

Uses Expo SDK 54 — pinned there because that's what Expo Go actually
supports at the time this was built. If you bump the SDK later, make sure
whatever Expo Go your testers have installed supports it, or use a dev
build / tunnel mode instead.

## 2. Set up Firebase (free — Spark plan)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a project.
2. Add a **Web app** (yes, even though this is a mobile app — the JS SDK uses the web app config).
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Enable **Firestore Database** → start in production mode.
5. Paste the config values it gives you into a `.env` file (copy `.env.example` and fill it in).
6. In Firestore → Rules, paste the contents of `firestore.rules` and publish.

The Spark (free) plan gives you 50K reads/20K writes per day and 1GB
storage — comfortably enough for a few hundred members.

## 3. Run it

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your phone, press `i` / `a` for a
simulator, or `w` for the web build. If your Wi-Fi has client isolation
(common on campus/dorm networks) and Expo Go can't connect over LAN, use
`npx expo start --tunnel` instead.

## 4. Make yourself an admin

Sign up in the app once. Then in the Firebase console, go to Firestore →
`users` → your document → change `role` from `"user"` to `"admin"`.
That's the manual step we talked about — no UI needed for this, since
it only happens when officers change.

## Features

**Home** — an auto-advancing image carousel (moderator-managed; an item is
either a plain image or linked to a post, in which case tapping it opens
that post's full detail), two quick-action buttons (Calendar, "What is
CSA?"), and a feed of this week's events only, soonest first. Moderators
can star one post as "featured," which shows it full-screen once per app
session on launch, with a "Skip Ns" countdown that's tappable at any time.

**Calendar** — a real month grid instead of a flat list. Days with events
get a dot; tap a day to see that day's events below. Search by title to
jump straight to an event's month/day.

**Posts** (created from Manage → New post, as a popup form):
- Title and description are required.
- Date is required, picked from a calendar (tap once for a single day,
  tap a second day for a multi-day range — e.g. a promo running Aug 23-25).
- Time is optional and collapsed by default — leaving it off makes the
  event all-day. Expanding it gives fixed start/end time slots (7am-11:30pm,
  30-min steps); on a single-day event, end-time slots before the chosen
  start time are disabled so you can't create a backwards range.
- Existing posts can be edited (not just deleted and recreated) via the
  "edit" link on each row in Manage → Posts, and starred to feature it as
  the launch popup (see Home above).
- An optional image URL renders at the top of the card; tapping a card
  opens a popup with the full (uncropped) image and description.

**Home carousel** — moderators add/remove images (either a plain decorative
image, or one linked to an existing post so tapping it opens that event's
full detail) from Manage → Home carousel.

**Members** — Manage → Members lists everyone (moderators/admins, then
members with their term), with year/semester/moderator/admin counts at the
top. Tapping a row (admin-only) opens per-member actions: change membership
term, promote/demote between member ↔ moderator ↔ admin, or remove
membership entirely (two-step confirm, can't be undone). Admins can also
clear all Year or all Semester memberships at once from here.

**Notifications** — Manage → Notifications. Moderators draft a push message
(title, body, and an Everyone/Members-only audience), which sits as a draft
until someone chooses to send it. Sending requires a second confirmation
("Send '{title}' to {audience}? This cannot be undone.") and is sent
directly from the sending moderator's device via Expo's push API — no
backend or paid Firebase plan required. Sent messages move to a Sent
history list for reference. See Costs below for what a *scheduled* /
exact-time version of this would need.

**Logs** — Manage → Logs (admin-only). Every moderation action (approvals,
role changes, post edits, notifications sent, etc.) is recorded with who
did it and when. Moderators' actions are logged but only admins can view or
clear the log.

## Known limitations (intentional, for v1)

- **"Members only" visibility is enforced in the app, not the database.**
  The Firestore rules allow anyone to read the `posts` collection (so
  browsing without an account works), and the *app* filters out
  members-only posts client-side. This is fine for club announcements
  that aren't sensitive, but it means a technically savvy person could
  query Firestore directly and see members-only content. If that ever
  matters, the fix is splitting the query so members-only posts require
  an authenticated, role-checked request — worth revisiting before you
  post anything truly private.
- **No real image upload yet.** Posts and carousel items take a pasted
  image URL (e.g. from imgbb.com), not a photo-library picker. See Costs
  below — this is a deliberate deferral, not an oversight.
- **Notifications are send-on-demand only, not scheduled.** A moderator
  has to actually tap Send; there's no "fire automatically 1 hour before
  the event" option yet. See Costs below for why.

## Costs to expect before production

Everything currently built runs entirely on free tiers (Firebase Spark +
Expo's free tier). These are the specific upgrades that would cost money,
and exactly what each one buys you, so nothing gets turned on by surprise:

- **Firebase Blaze plan** (pay-as-you-go, requires a credit card on file —
  actual usage cost should stay close to $0 at club scale, but Firebase
  requires Blaze to be enabled at all for these). Needed for:
  - **Cloud Storage**, to let moderators upload a photo directly from
    their library instead of pasting an image URL.
  - **Cloud Functions on a schedule** (Cloud Scheduler), which is what a
    true "send this reminder automatically N minutes before the event, or
    fire a scheduled notification even if nobody has the app open" feature
    needs. Notifications are currently designed to avoid this entirely —
    every send is triggered manually from a moderator's own device — which
    is why it's a deliberate limitation above rather than a bug.
- **Apple Developer Program — $99/year.** Required to publish to the App
  Store, and to create a standalone/production iOS build.
- **Google Play Console — $25 one-time.** Required to publish to the
  Play Store.
- **EAS Build.** Expo's free tier includes a limited number of builds per
  month, which is enough for occasional testing; publishing to app stores
  or building frequently may need a paid EAS plan. Also worth knowing: as
  of SDK 54, remote push notifications no longer work inside Expo Go on
  Android (iOS Expo Go still supports them) — testing the Notifications
  feature on Android, and shipping the app at all, requires at least one
  EAS **development build**, separate from app-store publishing builds.

## Next steps

- Real image upload (Firebase Storage, once the Blaze-plan tradeoff above
  is a deliberate decision rather than a surprise)
- Scheduled/exact-time notifications (Cloud Functions + Blaze — see Costs)
- Members-only visibility enforced server-side, not just client-side (see
  Known limitations)
