import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Sheet, Text, useTheme } from '../design';
import { sendCode, signIn } from '../lib/useSession';
import type { StrandedHousehold } from '../lib/merge';

/**
 * Signing in, in two plain steps.
 *
 * A CODE RATHER THAN A PASSWORD, which is what makes this worth doing at all here. There is no
 * password to forget, nothing to store, and the whole flow is two fields — so the ask stays small
 * enough to make from a screen someone reached by accident, on a phone, outdoors.
 *
 * The point is never "make an account". It's that the trips you already have follow you to the
 * next device, so that's what the copy says. An app that asks people to sign up before it has
 * done anything for them is asking on credit; this one asks after four trips.
 *
 * @param guest the household and own-person this device is using right now. Captured by the
 *              CALLER, before the identity changes underneath it — afterwards the household is
 *              gone from view and the person can't be identified at all, because a linked guest's
 *              profile isn't readable.
 */
export function SignInSheet({
  visible,
  guest,
  onClose,
  onSignedIn,
}: {
  visible: boolean;
  guest?: StrandedHousehold;
  onClose: () => void;
  onSignedIn: (result: { stranded?: StrandedHousehold }) => void;
}) {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    if (visible) return;
    setEmail('');
    setCode('');
    setSent(false);
    setProblem(undefined);
  }, [visible]);

  /** Instant puts the useful part on `body.message`; the Error's own message is a status line. */
  const explain = (err: unknown) =>
    (err as { body?: { message?: string } })?.body?.message ??
    (err as { message?: string })?.message ??
    'That did not work. Try again.';

  async function send() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setProblem(undefined);
    try {
      await sendCode(email);
      setSent(true);
    } catch (err) {
      setProblem(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setProblem(undefined);
    try {
      onSignedIn(await signIn({ email, code, guest }));
    } catch (err) {
      setProblem(explain(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={sent ? 'Check your email' : 'Keep your trips'}
    >
      <Text variant="body" tone="muted">
        {sent
          ? `We sent a six-digit code to ${email.trim()}.`
          : 'Sign in and your trips follow you to any device. No password — just a code by email.'}
      </Text>

      {sent ? (
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={verify}
        />
      ) : (
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={send}
        />
      )}

      {problem ? (
        <Text variant="body" tone="danger">
          {problem}
        </Text>
      ) : null}

      <View style={{ gap: t.space.xs }}>
        <Button
          label={sent ? 'Sign in' : 'Send me a code'}
          onPress={sent ? verify : send}
          disabled={sent ? !code.trim() : !email.trim()}
          loading={busy}
          full
        />
        {sent ? (
          // Going back rather than resending: a wrong address is the likely reason the code never
          // turned up, and resending to the same wrong address is the one thing that can't help.
          <Button
            label="Use a different email"
            variant="ghost"
            onPress={() => setSent(false)}
            full
          />
        ) : null}
      </View>
    </Sheet>
  );
}
