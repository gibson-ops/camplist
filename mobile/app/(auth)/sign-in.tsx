import { useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../../lib/theme';
import { clerkErrorMessage, isUserNotFound } from '../../lib/clerkError';

/**
 * Email-code (OTP) entry point. One screen serves both new and returning users: we try
 * sign-in first, and fall back to sign-up when Clerk reports the identifier is unknown.
 *
 * Uses Clerk v4's "future" API, where calls RETURN `{ error }` instead of throwing.
 */
export default function SignIn() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(signIn && signUp);

  async function sendCode() {
    const identifier = email.trim();
    if (!ready || !identifier) return;
    setBusy(true);
    setError(null);

    // Returning user: create the sign-in attempt, then send the code.
    const { error: createError } = await signIn!.create({ identifier });

    if (createError && isUserNotFound(createError)) {
      // New user: create the account instead and send its verification code.
      const { error: signUpError } = await signUp!.create({ emailAddress: identifier });
      if (signUpError) {
        setError(clerkErrorMessage(signUpError, 'Could not start sign-up.'));
        setBusy(false);
        return;
      }
      const { error: sendError } = await signUp!.verifications.sendEmailCode();
      if (sendError) {
        setError(clerkErrorMessage(sendError, 'Could not send a code.'));
        setBusy(false);
        return;
      }
      setBusy(false);
      router.push({ pathname: '/(auth)/verify-otp', params: { email: identifier, mode: 'sign-up' } });
      return;
    }

    if (createError) {
      setError(clerkErrorMessage(createError, 'Could not start sign-in.'));
      setBusy(false);
      return;
    }

    const { error: sendError } = await signIn!.emailCode.sendCode();
    if (sendError) {
      setError(clerkErrorMessage(sendError, 'Could not send a code.'));
      setBusy(false);
      return;
    }

    setBusy(false);
    router.push({ pathname: '/(auth)/verify-otp', params: { email: identifier, mode: 'sign-in' } });
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Camp List</Text>
        <Text style={styles.subtitle}>Pack once. Forget nothing.</Text>

        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (!ready || busy) && styles.buttonDisabled]}
          onPress={sendCode}
          disabled={!ready || busy}
        >
          {busy ? (
            <ActivityIndicator color={theme.bg} />
          ) : (
            <Text style={styles.buttonText}>Email me a code</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  title: { color: theme.text, fontSize: 34, fontWeight: '700' },
  subtitle: { color: theme.textMuted, fontSize: 16, marginBottom: 24 },
  input: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.bg, fontSize: 16, fontWeight: '700' },
  error: { color: theme.danger, fontSize: 14 },
});
