import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { icon } from '../tokens';
import { Text } from './Text';

/** Travel before the drag takes over from whatever was tapped. Past a tap's jitter. */
const DRAG_SLOP = 8;

/**
 * How long a release is credited with coasting, in seconds. Velocity arrives in points per
 * second, so this converts a throw into the extra distance it was going to cover.
 */
export const PROJECTION_SECONDS = 0.15;

/** How much of the sheet has to be gone, once coasting is counted, for letting go to dismiss. */
export const DISMISS_FRACTION = 0.5;

/**
 * Back to where it started, without a bounce.
 *
 * MEASURED OFF iOS, not guessed. Tracking the Mail compose sheet's top edge frame by frame
 * through three drag-and-release cycles: it never once goes above its resting line, and it
 * decays cleanly at about 0.78 of the remaining distance per frame — a critically damped spring,
 * ω ≈ 13 rad/s, settling in roughly 300ms from a 50pt drag.
 *
 * `dampingRatio: 1` is that "never above the line" property stated directly. It replaced damping
 * 22 with stiffness 260, which is ζ = 0.68 — underdamped, so it overshot by construction, while
 * the comment above it claimed it was critically damped. That bounce is what exposed a strip of
 * background under the sheet, and what read as a worn-out spring.
 *
 * 300 lands at ~215ms, deliberately a shade quicker than the reference: the complaint was that
 * this felt slow, and the honest reading is that the BOUNCE was most of that, so matching iOS
 * exactly risks trading one problem for the other. `overshootClamping` means no future tweak to
 * this number can put the sliver back.
 */
const SPRING_BACK = { duration: 300, dampingRatio: 1, overshootClamping: true };

/**
 * Whether letting go here dismisses the sheet, or springs it back.
 *
 * ONE RULE, NOT TWO: project where the sheet was heading, and dismiss if that is past halfway.
 * A flick is intent rather than distance, so its speed buys it travel it never actually made;
 * a slow drag that stopped short gets almost nothing added and stays.
 *
 * This replaced a fixed 90pt OR 500pt/s, which was wrong twice over. It ignored how big the
 * sheet was, so half of a short sheet and a fifth of a tall one both counted the same. And 500
 * pt/s is an ordinary swipe, not a throw — so a small flick that should have sprung back
 * dismissed instead, which is exactly what it felt like.
 *
 * Marked `'worklet'` so it can be called from the gesture callbacks, which run on the UI thread.
 * It stays an ordinary function on the JS side, which is what lets it be tested directly.
 *
 * @param translationY how far down the finger actually moved, in points
 * @param velocityY how fast it was moving when it let go, in points per SECOND
 * @param sheetHeight the sheet's measured height, so the bar scales with what's being dismissed
 */
export function shouldDismiss({
  translationY,
  velocityY,
  sheetHeight,
}: {
  translationY: number;
  velocityY: number;
  sheetHeight: number;
}) {
  'worklet';
  const projected = translationY + velocityY * PROJECTION_SECONDS;
  return projected > sheetHeight * DISMISS_FRACTION;
}

