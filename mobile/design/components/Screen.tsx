import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';

/**
 * Standard screen container. Exists so no screen hardcodes its top padding.
 *
 * Hardcoded insets are the classic "looked right on the Android emulator, wrong on iOS" bug:
 * a notch is ~44pt, a Dynamic Island ~59pt, a flat Android status bar ~24pt. iOS also needs
 * bottom clearance for the home indicator. Both platforms are first class here, so the real
 * insets are always read from the device.
 *
 * @param scroll wrap content in a ScrollView (default true)
 * @param edges which safe edges to pad; bottom is skipped for screens with a docked footer
 */
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Array<'top' | 'bottom'>;
  contentStyle?: ViewStyle;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const padding = {
    // A little breathing room past the hardware inset so content isn't jammed under it.
    paddingTop: edges.includes('top') ? insets.top + t.space.lg : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom + t.space.xxl : 0,
  };

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: t.color.bg }, padding, contentStyle]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
