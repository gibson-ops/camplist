import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: t.color.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: t.color.raised,
            borderTopLeftRadius: t.radius.sheet,
            borderTopRightRadius: t.radius.sheet,
            paddingBottom: insets.bottom + t.space.lg,
            shadowColor: t.color.sheetShadow,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: t.color.border, marginTop: t.space.sm }]} />

        {title ? (
          <Text variant="headline" style={{ paddingHorizontal: t.space.lg, marginTop: t.space.md }}>
            {title}
          </Text>
        ) : null}

        <View style={[{ padding: t.space.lg, gap: t.space.md }, contentStyle]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: {
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 24,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
});
