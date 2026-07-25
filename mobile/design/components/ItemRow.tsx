import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { PersonChips } from './PersonChip';
import { StateBox, type PackState } from './StateBox';

export type ItemRowPerson = { id: string; name: string; color?: string };

/**
 * The most important surface in the product: one packable thing.
 *
 * Two distinct targets share the row. The StateBox advances packing state; the rest of the
 * row opens detail. That split is deliberate, because advancing state is the high-frequency
 * action and must never require precision.
 *
 * Only the `loaded` state dims the name. Dimming means "genuinely finished" here, so it stays
 * meaningful rather than decorative.
 *
 * @param qty shown only when greater than 1, right-aligned so the column scans vertically
 * @param effectiveQty optional resolved count when sharing==='each' multiplies by assignees
 */
export function ItemRow({
  name,
  state,
  note,
  qty = 1,
  effectiveQty,
  people = [],
  onAdvance,
  onPress,
  isLast = false,
}: {
  name: string;
  state: PackState;
  note?: string;
  qty?: number;
  effectiveQty?: number;
  people?: ItemRowPerson[];
  onAdvance?: () => void;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const t = useTheme();
  const shownQty = effectiveQty ?? qty;
  const hasMeta = people.length > 0 || Boolean(note);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: t.touch.row,
          paddingVertical: t.space.md,
          paddingHorizontal: t.space.lg,
          gap: t.space.md,
          backgroundColor: pressed ? t.color.raised : t.color.surface,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: t.color.border,
        },
      ]}
    >
      <StateBox state={state} onAdvance={onAdvance} label={name} />

      <View style={styles.center}>
        <Text variant="title" tone={state === 'loaded' ? 'muted' : 'default'}>
          {name}
        </Text>
        {hasMeta ? (
          <View style={[styles.meta, { gap: t.space.sm, marginTop: t.space.xs + 2 }]}>
            {people.length > 0 ? <PersonChips people={people} /> : null}
            {note ? (
              <Text variant="label" tone="muted" numberOfLines={1} style={styles.note}>
                {note}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {shownQty > 1 ? (
        <Text variant="numeric" tone="muted">
          ×{shownQty}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  note: { flexShrink: 1, textTransform: 'none', letterSpacing: 0 },
});
