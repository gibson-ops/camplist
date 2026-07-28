import { Pressable, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '../ThemeProvider';
import { icon } from '../tokens';
import { Text } from './Text';

/**
 * One value from a controlled vocabulary, on or off. Trip setting, activities, conditions.
 *
 * SQUARED, unlike PersonChip. That contrast is load-bearing rather than decorative: pills are
 * reserved for people (DESIGN.md, Chips), so the shape alone says whether a chip names a human
 * or a fact. A screen that mixes both — the trip form does — stays readable because of it.
 *
 * Sized to 36px with hitSlop out to the 44pt floor rather than being 44px tall, because these
 * appear a dozen at a time and a wall of full-height buttons reads as a menu, not as a set of
 * tags. The target is still full size; only the ink is small.
 *
 * @param selected inverts to the signal fill. Selection is the only meaning amber carries in a
 *                 form, so there's no collision with `packed` on the trip screen — that surface
 *                 renders trip metadata as text, never as chips.
 * @param single true when the field is pick-one, which changes what it announces to a screen
 *               reader (radio vs checkbox) and nothing else
 */
export function SelectChip({
  label,
  selected,
  onPress,
  single = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  single?: boolean;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={single ? 'radio' : 'checkbox'}
      accessibilityState={single ? { selected } : { checked: selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      style={({ pressed }) => [
        styles.chip,
        {
          paddingHorizontal: t.space.md,
          borderRadius: t.radius.md,
          backgroundColor: selected ? t.color.signal : t.color.surface,
          // Unselected chips sit on `bg`, which in the light scheme is nearly the same tone as
          // `surface`. Without the border they'd have no edge at all there.
          borderWidth: selected ? 0 : 1,
          borderColor: t.color.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Text variant="title" tone={selected ? 'onSignal' : 'default'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The way out of a short list of chips. Opens the full set, plus free entry.
 *
 * Sits at the end of a chip row and is deliberately quieter than the options it sits beside —
 * a dashed edge and no fill, so it reads as "more of these" rather than as another option. It
 * is what lets the default set stay six chips long instead of twenty-eight.
 */
export function AddChip({ label = 'More', onPress }: { label?: string; onPress: () => void }) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      style={({ pressed }) => [
        styles.chip,
        {
          paddingHorizontal: t.space.md,
          gap: t.space.xs + 2,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: t.color.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Plus size={15} color={t.color.textMuted} strokeWidth={icon.stroke} />
      <Text variant="title" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
