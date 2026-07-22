import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing } from '../../src/theme';

function ProfileHeaderButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/profile')} hitSlop={8} style={styles.profileBtn}>
      <Ionicons name="person-circle-outline" size={28} color={colors.textPrimary} />
    </Pressable>
  );
}

function NotificationsHeaderButton() {
  const router = useRouter();
  const { firebaseUser, unreadCount } = useAuth();
  if (!firebaseUser) return null;
  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={8} style={styles.notifBtn}>
      <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  const { profile } = useAuth();
  const canModerate = profile?.role === 'moderator' || profile?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        headerLeft: () => <ProfileHeaderButton />,
        headerRight: () => <NotificationsHeaderButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="links"
        options={{
          title: 'Links',
          tabBarIcon: ({ color, size }) => <Ionicons name="link-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sponsors"
        options={{
          title: 'Sponsors',
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          // Reachable via the header profile icon instead of a bottom tab.
          href: null,
          headerLeft: () => null,
          headerRight: () => null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          // Reachable via the header bell icon instead of a bottom tab.
          href: null,
          headerRight: () => null,
        }}
      />
      <Tabs.Screen
        name="moderator"
        options={{
          title: 'Manage',
          // href: null hides a tab from the bar while keeping the route reachable.
          href: canModerate ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  profileBtn: { marginLeft: spacing.lg },
  notifBtn: { marginRight: spacing.lg },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: { color: colors.onAccent, fontSize: 9, fontWeight: '800' },
});
