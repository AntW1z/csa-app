import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Linking, Platform, Switch, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { registerForPushNotificationsAsync } from '../notifications';
import { StudentYear } from '../types';
import { colors, radius, spacing, shadow } from '../theme';
import { YEAR_OPTIONS } from '../constants';

// Rendered by the root layout, above the tab navigator, whenever
// profile.needsSetup is true — a brand-new account must finish this
// before it can reach any tab (including switching tabs to dodge it).
// Driven by that persisted Firestore field rather than local component
// state specifically so it survives a force-quit: local state reset on
// every launch, which meant closing the app mid-setup silently skipped it
// for good. Name and notifications are offered here too since it's the
// one guaranteed moment every new member sees, but year is the only field
// that's actually required to finish.
export default function AccountSetupGate() {
  const { profile } = useAuth();
  const [notifStatus, setNotifStatus] = useState<Notifications.PermissionStatus | 'checking'>('checking');
  const [nameDraft, setNameDraft] = useState('');
  const [year, setYear] = useState<StudentYear | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInitialized = useRef(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotifStatus(status));
  }, []);

  // Seeds the name field from the auto-generated default
  // (email.split('@')[0], set by AuthContext at profile creation) exactly
  // once — a plain useState initializer can't do this since profile is
  // still null on the very first render, before it's fetched.
  useEffect(() => {
    if (profile && !nameInitialized.current) {
      setNameDraft(profile.displayName);
      nameInitialized.current = true;
    }
  }, [profile]);

  // Once the OS permission is actually granted, the switch controls a
  // pure in-app preference (notificationsEnabled) — there's no API to
  // revoke OS notification permission from inside an app, so this field is
  // what actually determines whether Manage's sends include this device.
  // Before permission is granted, there's nothing to toggle off yet, so it
  // falls through to requesting it instead. Same logic as the main
  // Notifications row in profile.tsx.
  const handleNotifToggle = async (nextValue: boolean) => {
    if (notifStatus === 'checking' || !profile) return;
    if (notifStatus === 'granted') {
      await updateDoc(doc(db, 'users', profile.uid), { notificationsEnabled: nextValue });
      return;
    }
    if (!nextValue) return;
    if (notifStatus === 'denied') {
      if (Platform.OS !== 'web') Linking.openSettings();
      return;
    }
    await registerForPushNotificationsAsync(profile.uid);
    const { status } = await Notifications.getPermissionsAsync();
    setNotifStatus(status);
  };

  if (!profile) return null;

  const canFinish = !!year;

  const finishSetup = async () => {
    if (!canFinish || !year) return;
    setSaving(true);
    try {
      const trimmedName = nameDraft.trim();
      await updateDoc(doc(db, 'users', profile.uid), {
        year,
        needsSetup: false,
        ...(trimmedName && trimmedName !== profile.displayName ? { displayName: trimmedName } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Finish setting up your account</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Display name"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>What year are you? (required)</Text>
        <Text style={styles.hint}>Helps CSA officers plan events and is used when you check in at events.</Text>
        <View style={styles.yearOptionRow}>
          {YEAR_OPTIONS.map((y) => (
            <Pressable key={y} style={[styles.yearOption, year === y && styles.yearOptionActive]} onPress={() => setYear(y)}>
              <Text style={[styles.yearOptionText, year === y && styles.yearOptionTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.notifRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Notifications</Text>
            <Text style={styles.hint}>Get notified the moment events and announcements are posted.</Text>
          </View>
          <Switch
            value={notifStatus === 'granted' && profile.notificationsEnabled !== false}
            onValueChange={handleNotifToggle}
            disabled={notifStatus === 'checking'}
            trackColor={{ true: '#34C759', false: colors.borderStrong }}
          />
        </View>

        <Pressable
          style={[styles.button, { marginTop: spacing.lg }, (!canFinish || saving) && styles.buttonDisabled]}
          onPress={finishSetup}
          disabled={!canFinish || saving}
        >
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Finish setup'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: spacing.xl, gap: spacing.md },
  header: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.md },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
  yearOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  yearOption: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearOptionActive: { backgroundColor: colors.red, borderColor: colors.red, ...shadow.card },
  yearOptionText: { color: colors.textSecondary, fontSize: 18, fontWeight: '800' },
  yearOptionTextActive: { color: colors.onAccent },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: { backgroundColor: colors.red, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
});
