import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PushMessage, UserProfile } from '../types';
import { registerForPushNotificationsAsync } from '../notifications';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  // Sent notifications this account is eligible to see (audience already
  // filtered), and how many it hasn't opened yet — shared here so the
  // header badge and the inbox screen read from one listener instead of two.
  visibleNotifications: PushMessage[];
  unreadCount: number;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
  visibleNotifications: [],
  unreadCount: 0,
});

// Browsing the app never requires an account. This context only starts
// tracking a profile once someone actually signs in from the profile tab.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentNotifications, setSentNotifications] = useState<PushMessage[]>([]);

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

  // The in-app inbox — only meaningful once signed in, since read state
  // lives on the user's own profile doc.
  useEffect(() => {
    if (!firebaseUser) {
      setSentNotifications([]);
      return;
    }
    const q = query(collection(db, 'notifications'), where('status', '==', 'sent'), orderBy('sentAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setSentNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PushMessage))),
      (err) => console.warn('notifications listener error', err)
    );
  }, [firebaseUser]);

  const isMemberOrAbove = !!profile && profile.role !== 'user';
  const visibleNotifications = sentNotifications.filter(
    (n) => (n.audience === 'everyone' || isMemberOrAbove) && !profile?.deletedNotificationIds?.includes(n.id)
  );
  const unreadCount = profile
    ? visibleNotifications.filter((n) => !(profile.readNotificationIds ?? []).includes(n.id)).length
    : 0;

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, visibleNotifications, unreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
