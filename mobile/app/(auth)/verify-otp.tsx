import { useSignIn, useSignUp } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../lib/theme';
import { clerkErrorMessage } from '../../lib/clerkError';

/**
 * Verifies the 6-digit email code, then calls `finalize()` to promote the attempt into an
 * active Clerk session (v4's replacement for `setActive`).
 *
 * Only CLERK is activated here. The Instant session is minted separately by
 * useInstantClerkAuth, which reacts to Clerk's isSignedIn flipping true.
 */
export default function VerifyOtp() {
  const { email, mode } = useLocalSearchParams<{ email: string; mode: string }>();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (code.length < 6) return;
    setBusy(true);
    setError(null);

    const isSignUp = mode === 'sign-up';

    const { error: verifyError } = isSignUp
      ? await signUp!.verifications.verifyEmailCode({ code })
      : await signIn!.emailCode.verifyCode({ code });

    if (verifyError) {
      setError(clerkErrorMessage(verifyError, 'That code was not accepted.'));
      setBusy(false);
      return;
    }

    // Promote the completed attempt into the active session.
    const { error: finalizeError } = isSignUp
      ? await signUp!.finalize()
      : await signIn!.finalize();

    if (finalizeError) {
      setError(clerkErrorMessage(finalizeError, 'Could not complete sign-in.'));
      setBusy(false);
      return;
    }

    setBusy(false);
    router.replace('/');
  }

  return (
    <View style={styles.screen}>
      <View style={styles.inner}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor={theme.textMuted}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          autoFocus
          editable={!busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (busy || code.length < 6) && styles.buttonDisabled]}
          onPress={verify}
          disabled={busy || code.length < 6}
        >
          {busy ? (
            <ActivityIndicator color={theme.bg} />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={busy}>
          <Text style={styles.link}>Use a different email</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  title: { color: theme.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: theme.textMuted, fontSize: 15, marginBottom: 20 },
  input: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.bg, fontSize: 16, fontWeight: '700' },
  link: { color: theme.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  error: { color: theme.danger, fontSize: 14 },
});
