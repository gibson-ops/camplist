import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * Who an item is for. The ONLY place pills are allowed in this system: a person is a soft,
 * human thing among hard rows, and the shape difference is the point.
 *
 * Passing `onPress` makes it a selection control — that's how a trip picks who's going. The
 * squared SelectChip does the same job for controlled vocabularies, so on a form the shape
 * alone says whether a chip names a person or a fact.
 *
 * @param name person's display name
 * @param color that person's assigned accent, shown as a dot (never as the chip fill, so
 *              chips can't compete with the signal color)
 * @param active inverts to the signal color: engaged as a filter, or coming on this trip
 */
export function PersonChip({
  name,
  color,
  active = false,
  onPress,
}: {
  name: string;
  color?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();

  const shape = {
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space.sm + 2,
    gap: t.space.xs + 2,
    backgroundColor: active ? t.color.signal : t.color.raised,
    // Same rule as the disabled Button: a bottom sheet's own background IS `raised`, so an
    // unfilled chip inside one dissolves into it and reads as bare text rather than as an
    // unselected option. The signal fill needs no such help.
    borderWidth: active ? 0 : 1,
    borderColor: t.color.border,
  };

  const body = (
    <>
      {color && !active ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text variant="label" tone={active ? 'onSignal' : 'default'}>
        {name}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={[styles.chip, shape]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={name}
      // A 26px pill is far under the 44pt floor and has to stay 26px — the height is the
      // component's identity. hitSlop buys the target back without touching the shape.
      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
      style={({ pressed }) => [styles.chip, shape, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
    >
      {body}
    </Pressable>
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
