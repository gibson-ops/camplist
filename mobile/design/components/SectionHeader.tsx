import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { Chevron } from './Chevron';

/**
 * Separates grouped rows. Camp List uses full-bleed grouped lists instead of cards, so this
 * header is what carries structure: it sits on the app background, not on a surface.
 *
 * Passing `expanded` makes it a disclosure control for the group beneath it. That is how a
 * trip screen stays scannable with four people's lists on it — everyone else's collapses to
 * a single line that still reports its progress, so a closed list is never a blind spot.
 *
 * @param title section name, rendered uppercase in the label style
 * @param count optional progress like "8/14", set in tabular figures so it can tick without
 *              shifting the header
 * @param expanded omit for a static header; supply it (with `onToggle`) to make it collapsible
 */
export function SectionHeader({
  title,
  count,
  expanded,
  onToggle,
}: {
  title: string;
  count?: string;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const t = useTheme();
  const collapsible = typeof expanded === 'boolean' && Boolean(onToggle);

  const body = (
    <>
      <View style={[styles.title, { gap: t.space.sm }]}>
        {collapsible ? <Chevron direction={expanded ? 'down' : 'right'} size={11} /> : null}
        <Text variant="label" tone="muted" numberOfLines={1}>
          {title}
        </Text>
      </View>
      {count ? (
        <Text variant="numeric" tone="muted">
          {count}
        </Text>
      ) : null}
    </>
  );

  const layout = {
    backgroundColor: t.color.bg,
    paddingHorizontal: t.space.lg,
    paddingTop: t.space.lg,
    paddingBottom: t.space.sm,
  };

  if (!collapsible) {
    return <View style={[styles.row, layout]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${title}${count ? `, ${count} packed` : ''}`}
      // That padding alone leaves this ~38pt tall; a header tapped on every trip screen has
      // to clear the 44pt floor like any other control.
      style={({ pressed }) => [
        styles.row,
        layout,
        { minHeight: t.touch.floor, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
});
