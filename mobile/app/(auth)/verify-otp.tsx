import { useSignIn, useSignUp } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Input, Text, useTheme } from '../../design';
import { clerkErrorMessage } from '../../lib/clerkError';

/**
 * Verifies the 6-digit email code, then calls `finalize()` to promote the attempt into an
 * active Clerk session (v4's replacement for `setActive`).
 *
 * Only CLERK is activated here. The Instant session is minted separately by
 * useInstantClerkAuth, which reacts to Clerk's isSignedIn flipping true.
 */
export default function VerifyOtp() {
  const t = useTheme();
  const { email, mode } = useLocalSearchParams<{ email: string; mode: string }>();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function verify() {
    if (code.length < 6) return;
    setBusy(true);
    setError(undefined);

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
    const { error: finalizeError } = isSignUp ? await signUp!.finalize() : await signIn!.finalize();

    if (finalizeError) {
      setError(clerkErrorMessage(finalizeError, 'Could not complete sign-in.'));
      setBusy(false);
      return;
    }

    setBusy(false);
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: t.space.xl, gap: t.space.lg }}>
        <View>
          <Text variant="headline">Check your email</Text>
          <Text variant="body" tone="muted" style={{ marginTop: t.space.sm }}>
            We sent a 6-digit code to {email}
          </Text>
        </View>

        <Input
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          error={error}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          autoFocus
          editable={!busy}
          style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
        />

        <Button
          label="Verify"
          onPress={verify}
          disabled={code.length < 6}
          loading={busy}
          full
        />

        <Pressable onPress={() => router.back()} disabled={busy} style={{ paddingVertical: t.space.sm }}>
          <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
            Use a different email
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
