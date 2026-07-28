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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * The only floating layer in the app, and therefore the only thing that casts a shadow
 * (DESIGN.md, The Flat Field Rule). 16px top corners are the single exception to the 8px
 * maximum, because a sheet is a physically different object from the flat field below it.
 *
 * Use for adding/editing an item and capturing a reflection. NOT for confirmations, which
 * are inline.
 *
 * THREE WAYS OUT, and the reason is a bug this shipped with. The sheet used to grow without
 * limit while the scrim took whatever was left over, so a tall enough sheet — the tag picker
 * with forty chips in it — squeezed the scrim to nothing. Tapping outside was the only exit,
 * the handle was a decorative View, and on web there is no hardware back button. That is a
 * modal you cannot close. So now: the height is capped so a strip of scrim always survives,
 * the handle is a real button, and content scrolls inside the cap instead of pushing the
 * sheet taller.
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: t.color.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />

      <View
        testID="sheet-surface"
        style={[
          styles.sheet,
          {
            // Never taller than most of the screen. The strip of scrim this leaves behind is
            // the primary way out, and it has to exist no matter what's inside.
            maxHeight: height * 0.85,
            backgroundColor: t.color.raised,
            borderTopLeftRadius: t.radius.sheet,
            borderTopRightRadius: t.radius.sheet,
            paddingBottom: insets.bottom + t.space.lg,
            shadowColor: t.color.sheetShadow,
          },
        ]}
      >
        {/* A real control, not decoration. This is the exit that doesn't depend on being able
            to reach the scrim, and the only one a screen reader could ever find. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{ top: 12, bottom: 16, left: 40, right: 40 }}
          style={({ pressed }) => [styles.handleTarget, { opacity: pressed ? 0.5 : 1 }]}
        >
          <View style={[styles.handle, { backgroundColor: t.color.border }]} />
        </Pressable>

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
      </View>
    </Modal>
  );
}

/**
 * Web only. Stops a scroll that runs past the end of this list from turning into a
 * pull-to-refresh on the page underneath — which on mobile Safari reloads the app out from
 * under an open sheet.
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
  scroller: { flexGrow: 0 },
  handleTarget: { alignSelf: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 24 },
  handle: { width: 36, height: 4, borderRadius: 2 },
});
