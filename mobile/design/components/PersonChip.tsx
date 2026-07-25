import { StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * Who an item is for. The ONLY place pills are allowed in this system: a person is a soft,
 * human thing among hard rows, and the shape difference is the point.
 *
 * @param name person's display name
 * @param color that person's assigned accent, shown as a dot (never as the chip fill, so
 *              chips can't compete with the signal color)
 * @param active filter chips invert to the signal color when engaged
 */
export function PersonChip({
  name,
  color,
  active = false,
}: {
  name: string;
  color?: string;
  active?: boolean;
}) {
  const t = useTheme();

  return (
    <View
      style={[
        styles.chip,
        {
          borderRadius: t.radius.pill,
          paddingHorizontal: t.space.sm + 2,
          gap: t.space.xs + 2,
          backgroundColor: active ? t.color.signal : t.color.raised,
        },
      ]}
    >
      {color && !active ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text variant="label" tone={active ? 'onSignal' : 'default'}>
        {name}
      </Text>
    </View>
  );
}

/** Renders up to three chips, then a `+N` overflow count. */
export function PersonChips({
  people,
  max = 3,
}: {
  people: { id: string; name: string; color?: string }[];
  max?: number;
}) {
  const t = useTheme();
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <View style={[styles.row, { gap: t.space.xs + 2 }]}>
      {shown.map((p) => (
        <PersonChip key={p.id} name={p.name} color={p.color} />
      ))}
      {overflow > 0 ? (
        <Text variant="numeric" tone="muted">
          +{overflow}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 26, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
