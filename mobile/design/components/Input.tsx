import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * Focus turns the border Survey Yellow at 2px and keeps the fill. No glow, no outline
 * offset, no text color change: one clear signal, nothing decorative.
 *
 * @param label omit when the field's purpose is obvious from context, which is most of the time
 * @param error message shown beneath; also switches the border to the danger color
 */
export function Input({
  label,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? t.color.danger : focused ? t.color.signal : t.color.border;

  return (
    <View style={{ gap: t.space.sm }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}

      <TextInput
        placeholderTextColor={t.color.textMuted}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.field,
          {
            minHeight: t.touch.primary,
            paddingHorizontal: t.space.lg,
            borderRadius: t.radius.md,
            backgroundColor: t.color.surface,
            borderColor,
            borderWidth: focused || error ? 2 : 1,
            color: t.color.text,
            fontSize: t.type.body.fontSize,
          },
          style,
        ]}
        {...rest}
      />

      {error ? (
        <Text variant="label" tone="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingVertical: 14 },
  // The error message is a sentence, so drop the label style's uppercase + tracking.
  error: { textTransform: 'none', letterSpacing: 0 },
});
