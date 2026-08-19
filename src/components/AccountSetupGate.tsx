import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { StudentYear } from '../types';
import { colors, radius, spacing, shadow } from '../theme';
import { YEAR_OPTIONS } from '../constants';

// Rendered by the root layout, above the tab navigator, whenever
// profile.needsSetup is true — a brand-new account must finish this
// before it can reach any tab (including switching tabs to dodge it).
// Driven by that persisted Firestore field rather than local component
// state specifically so it survives a force-quit: local state reset on
// every launch, which meant closing the app mid-setup silently skipped it
// for good. Name is offered here too since it's the one guaranteed moment
// every new member sees, but year is the only field actually required to
// finish. (Notifications used to have a toggle here too — removed along
// with the one on the main Profile screen, see that file for why;
// AuthContext still auto-registers for push on sign-in regardless.)
export default function AccountSetupGate() {
  const { profile } = useAuth();
  const [nameDraft, setNameDraft] = useState('');
  const [year, setYear] = useState<StudentYear | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInitialized = useRef(false);

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
    <SafeAreaView style={styles.container}>
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

        <Pressable
          style={[styles.button, { marginTop: spacing.lg }, (!canFinish || saving) && styles.buttonDisabled]}
          onPress={finishSetup}
          disabled={!canFinish || saving}
        >
          <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Finish setup'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  button: { backgroundColor: colors.red, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
});
