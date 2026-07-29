import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { StateBox, type PackState } from './StateBox';

/**
 * One packable thing.
 *
 * Deliberately carries NO per-person marker. Lists are owned by a person, so on Jared's list
 * every item is Jared's and an avatar would be noise. The only ambiguity lives on the shared
 * list, and there the useful fact is `each` (everyone brings their own) versus one-for-all —
 * a single small tag, not a row of faces.
 *
 * Two targets share the row: the StateBox advances packing state, the rest opens detail.
 * That split is deliberate — advancing state is the high-frequency action and must never
 * require precision.
 *
 * @param nested renders as a child of an expanded kit (indented, shorter)
 */
export function ItemRow({
  name,
  state,
  note,
  qty = 1,
  each = false,
  consumable = false,
  nested = false,
  onAdvance,
  onPress,
  isLast = false,
}: {
  name: string;
  state: PackState;
  note?: string;
  qty?: number;
  each?: boolean;
  consumable?: boolean;
  nested?: boolean;
  onAdvance?: () => void;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: nested ? t.touch.nestedRow : t.touch.row,
          paddingVertical: nested ? t.space.xs + 2 : t.space.sm,
          paddingLeft: nested ? t.space.lg + 22 : t.space.lg,
          paddingRight: t.space.lg,
          gap: t.space.sm + 2,
          backgroundColor: pressed ? t.color.raised : nested ? t.color.bg : t.color.surface,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: t.color.border,
        },
      ]}
    >
      <StateBox state={state} onAdvance={onAdvance} label={name} size={nested ? 20 : 24} />

      {/* Name and note share one baseline so the row stays a single line. */}
      <View style={styles.body}>
        <Text variant="title" tone={state === 'loaded' ? 'muted' : 'default'} numberOfLines={1}>
          {name}
        </Text>
        {note ? (
          <Text variant="label" tone="muted" numberOfLines={1} style={styles.note}>
            {note}
          </Text>
        ) : null}
        {/* Only inside a kit. On a top-level row the flag has no consequence — ticking the item
            IS the check, and you can't pack zero of something you just packed — so the badge
            would be labelling a fact the row already states. */}
        {consumable && nested && !note ? (
          <Text variant="label" tone="muted" style={styles.note}>
            consumable
          </Text>
        ) : null}
      </View>

      {each ? (
        <View style={[styles.tag, { borderColor: t.color.border, borderRadius: t.radius.xs }]}>
          <Text variant="label" tone="muted">
            each
          </Text>
        </View>
      ) : null}

      {qty > 1 ? (
        <Text variant="numeric" tone="muted">
          ×{qty}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0 },
  // The note is a fragment, not a label, so drop the label style's uppercase + tracking.
  note: { flexShrink: 1, textTransform: 'none', letterSpacing: 0 },
  tag: { borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1 },
});
