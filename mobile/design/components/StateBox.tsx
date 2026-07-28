import { Pressable, StyleSheet, View, AccessibilityInfo } from 'react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Briefcase, Check } from 'lucide-react-native';
import { useTheme } from '../ThemeProvider';
import { icon } from '../tokens';

/** Packing progress. Mirrors `items.state` in instant.schema.ts. */
export type PackState = 'unpacked' | 'packed' | 'loaded';

const FILLED: Record<PackState, boolean> = { unpacked: false, packed: true, loaded: true };

/**
 * Lucide's glyphs are not all optically centred in their own 24-unit box, and inside a filled
 * circle that reads immediately as "the icon is sitting high".
 *
 *   Briefcase — ink spans y 2..20, so its centre is 11 against the box's 12.
 *   Check     — ink spans y 6..17, centre 11.5.
 *
 * Measured on device before and after: the briefcase was 1.5px high on a 63px disc. Expressed
 * in icon units so it stays correct at every size.
 */
const OPTICAL_NUDGE: Record<PackState, number> = { unpacked: 0, packed: 1, loaded: 0.5 };



/**
 * The round state control on every item row.
 *
 * ROUND, and deliberately not a checkbox. A square with a tick is the universal signal for a
 * two-state checkbox, and this has three states — promising checkbox behaviour and then not
 * delivering it is worse than looking unfamiliar. The circle borrows iPhone Notes' checklist
 * instead, which is the gesture people already have in their thumbs, and reads as a status
 * dot that can hold more than one meaning.
 *
 * The old rationale here was that circles read as radio buttons. That's true of a RING among
 * other rings, where the shared shape implies "pick one" — not of a filled status marker on
 * independent rows.
 *
 * Each state carries a distinct GLYPH as well as a distinct color, so the control survives
 * glare and colorblindness (DESIGN.md, The Colorblind Floor).
 *
 * ## The feel
 *
 * This is the most-tapped control in the product, so it's animated in four layers rather than
 * one, and every layer exists to answer a different question:
 *
 *  1. **Press** — the whole control dips the instant a finger lands, before any state change.
 *     This is the only layer that reports "the app heard you"; the rest report "and here's
 *     what happened". Tying acknowledgement to the write would make a cold start feel broken.
 *  2. **Fill** — the disc blooms from the centre with a small overshoot, so packing something
 *     is an event rather than a repaint.
 *  3. **Glyph** — lands ~50ms behind the fill. The stagger is what makes it read as the mark
 *     being *stamped onto* the disc instead of the whole thing fading up as one flat sprite.
 *  4. **Haptic** — escalating weight: light for packed, medium for loaded, a soft selection
 *     tick for undo. Progress should feel heavier the further along it gets.
 *
 * Undoing reverses faster and with no overshoot and no bloom: taking something back out of the
 * car is a correction, and celebrating a correction is how an app starts to feel sarcastic.
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

  const filled = FILLED[state];
  const press = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const glyph = useRef(new Animated.Value(filled ? 1 : 0)).current;

  const reduceMotion = useRef(false);
  const prevState = useRef(state);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    });
  }, []);

  useEffect(() => {
    const from = prevState.current;
    prevState.current = state;
    if (from === state) return;

    const wasFilled = FILLED[from];

    // Reduced motion still gets the haptic — the feedback is the point, the movement isn't.
    if (reduceMotion.current) {
      fill.setValue(filled ? 1 : 0);
      glyph.setValue(filled ? 1 : 0);
      return;
    }

    if (filled && !wasFilled) {
      // Bloom: overshoot, then settle. The glyph follows so the mark lands ON the disc.
      Animated.parallel([
        Animated.sequence([
          Animated.timing(fill, {
            toValue: 1.06,
            duration: 130,
            easing: Easing.bezier(...t.motion.easing),
            useNativeDriver: true,
          }),
          Animated.timing(fill, {
            toValue: 1,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(glyph, {
          toValue: 1,
          delay: 50,
          duration: 150,
          easing: Easing.bezier(...t.motion.easing),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!filled && wasFilled) {
      // Undo: straight out, quicker, no overshoot.
      Animated.parallel([
        Animated.timing(fill, {
          toValue: 0,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glyph, {
          toValue: 0,
          duration: 70,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    // packed -> loaded: the disc is already there, so only the glyph changes. Punch it out
    // and back so the swap is legible; without this the two marks cross-fade into mush.
    Animated.sequence([
      Animated.timing(glyph, {
        toValue: 0,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(glyph, {
        toValue: 1,
        duration: 150,
        easing: Easing.bezier(...t.motion.easing),
        useNativeDriver: true,
      }),
    ]).start();
  }, [state, filled, fill, glyph, t.motion]);

  /**
   * Escalating weight, so further along the ladder feels heavier under the thumb.
   *
   * Fire-and-forget and swallowed on failure by design. Haptics don't exist on web, aren't
   * guaranteed on every Android device, and are absent from any dev build made before
   * expo-haptics was added — none of which is a reason to drop the user's tap.
   */
  function tap() {
    if (!onAdvance) return;

    const next = state === 'unpacked' ? 'packed' : state === 'packed' ? 'loaded' : 'unpacked';
    try {
      if (next === 'packed') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (next === 'loaded') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else void Haptics.selectionAsync();
    } catch {
      // no haptic engine here; the visual layers carry the feedback on their own
    }

    onAdvance();
  }

  const dip = (to: number) =>
    Animated.timing(press, {
      toValue: to,
      duration: to < 1 ? 70 : 130,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const fillColor = state === 'loaded' ? t.color.loaded : t.color.signal;

  /** Both stacked layers occupy the full control, dead centre, at every size. */
  const layer = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };

  return (
    <Pressable
      onPress={tap}
      onPressIn={() => !reduceMotion.current && dip(0.88)}
      onPressOut={() => !reduceMotion.current && dip(1)}
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityRole={decorative ? undefined : 'checkbox'}
      accessibilityState={decorative ? undefined : { checked: filled }}
      accessibilityLabel={decorative ? undefined : `${label}, ${state}`}
      // Visual size shrinks for density; hitSlop keeps the TARGET at the 44pt floor.
      // Visual height and touch target are deliberately decoupled.
      hitSlop={Math.max(0, (t.touch.floor - size) / 2)}
      style={styles.press}
    >
      <Animated.View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            opacity: dimmed ? 0.45 : 1,
            transform: [{ scale: press }],
          },
        ]}
      >
        {/* The empty ring. Stays put underneath so the disc blooms on top of a stable outline
            rather than the outline popping out of existence.

            Explicit width/height rather than absoluteFillObject: the stacked layers here were
            collapsing to a few pixels and leaving a bare glyph on the row, and pinning the
            geometry to `size` removes the ambiguity entirely. */}
        <View
          style={[
            layer,
            { borderRadius: size / 2, borderWidth: 2, borderColor: t.color.border },
          ]}
        />

        <Animated.View
          style={[
            layer,
            {
              borderRadius: size / 2,
              backgroundColor: fillColor,
              opacity: fill.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [{ scale: fill }],
            },
          ]}
        />

        <Animated.View
          style={{
            opacity: glyph,
            transform: [{ scale: glyph.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }}
        >
          {/*
            The ladder is nothing -> in the bag -> done. The CHECK sits at the END, not the
            middle: it's the strongest "complete" mark we have, so spending it on the halfway
            step leaves nothing louder for the finish line.

            Both glyphs come from Lucide rather than being drawn here. Hand-rolled paths are
            how the packed state ended up as a padlock: drawing one icon in isolation gives
            you no sense of the silhouettes it will be confused with. A set that was drawn
            together already solved that.

          */}
          <View style={{ marginTop: (size * 0.62 * OPTICAL_NUDGE[state]) / 24 }}>
            {state === 'loaded' ? (
              <Check size={size * 0.62} color={t.color.onLoaded} strokeWidth={icon.stroke} />
            ) : (
              <Briefcase size={size * 0.62} color={t.color.onSignal} strokeWidth={icon.stroke} />
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { alignItems: 'center', justifyContent: 'center' },
  box: { alignItems: 'center', justifyContent: 'center' },
});
