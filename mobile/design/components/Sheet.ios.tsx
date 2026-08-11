import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { BottomSheet as SwiftUIBottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { frame, padding, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * The iOS sheet, composed from the SwiftUI primitives rather than from `@expo/ui`'s universal
 * `BottomSheet`.
 *
 * WHY THIS FORK EXISTS: THE UNIVERSAL WRAPPER NEVER HOSTS ITS CHILDREN. `import { BottomSheet }
 * from '@expo/ui'` resolves to the universal component — a drop-in replacement for
 * `@gorhom/bottom-sheet` — and it passes React Native children straight into a SwiftUI `Group`.
 * A React Native view only enters a SwiftUI tree through `RNHostView`; without it the content
 * still DRAWS, which is what makes this so hard to see, but it never joins RN's view tree. Two
 * consequences, both of which made this app unusable on a real iPhone:
 *
 *   - no touch handler, so every `Pressable` is inert. Every button, chip and row in every sheet.
 *   - it measures as zero height, so `fitToContents` has nothing to size to and the sheet
 *     collapses to a stub or snaps shut as you reach for it.
 *
 * TEXT INPUT KEPT WORKING THROUGHOUT, which is what sent this the wrong way for hours: iOS makes
 * a native text field first responder through UIKit, so the one control that appeared healthy was
 * the one that never needed the broken path. A capture-phase responder on the content logged zero
 * touches while a `Pressable` sat there enabled with correct state — that measurement, not the
 * symptom, is what finally located it.
 *
 * The other difference from the wrapper: it applies `padding({ leading: 16, trailing: 16 })` of
 * its own, which this app then doubled with its own 16 — a 32pt left margin and content running
 * off the right edge. Here the modifier pads only the top and the design system owns the
 * horizontal margin, so there is one owner of it rather than two.
 *
 * `pointerEvents="box-none"` on the host is deliberate but was NOT the fix — the wrapper passes
 * `"none"`, which looks like the culprit and measurably is not. Recorded because it is the first
 * thing the next person will suspect.
 *
 * Otherwise kept deliberately close to the wrapper's own composition, so this stays easy to diff
 * against upstream and delete when the fix lands. See the filed issue in ROADMAP.md.
 *
 * WEB IS FORKED SEPARATELY — see Sheet.web.tsx, for an unrelated reason (a hardcoded #000 surface
 * in dark mode). Android still uses Sheet.tsx and the universal wrapper, which is correct there:
 * these are iOS defects.
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
  const { width } = useWindowDimensions();

  return (
    <Host style={styles.host} pointerEvents="box-none">
      <SwiftUIBottomSheet
        isPresented={visible}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
        fitToContents
      >
        <Group
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'topLeading' }),
            // Top only. The horizontal margin belongs to the design system, below.
            padding({ top: t.space.lg }),
            presentationDragIndicator('visible'),
          ]}
        >
          {/* RN CONTENT MUST BE HOSTED. `RNHostView` is how a React Native view enters a SwiftUI
              tree — without it the content still draws, but it never joins RN's view tree, so it
              gets no touch handler (every Pressable inert) and takes its size from the screen
              rather than from the sheet. @expo/ui's own universal BottomSheet omits this, which is
              why its sheets are unusable here.

              `matchContents` reports our height back up so `fitToContents` has something to size
              the sheet to. */}
          <RNHostView matchContents>
            <View
              testID="sheet-surface"
              /**
               * AN EXPLICIT WIDTH, and not `'100%'`.
               *
               * Under `matchContents` the host takes its size FROM this view, so a percentage is
               * circular and no width at all is content-driven — which is why the sheet measured
               * 390 on the email step and 287 on the code step, sizing itself to whatever text
               * happened to be longest. Stating the window width makes every sheet full-bleed and
               * leaves `matchContents` doing the one job it is needed for: reporting height up so
               * `fitToContents` has something to size to.
               */
              style={[styles.surface, { width }]}
            >
              {title ? (
                // `paddingTop` as well as the Group's, matching Sheet.tsx. Dropping it when the
                // library's own leading/trailing padding came out took the top margin with it, and
                // the title ended up under the system grabber.
                <Text
                  variant="headline"
                  style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.lg }}
                >
                  {title}
                </Text>
              ) : null}

              <View
                style={[
                  {
                    paddingHorizontal: t.space.lg,
                    // Safe area plus a real floor — `insets.bottom` is 0 on plenty of devices, and a
                    // button flush to the sheet's edge reads as cut off. See Sheet.tsx.
                    paddingBottom: insets.bottom + t.space.xl,
                    gap: t.space.md,
                  },
                  contentStyle,
                ]}
              >
                {children}
              </View>
            </View>
          </RNHostView>
        </Group>
      </SwiftUIBottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  surface: {},
});
