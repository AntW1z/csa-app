import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { registerForPushNotificationsAsync } from '../notifications';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
});

// Browsing the app never requires an account. This context only starts
// tracking a profile once someone actually signs in from the profile tab.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsubDoc = onSnapshot(
      ref,
      async (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          // First sign-in: create their profile doc, defaulting to the
          // lowest-privilege role. Moderators/admins are promoted manually.
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.email?.split('@')[0] ?? 'Member',
            role: 'user',
            memberRequestStatus: 'none',
            createdAt: serverTimestamp(),
          };
          await setDoc(ref, newProfile);
          setProfile(newProfile);
        }
        setLoading(false);
      },
      (err) => console.warn('profile listener error', err)
    );
    return unsubDoc;
  }, [firebaseUser]);

  // Registers this device's Expo push token once someone's signed in — web
  // has no meaningful equivalent here, so it's skipped there.
  useEffect(() => {
    if (!firebaseUser || Platform.OS === 'web') return;
    registerForPushNotificationsAsync(firebaseUser.uid);
  }, [firebaseUser]);

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
