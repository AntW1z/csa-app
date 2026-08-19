import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, Linking, Platform, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { registerForPushNotificationsAsync } from '../../src/notifications';
import { MembershipTerm } from '../../src/types';
import { colors, radius, spacing, shadow } from '../../src/theme';
import { getAuthErrorMessage, openExternalLink } from '../../src/utils';
import { WHAT_IS_CSA } from '../../src/constants';

const PRIVACY_POLICY_URL = 'https://antw1z.github.io/csa-app/privacy-policy.html';
const TERMS_OF_SERVICE_URL = 'https://antw1z.github.io/csa-app/terms-of-service.html';

const termLabel = (term?: MembershipTerm) => (term === 'year' ? 'Full Year' : term === 'semester' ? 'Semester' : null);

export default function ProfileScreen() {
  const { firebaseUser, profile, loading, skipAutoCreateProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  // Only gates account *creation* — signing into an existing account
  // doesn't re-collect anything new, so there's nothing fresh to consent
  // to there. Required (not just shown) before Create account will submit.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showMemberInfo, setShowMemberInfo] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'reauth'>('idle');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [notifStatus, setNotifStatus] = useState<Notifications.PermissionStatus | 'checking'>('checking');
  const [notifToggleError, setNotifToggleError] = useState('');
  const [savingNotifToggle, setSavingNotifToggle] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [showCsaInfo, setShowCsaInfo] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    Notifications.getPermissionsAsync().then(({ status }) => setNotifStatus(status));
  }, [firebaseUser]);

  // This screen never unmounts across sign-out, account deletion, or
  // signing into a different account — it's the same persistent tab
  // instance the whole time. Without this, leftover UI state from a
  // previous session (e.g. the delete-account flow sitting on "confirm
  // your password" after a successful reauth-and-delete) stays put and
  // reappears the next time someone's signed in, even on a brand new
  // account that never touched any of it.
  useEffect(() => {
    if (firebaseUser) return;
    setEditingName(false);
    setNameDraft('');
    setShowMemberInfo(false);
    setDeleteStep('idle');
    setDeletePassword('');
    setDeleteError('');
    setDeleting(false);
    setShowChangePassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setChangePasswordError('');
    setPasswordChanged(false);
    setShowCsaInfo(false);
    setShowFeedback(false);
    setFeedbackMessage('');
    setFeedbackSubmitting(false);
    setFeedbackSubmitted(false);
    setFeedbackError('');
    setNotifToggleError('');
    setSavingNotifToggle(false);
  }, [firebaseUser]);

  // Once the OS permission is actually granted, the switch controls a
  // pure in-app preference (notificationsEnabled) — there's no API to
  // revoke OS notification permission from inside an app, so this field is
  // what actually determines whether Manage's sends include this device
  // (see the recipient filters in moderator.tsx and functions/src). Before
  // permission is granted, there's nothing to toggle off yet, so it falls
  // through to requesting it instead.
  const handleNotifToggle = async (nextValue: boolean) => {
    // Guards against rapid double-taps racing each other — each call is a
    // separate async updateDoc with no ordering guarantee, so two in
    // flight at once could resolve out of order and leave Firestore
    // reflecting the *first* tap instead of the most recent one. Disabling
    // the switch for the duration of one write closes that window.
    if (notifStatus === 'checking' || savingNotifToggle) return;
    setNotifToggleError('');
    setSavingNotifToggle(true);
    try {
      if (notifStatus === 'granted') {
        if (!profile) return;
        await updateDoc(doc(db, 'users', profile.uid), { notificationsEnabled: nextValue });
        return;
      }
      if (!nextValue) return;
      if (notifStatus === 'denied') {
        // openSettings() opens the OS Settings app — there's no equivalent
        // on web, where notification permission lives in the browser's own
        // site-settings UI instead, so there's nothing useful to jump to.
        if (Platform.OS !== 'web') Linking.openSettings();
        return;
      }
      if (!profile) return;
      await registerForPushNotificationsAsync(profile.uid);
      const { status } = await Notifications.getPermissionsAsync();
      setNotifStatus(status);
    } catch (err) {
      // This whole function used to have no error handling at all — a
      // failed updateDoc (or anything else in here) was an unhandled
      // promise rejection, which outside dev mode can fail completely
      // silently with nothing shown, making "the toggle doesn't work"
      // impossible to diagnose from the UI alone.
      console.warn('Notification toggle failed:', err);
      setNotifToggleError('Something went wrong — try again.');
    } finally {
      setSavingNotifToggle(false);
    }
  };

  if (loading) return null;

  // Not signed in: this is the ONLY place the app ever asks for an account.
  if (!firebaseUser) {
    const canSubmit = mode === 'signin' || agreedToTerms;

    const submit = async () => {
      if (!canSubmit) return;
      setError('');
      try {
        if (mode === 'signup') {
          await createUserWithEmailAndPassword(auth, email, password);
          // AuthContext creates the profile doc with needsSetup: true, and
          // the root layout (see AccountSetupGate) takes over from there —
          // nothing else to do here.
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
      } catch (e: any) {
        setError(getAuthErrorMessage(e.code));
      }
    };

    return (
      <View style={styles.container}>
        <View style={styles.form}>
          <Text style={styles.header}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
          {mode === 'signup' && (
            <Pressable style={styles.agreeRow} onPress={() => setAgreedToTerms((v) => !v)} hitSlop={4}>
              <Ionicons
                name={agreedToTerms ? 'checkbox' : 'square-outline'}
                size={20}
                color={agreedToTerms ? colors.red : colors.textMuted}
              />
              <Text style={styles.agreeText}>
                I agree to the{' '}
                <Text style={styles.agreeLink} onPress={() => openExternalLink(TERMS_OF_SERVICE_URL)}>
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text style={styles.agreeLink} onPress={() => openExternalLink(PRIVACY_POLICY_URL)}>
                  Privacy Policy
                </Text>
              </Text>
            </Pressable>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={submit} disabled={!canSubmit}>
            <Text style={styles.buttonText}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setAgreedToTerms(false); }}>
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

  const closeChangePassword = () => {
    setShowChangePassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setChangePasswordError('');
    setPasswordChanged(false);
  };

  const changePassword = async () => {
    if (!firebaseUser?.email) return;
    setChangingPassword(true);
    setChangePasswordError('');
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      setPasswordChanged(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setChangePasswordError(getAuthErrorMessage(err.code));
    } finally {
      setChangingPassword(false);
    }
  };

  const closeCsaInfo = () => setShowCsaInfo(false);

  const closeFeedback = () => {
    setShowFeedback(false);
    setFeedbackMessage('');
    setFeedbackSubmitted(false);
    setFeedbackError('');
  };

  const submitFeedback = async () => {
    if (!profile || !feedbackMessage.trim()) return;
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      await addDoc(collection(db, 'feedback'), {
        message: feedbackMessage.trim(),
        submittedByUid: profile.uid,
        submittedByName: profile.displayName,
        submittedByEmail: profile.email,
        createdAt: serverTimestamp(),
      });
      setFeedbackMessage('');
      setFeedbackSubmitted(true);
    } catch (err) {
      console.warn('Feedback submit failed:', err);
      setFeedbackError('Something went wrong sending that — try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const closeDeleteFlow = () => {
    setDeleteStep('idle');
    setDeletePassword('');
    setDeleteError('');
    skipAutoCreateProfile.current = false;
  };

  // Firestore doc goes first, while still authenticated as this uid — once
  // deleteUser() succeeds, auth.currentUser drops immediately and a
  // self-scoped delete would no longer be permitted. skipAutoCreateProfile
  // stops AuthContext's listener from recreating a blank profile in the
  // moment between the doc disappearing and the auth account actually
  // being gone (see src/context/AuthContext.tsx).
  const performDelete = async () => {
    if (!firebaseUser || !profile) return;
    setDeleting(true);
    setDeleteError('');
    skipAutoCreateProfile.current = true;
    try {
      await deleteDoc(doc(db, 'users', profile.uid));
      await deleteUser(firebaseUser);
      // Success: onAuthStateChanged fires with null and resets everything.
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setDeleteStep('reauth');
      } else {
        setDeleteError(getAuthErrorMessage(err.code));
        skipAutoCreateProfile.current = false;
      }
    } finally {
      setDeleting(false);
    }
  };

  const reauthAndDelete = async () => {
    if (!firebaseUser?.email) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, deletePassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      // The Firestore doc was already deleted in performDelete before it
      // hit the recent-login error — just the auth account is left.
      await deleteUser(firebaseUser);
    } catch (err: any) {
      setDeleteError(err.code === 'auth/invalid-credential' ? 'Incorrect password.' : getAuthErrorMessage(err.code));
    } finally {
      setDeleting(false);
    }
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

        <View style={styles.settingsGroup}>
          <Pressable style={styles.settingsRow} onPress={() => setShowChangePassword(true)}>
            <View style={styles.settingsIcon}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.red} />
            </View>
            <Text style={styles.settingsLabel}>Change password</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.settingsRow, { flexWrap: 'wrap' }]}>
            <View style={styles.settingsIcon}>
              <Ionicons name="notifications-outline" size={16} color={colors.red} />
            </View>
            <Text style={styles.settingsLabel}>Notifications</Text>
            <Switch
              value={notifStatus === 'granted' && profile?.notificationsEnabled !== false}
              onValueChange={handleNotifToggle}
              disabled={notifStatus === 'checking' || savingNotifToggle}
              trackColor={{ true: '#34C759', false: colors.borderStrong }}
            />
            {notifToggleError ? <Text style={[styles.error, { width: '100%', marginTop: spacing.xs }]}>{notifToggleError}</Text> : null}
          </View>

          <Pressable style={styles.settingsRow} onPress={() => setShowCsaInfo(true)}>
            <View style={styles.settingsIcon}>
              <Ionicons name="information-circle-outline" size={16} color={colors.red} />
            </View>
            <Text style={styles.settingsLabel}>What is CSA?</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable style={[styles.settingsRow, styles.settingsRowLast]} onPress={() => setShowFeedback(true)}>
            <View style={styles.settingsIcon}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.red} />
            </View>
            <Text style={styles.settingsLabel}>Feedback</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.footerWrap}>
          <Text style={styles.versionText}>Version {Constants.expoConfig?.version ?? '—'}</Text>
          <View style={styles.footerLinksRow}>
            <Text style={styles.footerLink} onPress={() => openExternalLink(PRIVACY_POLICY_URL)}>
              Privacy Policy
            </Text>
            <Text style={styles.footerLinkDivider}>·</Text>
            <Text style={styles.footerLink} onPress={() => openExternalLink(TERMS_OF_SERVICE_URL)}>
              Terms of Service
            </Text>
          </View>
        </View>

        <View style={styles.signOutWrap}>
          <Pressable style={styles.signOutBtn} onPress={() => signOut(auth)}>
            <Ionicons name="log-out-outline" size={18} color={colors.red} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
          <Pressable style={styles.deleteAccountLink} onPress={() => setDeleteStep('confirm')} hitSlop={8}>
            <Text style={styles.deleteAccountText}>Delete account</Text>
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

      <Modal visible={showChangePassword} transparent animationType="fade" onRequestClose={closeChangePassword}>
        <Pressable style={styles.overlay} onPress={closeChangePassword}>
          <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.closeBtn} onPress={closeChangePassword} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.infoTitle}>Change password</Text>
            {passwordChanged ? (
              <Text style={styles.pending}>Password updated.</Text>
            ) : (
              <>
                <Text style={styles.infoBody}>Enter your current password, then choose a new one.</Text>
                <TextInput
                  style={[styles.input, { marginTop: spacing.md }]}
                  placeholder="Current password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]}
                  placeholder="New password (min. 6 characters)"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  onSubmitEditing={changePassword}
                />
                {changePasswordError ? <Text style={styles.error}>{changePasswordError}</Text> : null}
                <Pressable
                  style={[
                    styles.button,
                    { marginTop: spacing.md },
                    (changingPassword || !currentPassword || newPassword.length < 6) && styles.buttonDisabled,
                  ]}
                  onPress={changePassword}
                  disabled={changingPassword || !currentPassword || newPassword.length < 6}
                >
                  <Text style={styles.buttonText}>{changingPassword ? 'Updating…' : 'Update password'}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCsaInfo} transparent animationType="fade" onRequestClose={closeCsaInfo}>
        <Pressable style={styles.overlay} onPress={closeCsaInfo}>
          <Pressable style={[styles.infoCard, { maxHeight: '80%' }]} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.closeBtn} onPress={closeCsaInfo} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.infoTitle}>What is CSA?</Text>
              <Text style={styles.infoBody}>{WHAT_IS_CSA}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showFeedback} transparent animationType="fade" onRequestClose={closeFeedback}>
        <Pressable style={styles.overlay} onPress={closeFeedback}>
          <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.closeBtn} onPress={closeFeedback} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.infoTitle}>Feedback</Text>
            {feedbackSubmitted ? (
              <Text style={styles.pending}>Thanks — an officer will take a look.</Text>
            ) : (
              <>
                <Text style={styles.infoBody}>Have a suggestion or found a bug? Let us know.</Text>
                <TextInput
                  style={[styles.input, styles.feedbackInput, { marginTop: spacing.md }]}
                  placeholder="Tell us what's up..."
                  placeholderTextColor={colors.textMuted}
                  value={feedbackMessage}
                  onChangeText={setFeedbackMessage}
                  multiline
                />
                {feedbackError ? <Text style={styles.error}>{feedbackError}</Text> : null}
                <Pressable
                  style={[styles.button, { marginTop: spacing.sm }, (feedbackSubmitting || !feedbackMessage.trim()) && styles.buttonDisabled]}
                  onPress={submitFeedback}
                  disabled={feedbackSubmitting || !feedbackMessage.trim()}
                >
                  <Text style={styles.buttonText}>{feedbackSubmitting ? 'Sending…' : 'Send'}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={deleteStep !== 'idle'} transparent animationType="fade" onRequestClose={closeDeleteFlow}>
        <Pressable style={styles.overlay} onPress={closeDeleteFlow}>
          <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.closeBtn} onPress={closeDeleteFlow} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>

            {deleteStep === 'confirm' && (
              <>
                <Text style={styles.infoTitle}>Delete your account?</Text>
                <Text style={styles.infoBody}>
                  This permanently deletes your profile and membership status. This cannot be undone.
                </Text>
                {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                  <Pressable
                    style={[styles.dangerBtn, deleting && styles.buttonDisabled]}
                    onPress={performDelete}
                    disabled={deleting}
                  >
                    <Text style={styles.buttonText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={closeDeleteFlow}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )}

            {deleteStep === 'reauth' && (
              <>
                <Text style={styles.infoTitle}>Confirm your password</Text>
                <Text style={styles.infoBody}>
                  For your security, deleting an account requires signing in again. Enter your password to finish.
                </Text>
                <TextInput
                  style={[styles.input, { marginTop: spacing.md }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  autoFocus
                />
                {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <Pressable
                    style={[styles.dangerBtn, (deleting || !deletePassword) && styles.buttonDisabled]}
                    onPress={reauthAndDelete}
                    disabled={deleting || !deletePassword}
                  >
                    <Text style={styles.buttonText}>{deleting ? 'Deleting…' : 'Confirm & delete'}</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={closeDeleteFlow}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
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
  settingsGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  footerWrap: { alignItems: 'center', gap: spacing.xs },
  versionText: { textAlign: 'center', fontSize: 12, color: colors.textMuted },
  footerLinksRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  footerLink: { fontSize: 12, color: colors.red, fontWeight: '600' },
  footerLinkDivider: { fontSize: 12, color: colors.textMuted },
  feedbackInput: { minHeight: 80, textAlignVertical: 'top' },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
  button: { backgroundColor: colors.red, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
  switchText: { color: colors.red, textAlign: 'center', marginTop: spacing.sm },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  agreeText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  agreeLink: { color: colors.red, fontWeight: '600' },
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
  deleteAccountLink: { alignItems: 'center', marginTop: spacing.md },
  deleteAccountText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  dangerBtn: { flex: 1, backgroundColor: colors.red, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  closeBtn: { alignSelf: 'flex-end', marginBottom: spacing.xs },
  infoTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  infoBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
