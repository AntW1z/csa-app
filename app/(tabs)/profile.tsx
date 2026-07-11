import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../src/firebase';
import { useAuth } from '../../src/context/AuthContext';

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
      <Text style={styles.role}>Status: {profile?.role ?? 'user'}</Text>
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
  container: { flex: 1, backgroundColor: '#fff', padding: 20, gap: 12, justifyContent: 'center' },
  header: { fontSize: 20, fontWeight: '600' },
  role: { fontSize: 14, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#A32D2D', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  switchText: { color: '#A32D2D', textAlign: 'center', marginTop: 8 },
  error: { color: '#A32D2D', fontSize: 13 },
  pending: { color: '#854F0B', fontSize: 13 },
  signOut: { marginTop: 24, alignItems: 'center' },
  signOutText: { color: '#888' },
});
