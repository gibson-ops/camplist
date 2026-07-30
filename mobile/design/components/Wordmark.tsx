import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '../ThemeProvider';
import { WORDMARK_ASPECT, wordmarkSvg } from '../wordmarkArt';

/**
 * The `camplist` lockup: the packing-list controls beside the wordmark.
 *
 * The art is outlined paths generated from the brand file, so it carries no font
 * dependency and cannot drift from `brand/camplist-wordmark.svg`. Only the colors
 * come from the theme.
 *
 * The contour lines that appear in the app icon are deliberately absent here.
 * Beside type they read as texture rather than terrain and compete with the word;
 * the controls alone still carry the list idea.
 *
 * @param height rendered height in px; width follows from the art's aspect ratio.
 *   Defaults to the display type size so it sits where a screen title would.
 */
export function Wordmark({ height }: { height?: number }) {
  const t = useTheme();
  const h = height ?? t.type.display.fontSize;
  const xml = wordmarkSvg({
    text: t.color.text,
    // Survey Amber is a FILL here, which is its only legal use on a light
    // background, so the same value serves both schemes.
    amber: t.color.signal,
    stone: t.color.textMuted,
  });

  // The label lives on a wrapping View: SvgXml does not forward accessibility
  // props to the native view, so a screen reader would otherwise meet artwork
  // where a screen title used to be. The product name stays two words when spoken.
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Camp List">
      <SvgXml xml={xml} width={h * WORDMARK_ASPECT} height={h} />
    </View>
  );
}
