import { Pressable, StyleSheet, View, AccessibilityInfo, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';

/** Packing progress. Mirrors `items.state` in instant.schema.ts. */
export type PackState = 'unpacked' | 'packed' | 'loaded';

/**
 * The square state control on every item row.
 *
 * Square, not circular: circles read as radio buttons ("select one"), and this is a
 * three-step progression. Each state carries a distinct GLYPH as well as a distinct color,
 * so the control survives glare and colorblindness (DESIGN.md, The Colorblind Floor).
 *
 * @param state current packing state
 * @param onAdvance called when tapped; caller decides the next state
 * @param label accessible name, normally the item name
 */
export function StateBox({
  state,
  onAdvance,
  label,
}: {
  state: PackState;
  onAdvance?: () => void;
  label: string;
}) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(state === 'unpacked' ? 0.8 : 1)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v));
  }, []);

  useEffect(() => {
    const filled = state !== 'unpacked';
    if (reduceMotion.current) {
      scale.setValue(filled ? 1 : 0.8);
      return;
    }
    Animated.timing(scale, {
      toValue: filled ? 1 : 0.8,
      duration: t.motion.state,
      easing: Easing.bezier(...t.motion.easing),
      useNativeDriver: true,
    }).start();
  }, [state, scale, t.motion]);

  const fill =
    state === 'packed' ? t.color.signal : state === 'loaded' ? t.color.loaded : 'transparent';

  return (
    <Pressable
      onPress={onAdvance}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state !== 'unpacked' }}
      accessibilityLabel={`${label}, ${state}`}
      // 28px visual, 44px target — the box is small so the row stays dense, but the
      // hit area never drops below the accessibility floor.
      hitSlop={(t.touch.floor - 28) / 2}
      style={styles.press}
    >
      <View
        style={[
          styles.box,
          {
            borderRadius: t.radius.sm,
            backgroundColor: fill,
            borderWidth: state === 'unpacked' ? 2 : 0,
            borderColor: t.color.border,
          },
        ]}
      >
        {state !== 'unpacked' && (
          <Animated.View style={{ transform: [{ scale }] }}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              {state === 'packed' ? (
                // Check — "handled"
                <Path
                  d="M20 6L9 17l-5-5"
                  stroke={t.color.onSignal}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : (
                // Box — "in the car"
                <Path
                  d="M3 8l9-4 9 4v8l-9 4-9-4V8zm9-4v20M3 8l9 4 9-4"
                  stroke={t.color.onSignal}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </Svg>
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { alignItems: 'center', justifyContent: 'center' },
  box: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
