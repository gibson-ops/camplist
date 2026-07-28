import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, CheckRow, Text, useTheme } from '../design';
import { slugify } from '../lib/tripMeta';
import type { ItemSeed } from '../lib/itemSeeds';

/**
 * The suggested packing list, offered as a whole for review.
 *
 * TICKED BY DEFAULT, and the reason is that the two failure modes aren't symmetric: an extra
 * item costs one glance to skip, a missing one costs the trip. Asking someone to opt in to
 * twenty-four checkboxes is asking them to do the work the app exists to do. What keeps that
 * honest is the list being SHORT and RANKED rather than everything the app knows, plus a
 * one-tap Clear all for anyone who disagrees with the lot.
 *
 * GROUPED BY HOW MANY, NEVER BY WHO. "Is this sleeping bag for me, or Brooke, or shared?" is a
 * question with no good answer and no need to be asked: it's an `each` item, one row meaning
 * everyone brings their own. Assigning gear to people is what personal lists are for, and
 * that's a decision to make later with the list in front of you, not a tax on every suggestion.
 */
export function SuggestedList({
  items,
  onConfirm,
  onSkip,
  confirmLabel = 'Add to the list',
}: {
  items: ItemSeed[];
  onConfirm: (chosen: ItemSeed[]) => void;
  onSkip: () => void;
  confirmLabel?: string;
}) {
  const t = useTheme();
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  const chosen = useMemo(
    () => items.filter((seed) => !dropped.has(slugify(seed.name))),
    [items, dropped],
  );

  const groups = [
    { title: 'Shared', hint: 'One covers everyone', seeds: items.filter((s) => s.sharing !== 'each') },
    {
      title: "Everyone's own",
      hint: 'One row, but each of you brings one',
      seeds: items.filter((s) => s.sharing === 'each'),
    },
  ].filter((g) => g.seeds.length);

  const toggle = (seed: ItemSeed) =>
    setDropped((was) => {
      const next = new Set(was);
      const key = slugify(seed.name);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <View style={{ gap: t.space.lg, flex: 1 }}>
      {groups.map((group) => (
        <View key={group.title} style={{ gap: t.space.xs }}>
          <Text variant="label" tone="muted">
            {group.title}
          </Text>
          <Text variant="caption" tone="muted">
            {group.hint}
          </Text>
          {group.seeds.map((seed) => (
            <CheckRow
              key={slugify(seed.name)}
              label={seed.name}
              checked={!dropped.has(slugify(seed.name))}
              // Choosing, not packing: nothing here is in a bag yet.
              meaning="choosing"
              onChange={() => toggle(seed)}
            />
          ))}
        </View>
      ))}

      <View style={{ marginTop: 'auto', gap: t.space.xs, paddingTop: t.space.lg }}>
        <Button
          label={chosen.length ? `${confirmLabel} (${chosen.length})` : 'Add nothing'}
          onPress={() => onConfirm(chosen)}
          full
        />
        <Button
          label={dropped.size ? 'Tick everything' : 'Untick everything'}
          variant="ghost"
          onPress={() =>
            setDropped(dropped.size ? new Set() : new Set(items.map((s) => slugify(s.name))))
          }
          full
        />
        <Button label="Skip for now" variant="ghost" onPress={onSkip} full />
      </View>
    </View>
  );
}
