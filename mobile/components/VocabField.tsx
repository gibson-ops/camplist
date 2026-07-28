import { View } from 'react-native';
import { SelectChip, Text, useTheme } from '../design';
import type { Vocab } from '../lib/tripMeta';

/**
 * One controlled vocabulary, rendered as a wrap of chips.
 *
 * Every option is on screen at once rather than behind a picker or a multi-select modal. The
 * vocabularies are short by design (five settings, a dozen activities), and the whole reason
 * they exist is that people describe a trip better when they're RECOGNISING options than when
 * they're recalling them — a closed picker gives back the recall problem.
 *
 * Selection is always a `string[]`, even for pick-one fields, so the caller does the unwrapping
 * and this component has one shape of state to reason about.
 *
 * @param single caps selection at one and lets a second tap on the chosen chip clear it. Also
 *               what makes it announce as a radio rather than a checkbox.
 * @param hint one line on why the field is worth filling in, not a restatement of the label
 */
export function VocabField({
  label,
  hint,
  vocab,
  selected,
  onChange,
  single = false,
}: {
  label: string;
  hint?: string;
  vocab: Vocab[];
  selected: string[];
  onChange: (next: string[]) => void;
  single?: boolean;
}) {
  const t = useTheme();
  const chosen = new Set(selected);

  function toggle(optionId: string) {
    if (single) {
      onChange(chosen.has(optionId) ? [] : [optionId]);
      return;
    }
    // Filtered from `vocab` rather than pushed onto `selected`, so the stored order always
    // matches the order on screen no matter which chips were tapped first.
    const next = new Set(chosen);
    if (next.has(optionId)) next.delete(optionId);
    else next.add(optionId);
    onChange(vocab.filter((v) => next.has(v.id)).map((v) => v.id));
  }

  return (
    <View style={{ gap: t.space.sm, paddingHorizontal: t.space.lg }}>
      <View style={{ gap: 2 }}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        {/* Body, not Label. A hint is a sentence, and the Label style is 700 weight — set in
            it, the hint came out BOLDER than the field label above it and won the row. */}
        {hint ? (
          <Text variant="body" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        {vocab.map((option) => (
          <SelectChip
            key={option.id}
            label={option.label}
            selected={chosen.has(option.id)}
            single={single}
            onPress={() => toggle(option.id)}
          />
        ))}
      </View>
    </View>
  );
}
