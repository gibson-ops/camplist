import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { StateBox, type BoxMeaning, type PackState } from './StateBox';

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
  meaning,
  consumable = false,
  checkLabel,
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
  /** What a filled disc claims here. Kit contents are 'checking'. See StateBox. */
  meaning?: BoxMeaning;
  consumable?: boolean;
  /**
   * The question this row asks when it gates a kit, e.g. "charged?".
   *
   * PASSED IN RATHER THAN DERIVED. The vocabulary lives in lib/checkReasons.ts and the design
   * system does not import from lib — a component that reaches into app logic for a string stops
   * being reusable and starts being this app's screen. Callers own the wording; this owns the type.
   */
  checkLabel?: string;
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
      <StateBox
        state={state}
        meaning={meaning}
        onAdvance={onAdvance}
        label={name}
        size={nested ? 20 : 24}
      />

      <View style={styles.body}>
        {/*
          WRAPS RATHER THAN TRUNCATES. A packing list is read to find out what a thing IS, and
          "Rechargeable headlamp bat…" answers a different question than the row was asked. Long
          names are rare, so the cost of letting one take a second line is paid by whoever wrote it
          and nobody else — which is cheaper than everyone reading half a name.

          Unclamped on purpose: a limit only matters for a name long enough that truncating it
          would lose the point of writing it.
        */}
        <Text
          variant="title"
          tone={state === 'loaded' ? 'muted' : 'default'}
          // Shrinks so it wraps inside the row rather than shoving the note off the end.
          style={{ flexShrink: 1 }}
        >
          {name}
        </Text>
        {note ? (
          <Text variant="label" tone="muted" numberOfLines={1} style={styles.note}>
            {note}
          </Text>
        ) : null}
        {/* Only inside a kit. On a top-level row the flag has no consequence — ticking the item
            IS the check, and you can't pack zero of something you just packed — so the badge
            would be labelling a fact the row already states.

            A QUESTION RATHER THAN A CATEGORY. This read "consumable", which named the flag and
            told you nothing to do; "charged?" is the check itself. */}
        {consumable && nested && !note && checkLabel ? (
          <Text variant="label" tone="muted" style={styles.note}>
            {checkLabel}
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
