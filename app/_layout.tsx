import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import AccountSetupGate from '../src/components/AccountSetupGate';

// Split out from RootLayout since useAuth() needs to run *inside*
// AuthProvider, not alongside it.
function AppShell() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  // Renders instead of the tab navigator entirely — not just within one
  // tab's screen — so a brand-new account can't dodge this by switching
  // tabs. See AccountSetupGate and UserProfile.needsSetup for why.
  if (profile?.needsSetup) return <AccountSetupGate />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
