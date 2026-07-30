import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BottomSheet } from '@expo/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * The platform's own bottom sheet: a SwiftUI sheet on iOS, a Compose ModalBottomSheet on
 * Android, and vaul on web. We supply the contents and nothing else.
 *
 * THIS USED TO BE HAND-ROLLED, and the deletion is the point. Four rounds of bug reports went
 * into a PanResponder that never fired on web, a scrim that only covered the screen above the
 * sheet, a spring whose damping ratio was 0.68 while its comment claimed 1.0, an exit that
 * travelled a whole window height for a sheet a third that size, and a dismiss threshold in the
 * wrong units by a factor of a thousand. Every one of those is a behaviour the operating system
 * already had. What finally forced the issue was the next item on the list — dragging the sheet
 * from anywhere rather than from a 34px strip — which needs the drag to hand off to and from
 * scrolling content at exactly the right moment. That is not a thing to reimplement.
 *
 * SO THE EXITS ARE THE PLATFORM'S: the grabber, the swipe, the tap outside, the Android back
 * button. No ✕ of our own. The ✕ was earned honestly — a handle reads as a sheet affordance and
 * an ✕ reads as an exit — but it existed because our sheet could only be dismissed by gestures
 * we had built badly. A system sheet is the gesture people already know.
 *
 * AND THE SURFACE IS THE PLATFORM'S. Nothing here paints a background. That means sheets follow
 * the OS rather than DESIGN.md's `raised`, and look slightly different on each platform, which
 * is the trade being made deliberately: system material, system dark mode, system accessibility,
 * and whatever the OS does next, for free.
 *
 * WEB IS FORKED — see Sheet.web.tsx, which Metro swaps in. Not because web wanted different
 * behaviour, but because it was the one platform that got the surface WRONG: `@expo/ui` hardcodes
 * a #000 sheet in dark mode, which against this app's #0a0b0c background is 1.05:1 and inverted
 * besides, since a sheet should be lighter than the field it floats over. iOS and Android arrive
 * at properly elevated material on their own, so they use this file unchanged.
 *
 * No `snapPoints`, so the sheet sizes itself to its content. A fixed detent would make a
 * two-field sheet half a screen tall.
 *
 * AND NOTHING HERE SCROLLS, on purpose. There was a ScrollView in this spot, added to stop a
 * tall sheet running off the bottom of the screen — but the platform sheet already caps itself
 * and already scrolls its own contents, so ours was a second scroller nested inside a working
 * one. Measured: shrink the viewport until an "Add item" sheet cannot fit and the platform's
 * container takes 217pt of 249pt of content and scrolls the rest, with the sheet still ending
 * exactly at the bottom of the screen.
 *
 * That matters beyond tidiness. Our ScrollView needed a ceiling to be able to scroll at all, the
 * ceiling came from `useWindowDimensions`, and a second opinion about how tall the sheet may be
 * is exactly the thing that gets stuck at the wrong value when a keyboard opens and closes.
 *
 * @param title optional heading; omit for sheets whose content is self-evident
 * @param contentStyle overrides for the content container, e.g. a tighter gap for chip grids
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

  return (
    <BottomSheet isPresented={visible} onDismiss={onClose} showDragIndicator>
      <View testID="sheet-surface" style={styles.surface}>
        {/* Above the content rather than inside it, so it stays put when the platform's own
            scroller takes over on a sheet too tall to fit. A title that scrolls away takes with
            it the only thing saying what the sheet is for. */}
        {title ? (
          <Text
            variant="headline"
            style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.lg }}
          >
            {title}
          </Text>
        ) : null}

        <View
          style={[
            { paddingHorizontal: t.space.lg, paddingBottom: insets.bottom, gap: t.space.md },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  surface: { width: '100%' },
});
