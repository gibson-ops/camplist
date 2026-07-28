import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, CheckRow, Chip, Input, Sheet, Text, useTheme } from '../design';
import { slugify } from '../lib/tripMeta';
import type { ItemSeed } from '../lib/itemSeeds';

/**
 * Rapid entry for list contents. Used both for items on a list and for things inside a kit.
 *
 * Stays open after each add and clears the field, because packing lists are written in bursts
 * ("headlamp, matches, lighter, firestarter") and closing after every one would turn a
 * thirty-second brain-dump into thirty taps. The running tally is the receipt that the last
 * one landed, since the row itself is behind the sheet.
 *
 * @param check the one modifier this entry mode offers — kit-or-not for a list, consumable-
 *              or-not inside a kit. Its value is sticky between adds when stocking a box is
 *              the likely intent (see `stickyCheck`).
 * @param suggestions what the trip implies, narrowed to THIS list. Offering them here rather
 *                    than beside the list is what settles who a suggestion is for: opening
 *                    "Add item" under Brooke's list is already a statement that whatever comes
 *                    next is hers, so the sheet never has to ask.
 */
export function AddItemSheet({
  visible,
  title,
  placeholder,
  check,
  suggestions = [],
  onAdd,
  onSuggestion,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder?: string;
  check: { label: string; hint?: string; stickyCheck?: boolean };
  suggestions?: ItemSeed[];
  onAdd: (name: string, checked: boolean) => void;
  onSuggestion?: (seed: ItemSeed) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [taken, setTaken] = useState<string[]>([]);
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setValue('');
    setChecked(false);
    setAdded(0);
    setTaken([]);
  }, [visible]);

  const trimmed = value.trim();

  function submit() {
    if (!trimmed) return;
    onAdd(trimmed, checked);
    setValue('');
    // A kit is a one-off; a shelf of consumables is not. Only the latter stays armed.
    if (!check.stickyCheck) setChecked(false);
    setAdded((n) => n + 1);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Input
        placeholder={placeholder ?? 'Sleeping bag'}
        value={value}
        onChangeText={setValue}
        autoFocus
        autoCapitalize="sentences"
        // "next", not "done": submitting is expected to be followed by another one.
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={submit}
      />

      <CheckRow label={check.label} hint={check.hint} checked={checked} onChange={setChecked} />

      <Button label="Add" onPress={submit} disabled={!trimmed} full />

      {/* Below the field, not above it: someone who opened this sheet already had something in
          mind, and a wall of guesses between them and the keyboard would be in the way. These
          are for the moment AFTER, when the thing they came for is written down. */}
      {suggestions.length ? (
        <View style={{ gap: t.space.sm }}>
          <Text variant="label" tone="muted">
            Probably need
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {suggestions
              .filter((seed) => !taken.includes(slugify(seed.name)))
              .map((seed) => (
                <Chip
                  key={slugify(seed.name)}
                  label={seed.name}
                  // Never the signal fill: amber means PACKED, and a suggestion is its opposite.
                  selected={false}
                  onPress={() => {
                    onSuggestion?.(seed);
                    setTaken((was) => [...was, slugify(seed.name)]);
                    setAdded((n) => n + 1);
                  }}
                />
              ))}
          </View>
        </View>
      ) : null}

      {added > 0 ? (
        <Text variant="label" tone="muted" style={{ textAlign: 'center' }}>
          {added} added
        </Text>
      ) : null}
    </Sheet>
  );
}
