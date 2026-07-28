import { Pressable, StyleSheet, View } from 'react-native';
import { Plus, User, X } from 'lucide-react-native';
import { useTheme } from '../ThemeProvider';
import { icon } from '../tokens';
import { Text } from './Text';

/**
 * One value, on or off. Every axis of a trip is made of these: trip type, travel, lodging,
 * activities, conditions, and the people going.
 *
 * ONE SHAPE FOR EVERYTHING. Facts used to be squared chips and people rounded ones, on the
 * theory that shape could carry the distinction — but two chip shapes on one form is two
 * systems to learn, and the squared version was noticeably bulkier for no gain. A person is
 * marked by an AVATAR instead, which says "human" faster than a corner radius ever did and
 * doesn't cost a second component.
 *
 * 30px rather than 44: these appear a dozen at a time and a wall of full-height buttons reads
 * as a menu, not as a set of tags. hitSlop carries the target to the 44pt floor, so only the
 * ink is small.
 *
 * @param selected inverts to the signal fill. Selection is the only meaning amber carries on a
 *                 form — the trip screen renders the same metadata as text, never as chips.
 * @param avatar mark this as a PERSON rather than a fact
 * @param color that person's assigned accent, filling the avatar ring
 * @param single announce as a radio rather than a checkbox; pick-one fields set it
 * @param onDismiss adds a ✕ that turns the chip DOWN rather than off. Only suggestions have
 *                  one: taking a suggestion and rejecting it are different acts, and a chip
 *                  that could only toggle would make "no thanks" indistinguishable from "not
 *                  yet".
 */
export function Chip({
  label,
  selected,
  onPress,
  single = false,
  avatar = false,
  color,
  onDismiss,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  single?: boolean;
  avatar?: boolean;
  color?: string;
  onDismiss?: () => void;
}) {
  const t = useTheme();
  const ink = selected ? t.color.onSignal : t.color.text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={single ? 'radio' : 'checkbox'}
      accessibilityState={single ? { selected } : { checked: selected }}
      // React Native Web doesn't translate accessibilityState into an attribute, so without this
      // every chip on the trip form announced itself as a checkbox that was never ticked. Both
      // roles here take aria-checked — aria-selected belongs to tabs and options, not radios.
      aria-checked={selected}
      accessibilityLabel={label}
      hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
      style={({ pressed }) => [
        styles.chip,
        {
          paddingLeft: avatar ? t.space.xs + 1 : t.space.md,
          paddingRight: onDismiss ? t.space.xs : t.space.md,
          gap: t.space.xs + 2,
          borderRadius: t.radius.pill,
          backgroundColor: selected ? t.color.signal : t.color.surface,
          // Unselected chips sit on `bg`, which in the light scheme is nearly the same tone as
          // `surface` — and inside a sheet the background IS `raised`. Without the border they
          // have no edge at all in either place.
          borderWidth: selected ? 0 : 1,
          borderColor: t.color.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      {avatar ? (
        <View
          style={[styles.avatar, { borderColor: ink, backgroundColor: color ?? 'transparent' }]}
        >
          <User size={11} color={color ? t.color.onSignal : ink} strokeWidth={icon.stroke} />
        </View>
      ) : null}

      <Text variant="title" tone={selected ? 'onSignal' : 'default'} numberOfLines={1}>
        {label}
      </Text>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={`Not ${label}`}
          hitSlop={10}
          style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.4 : 0.6 })}
        >
          <X size={14} color={ink} strokeWidth={icon.stroke} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/**
 * The way out of a short row of chips. Opens the full set, plus free entry.
 *
 * Deliberately quieter than the options beside it — a dashed edge and no fill — so it reads as
 * "more of these" rather than as another option. It is what lets a row stay six chips long
 * instead of forty.
 */
export function AddChip({ label = 'More', onPress }: { label?: string; onPress: () => void }) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 7, bottom: 7, left: 2, right: 2 }}
      style={({ pressed }) => [
        styles.chip,
        {
          paddingHorizontal: t.space.md,
          gap: t.space.xs + 1,
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: t.color.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Plus size={14} color={t.color.textMuted} strokeWidth={icon.stroke} />
      <Text variant="title" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}

/** Read-only roster: up to three people, then a `+N` overflow count. */
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
    <View style={[styles.row, { gap: t.space.sm }]}>
      {shown.map((p) => (
        <Chip key={p.id} label={p.name} color={p.color} avatar selected={false} onPress={noop} />
      ))}
      {overflow > 0 ? (
        <Text variant="numeric" tone="muted">
          +{overflow}
        </Text>
      ) : null}
    </View>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  chip: { height: 30, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  avatar: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
