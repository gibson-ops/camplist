import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, CheckRow, SectionHeader, Text, useTheme } from '../design';
import { slugify } from '../lib/tripMeta';
import { planSuggestions, type PlannedItem, type TargetList } from '../lib/itemSeeds';
import type { Suggestion } from '../lib/suggest';

/**
 * Where this list came from, in one line.
 *
 * Worth saying because the two sources earn very different amounts of trust. "Trips like this
 * usually need one" is a guess from a table someone wrote; "you packed this for the Uintas" is the
 * household's own record, and a suggestion the user can place is one they can accept at a glance
 * instead of reading twice.
 *
 * Names the closest trip rather than listing them all — one concrete trip carries the point, and
 * five names is a sentence nobody finishes.
 */
function provenance(seeds: Suggestion[]): string {
  const trips = new Map<string, string>();
  for (const seed of seeds) for (const trip of seed.from) trips.set(trip.id, trip.name);

  const [closest] = [...trips.values()];
  if (!closest) return 'From what you just told me. Untick anything you won’t take.';

  const others = trips.size - 1;
  const rest = others === 0 ? '' : others === 1 ? ' and one other trip' : ` and ${others} other trips`;
  return `From what you packed for ${closest}${rest}. Untick anything you won’t take.`;
}

/**
 * The suggested packing list, laid out the way the trip screen will lay it out.
 *
 * SAME SHAPE AS THE REAL THING. One section per list — shared first, then a person each — so
 * what gets ticked here is literally what appears afterwards. A review screen that groups
 * differently from the screen it produces makes you learn two layouts and check your work
 * twice.
 *
 * That means an `each` item shows up under every person rather than once under a heading. It's
 * longer and it's correct: three sleeping bags are three separate things to remember, and this
 * is the screen where you say Walker doesn't need his own headlamp.
 *
 * TICKED BY DEFAULT, because the failure modes aren't symmetric — an extra item costs a glance
 * to skip, a missing one costs the trip. What keeps that honest is the list being short and
 * ranked rather than everything the app knows, plus one tap to clear the lot.
 */
export function SuggestedList({
  seeds,
  lists,
  onConfirm,
  onSkip,
}: {
  seeds: Suggestion[];
  lists: TargetList[];
  onConfirm: (planned: PlannedItem[]) => void;
  onSkip: () => void;
}) {
  const t = useTheme();
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  const planned = useMemo(() => planSuggestions(seeds, lists), [seeds, lists]);
  const key = (item: PlannedItem) => `${item.listId}:${slugify(item.seed.name)}`;

  const chosen = planned.filter((item) => !dropped.has(key(item)));

  /** In list order, so it matches the trip screen: shared first, then each person. */
  const sections = lists
    .map((list) => ({ list, items: planned.filter((item) => item.listId === list.id) }))
    .filter((section) => section.items.length);

  const toggle = (item: PlannedItem) =>
    setDropped((was) => {
      const next = new Set(was);
      if (next.has(key(item))) next.delete(key(item));
      else next.add(key(item));
      return next;
    });

  return (
    <View style={{ gap: t.space.sm, flex: 1 }}>
      {sections.length ? (
        <Text variant="body" tone="muted" style={{ paddingHorizontal: t.space.lg }}>
          {provenance(seeds)}
        </Text>
      ) : null}

      {sections.map(({ list, items }) => (
        <View key={list.id}>
          <SectionHeader
            title={list.name}
            count={`${items.filter((i) => !dropped.has(key(i))).length}/${items.length}`}
          />
          <View style={{ paddingHorizontal: t.space.lg, backgroundColor: t.color.surface }}>
            {items.map((item) => (
              <CheckRow
                key={key(item)}
                label={item.seed.name}
                checked={!dropped.has(key(item))}
                // Choosing, not packing: nothing here is in a bag yet.
                meaning="choosing"
                onChange={() => toggle(item)}
              />
            ))}
          </View>
        </View>
      ))}

      {!sections.length ? (
        <Text variant="body" tone="muted">
          Nothing to suggest yet. Tell the trip a bit more and it'll have ideas.
        </Text>
      ) : null}

      <View style={{ marginTop: 'auto', gap: t.space.xs, paddingTop: t.space.lg }}>
        <Button
          label={
            chosen.length ? `Add ${chosen.length} item${chosen.length === 1 ? '' : 's'}` : 'Add nothing'
          }
          onPress={() => onConfirm(chosen)}
          full
        />
        <Button
          label={dropped.size ? 'Tick everything' : 'Untick everything'}
          variant="ghost"
          onPress={() => setDropped(dropped.size ? new Set() : new Set(planned.map(key)))}
          full
        />
        <Button label="Skip for now" variant="ghost" onPress={onSkip} full />
      </View>
    </View>
  );
}
