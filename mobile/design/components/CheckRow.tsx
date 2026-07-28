import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { StateBox } from './StateBox';

/**
 * A labelled on/off choice inside a sheet.
 *
 * Reuses StateBox rather than a platform Switch on purpose: this app teaches exactly one
 * "yes, that's handled" gesture, and a sliding toggle would be a second, softer version of
 * it. The whole row is the target, so the box never has to be aimed at.
 *
 * @param hint one short line explaining the consequence, not a restatement of the label
 */
export function CheckRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: t.touch.floor,
          paddingVertical: t.space.sm,
          gap: t.space.sm + 2,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* Non-interactive here: the parent Pressable owns the gesture, and the row already
          announces itself as the checkbox — a second node would read the state twice. */}
      <View pointerEvents="none">
        <StateBox state={checked ? 'packed' : 'unpacked'} label={label} size={24} decorative />
      </View>

      <View style={styles.body}>
        <Text variant="title">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, gap: 2, minWidth: 0 },
});
