import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { Chevron } from './Chevron';

/**
 * A labelled row that shows its answer and opens to change it.
 *
 * This is what makes a long form scannable: every field collapses to one line carrying its own
 * value, so the whole thing fits on a screen and you can see what's been answered without
 * scrolling through the controls that answer it. Opening one is how you edit it.
 *
 * The value is the point. A row reading "Kind · Camping" is worth ten times a row reading
 * "Kind ›", because the first one means you can stop reading.
 *
 * @param value the current answer; omit it and the row shows `placeholder` in the muted tone,
 *              which is how an unanswered field says so without looking broken
 * @param isLast drop the divider, since the group's edge already draws one
 */
export function DisclosureRow({
  label,
  value,
  placeholder = 'Not set',
  open = false,
  onToggle,
  isLast = false,
  children,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  open?: boolean;
  onToggle: () => void;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const filled = Boolean(value);

  return (
    <View style={{ backgroundColor: t.color.surface }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${value || placeholder}`}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: t.touch.row,
            paddingVertical: t.space.sm,
            paddingHorizontal: t.space.lg,
            gap: t.space.md,
            backgroundColor: pressed ? t.color.raised : t.color.surface,
            // An open row runs straight into its own contents, so a line there would cut the
            // field in half.
            borderBottomWidth: isLast || open ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: t.color.border,
          },
        ]}
      >
        <Text variant="label" tone="muted" numberOfLines={1}>
          {label}
        </Text>
        <Text
          variant="title"
          tone={filled ? 'default' : 'muted'}
          numberOfLines={1}
          style={styles.value}
        >
          {value || placeholder}
        </Text>
        <Chevron direction={open ? 'down' : 'right'} size={12} />
      </Pressable>

      {open ? (
        <View
          style={{
            paddingHorizontal: t.space.lg,
            paddingBottom: t.space.lg,
            borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: t.color.border,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // Right-aligned so the answers form a column the eye can run down, rather than starting at a
  // different place on every row depending on how long its label is.
  value: { flex: 1, textAlign: 'right' },
});
