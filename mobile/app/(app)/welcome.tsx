import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { db } from '../../lib/db';
import { useHousehold, useSession, useStrandedRecorder } from '../../lib/useSession';
import { addPerson, finishOnboarding, renameHousehold, renamePerson } from '../../lib/trips';
import { SignInSheet } from '../../components/SignInSheet';
import { NameSheet } from '../../components/NameSheet';
import { AddRow, Button, Input, NavRow, Screen, SectionHeader, Text, useTheme } from '../../design';

/**
 * First run: who this is, who they pack for, and a way past all of it.
 *
 * THE ESCAPE HATCH IS THE POINT OF THE FIRST SCREEN. A fresh install and a fresh device look
 * identical to the app, and the person holding it is the only one who knows which it is — so the
 * one thing onboarding must never do is make a returning user introduce themselves again. Signing
 * in skips everything, because their profile arrives with `onboardedAt` already on it.
 *
 * WHO YOU PACK FOR IS NOT A NICETY. `createTrip` seeds one list per attendee, and adding someone
 * later does NOT give them lists on trips that already exist. Skip this and the first trip is a
 * single anonymous list forever — which is the one screen that would have shown what the app is
 * actually for.
 *
 * Nothing here is required. Every step can be passed over, and the trip that follows is worth
 * having either way; this is pacing, not a gate.
 */
export default function WelcomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const { householdId, profileId, personId, pendingMerge } = useHousehold(user?.id);

  const [step, setStep] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [name, setName] = useState('');
  const [addingPerson, setAddingPerson] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const recordStranded = useStrandedRecorder(profileId, pendingMerge);

  const { data } = db.useQuery(householdId ? { people: { $: { where: { householdId } } } } : null);
  const people = [...(data?.people ?? [])].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );

  /** Onboarding ends by handing straight off to the first trip, never to an empty home screen. */
  function done() {
    if (profileId) finishOnboarding(profileId);
    router.replace('/(app)/trip/new');
  }

  if (!householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  return (
    <Screen contentStyle={{ flexGrow: 1, gap: t.space.lg }}>
      {step === 0 ? (
        <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg, flex: 1 }}>
          <View style={{ gap: t.space.sm, marginTop: t.space.xl }}>
            <Text variant="display">Camp List</Text>
            <Text variant="body" tone="muted">
              Packing lists that get better every trip. Tell it about a trip and it works out what
              you&rsquo;ll need — from what you packed last time, not from a template.
            </Text>
          </View>

          <View style={{ marginTop: 'auto', gap: t.space.xs }}>
            <Button label="Get started" onPress={() => setStep(1)} full />
            {/* The one thing a brand new user can't be asked to know is whether they're brand
                new. So this is offered rather than detected — and once they sign in, their
                profile arrives already onboarded and the rest of this never appears. */}
            <Button
              label="I already have an account"
              variant="ghost"
              onPress={() => setSigningIn(true)}
              full
            />
          </View>
        </View>
      ) : step === 1 ? (
        <View style={{ paddingHorizontal: t.space.lg, gap: t.space.lg, flex: 1 }}>
          <Text variant="display">What should we call your household?</Text>
          <Text variant="body" tone="muted">
            It shows up when you invite someone later. &ldquo;My household&rdquo; works fine.
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="The Gibsons"
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => setStep(2)}
          />
          <View style={{ marginTop: 'auto', gap: t.space.xs }}>
            <Button
              label="Next"
              onPress={() => {
                if (name.trim()) renameHousehold(householdId, name.trim());
                setStep(2);
              }}
              full
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: t.space.lg, flex: 1 }}>
          <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
            <Text variant="display">Who do you pack for?</Text>
            <Text variant="body" tone="muted">
              Everyone here gets their own list on a trip, so nobody&rsquo;s sleeping bag ends up
              being somebody else&rsquo;s problem. You can add more later.
            </Text>
          </View>

          <View>
            <SectionHeader title="Household" />
            <View style={{ backgroundColor: t.color.surface }}>
              {people.map((person) => (
                <NavRow
                  key={person.id}
                  title={person.name}
                  // The bootstrap calls the first person "Me". Renaming it here is the natural
                  // moment: it's the only screen where the word sits next to real names.
                  meta={person.id === personId ? 'You' : undefined}
                  onPress={() => setEditing({ id: person.id, name: person.name })}
                />
              ))}
              <AddRow label="Add someone" onPress={() => setAddingPerson(true)} isLast />
            </View>
          </View>

          <View style={{ paddingHorizontal: t.space.lg, marginTop: 'auto', gap: t.space.xs }}>
            <Button label="Start my first trip" onPress={done} full />
          </View>
        </View>
      )}

      <SignInSheet
        visible={signingIn}
        guest={householdId ? { household: householdId, person: personId } : undefined}
        onClose={() => setSigningIn(false)}
        onSignedIn={({ stranded }) => {
          setSigningIn(false);
          recordStranded(stranded);
          // Straight to the app: a returning user has trips already, and the last thing they
          // want is to be walked through setting up a household they set up years ago.
          router.replace('/(app)');
        }}
      />

      <NameSheet
        visible={addingPerson}
        title="Add someone"
        placeholder="Brooke"
        submitLabel="Add"
        onSubmit={(personName) => addPerson({ householdId, name: personName })}
        onClose={() => setAddingPerson(false)}
      />

      <NameSheet
        visible={Boolean(editing)}
        title="Name"
        placeholder="Walker"
        initialValue={editing?.name ?? ''}
        onSubmit={(next) => editing && renamePerson(editing.id, next)}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}
