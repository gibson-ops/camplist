import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { db } from '../../../../lib/db';
import { useHousehold, useSession } from '../../../../lib/useSession';
import { recordReflections } from '../../../../lib/trips';
import { needsAnswer } from '../../../../lib/reflections';
import { canonicalTag, dedupeTags } from '../../../../lib/tripMeta';
import { ANSWERS, AnswerSheet } from '../../../../components/AnswerSheet';
import {
  Button,
  Chip,
  EmptyState,
  Input,
  NavRow,
  Screen,
  SectionHeader,
  Text,
  useTheme,
} from '../../../../design';

/**
 * What happened, asked once, after the trip.
 *
 * This screen is the only place the app can learn something history cannot tell it. History is
 * structurally incapable of suggesting what you FORGOT — a thing you forgot left no trace on any
 * list — so without this the loop can only ever get better at repeating itself.
 *
 * TWO QUESTIONS, AND NO MORE. Everything else the app can work out for itself, and a post-trip
 * form that asks about all forty items is one nobody finishes twice. What it genuinely cannot
 * know is why something never got ticked, and what wasn't there at all.
 *
 * Nothing here is required. Leaving with half of it answered stores half of it, because a
 * partial answer is still more than the app had.
 */
export default function ReflectScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { householdId } = useHousehold(user?.id);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(null);
  const [wished, setWished] = useState<string[]>([]);
  const [typing, setTyping] = useState('');

  const { data, isLoading } = db.useQuery(
    tripId && householdId
      ? { trips: { $: { where: { id: tripId } }, lists: { items: { group: {} } } } }
      : null,
  );

  const trip = data?.trips?.[0];
  const unanswered = useMemo(() => needsAnswer(trip?.lists ?? []), [trip?.lists]);

  const labelFor = (kind: string) => ANSWERS.find((a) => a.kind === kind)?.label;

  function addWish() {
    // Canonicalized like a tag, because "2nd lantern" / "another lantern" / "spare lantern" is
    // one fact typed three ways, and three ways is the same as none.
    const named = canonicalTag(typing, wished);
    if (!named) return;
    setWished((was) => dedupeTags([...was, named]));
    setTyping('');
  }

  function done() {
    if (householdId && tripId) {
      recordReflections({
        tripId,
        householdId,
        answers: Object.entries(answers).map(([itemId, kind]) => ({ itemId, kind })),
        wished,
      });
    }
    router.replace(`/(app)/trip/${tripId}`);
  }

  if (isLoading || !householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={t.color.signal} />
      </View>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <EmptyState
          title="That trip is gone."
          body="It may have been deleted on another device."
          actionLabel="Back to trips"
          onAction={() => router.replace('/(app)')}
        />
      </Screen>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <Screen contentStyle={{ gap: t.space.lg }}>
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.xs }}>
        <Text variant="display">How did it go?</Text>
        <Text variant="body" tone="muted">
          Two questions, and they only get asked once. What you say here is what makes the next
          list better.
        </Text>
      </View>

      {unanswered.length > 0 ? (
        <View>
          <SectionHeader
            title="Never ticked off"
            count={`${answeredCount}/${unanswered.length}`}
          />
          <View style={{ backgroundColor: t.color.surface }}>
            {unanswered.map((item, i) => (
              <NavRow
                key={item.id}
                title={item.name}
                // The answer replaces the prompt, so the row reads as a receipt once it's done.
                meta={labelFor(answers[item.id]) ?? 'What happened?'}
                isLast={i === unanswered.length - 1}
                onPress={() => setAsking(item)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
        <Text variant="label" tone="muted">
          ANYTHING YOU WISHED YOU'D HAD
        </Text>
        <Input
          value={typing}
          onChangeText={setTyping}
          placeholder="Second lantern"
          autoCapitalize="sentences"
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={addWish}
        />
        {wished.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {wished.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={false}
                onPress={() => {}}
                onDismiss={() => setWished((was) => was.filter((w) => w !== name))}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.xs, paddingTop: t.space.md }}>
        <Button label="Done" onPress={done} full />
        <Button label="Not now" variant="ghost" onPress={() => router.back()} full />
      </View>

      <AnswerSheet
        item={asking}
        onAnswer={(kind) => {
          if (asking) setAnswers((was) => ({ ...was, [asking.id]: kind }));
          setAsking(null);
        }}
        onClose={() => setAsking(null)}
      />
    </Screen>
  );
}
