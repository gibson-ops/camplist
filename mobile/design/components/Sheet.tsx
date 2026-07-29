import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { icon } from '../tokens';
import { Text } from './Text';

/** A deliberate downward drag: past a tap's jitter, and more vertical than sideways. */
const claims = (g: { dy: number; dx: number }) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx);

/** Drag far enough, or fast enough, and let go. Either one dismisses. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.5;

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
 * TWO THINGS THE PLATFORM WAS DOING FOR US, BADLY, until it was taken back:
 *
 *   The drag was claimed on the MOVE phase by the header strip — but the handle inside it is a
 *   Pressable, and a Pressable takes the responder on touch-down. The parent's move handler never
 *   ran, so swipe-to-dismiss simply did nothing on every sheet in the app. Claiming on CAPTURE
 *   lets the parent take a gesture the child is already holding, which is the only way a drag can
 *   start on top of something tappable.
 *
 *   `Modal animationType="slide"` slides its entire contents, and the scrim is part of those
 *   contents — so closing dragged the dim layer down the screen with the sheet, which reads as
 *   the whole app falling over rather than a panel being dismissed. The scrim fades and the sheet
 *   travels, which is what a sheet has always looked like; doing that means owning both
 *   animations rather than asking Modal for one.
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

  const drag = useRef(new Animated.Value(0)).current;
  /** 0 closed, 1 open. Drives the scrim's opacity and the sheet's travel, separately. */
  const open = useRef(new Animated.Value(0)).current;
  /**
   * Stays true through the closing animation.
   *
   * `visible` going false has to start an exit, not end one — unmounting the Modal on the same
   * frame is what makes a sheet vanish rather than leave.
   */
  const [mounted, setMounted] = useState(visible);
  /** Measured, so the sheet travels its own height instead of an assumed screenful. */
  const travel = useRef(height);

  // `onClose` is read through a ref so the PanResponder can be built once. Rebuilding it every
  // render drops the gesture halfway through a drag.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // A reopened sheet must not still be shoved down where the last drag left it.
      drag.setValue(0);
      Animated.timing(open, {
        toValue: 1,
        duration: 240,
        easing: Easing.bezier(...t.motion.easing),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(open, {
      toValue: 0,
      // Out faster than in. Leaving is an acknowledgement, not an arrival.
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, drag, open, t.motion]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        /**
         * CAPTURE, not bubble. The handle is a Pressable and takes the responder the moment a
         * finger lands, so a move handler on the parent never runs — which is exactly why
         * swipe-to-dismiss did nothing on every sheet. Capturing lets this strip take a gesture
         * its own child is already holding.
         *
         * Still only a deliberate DOWNWARD drag: 4px is past a tap's jitter and nowhere near a
         * scroll, so tapping the handle still closes and nothing else is stolen. Anything not
         * claimed here becomes the browser's pull-to-refresh on web.
         */
        onMoveShouldSetPanResponderCapture: (_e, g) => claims(g),
        // BOTH PHASES. Capture is what takes the gesture back from the handle's Pressable on
        // native; the bubble hook is the one React Native Web actually dispatches here. Either
        // alone leaves the drag dead on one of the two platforms.
        onMoveShouldSetPanResponder: (_e, g) => claims(g),
        onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            // Carry the throw through to the bottom instead of handing off mid-air: `visible`
            // going false starts its own exit, and the two would fight over the same pixels.
            Animated.timing(drag, {
              toValue: travel.current,
              duration: 140,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start(() => close.current());
            return;
          }
          // Not far enough: spring back rather than snapping, so a half-drag reads as "not yet"
          // instead of as a glitch.
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [drag],
  );

  return (
    // `animationType="none"`: both animations are owned here, so the scrim can fade while only
    // the sheet moves. Kept mounted past `visible` so the exit has somewhere to play.
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity: open }]}>
        <Pressable
          style={[styles.scrim, { backgroundColor: t.color.scrim }]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        testID="sheet-surface"
        // Measured on the way up so the sheet travels its own height. Assuming a screenful makes
        // a short sheet start further away than it is and arrive late.
        onLayout={(e) => {
          travel.current = e.nativeEvent.layout.height || height;
        }}
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
            // The drag the finger is doing, plus wherever the open/close animation has it.
            transform: [
              {
                translateY: Animated.add(
                  drag,
                  open.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
                ),
              },
            ],
          },
        ]}
      >
        <View style={styles.head} {...pan.panHandlers}>
          {/* Tappable as well as draggable: a drag is a gesture nobody announces, and this is
              the exit that doesn't depend on being able to reach the scrim. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 12, bottom: 16, left: 40, right: 40 }}
            style={({ pressed }) => [styles.handleTarget, { opacity: pressed ? 0.5 : 1 }]}
          >
            <View style={[styles.handle, { backgroundColor: t.color.border }]} />
          </Pressable>

          {/* The unambiguous one. A handle reads as a sheet affordance; an ✕ reads as an exit,
              and someone who has just been trapped in a sheet is looking for an exit. */}
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
  scrim: { flex: 1 },
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
