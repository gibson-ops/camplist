import { Pressable, type ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Chevron } from './Chevron';
import { Text } from './Text';

/**
 * The way out of a step. Top-left chevron and a word, quiet enough not to compete with the action.
 *
 * A COMPONENT BECAUSE THERE ARE NOW TWO STEPPERS, and a way out that looks different in each is how
 * people learn there isn't one. Trip creation had this inline; the welcome flow had nothing, so
 * tapping "Get started" was a trap — Jared's report, and the reason it moved here rather than being
 * copied.
 *
 * Deliberately not a header bar. These screens have no chrome, the label changes with the step
 * ("Cancel" at the start, "Back" after), and a real header would take vertical space from screens
 * whose whole job is one question at a time.
 *
 * @param label what this does from here — "Back" mid-flow, "Cancel" when leaving entirely
 * @param onPress where to go; the caller owns whether that's a step or a route
 */
export function BackLink({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs + 2,
        // Full touch target even though the ink is small: this is the escape hatch, and a
        // hard-to-hit one is the same as none.
        minHeight: t.touch.floor,
        // Keeps the row from stretching across the screen and swallowing taps meant for content.
        alignSelf: 'flex-start',
        opacity: pressed ? 0.6 : 1,
        ...style,
      })}
    >
      <Chevron direction="left" size={11} />
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
}
