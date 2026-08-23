import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * The smallest a field can be on the web without mobile Safari zooming the page to focus it.
 *
 * Under 16px Safari zooms in on focus and does NOT zoom back out, so with body text at 15 every
 * tap into an input left the app a size too big with its edges cut off, to be pinched back by
 * hand. That pinch is also what trips the `Cannot find single active touch` banner — it's a
 * dev-only console.error in react-native-web's responder store — so this is the fix for both.
 *
 * 16 rather than a viewport `maximum-scale`, which would buy the same thing by taking zoom away
 * from people who need it. The extra pixel is invisible next to body text; the zoom was not.
 */
const WEB_MIN_FIELD_SIZE = 16;

/**
 * What to render a field's text at, given the body size it would otherwise inherit.
 *
 * Split out from the component because the rule is invisible from a screenshot and the test
 * suite runs on the android preset, where the web branch can never be reached.
 *
 * @param bodySize the size the field would use if the browser had no opinion
 * @param platform defaults to the running platform; passed explicitly by tests
 */
export function fieldFontSize(bodySize: number, platform: string = Platform.OS) {
  return platform === 'web' ? Math.max(bodySize, WEB_MIN_FIELD_SIZE) : bodySize;
}

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
            fontSize: fieldFontSize(t.type.body.fontSize),
          },
          style,
        ]}
        {...rest}
      />

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingVertical: 14 },
});
