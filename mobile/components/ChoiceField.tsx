import { View } from 'react-native';
import { SelectChip, Text, useTheme } from '../design';
import type { Vocab } from '../lib/tripMeta';

/**
 * One of the trip's closed axes — type, travel, lodging. Pick one, or none.
 *
 * These are NOT tags. They're structural: the trip type decides which suggestions load at all,
 * and code branches on the values, so they're stored as stable ids and the user can't invent
 * new ones. TagField is the open-ended counterpart.
 *
 * Every option is on screen. The lists are five or six long by construction, and a closed
 * choice behind a picker would be recall where recognition costs nothing.
 *
 * @param hint one line on why the field is worth filling in, not a restatement of the label
 */
export function ChoiceField({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Vocab[];
  value?: string;
  onChange: (next: string) => void;
}) {
  const t = useTheme();

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
        {options.map((option) => (
          <SelectChip
            key={option.id}
            label={option.label}
            selected={value === option.id}
            single
            // Tapping the chosen one clears it. A mis-tap has to be undoable, and there's no
            // other affordance to undo it with.
            onPress={() => onChange(value === option.id ? '' : option.id)}
          />
        ))}
      </View>
    </View>
  );
}
