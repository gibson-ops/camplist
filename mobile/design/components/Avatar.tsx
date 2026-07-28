import { Image, Pressable, StyleSheet, View } from 'react-native';
import { User } from 'lucide-react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * The account, top right, and the only place the app says whether one is finished.
 *
 * IT REPORTS BY CHANGING SHAPE, not by wearing a badge. A generic outline means there's still
 * something to do; initials or a picture mean it's yours. A dot would say the same thing while
 * adding a second thing to look at and something to want to dismiss — and this way finishing has
 * a reward attached, which a dot disappearing does not.
 *
 * Present for guests too, deliberately. It's the permanent way back to "finish signing up", so
 * the ask never depends on a card someone has already scrolled past.
 *
 * @param initials 1–2 letters once the account is real; absent while it isn't. See `initialsOf`
 * @param imageUrl a picture, which wins over initials when there is one
 * @param label what a screen reader announces — the caller knows whether this is an account or
 *              an invitation to make one, and the two should not sound alike
 */
export function Avatar({
  initials,
  imageUrl,
  label,
  size = 32,
  onPress,
}: {
  initials?: string;
  imageUrl?: string;
  label: string;
  size?: number;
  onPress?: () => void;
}) {
  const t = useTheme();
  const complete = Boolean(imageUrl || initials);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Visual size stays small at the corner; the target stays at the 44pt floor.
      hitSlop={Math.max(0, (t.touch.floor - size) / 2)}
      style={({ pressed }) => [styles.press, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            // Filled once it's an identity; an outline while it's still a placeholder for one.
            backgroundColor: complete ? t.color.signal : 'transparent',
            borderWidth: complete ? 0 : 2,
            borderColor: t.color.border,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : initials ? (
          <Text
            variant="label"
            style={{ color: t.color.onSignal, fontSize: size * 0.4, letterSpacing: 0 }}
          >
            {initials}
          </Text>
        ) : (
          <User size={size * 0.55} color={t.color.textMuted} strokeWidth={2} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
