import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Pressed state steps the background one tone darker and scales to 0.98. Deliberately not an
 * opacity fade: opacity reads as "disabled", not "pressed".
 *
 * @param variant primary is the single Survey Yellow fill; only one per screen
 * @param full stretch to the container width (bottom-of-flow actions)
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  full = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const inert = disabled || loading;

  const bg: Record<Variant, string> = {
    primary: t.color.signal,
    secondary: t.color.surface,
    ghost: 'transparent',
    danger: t.color.danger,
  };

  // Primary and danger are fills, so their text is the near-black that sits on them.
  const tone = variant === 'primary' || variant === 'danger' ? 'onSignal' : 'default';

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: t.touch.primary,
          paddingHorizontal: t.space.xl,
          borderRadius: t.radius.md,
          backgroundColor: inert ? t.color.raised : bg[variant],
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: t.color.border,
          alignSelf: full ? 'stretch' : 'flex-start',
          transform: [{ scale: pressed && !inert ? 0.98 : 1 }],
          opacity: pressed && variant === 'ghost' ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? t.color.onSignal : t.color.text} />
      ) : (
        <Text variant="title" tone={inert ? 'muted' : tone}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
