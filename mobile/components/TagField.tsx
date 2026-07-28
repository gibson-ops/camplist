import { useState } from 'react';
import { View } from 'react-native';
import { AddChip, SelectChip, Text, useTheme } from '../design';
import { POOLS, slugify, suggestedTags, toggleTag, type TagKind } from '../lib/tripMeta';
import { TagPickerSheet } from './TagPickerSheet';

/**
 * One axis of a trip, as a short row of chips: trip type, travel, lodging, activities,
 * conditions.
 *
 * All five are the same thing. Some take one value and some take several, and that is the only
 * difference — they store labels, they canonicalise the same way, and any of them can be added
 * to. Type, travel and lodging were briefly closed sets of ids justified as "structural", but
 * nothing branched on them and no such list is ever complete: the travel axis shipped with
 * "Train or boat" as a catch-all, which is what an unfinished list looks like.
 *
 * Short is the whole design. The first version put every value of every vocabulary on screen at
 * once, twenty-eight chips deep — a wall nobody reads that still couldn't say "rockhounding".
 * So the chips shown are the handful seeded for this trip type, plus whatever is already
 * picked, and everything else lives one tap away behind the `+`.
 *
 * @param single cap selection at one, and let a second tap on the chosen chip clear it
 * @param closed drop the `+`, refusing anything not already seeded. Nothing sets this today;
 *               it exists so an axis can be locked down without inventing a second component.
 * @param used every spelling in play in this household, most-used first; the `+` sheet offers
 *             these ahead of the app's own seeds
 */
export function TagField({
  label,
  hint,
  kind,
  tripType,
  selected,
  used = [],
  single = false,
  closed = false,
  onChange,
}: {
  label: string;
  hint?: string;
  kind: TagKind;
  tripType?: string;
  selected: string[];
  used?: string[];
  single?: boolean;
  closed?: boolean;
  onChange: (next: string[]) => void;
}) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);

  const pool = POOLS[kind];
  // Selected first, then this type's seeds, each rendered in this household's own spelling.
  // Changing the trip type can only change what ELSE is on offer — never hide what's picked.
  const shown = suggestedTags(kind, tripType, selected, used);
  const chosen = new Set(selected.map(slugify));

  function toggle(tag: string) {
    if (single) {
      // `known` puts the household's spelling ahead of the one the app ships with.
      const next = toggleTag(selected, tag, [...used, ...shown, ...pool]);
      onChange(next.slice(-1));
      return;
    }
    onChange(toggleTag(selected, tag, [...used, ...shown, ...pool]));
  }

  return (
    <View style={{ gap: t.space.sm, paddingHorizontal: t.space.lg }}>
      <View style={{ gap: 2 }}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        {/* Body, not Label. A hint is a sentence, and Label is 700 weight — set in it, the
            hint comes out bolder than the field label above it and wins the row. */}
        {hint ? (
          <Text variant="body" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        {shown.map((tag) => (
          <SelectChip
            key={slugify(tag)}
            label={tag}
            selected={chosen.has(slugify(tag))}
            single={single}
            onPress={() => toggle(tag)}
          />
        ))}
        {closed ? null : <AddChip onPress={() => setPicking(true)} />}
      </View>

      <TagPickerSheet
        visible={picking}
        title={label}
        placeholder={PLACEHOLDER[kind]}
        used={used}
        pool={pool}
        selected={selected}
        onToggle={(tag) => {
          toggle(tag);
          // A single-value axis is answered by one tap; keeping the sheet open would leave the
          // user staring at a list they're done with.
          if (single) setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

/** Examples chosen to sit OUTSIDE the seeded list, so they read as "type anything". */
const PLACEHOLDER: Record<TagKind, string> = {
  tripType: 'Festival',
  travel: 'Motorcycle',
  lodging: 'Yurt',
  activities: 'Rockhounding',
  conditions: 'Shared bathroom',
};
