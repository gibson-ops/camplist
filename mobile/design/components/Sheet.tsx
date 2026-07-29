import { ScrollView, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
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
 * No `snapPoints`, so the sheet sizes itself to its content. A fixed detent would make a
 * two-field sheet half a screen tall.
 *
 * SIZING TO CONTENT IS ONLY SAFE IF THE CONTENT IS BOUNDED, which is the one piece a sheet
 * cannot delegate. Removing the scroller here on the way to the platform sheet looked like
 * deleting our own layout code and was really deleting the ceiling: vaul measures the content,
 * writes an explicit height, and leaves `overflow: visible`, so a sheet taller than its own
 * measurement doesn't clip or scroll — it renders off the bottom of the screen. Jared got an
 * "Add item" sheet showing a title and nothing else, with the fields below the fold.
 *
 * So the children scroll, and the cap is what makes them able to. A ScrollView with no ceiling
 * grows to fit and never scrolls at all, which is exactly the state that produced the bug.
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
  const { height } = useWindowDimensions();

  return (
    <BottomSheet isPresented={visible} onDismiss={onClose} showDragIndicator>
      <View testID="sheet-surface" style={styles.surface}>
        {/* Outside the scroller on purpose: a title that scrolls away takes with it the only
            thing saying what the sheet is for. */}
        {title ? (
          <Text
            variant="headline"
            style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.lg }}
          >
            {title}
          </Text>
        ) : null}

        <ScrollView
          // The ceiling. Short content still sizes the sheet to itself; only content that would
          // have run off the screen scrolls instead.
          style={{ maxHeight: height * 0.7 }}
          contentContainerStyle={[
            { padding: t.space.lg, paddingBottom: insets.bottom + t.space.lg, gap: t.space.md },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  surface: { width: '100%' },
});
