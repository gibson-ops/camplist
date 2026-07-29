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

/** Far enough to be deliberate, in points. */
export const DISMISS_DISTANCE = 90;
/**
 * Or fast enough to be a flick, in POINTS PER SECOND.
 *
 * The unit is shouted because getting it wrong is silent. PanResponder reports velocity in
 * points per MILLISECOND, and this constant was carried over from it unchanged — so the
 * threshold was a thousand times too low and every drag, however gentle, read as a flick. On
 * Android a deliberate 67pt drag over 700ms came back as velocityY 108, sailed past 0.5, and
 * dismissed a sheet that should have sprung back. Nothing about that looks like a unit bug from
 * the outside; it looks like the distance threshold isn't working.
 *
 * 500pt/s is a throw. An unhurried drag runs around 100.
 */
export const DISMISS_VELOCITY = 500;

/** Critically damped: back where it started with no wobble, because a wobble reads as a bug. */
const SPRING_BACK = { damping: 22, stiffness: 260 };

/**
 * Whether letting go here dismisses the sheet: dragged far enough, OR thrown fast enough.
 *
 * Distance alone punishes the flick — the quick short throw that is how most people close a
 * sheet once they know they can. Velocity alone dismisses on a slow careful drag that stops
 * short, which reads as the sheet ignoring where the finger actually left it.
 *
 * Marked `'worklet'` so it can be called from the gesture callbacks, which run on the UI thread.
 * It stays an ordinary function on the JS side, which is what lets it be tested directly.
 */
export function shouldDismiss({
  translationY,
  velocityY,
}: {
  translationY: number;
  velocityY: number;
}) {
  'worklet';
  return translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY;
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

  /** 0 closed, 1 open. Drives the scrim's opacity and the sheet's travel, separately. */
  const progress = useSharedValue(0);
  /** Where the finger has dragged the sheet to, on top of wherever `progress` has it. */
  const drag = useSharedValue(0);
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
      // A reopened sheet must not still be shoved down where the last drag left it.
      drag.value = 0;
      progress.value = withTiming(1, {
        duration: t.motion.sheet,
        easing: Easing.bezier(...t.motion.easing),
      });
      return;
    }

    progress.value = withTiming(
      0,
      // Out faster than in. Leaving is an acknowledgement, not an arrival.
      { duration: t.motion.enter, easing: Easing.out(Easing.quad) },
      (finished) => {
        if (!finished) return;
        // Offscreen by now, so this is the moment a half-finished drag can be forgotten
        // without anyone watching it snap back.
        drag.value = 0;
        runOnJS(setMounted)(false);
      },
    );
  }, [visible, drag, progress, t.motion]);

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
          drag.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (shouldDismiss(e)) {
            // Hand straight over to the close animation instead of throwing the sheet to the
            // bottom first. `drag` stays where the finger left it and the exit carries on from
            // there, so a dismissal is ONE continuous movement rather than two that meet in
            // the middle and have to be timed against each other.
            runOnJS(fireClose)();
            return;
          }
          // Not far enough: spring back rather than snap, so a half-drag reads as "not yet"
          // instead of as a glitch.
          drag.value = withSpring(0, SPRING_BACK);
        })
        .onFinalize((_e, success) => {
          // Cancelled or interrupted mid-drag — put the sheet back where it belongs.
          if (!success) drag.value = withSpring(0, SPRING_BACK);
        }),
    [drag, dragged, fireClose],
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    // The drag the finger is doing, plus wherever the open/close animation has it.
    transform: [{ translateY: drag.value + (1 - progress.value) * height }],
  }));

  return (
    // `animationType="none"`: both animations are owned here, so the scrim can fade while only
    // the sheet moves. Kept mounted past `visible` so the exit has somewhere to play.
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* A Modal is its own native view hierarchy, so the root view at the top of the app does
          not reach in here — without this, gestures inside a modal are dead on Android. */}
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[styles.fill, scrimStyle]}>
          <Pressable
            style={[styles.fill, { backgroundColor: t.color.scrim }]}
            onPress={onClose}
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View
          testID="sheet-surface"
          style={[
            styles.sheet,
            {
              // Never taller than most of the screen. The strip of scrim this leaves behind is
              // an exit in its own right, and it has to exist no matter what's inside.
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
