import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth, Persistence } from 'firebase/auth';
// The top-level `firebase` package's `./auth` export map has no
// react-native condition (it only resolves to the browser/default bundle,
// which lacks this), so getReactNativePersistence has to come from the
// underlying @firebase/auth package instead, which does define one at
// runtime for React Native. Its type declarations don't include this
// function though — TS's "types" condition wins over "react-native" by key
// order in @firebase/auth's export map, so it always resolves to the
// generic (non-RN) .d.ts — hence the manual augmentation below.
import { getReactNativePersistence } from '@firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}

// Values come from a .env file at the project root (see .env.example).
// Expo automatically exposes any variable prefixed EXPO_PUBLIC_ to the app.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth throws if called twice (happens during Fast Refresh in dev),
// so fall back to getAuth if it's already been set up.
let authInstance: Auth;
if (Platform.OS === 'web') {
  authInstance = getAuth(app);
} else {
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    authInstance = getAuth(app);
  }
}

export const auth = authInstance;
export const db = getFirestore(app);
export default app;
