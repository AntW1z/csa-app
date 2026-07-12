# CSA app

A four-role (user / member / moderator / admin) events + announcements app
for Georgia Tech CSA, built with Expo Router and Firebase. Everything here
runs on Firebase's free Spark tier — no credit card needed for anything
currently implemented. (Real image *upload* would change that — see
Known limitations.)

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
    moderator.tsx                   Approve requests, create/edit/delete
                                      posts, manage the home carousel,
                                      year-end reset
src/
  firebase.ts                 Firebase init (reads from .env)
  theme.ts                    Shared design tokens (colors, spacing,
                                radius) — every screen pulls from here
  types.ts                    Shared TypeScript types
  utils.ts                    Event date/time formatting + all-day/
                                multi-day window math
  context/AuthContext.tsx     Tracks signed-in user + their Firestore role
  components/
    PostCard.tsx               Compact feed/calendar card — tap for a
                                 popup with the full image + description
    PostGrid.tsx                Responsive 1/2/3-column layout (phones get
                                 one column, wider viewports get more)
    PromoCarousel.tsx           Auto-advancing image strip at the top of
                                 Home, moderator-curated
    PromoPopup.tsx              Launch popup with a "Skip Ns" countdown
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

**Home** — an auto-advancing image carousel (moderator-managed, tap an
image to jump to a link or in-app page), two quick-action buttons
(Calendar, "What is CSA?"), and a feed of this week's events only,
soonest first. A launch popup can be configured to show once per app
session, with a "Skip Ns" countdown that's tappable at any time.

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
  "edit" link on each row in Manage → All posts.
- An optional image URL renders at the top of the card; tapping a card
  opens a popup with the full (uncropped) image and description.

**Home carousel** — moderators add/remove images (with an optional tap
destination, internal path or external URL) from Manage → Home carousel.

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
  image URL (e.g. from imgbb.com), not a photo-library picker. Real
  in-app upload needs a hosting backend — Firebase Storage is the natural
  fit, but as of when this was built, enabling Storage typically requires
  upgrading to the pay-as-you-go Blaze plan (a credit card on file), even
  though real usage cost should stay ~$0 at club scale. Worth deciding
  deliberately rather than by surprise, which is why it's deferred for now.
- **Auth doesn't persist across app restarts on native (iOS/Android).**
  `src/firebase.ts` tries to use `getReactNativePersistence` from
  `firebase/auth`, which isn't actually exported by the installed
  `firebase` version — it silently falls back to `getAuth(app)`, so
  sign-in still works, but members have to sign in again after fully
  quitting the app. Fixing this means finding the right persistence
  import for the current `firebase` package version (it moved around
  across major versions).
- No push notifications wired up yet — `expo-notifications` is the free,
  no-backend-needed path when you're ready to add them. The event data
  model already has structured start/end times and an `allDay` flag
  (not just a freeform date string), which is exactly what scheduling a
  reminder notification would need.
- Moderator/admin assignment is manual via the Firebase console, by
  design. The Firestore rules already permit any moderator/admin to set
  any role on any user, though — there's no in-app promote button, purely
  a missing UI, not a missing permission.

## Next steps

- Push notifications for upcoming events (`expo-notifications`)
- Real image upload (Firebase Storage, once the Blaze-plan tradeoff above
  is a deliberate decision rather than a surprise)
- Fix the auth-persistence fallback in `src/firebase.ts`
- In-app promote-to-moderator/admin control (admin-only)
- Confirm dialog on the year-end reset button before this goes live
