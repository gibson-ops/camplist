import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { Chevron } from './Chevron';

/**
 * A row that goes somewhere. Trips, people, kits.
 *
 * Single line with the meta on the same baseline rather than stacked, because this system's
 * whole premise is that you can scan a screenful at arm's length. A two-line row halves how
 * many trips fit and buys nothing: the destination is a fragment, not a paragraph.
 *
 * @param meta secondary fragment shown after the title, e.g. a destination or date range
 * @param count right-aligned progress like "8/14", in tabular figures so it can tick without
 *              shifting the row
 */
export function NavRow({
  title,
  meta,
  count,
  onPress,
  isLast = false,
}: {
  title: string;
  meta?: string;
  count?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, meta, count].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: t.touch.row,
          paddingVertical: t.space.sm,
          paddingHorizontal: t.space.lg,
          gap: t.space.sm + 2,
          backgroundColor: pressed ? t.color.raised : t.color.surface,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: t.color.border,
        },
      ]}
    >
      <View style={styles.body}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="label" tone="muted" numberOfLines={1} style={styles.meta}>
            {meta}
          </Text>
        ) : null}
      </View>

      {count ? (
        <Text variant="numeric" tone="muted">
          {count}
        </Text>
      ) : null}

      {onPress ? <Chevron /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0 },
  // The meta is a fragment, not a label, so drop the label style's uppercase + tracking.
  meta: { flexShrink: 1, textTransform: 'none', letterSpacing: 0 },
});
