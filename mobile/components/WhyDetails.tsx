import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Chevron, Text, useTheme } from '../design';

/**
 * The one explanation the trip form owes, available to whoever asks for it and invisible to
 * everyone else.
 *
 * Every field used to carry a line of its own justifying itself — "a work trip and a
 * backpacking trip barely share a list", and so on. Those were the right idea in the wrong
 * place: "What you'll be doing" needs no explaining, and eight explanations of self-evident
 * prompts is most of why the screen felt like work. The prompt does the prompting.
 *
 * What genuinely isn't obvious is why any of it is worth filling in, and a slogan can't carry
 * that — it has to say what the app actually does with the answers. So it's one quiet line
 * that opens into a real explanation, rather than a headline nobody asked for.
 */
export function WhyDetails() {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
      <Pressable
        onPress={() => setOpen((was) => !was)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Why does this matter?"
        hitSlop={10}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          minHeight: t.touch.floor,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Chevron direction={open ? 'down' : 'right'} size={11} />
        <Text variant="caption" tone="muted">
          Why does this matter?
        </Text>
      </Pressable>

      {open ? (
        <Text variant="body" tone="muted" style={{ paddingBottom: t.space.sm }}>
          Your next packing list gets built from trips like this one. Describe a cold September
          weekend in a tent and Camp List can look at your other cold September weekends in a
          tent — instead of guessing from the beach trip.
        </Text>
      ) : null}
    </View>
  );
}
