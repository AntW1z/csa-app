import { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { MembershipTerm } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';

const termLabel = (term?: MembershipTerm) => (term === 'year' ? 'Full Year' : term === 'semester' ? 'Semester' : null);

export default function ProfileScreen() {
  const { firebaseUser, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showMemberInfo, setShowMemberInfo] = useState(false);

  if (loading) return null;

  // Not signed in: this is the ONLY place the app ever asks for an account.
  if (!firebaseUser) {
    const submit = async () => {
      setError('');
      try {
        if (mode === 'signup') {
          await createUserWithEmailAndPassword(auth, email, password);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
      } catch (e: any) {
        setError(e.message);
      }
    };

    return (
      <View style={styles.container}>
        <View style={styles.form}>
          <Text style={styles.header}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
          </Pressable>
          <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
            <Text style={styles.switchText}>
              {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </Pressable>
          <Text style={styles.notifHint}>
            Want to hear about CSA events the moment they're posted? Sign up for an account to get
            real-time notifications from the club!
          </Text>
        </View>
      </View>
    );
  }

  // Term (full year vs. semester) is decided by the moderator/admin at
  // approval time in Manage, not chosen here — this is just a request.
  const requestMembership = async () => {
    if (!profile) return;
    await updateDoc(doc(db, 'users', profile.uid), {
      memberRequestStatus: 'pending',
      requestedAt: serverTimestamp(),
    });
    setShowMemberInfo(false);
  };

  const startEditName = () => {
    setNameDraft(profile?.displayName ?? '');
    setEditingName(true);
  };

  const saveName = async () => {
    if (!profile || !nameDraft.trim()) return;
    await updateDoc(doc(db, 'users', profile.uid), { displayName: nameDraft.trim() });
    setEditingName(false);
  };

  const displayName = profile?.displayName ?? firebaseUser.email ?? '?';
  const initial = displayName.charAt(0).toUpperCase();
  const role = profile?.role ?? 'user';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const isPending = profile?.memberRequestStatus === 'pending';
  const isMemberOrAbove = role !== 'user';

  // Shows the actual account email alongside "Yes" — the point is that if a
  // paid login gets shared around, everyone using it sees the same email
  // here no matter what display name they've set for themselves.
  const memberValue = isPending ? 'Pending' : isMemberOrAbove ? 'Yes' : 'No';
  const memberSubtitle = isMemberOrAbove
    ? [firebaseUser.email, termLabel(profile?.membershipTerm)].filter(Boolean).join(' · ')
    : isPending
    ? 'Awaiting moderator review'
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.signedInGroup}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                onSubmitEditing={saveName}
              />
              <Pressable onPress={saveName} hitSlop={8}>
                <Ionicons name="checkmark-circle" size={24} color={colors.red} />
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.nameRow} onPress={startEditName} hitSlop={8}>
              <Text style={styles.name}>{displayName}</Text>
              <Ionicons name="pencil" size={16} color={colors.textMuted} />
            </Pressable>
          )}

          {(role === 'moderator' || role === 'admin') && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.memberRow} onPress={() => setShowMemberInfo(true)}>
          <View style={styles.memberRowIcon}>
            <Ionicons name="ribbon-outline" size={18} color={colors.red} />
          </View>
          <View style={styles.memberRowContent}>
            <Text style={styles.memberRowLabel}>Member: {memberValue}</Text>
            {memberSubtitle ? <Text style={styles.memberRowSubtitle}>{memberSubtitle}</Text> : null}
          </View>
          <Ionicons name="help-circle-outline" size={22} color={colors.textMuted} />
        </Pressable>

        <View style={styles.signOutWrap}>
          <Pressable style={styles.signOutBtn} onPress={() => signOut(auth)}>
            <Ionicons name="log-out-outline" size={18} color={colors.red} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={showMemberInfo} transparent animationType="fade" onRequestClose={() => setShowMemberInfo(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowMemberInfo(false)}>
          <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.closeBtn} onPress={() => setShowMemberInfo(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.infoTitle}>What is a member?</Text>
            <Text style={styles.infoBody}>
              Members get access to members-only posts and events, plus voting rights at general body
              meetings. Membership runs either a full academic year or a single semester, depending on
              what you paid for — ask an officer if you're not sure which applies to you.
              {'\n\n'}(Filler text — customize this for your club.)
            </Text>

            {!isMemberOrAbove && !isPending && (
              <Pressable style={[styles.button, { marginTop: spacing.lg }]} onPress={requestMembership}>
                <Text style={styles.buttonText}>Request member status</Text>
              </Pressable>
            )}
            {isPending && <Text style={styles.pending}>Your request is pending review.</Text>}
            {isMemberOrAbove && (
              <Text style={styles.pending}>You're a {termLabel(profile?.membershipTerm) ?? 'current'} member.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, justifyContent: 'center' },
  form: { gap: spacing.md },
  signedInGroup: { gap: spacing.xl },
  header: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  identity: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  avatarText: { color: colors.onAccent, fontSize: 32, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  name: { fontSize: 30, fontWeight: '800', color: colors.textPrimary },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 18,
    minWidth: 160,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  roleBadge: { backgroundColor: colors.neutralSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: colors.neutralSoftText, textTransform: 'uppercase', letterSpacing: 0.3 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  memberRowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRowContent: { flex: 1, gap: 2 },
  memberRowLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  memberRowSubtitle: { fontSize: 12, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
  button: { backgroundColor: colors.red, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
  switchText: { color: colors.red, textAlign: 'center', marginTop: spacing.sm },
  notifHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.lg, lineHeight: 17 },
  error: { color: colors.red, fontSize: 13 },
  pending: { color: colors.amberSoftText, fontSize: 13, textAlign: 'center', marginTop: spacing.md },
  signOutWrap: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  signOutText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  closeBtn: { alignSelf: 'flex-end', marginBottom: spacing.xs },
  infoTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  infoBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
