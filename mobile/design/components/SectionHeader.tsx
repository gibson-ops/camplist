import { StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * Separates grouped rows. Camp List uses full-bleed grouped lists instead of cards, so this
 * header is what carries structure: it sits on the app background, not on a surface.
 *
 * @param title section name, rendered uppercase in the label style
 * @param count optional progress like "8/14", set in tabular figures so it can tick without
 *              shifting the header
 */
export function SectionHeader({ title, count }: { title: string; count?: string }) {
  const t = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: t.color.bg,
          paddingHorizontal: t.space.lg,
          paddingTop: t.space.lg,
          paddingBottom: t.space.sm,
        },
      ]}
    >
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {count ? (
        <Text variant="numeric" tone="muted">
          {count}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
