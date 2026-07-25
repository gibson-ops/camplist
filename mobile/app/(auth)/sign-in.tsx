import { useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Input, Text, useTheme } from '../../design';
import { clerkErrorMessage, isUserNotFound } from '../../lib/clerkError';

/**
 * Email-code (OTP) entry point. One screen serves both new and returning users: we try
 * sign-in first, and fall back to sign-up when Clerk reports the identifier is unknown.
 *
 * Uses Clerk v4's "future" API, where calls RETURN `{ error }` instead of throwing.
 */
export default function SignIn() {
  const t = useTheme();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const ready = Boolean(signIn && signUp);

  async function sendCode() {
    const identifier = email.trim();
    if (!ready || !identifier) return;
    setBusy(true);
    setError(undefined);

    const { error: createError } = await signIn!.create({ identifier });

    // Unknown identifier means this is a new user: create the account instead.
    if (createError && isUserNotFound(createError)) {
      const { error: signUpError } = await signUp!.create({ emailAddress: identifier });
      if (signUpError) return fail(signUpError, 'Could not start sign-up.');

      const { error: sendError } = await signUp!.verifications.sendEmailCode();
      if (sendError) return fail(sendError, 'Could not send a code.');

      setBusy(false);
      router.push({ pathname: '/(auth)/verify-otp', params: { email: identifier, mode: 'sign-up' } });
      return;
    }

    if (createError) return fail(createError, 'Could not start sign-in.');

    const { error: sendError } = await signIn!.emailCode.sendCode();
    if (sendError) return fail(sendError, 'Could not send a code.');

    setBusy(false);
    router.push({ pathname: '/(auth)/verify-otp', params: { email: identifier, mode: 'sign-in' } });
  }

  function fail(err: unknown, fallback: string) {
    setError(clerkErrorMessage(err, fallback));
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: t.space.xl, gap: t.space.lg }}>
        <View>
          <Text variant="display">Camp List</Text>
          <Text variant="body" tone="muted" style={{ marginTop: t.space.sm }}>
            Pack once. Forget nothing.
          </Text>
        </View>

        <Input
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          onSubmitEditing={sendCode}
          returnKeyType="go"
        />

        <Button
          label="Email me a code"
          onPress={sendCode}
          disabled={!ready || !email.trim()}
          loading={busy}
          full
        />
      </View>
    </KeyboardAvoidingView>
  );
}
