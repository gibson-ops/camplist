import { View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../ThemeProvider';

type Direction = 'right' | 'down' | 'left' | 'up';

/** One glyph, rotated. Expanding a kit and expanding a list must not look like different ideas. */
const ANGLE: Record<Direction, string> = {
  right: '0deg',
  down: '90deg',
  left: '180deg',
  up: '-90deg',
};

/**
 * The system's only disclosure/navigation glyph.
 *
 * Rotated rather than swapped for Lucide's ChevronDown/Left/Up, so the same shape can be
 * animated between states later instead of popping between two drawings.
 *
 * @param direction where it points; `down` means "this is open"
 * @param color defaults to the muted text tone, which is where it belongs on every current use
 */
export function Chevron({
  direction = 'right',
  color,
  size = 12,
}: {
  direction?: Direction;
  color?: string;
  size?: number;
}) {
  const t = useTheme();

  return (
    <View style={{ transform: [{ rotate: ANGLE[direction] }] }}>
      {/* Lucide's default stroke of 2 is in the icon's own 24-unit space, so at 12px it lands
          near 1px and vanishes outdoors. */}
      <ChevronRight size={size} color={color ?? t.color.textMuted} strokeWidth={2.8} />
    </View>
  );
}
