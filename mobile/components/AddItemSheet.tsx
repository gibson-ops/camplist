import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, CheckRow, Chip, Input, Sheet, Text, useTheme } from '../design';
import { slugify } from '../lib/tripMeta';
import { isAlreadyPresent } from '../lib/itemKey';
import type { ItemSeed } from '../lib/itemSeeds';
import { DEFAULT_CHECK_REASON, type CheckReason } from '../lib/checkReasons';
import { CheckReasonField } from './CheckReasonField';

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
  existing = [],
  suggestions = [],
  onAdd,
  onSuggestion,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder?: string;
  /**
   * The one modifier this entry mode offers. `reasons` swaps the bare checkbox for the shared
   * "needs checking, and what for" field — the same control the edit sheet uses, so the two cannot
   * drift into asking one question two ways again.
   */
  check: { label: string; hint?: string; stickyCheck?: boolean; reasons?: boolean };
  /**
   * What is already in the place this adds to, so the same thing can't go on twice.
   *
   * A long list is exactly where you stop remembering what you put on it, which is where the
   * accidental duplicate happens and where it is least visible.
   */
  existing?: string[];
  suggestions?: ItemSeed[];
  onAdd: (name: string, checked: boolean, reason?: CheckReason) => void;
  onSuggestion?: (seed: ItemSeed) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [taken, setTaken] = useState<string[]>([]);
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState<CheckReason>(DEFAULT_CHECK_REASON);
  const [added, setAdded] = useState(0);
  /** Names written since the sheet opened, so a burst of adds can't repeat itself. */
  const [addedNames, setAddedNames] = useState<string[]>([]);

  /**
   * Clears on open AND on a change of target.
   *
   * `title` is the target's identity here — a list's name, or "Into <kit>" — so it changing means
   * the sheet is now pointed somewhere else without having closed. That happens when creating a
   * kit aims the sheet inside it, and carrying the previous tally across would have the running
   * count of what you added to the list appear as things you had put in the box.
   */
  useEffect(() => {
    if (!visible) return;
    setValue('');
    setChecked(false);
    setAdded(0);
    setAddedNames([]);
    setTaken([]);
  }, [visible, title]);

  const trimmed = value.trim();
  // Session adds count too: two in a row without closing the sheet is the same mistake.
  const duplicate = isAlreadyPresent(value, [...existing, ...addedNames]);

  function submit() {
    if (!trimmed || duplicate) return;
    onAdd(trimmed, checked, checked ? reason : undefined);
    setAddedNames((was) => [...was, trimmed]);
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

      {check.reasons ? (
        <CheckReasonField
          checked={checked}
          onCheckedChange={setChecked}
          reason={reason}
          onReasonChange={setReason}
        />
      ) : (
        <CheckRow label={check.label} hint={check.hint} checked={checked} onChange={setChecked} />
      )}

      {/* SAID, NOT JUST DISABLED. A dead button with no reason reads as broken; the sentence is
          the whole feature, because the useful information is that the thing is already handled. */}
      {duplicate ? (
        <Text variant="label" tone="muted">
          Already in the list.
        </Text>
      ) : null}

      <Button label="Add" onPress={submit} disabled={!trimmed || duplicate} full />

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
                    setAddedNames((was) => [...was, seed.name]);
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
