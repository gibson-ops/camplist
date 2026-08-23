import { Pressable, StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '../ThemeProvider';
import { icon } from '../tokens';
import { Text } from './Text';

/**
 * The last row of a group: "add another one of these".
 *
 * Shares ItemRow's exact geometry so the plus lands in the same column as the StateBox and
 * the label lands on the same left edge as every item name. It reads as the next empty line
 * of the list rather than as a button parked underneath it, which is what makes rapid entry
 * feel like writing a list instead of filling a form.
 *
 * @param nested sits inside an expanded kit, matching ItemRow's nested indent
 */
export function AddRow({
  label,
  onPress,
  nested = false,
  isLast = true,
}: {
  label: string;
  onPress: () => void;
  nested?: boolean;
  isLast?: boolean;
}) {
  const t = useTheme();
  const glyph = nested ? 20 : 24;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
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
      {/* Bare stroke, no box: a bordered square here would read as an unpacked StateBox. */}
      <View style={{ width: glyph, alignItems: 'center' }}>
        <Plus size={glyph * 0.62} color={t.color.textMuted} strokeWidth={icon.stroke} />
      </View>

      <Text variant="title" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
