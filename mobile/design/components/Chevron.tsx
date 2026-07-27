import Svg, { Path } from 'react-native-svg';
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
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: [{ rotate: ANGLE[direction] }] }}
    >
      <Path
        d="M9 6l6 6-6 6"
        stroke={color ?? t.color.textMuted}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
