import { StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { Button } from './Button';

/**
 * Headline, one line of explanation, one action. Nothing else.
 *
 * No illustration, no mascot, no oversized icon: "cutesy checklist app" is an explicit
 * anti-reference. Copy states the situation and the next action plainly.
 *
 * @param title the situation, e.g. "No trips yet."
 * @param body the next action, e.g. "Start one, or build it from a past trip."
 */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();

  return (
    <View style={[styles.wrap, { padding: t.space.xl, gap: t.space.md }]}>
      <Text variant="headline">{title}</Text>
      {body ? (
        <Text variant="body" tone="muted" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: t.space.sm }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', justifyContent: 'center', flex: 1 },
  // Cap measure so explanatory copy stays in the 65-75ch band even on a tablet.
  body: { maxWidth: 420 },
});
