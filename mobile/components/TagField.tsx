import { useState } from 'react';
import { View } from 'react-native';
import { AddChip, SelectChip, Text, useTheme } from '../design';
import { slugify, suggestedTags, toggleTag } from '../lib/tripMeta';
import { TagPickerSheet } from './TagPickerSheet';

/**
 * An open-ended set of tags — activities, conditions — shown as a short row of chips.
 *
 * Short is the whole design. The first version put every value of every vocabulary on screen at
 * once, twenty-eight chips deep, and it was a wall nobody would read; it also still couldn't
 * say "rockhounding". So the chips shown are the handful that suit this trip type, plus
 * whatever is already picked, and everything else lives one tap away behind the `+`.
 *
 * Tags are stored as their LABEL, not as ids — see lib/tripMeta.ts. Adding one canonicalises
 * its spelling against what's already in play, which is what keeps "cold nights" and "Cold
 * nights" from becoming two different tags.
 *
 * @param used every spelling in play in this household, most-used first; the `+` sheet offers
 *             these ahead of the app's own defaults
 * @param pool what the app ships for this kind of tag, for browsing behind the `+`
 */
export function TagField({
  label,
  hint,
  kind,
  tripType,
  selected,
  used,
  pool,
  onChange,
}: {
  label: string;
  hint?: string;
  kind: 'activities' | 'conditions';
  tripType?: string;
  selected: string[];
  used: string[];
  pool: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);

  // Selected first, then this type's defaults, each rendered in this household's own spelling.
  // Changing the trip type can only change what ELSE is on offer — never hide what's picked.
  const shown = suggestedTags(kind, tripType, selected, used);
  const chosen = new Set(selected.map(slugify));

  // `used` outranks `pool`: the household's spelling beats the one the app ships with.
  const toggle = (tag: string) => onChange(toggleTag(selected, tag, [...used, ...shown, ...pool]));

  return (
    <View style={{ gap: t.space.sm, paddingHorizontal: t.space.lg }}>
      <View style={{ gap: 2 }}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
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
            onPress={() => toggle(tag)}
          />
        ))}
        <AddChip onPress={() => setPicking(true)} />
      </View>

      <TagPickerSheet
        visible={picking}
        title={label}
        placeholder={kind === 'activities' ? 'Rockhounding' : 'Shared bathroom'}
        used={used}
        pool={pool}
        selected={selected}
        onToggle={toggle}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}
