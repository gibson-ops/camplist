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
  size = 24,
  dimmed = false,
  decorative = false,
}: {
  state: PackState;
  onAdvance?: () => void;
  label: string;
  /** 24 on a normal row, 20 nested inside an expanded kit. */
  size?: number;
  /** Advancing is currently blocked (a kit with unchecked consumables). */
  dimmed?: boolean;
  /**
   * Drop out of the accessibility tree entirely, for when an ancestor already announces
   * itself as the checkbox (CheckRow). Suppressing from the ancestor is not sufficient:
   * this is a Pressable with its own role, and it keeps its own node regardless.
   */
  decorative?: boolean;
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
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityRole={decorative ? undefined : 'checkbox'}
      accessibilityState={decorative ? undefined : { checked: state !== 'unpacked' }}
      accessibilityLabel={decorative ? undefined : `${label}, ${state}`}
      // Visual size shrinks for density; hitSlop keeps the TARGET at the 44pt floor.
      // Visual height and touch target are deliberately decoupled.
      hitSlop={Math.max(0, (t.touch.floor - size) / 2)}
      style={styles.press}
    >
      <View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            opacity: dimmed ? 0.45 : 1,
            borderRadius: t.radius.sm,
            backgroundColor: fill,
            borderWidth: state === 'unpacked' ? 2 : 0,
            borderColor: t.color.border,
          },
        ]}
      >
        {state !== 'unpacked' && (
          <Animated.View style={{ transform: [{ scale }] }}>
            <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
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
  box: { alignItems: 'center', justifyContent: 'center' },
});
