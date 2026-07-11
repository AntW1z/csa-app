import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { colors, radius, spacing } from '../../src/theme';

export default function ProfileScreen() {
  const { firebaseUser, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState('');

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
        <Text style={styles.header}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
        <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={submit}>
          <Text style={styles.buttonText}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
        </Pressable>
        <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          <Text style={styles.switchText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const requestMembership = async () => {
    if (!profile) return;
    await updateDoc(doc(db, 'users', profile.uid), {
      memberRequestStatus: 'pending',
      requestedAt: serverTimestamp(),
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{profile?.displayName ?? firebaseUser.email}</Text>
      <View style={styles.roleBadge}>
        <Text style={styles.roleBadgeText}>{profile?.role ?? 'user'}</Text>
      </View>
      {profile?.role === 'user' && profile.memberRequestStatus !== 'pending' && (
        <Pressable style={styles.button} onPress={requestMembership}>
          <Text style={styles.buttonText}>Request member status</Text>
        </Pressable>
      )}
      {profile?.memberRequestStatus === 'pending' && (
        <Text style={styles.pending}>Your request is pending review.</Text>
      )}
      <Pressable style={styles.signOut} onPress={() => signOut(auth)}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  header: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: colors.neutralSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: colors.neutralSoftText, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, padding: spacing.md, fontSize: 15 },
  button: { backgroundColor: colors.red, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: colors.onAccent, fontWeight: '700' },
  switchText: { color: colors.red, textAlign: 'center', marginTop: spacing.sm },
  error: { color: colors.red, fontSize: 13 },
  pending: { color: colors.amberSoftText, fontSize: 13 },
  signOut: { marginTop: spacing.xl, alignItems: 'center' },
  signOutText: { color: colors.textMuted },
});
