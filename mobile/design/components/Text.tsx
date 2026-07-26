import { Text as RNText, type TextProps, Platform } from 'react-native';
import { useTheme } from '../ThemeProvider';
import type { type as TypeScale } from '../tokens';

type Variant = keyof typeof TypeScale;
type Tone = 'default' | 'muted' | 'signal' | 'danger' | 'onSignal' | 'onDanger' | 'loaded';

/**
 * Typed text. Every string in the app goes through here so the type scale stays honest and
 * no screen invents its own size.
 *
 * `numeric` uses the platform monospace with tabular figures, per The Tabular Rule: a count
 * that reflows its row when it ticks 9 → 10 reads as sloppy instrumentation.
 */
export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = useTheme();
  const scale = t.type[variant];

  const color =
    tone === 'muted'
      ? t.color.textMuted
      : tone === 'signal'
        ? t.color.signal
        : tone === 'danger'
          ? t.color.danger
          : tone === 'loaded'
            ? t.color.loaded
            : tone === 'onSignal'
              ? t.color.onSignal
              : tone === 'onDanger'
                ? t.color.onDanger
                : t.color.text;

  return (
    <RNText
      style={[
        {
          color,
          fontSize: scale.fontSize,
          fontWeight: scale.fontWeight,
          lineHeight: scale.lineHeight,
          letterSpacing: scale.letterSpacing,
        },
        variant === 'label' && { textTransform: 'uppercase' },
        variant === 'numeric' && {
          fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
          fontVariant: ['tabular-nums'],
        },
        style,
      ]}
      // Layouts reflow rather than clip; cap the multiplier so the largest steps stay usable.
      maxFontSizeMultiplier={variant === 'display' || variant === 'headline' ? 1.6 : 2}
      {...rest}
    />
  );
}
