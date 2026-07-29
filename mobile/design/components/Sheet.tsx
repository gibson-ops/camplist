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
 * No `snapPoints`, so the sheet sizes itself to its content. A fixed detent would make a
 * two-field sheet half a screen tall.
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
      <View
        testID="sheet-surface"
        style={[
          styles.content,
          { padding: t.space.lg, paddingBottom: insets.bottom + t.space.lg, gap: t.space.md },
          contentStyle,
        ]}
      >
        {title ? <Text variant="headline">{title}</Text> : null}
        {children}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%' },
});
