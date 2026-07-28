import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, SelectChip, Sheet, Text, useTheme } from '../design';
import { canonicalTag, dedupeTags, slugify } from '../lib/tripMeta';

/**
 * The long tail behind a `+`.
 *
 * Search first, then everything this household has used before, then everything the app ships,
 * then create. That order is the whole point: free text is what makes the tag set flexible and
 * also what would wreck matching, so the existing spelling has to be easier to reach than
 * typing a new one. "cold" surfaces "Cold nights" before it offers to invent anything.
 *
 * @param used every spelling already in play in this household, most-used first
 * @param pool what the app ships for this kind of tag
 * @param selected what's on the trip now, so a tag can be turned off from in here too
 */
export function TagPickerSheet({
  visible,
  title,
  placeholder,
  used,
  pool,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  used: string[];
  pool: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const chosen = useMemo(() => new Set(selected.map(slugify)), [selected]);

  /**
   * Everything on offer, household history ahead of shipped defaults. Deduped by slug, so a
   * tag this household already uses is never shown twice next to the app's own spelling.
   */
  const options = useMemo(() => {
    const all = dedupeTags([...used, ...pool]);
    const q = query.trim().toLowerCase();
    return q ? all.filter((tag) => tag.toLowerCase().includes(q)) : all;
  }, [used, pool, query]);

  /**
   * IF THE SEARCH SHOWS YOU ANYTHING, PICK ONE. IF IT SHOWS NOTHING, CREATE IT.
   *
   * Offering "Add 'fish'" while "Fishing" is sitting right above it is the duplicate trap the
   * whole canonicalisation scheme exists to avoid — and slug-matching can't catch it, because
   * "fish" and "Fishing" genuinely are different strings. Since the list is filtered to options
   * containing the query, anything still on screen means the user is mid-search rather than
   * inventing something. Finish typing "Golf lessons" and the matches fall away on their own.
   */
  const typed = canonicalTag(query, options);
  const canCreate = Boolean(typed) && options.length === 0;

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Input
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCapitalize="sentences"
        returnKeyType="done"
      />

      {options.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {options.map((tag) => (
            <SelectChip
              key={slugify(tag)}
              label={tag}
              selected={chosen.has(slugify(tag))}
              onPress={() => onToggle(tag)}
            />
          ))}
        </View>
      ) : null}

      {canCreate ? (
        <Button label={`Add "${typed}"`} onPress={() => onToggle(typed!)} full />
      ) : null}

      {options.length === 0 && !canCreate ? (
        <Text variant="caption" tone="muted">
          Nothing matches. Type something to add it.
        </Text>
      ) : null}
    </Sheet>
  );
}