/**
 * The only floating layer in the app, and therefore the only thing that casts a shadow
 * (DESIGN.md, The Flat Field Rule). 16px top corners are the single exception to the 8px
 * maximum, because a sheet is a physically different object from the flat field below it.
 *
 * Use for adding/editing an item and capturing a reflection. NOT for confirmations, which
 * are inline.
 *
 * FOUR WAYS OUT, each one earned by a bug. This sheet once grew without limit while the scrim
 * took whatever was left, so enough chips squeezed the scrim to nothing and there was no exit
 * at all. Capping it fixed that, and uncovered the next problem: a handle is a DRAG affordance,
 * so people drag it — and a drag the app ignores gets picked up by the browser as
 * pull-to-refresh, which reloads the app out from under them. A control that looks draggable
 * has to be draggable.
 *
 * So: drag the handle, tap the handle, tap the ✕, tap the scrim. Plus Android's back button.
 *
 * WHY THE GESTURE IS NOT A PanResponder, having been one for a long time. The handle is a
 * Pressable, and a Pressable takes the responder the instant a finger lands, so the strip's own
 * move handler never ran and the drag did nothing. Claiming on the capture phase fixes that on
 * native — but React Native Web never dispatched either hook to this node, so on web the sheet
 * did not move by a single pixel through a full drag. What looked like a working swipe was the
 * handle's tap firing on mouse-up, which is identical from the outside and is why this survived
 * four rounds of bug reports. react-native-gesture-handler brings its own recognizers on both
 * platforms instead of negotiating with two different responder systems.
 *
 * `Modal animationType="slide"` is also gone: it slides its ENTIRE contents, and the scrim is
 * part of those contents, so closing dragged the dim layer down the screen with the sheet and
 * read as the whole app falling over. The scrim fades while only the sheet travels, which means
 * owning both animations here rather than asking Modal for one.
 *
 * @param title optional heading; omit for sheets whose content is self-evident
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  /**
   * WHERE THE SHEET IS, in points below its resting place. 0 is open, `travel` is gone.
   *
   * One value rather than a drag composed with an open/close progress, which is what this was.
   * Composing them double-counts: a sheet already dragged 150 down then had a whole further
   * screen height added to see it out, so it left three times faster than it needed to and read
   * as vanishing rather than leaving. A position that everything writes to cannot disagree with
   * itself about where the sheet is.
   */
  const y = useSharedValue(height);
  /** The scrim's own opacity. Held steady through a drag; only an actual close fades it. */
  const dim = useSharedValue(0);
  /**
   * The sheet's measured height, and therefore exactly how far it has to go to be gone.
   *
   * Starts at a screenful, which is safely offscreen for the one frame before the first layout
   * lands. Everything after that — the exit, and the halfway mark a dismissal is judged against
   * — is measured rather than assumed.
   */
  const travel = useSharedValue(height);
  /** Set when the drag takes over, cleared when the next touch starts. See the handle. */
  const dragged = useSharedValue(false);

  /**
   * Stays true through the closing animation.
   *
   * `visible` going false has to start an exit, not end one — unmounting the Modal on the same
   * frame is what makes a sheet vanish rather than leave.
   */
  const [mounted, setMounted] = useState(visible);

  // Read through a ref so the gesture can be built once. Rebuilding it mid-drag drops the drag.
  const close = useRef(onClose);
  close.current = onClose;
  const fireClose = useCallback(() => close.current(), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Start from gone, wherever a previous drag happened to leave it, then come up.
      y.value = travel.value;
      const arriving = { duration: t.motion.sheet, easing: Easing.bezier(...t.motion.easing) };
      y.value = withTiming(0, arriving);
      dim.value = withTiming(1, arriving);
      return;
    }

    // Out faster than in. Leaving is an acknowledgement, not an arrival.
    //
    // ACCELERATING, NOT DECELERATING, and that way round is measured rather than chosen. On the
    // frames where iOS dismisses its own sheet, the gap between one frame and the next grows —
    // 18pt, then 44, then 51 — so the sheet gathers speed on the way out. An ease-OUT does the
    // opposite: it brakes. After a throw that reads as the sheet catching itself on something,
    // which is not a motion anything physical makes.
    //
    // Every close comes through here, including a swipe: the gesture calls onClose and lets
    // `visible` drive the exit from wherever the finger left the sheet. One path out means the
    // throw and the fade can't be timed against each other and lose.
    const leaving = { duration: t.motion.enter, easing: Easing.in(Easing.quad) };
    y.value = withTiming(travel.value, leaving);
    // The scrim keeps its own curve. Tied to the sheet's it would hold near-full opacity for
    // most of the exit and then drop, which flashes the app back in at the very end.
    dim.value = withTiming(0, { duration: t.motion.enter }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [visible, y, dim, travel, t.motion]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        /**
         * CLAIMS A DRAG IN ANY DIRECTION, and moves for exactly one of them. That looks like
         * over-reach and is the opposite: this strip is 34px of handle and ✕, with nothing to
         * scroll and nothing to swipe, so a drag starting here was always meant for the sheet.
         *
         * Handing the other directions back is what caused the bug. A pan that FAILS releases
         * the touch, the handle's Pressable gets the click on the way up, and the sheet closes —
         * so pulling the handle UP, watching nothing move, and letting go dismissed it. Claiming
         * the gesture is what lets it be ignored.
         *
         * The threshold is past a tap's jitter in both axes, so tapping the handle still closes.
         * Anything not claimed here becomes the browser's pull-to-refresh on web.
         */
        .activeOffsetY([-DRAG_SLOP, DRAG_SLOP])
        .activeOffsetX([-DRAG_SLOP, DRAG_SLOP])
        .withTestId('sheet-drag')
        // Cleared at the START of a gesture rather than the end of the last one, because the
        // tap this guards against arrives AFTER the drag finishes and the order isn't ours to
        // rely on. A flag that survives until the next touch can't be raced.
        .onBegin(() => {
          dragged.value = false;
        })
        .onStart(() => {
          dragged.value = true;
        })
        .onUpdate((e) => {
          // Clamped, so the sideways and upward drags claimed above are held rather than
          // obeyed: the sheet is already at its top, and peeling it off that edge would leave
          // a gap under it with nothing in it.
          y.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          const gone = shouldDismiss({
            translationY: e.translationY,
            velocityY: e.velocityY,
            sheetHeight: travel.value,
          });
          // Leave the sheet exactly where the finger let go and hand over to the close
          // animation, which carries on from there. Nothing jumps and nothing is thrown twice.
          if (gone) runOnJS(fireClose)();
          // Not far enough: spring back rather than snap, so a half-drag reads as "not yet"
          // instead of as a glitch.
          else y.value = withSpring(0, SPRING_BACK);
        })
        .onFinalize((_e, success) => {
          // Cancelled or interrupted mid-drag — put the sheet back where it belongs.
          if (!success) y.value = withSpring(0, SPRING_BACK);
        }),
    [y, travel, dragged, fireClose],
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    // `animationType="none"`: both animations are owned here, so the scrim can fade while only
    // the sheet moves. Kept mounted past `visible` so the exit has somewhere to play.
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* A Modal is its own native view hierarchy, so the root view at the top of the app does
          not reach in here — without this, gestures inside a modal are dead on Android. */}
      <GestureHandlerRootView style={styles.root}>
        {/* ABSOLUTE, NOT flex: 1. As a flex sibling the scrim took only the space left over
            above the sheet, so it dimmed the screen down to the sheet's top edge and stopped.
            Undimmed app showed through the sheet's own rounded corners, and dragging the sheet
            down opened a bright band between the two that grew with the drag. It has to be a
            full-screen layer the sheet sits ON TOP of, which is also the only version where
            nothing has to move to keep up with the sheet. */}
        <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
          <Pressable
            style={[styles.fill, { backgroundColor: t.color.scrim }]}
            onPress={onClose}
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View
          testID="sheet-surface"
          // The sheet's own height IS the distance it has to travel to be gone, and it's also
          // the yardstick a dismissal is judged against. Measuring it is what stopped the exit
          // being a screenful of animation for a sheet three times shorter than that.
          onLayout={(e) => {
            const measured = e.nativeEvent.layout.height;
            if (measured > 0) travel.value = measured;
          }}
          style={[
            styles.sheet,
            {
              // Never taller than most of the screen. The scrim runs the full height behind
              // this, so what the cap protects is the strip of it left UNCOVERED — an exit in
              // its own right, and one that has to exist no matter what's inside.
              maxHeight: height * 0.85,
              backgroundColor: t.color.raised,
              borderTopLeftRadius: t.radius.sheet,
              borderTopRightRadius: t.radius.sheet,
              paddingBottom: insets.bottom + t.space.lg,
              shadowColor: t.color.sheetShadow,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.head}>
              {/* Tappable as well as draggable: a drag is a gesture nobody announces, and this
                  is the exit that doesn't depend on being able to reach the scrim. */}
              <Pressable
                onPress={() => {
                  // A drag that sprang back must not also read as a tap. Both end on the same
                  // finger lift, and without this a 30px tug closes the sheet it just refused
                  // to dismiss.
                  if (dragged.value) return;
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 12, bottom: 16, left: 40, right: 40 }}
                style={({ pressed }) => [styles.handleTarget, { opacity: pressed ? 0.5 : 1 }]}
              >
                <View style={[styles.handle, { backgroundColor: t.color.border }]} />
              </Pressable>

              {/* The unambiguous one. A handle reads as a sheet affordance; an ✕ reads as an
                  exit, and someone who has just been trapped in a sheet wants an exit. */}
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                style={({ pressed }) => [
                  styles.dismiss,
                  { padding: t.space.sm, opacity: pressed ? 0.5 : 1 },
                ]}
              >
                <X size={20} color={t.color.textMuted} strokeWidth={icon.stroke} />
              </Pressable>
            </View>
          </GestureDetector>

          {title ? (
            <Text variant="headline" style={{ paddingHorizontal: t.space.lg }}>
              {title}
            </Text>
          ) : null}

          <ScrollView
            // flexGrow 0 keeps a short sheet short. Without it the ScrollView stretches to the
            // cap and a two-field sheet arrives the height of the screen.
            style={[styles.scroller, Platform.OS === 'web' ? WEB_CONTAIN : null]}
            contentContainerStyle={[{ padding: t.space.lg, gap: t.space.md }, contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Belt and braces on web. `suppressPullToRefresh()` handles the document; this stops a scroll
 * that runs off the end of the list from reaching it in the first place.
 *
 * `overscrollBehavior` isn't in React Native's style types; it is a real CSS property that
 * React Native Web passes straight through.
 */
const WEB_CONTAIN = { overscrollBehavior: 'contain' } as unknown as ViewStyle;

const styles = StyleSheet.create({
  // The sheet is the only child left in flow, so flex-end is what puts it on the bottom edge.
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { flex: 1 },
  sheet: {
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 24,
  },
  // The whole strip is the drag target, not just the 36px handle — a grab that misses by 10px
  // and reloads the page is worse than no gesture at all.
  head: { minHeight: 34, justifyContent: 'center' },
  scroller: { flexGrow: 0 },
  handleTarget: { alignSelf: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 24 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  dismiss: { position: 'absolute', right: 6, top: 2 },
});
