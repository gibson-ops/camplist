import { View } from 'react-native';
import { useTheme } from '../design';

/**
 * Ambient progress. A thin rule rather than a number, because this is encouragement and not a
 * score — nobody should feel they're being marked on how well they described a weekend.
 */
export function Meter({ filled, total }: { filled: number; total: number }) {
  const t = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: filled }}
      style={{
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: t.color.raised,
      }}
    >
      <View
        style={{
          width: `${Math.round((filled / total) * 100)}%`,
          height: '100%',
          backgroundColor: t.color.signal,
        }}
      />
    </View>
  );
}
