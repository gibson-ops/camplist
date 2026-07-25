import { useAuth, useUser } from '@clerk/expo';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { db } from '../../lib/db';
import { signOutEverywhere, useInstantClerkAuth } from '../../lib/useInstantClerkAuth';
import { theme } from '../../lib/theme';

/**
 * M0 spike screen. Its only job is to prove the Clerk → InstantDB bridge end-to-end:
 *   1. Clerk holds a session (email visible).
 *   2. Instant minted its OWN session from Clerk's id token (auth.id + matching email).
 *   3. Permissioned queries run as that Instant identity (the household query below
 *      returns data only once the access cache links this profile to a household).
 *
 * Replace with the real trip list in M1.
 */
export default function SpikeScreen() {
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const { instantUser, error } = useInstantClerkAuth();

  // Runs under the CEL rules — proves permissions are live, not that data exists.
  const { data, isLoading, error: queryError } = db.useQuery({
    profiles: {
      households: {},
      $user: {},
    },
  });

  const profile = data?.profiles?.[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Clerk → Instant bridge</Text>

      <Section title="1 · Clerk session">
        <Row label="signed in" value={clerkUser ? 'yes' : 'no'} ok={Boolean(clerkUser)} />
        <Row label="email" value={clerkUser?.primaryEmailAddress?.emailAddress ?? '—'} />
      </Section>

      <Section title="2 · Instant session">
        <Row label="auth.id" value={instantUser?.id ?? '—'} ok={Boolean(instantUser?.id)} />
        <Row label="email" value={instantUser?.email ?? '—'} ok={Boolean(instantUser?.email)} />
        <Row
          label="emails match"
          value={
            instantUser?.email && clerkUser?.primaryEmailAddress?.emailAddress
              ? String(instantUser.email === clerkUser.primaryEmailAddress.emailAddress)
              : '—'
          }
          ok={instantUser?.email === clerkUser?.primaryEmailAddress?.emailAddress}
        />
        {error ? <Text style={styles.error}>{String(error.message ?? error)}</Text> : null}
      </Section>

      <Section title="3 · Permissioned query">
        <Row label="status" value={isLoading ? 'loading…' : queryError ? 'error' : 'ok'} ok={!queryError && !isLoading} />
        <Row label="profile row" value={profile ? profile.name : 'none yet (needs bootstrap)'} />
        <Row label="households" value={String(profile?.households?.length ?? 0)} />
        {queryError ? (
          <Text style={styles.error}>{String(queryError.message ?? queryError)}</Text>
        ) : null}
      </Section>

      <Text style={styles.hint}>
        No profile row is expected until the household bootstrap runs — the perms make
        profile/membership writes server-only on purpose.
      </Text>

      <Pressable style={styles.button} onPress={() => signOutEverywhere(signOut)}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          ok === true && { color: theme.accent },
          ok === false && { color: theme.danger },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 24, paddingTop: 72, gap: 16 },
  title: { color: theme.text, fontSize: 24, fontWeight: '700', marginBottom: 4 },
  section: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { color: theme.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: theme.textMuted, fontSize: 14 },
  rowValue: { color: theme.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  hint: { color: theme.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: theme.danger, fontSize: 13, marginTop: 4 },
  button: {
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: theme.textMuted, fontSize: 15, fontWeight: '600' },
});
