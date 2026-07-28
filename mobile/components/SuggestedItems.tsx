import { View } from 'react-native';
import { Chip, Text, useTheme } from '../design';
import { slugify } from '../lib/tripMeta';
import type { ItemSeed } from '../lib/itemSeeds';

/**
 * What this trip probably needs, offered rather than added.
 *
 * NOTHING IS AUTO-ADDED. A list that arrives pre-filled with thirty guesses stops being read,
 * and a list that stops being read is how things get forgotten — the exact failure the app
 * exists to reduce. So these sit below the list as an offer: tap to take one, tap the ✕ to say
 * it isn't for you.
 *
 * Dismissing is not a delete. It's the household telling the app something about itself, which
 * is why it's recorded as a reflection and why doing it twice silences the suggestion for good
 * (see `dismissedNames`). Nobody should have to maintain a blocklist.
 *
 * The row refills as items are taken or turned down, so it stays a handful rather than a wall
 * of things you haven't done yet.
 */
export function SuggestedItems({
  items,
  onAdd,
  onDismiss,
}: {
  items: ItemSeed[];
  onAdd: (seed: ItemSeed) => void;
  onDismiss: (seed: ItemSeed) => void;
}) {
  const t = useTheme();
  if (!items.length) return null;

  return (
    <View
      style={{
        backgroundColor: t.color.bg,
        paddingHorizontal: t.space.lg,
        paddingTop: t.space.md,
        paddingBottom: t.space.lg,
        gap: t.space.sm,
      }}
    >
      <Text variant="label" tone="muted">
        Probably need
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
        {items.map((seed) => (
          <Chip
            key={slugify(seed.name)}
            label={seed.name}
            // Never the signal fill: amber means PACKED on this screen, and a suggestion is the
            // opposite of packed. These are offers, and they read as offers.
            selected={false}
            onPress={() => onAdd(seed)}
            onDismiss={() => onDismiss(seed)}
          />
        ))}
      </View>
    </View>
  );
}
