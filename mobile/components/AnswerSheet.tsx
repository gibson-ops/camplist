import { Pressable, View } from 'react-native';
import { Sheet, Text, useTheme } from '../design';

/**
 * The four things "it was on the list and never got ticked" can mean.
 *
 * Written as the user's own account of what happened, not as the category the app files it
 * under. "It came, I just didn't tick it" is a sentence somebody would say; "mistracked" is a
 * word from a schema, and asking people to translate their trip into schema is how a post-trip
 * prompt stops getting filled in.
 *
 * The hints exist because two of these look alike and point opposite ways. Deciding against
 * something and it not applying are both "no", but one is a preference this household has and
 * the other is a fact about this kind of trip — and demoting the wrong one loses a thing they
 * actually want on the next trip of a different shape.
 */
export const ANSWERS: { kind: string; label: string; hint: string }[] = [
  {
    kind: 'mistracked',
    label: 'It came anyway',
    hint: 'Nobody ticked it off. Nothing to learn here.',
  },
  { kind: 'forgot', label: 'We forgot it', hint: 'Should have come. Say so louder next time.' },
  {
    kind: 'skipped',
    label: 'We decided against it',
    hint: 'Left home on purpose. Offer it lower, not never.',
  },
  {
    kind: 'didnt_fit',
    label: "It didn't apply",
    hint: 'Wrong for this kind of trip, not wrong for us.',
  },
];

/** Asks what happened to one item. One tap, and the common answer is first. */
export function AnswerSheet({
  item,
  onAnswer,
  onClose,
}: {
  item: { id: string; name: string } | null;
  onAnswer: (kind: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();

  return (
    <Sheet visible={Boolean(item)} onClose={onClose} title={item?.name ?? ''}>
      <View style={{ gap: t.space.xs }}>
        {ANSWERS.map((answer) => (
          <Pressable
            key={answer.kind}
            onPress={() => onAnswer(answer.kind)}
            accessibilityRole="button"
            accessibilityLabel={`${answer.label}. ${answer.hint}`}
            style={({ pressed }) => ({
              minHeight: t.touch.floor,
              paddingVertical: t.space.sm,
              paddingHorizontal: t.space.md,
              borderRadius: t.radius.sm,
              backgroundColor: pressed ? t.color.raised : 'transparent',
              gap: 2,
            })}
          >
            <Text variant="title">{answer.label}</Text>
            <Text variant="caption" tone="muted">
              {answer.hint}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
