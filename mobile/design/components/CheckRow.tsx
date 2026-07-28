import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { StateBox, type BoxMeaning } from './StateBox';

/**
 * A labeled on/off choice inside a sheet.
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
  meaning = 'packing',
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  /**
   * `choosing` when the row is picking something for a list rather than reporting on a bag.
   * A briefcase means IN THE BAG, and a column of them on a list you're still building claims
   * things are packed when nothing is.
   */
  meaning?: BoxMeaning;
  onChange: (next: boolean) => void;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      // BOTH, and the aria one isn't redundant. React Native Web doesn't translate
      // `accessibilityState` into an attribute, so on web this row announced itself as a checkbox
      // and then said nothing about whether it was ticked — on the review screen, where every row
      // starts ticked, that reads as "nothing is selected". StateBox escapes the same bug only
      // because it spells the state into its own label.
      accessibilityState={{ checked }}
      aria-checked={checked}
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
        <StateBox
          state={checked ? 'packed' : 'unpacked'}
          label={label}
          size={24}
          meaning={meaning}
          decorative
        />
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
