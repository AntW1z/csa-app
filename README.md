# CSA app — scaffold

A four-role (user / member / moderator / admin) events + announcements app,
built with Expo Router and Firebase. Everything in this scaffold runs on
free tiers — no paid services required to build, test, or run this at
club scale (a few hundred users).

## What's in here

```
app/
  _layout.tsx              root layout, wraps everything in AuthProvider
  (tabs)/
    _layout.tsx             tab bar — "Manage" tab hidden unless you're a moderator/admin
    index.tsx                Home: post feed + launch popup
    calendar.tsx              Upcoming events list
    links.tsx                  Instagram / Discord / etc
    profile.tsx                 Sign in / create account / status — the ONLY login screen
    moderator.tsx                Approve requests, publish posts, year-end reset
src/
  firebase.ts               Firebase init (reads from .env)
  types.ts                  Shared TypeScript types
  context/AuthContext.tsx    Tracks signed-in user + their Firestore role
  components/PostCard.tsx    Feed card
  components/PromoPopup.tsx  Launch popup modal
firestore.rules            Security rules — enforces role boundaries server-side
.env.example                Firebase config template
```

## 1. Create the Expo project

This scaffold isn't a full project by itself — it's the app-specific code
to drop into a fresh Expo app, so you always get current, compatible
package versions instead of whatever I hardcoded months ago.

```bash
npx create-expo-app@latest csa-app
cd csa-app
```

When prompted, choose the **default (Expo Router)** template.

Copy the `app/`, `src/`, `firestore.rules`, and `.env.example` from this
scaffold into your new `csa-app` folder, replacing the generated `app/`
folder.

## 2. Install dependencies

```bash
npx expo install firebase @react-native-async-storage/async-storage @expo/vector-icons
```

`expo install` (not plain `npm install`) resolves versions that are
actually compatible with your Expo SDK version — always use it for
Expo/React Native packages.

## 3. Set up Firebase (free — Spark plan)

1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a project.
2. Add a **Web app** (yes, even though this is a mobile app — the JS SDK uses the web app config).
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Enable **Firestore Database** → start in production mode.
5. Paste the config values it gives you into a `.env` file (copy `.env.example` and fill it in).
6. In Firestore → Rules, paste the contents of `firestore.rules` and publish.

The Spark (free) plan gives you 50K reads/20K writes per day and 1GB
storage — comfortably enough for a few hundred members. You won't need
to enter a credit card or upgrade to Blaze unless you add features like
image uploads or server-side functions later.

## 4. Run it

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your phone, or press `i` / `a`
for a simulator.

## 5. Make yourself an admin

Sign up in the app once. Then in the Firebase console, go to Firestore →
`users` → your document → change `role` from `"user"` to `"admin"`.
That's the manual step we talked about — no UI needed for this, since
it only happens when officers change.

## Adding your first posts and popup

The moderator dashboard can publish posts once you're an admin. For the
popup, add a document manually: Firestore → create collection `config` →
document ID `popup`, with fields matching `PopupConfig` in `types.ts`
(`active`, `title`, `description`, `ctaText`, `ctaLink`).

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
- Calendar is a sorted list, not a real calendar grid — swap in
  `react-native-calendars` when you want the visual grid.
- No push notifications wired up yet — `expo-notifications` is the free,
  no-backend-needed path when you're ready to add them.
- Moderator/admin assignment is manual via the Firebase console, by design.

## Next steps

- Push notifications (`expo-notifications`, free, triggers when a
  moderator publishes)
- Real calendar grid
- Image upload for posts/popup (Firebase Storage — still free tier at this scale)
- Confirm dialog on the year-end reset button before this goes live
