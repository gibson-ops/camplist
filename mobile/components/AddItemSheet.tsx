import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, CheckRow, Chip, Input, Sheet, Text, useTheme } from '../design';
import { slugify } from '../lib/tripMeta';
import { isAlreadyPresent, itemKey } from '../lib/itemKey';
import { rankNames } from '../lib/fuzzy';
import type { KnownName } from '../lib/itemNames';
import type { ItemSeed } from '../lib/itemSeeds';
import { DEFAULT_CHECK_REASON, type CheckReason } from '../lib/checkReasons';
import { CheckReasonField } from './CheckReasonField';

/**
 * How many names to offer at once, in each of the two groups below the button.
 *
 * Small on purpose. These sit above a raised keyboard, and a completion list you have to read is
 * slower than finishing the word — five is enough to contain the right answer and short enough to
 * take in without moving your eyes.
 */
const OFFER_LIMIT = 5;

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
  duplicateLabel = 'Already in the list',
  known = [],
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
  /**
   * What the button says when what you typed is already there.
   *
   * Worded by the caller because the destination has a name: a kit is not "the list", and being
   * told the wrong one is worse than being told nothing.
   */
  duplicateLabel?: string;
  /**
   * Every name the household has ever written down. See `lib/itemNames.ts`.
   *
   * Distinct from `suggestions`, which is what this TRIP probably needs. This is what the
   * household CALLS things, and it only ever appears in response to typing — so the two never
   * compete for the same moment.
   */
  known?: KnownName[];
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

  /**
   * Names already where this is going, keyed the SAME WAY the duplicate guard keys them.
   *
   * Sharing `itemKey` is the whole point rather than an economy: offering a completion that the
   * Add button would then refuse is a trap, and any second opinion about what counts as the same
   * name is how the two drift into disagreeing.
   */
  const present = useMemo(
    () => new Set([...existing, ...addedNames].map(itemKey)),
    [existing, addedNames],
  );

  /**
   * What the household has called things, narrowed to what is being typed.
   *
   * Only ever shown in response to typing. Offering the household's entire vocabulary to somebody
   * who has not typed anything is a dictionary, not a suggestion.
   */
  const completions = useMemo(
    () =>
      rankNames(
        value,
        known.filter((row) => !present.has(row.key)),
        OFFER_LIMIT,
      ),
    [value, known, present],
  );

  /**
   * The trip's own suggestions, narrowed the same way once there is something to narrow by.
   *
   * Filtered rather than hidden while typing, because the two answer different questions and the
   * seeds are the only source that can name something this household has never packed. Type "ro"
   * on the first fishing trip and "Fishing rod" is in the seeds and nowhere else.
   */
  const offered = useMemo(() => {
    const live = suggestions.filter((seed) => !taken.includes(slugify(seed.name)));
    return trimmed ? rankNames(value, live, OFFER_LIMIT) : live;
  }, [suggestions, taken, trimmed, value]);

  /**
   * Writes one name and leaves the sheet ready for the next.
   *
   * Shared by the button and by tapping a remembered name, so the two cannot come to mean
   * different things — a completion applies whatever modifier is currently set, exactly as if you
   * had typed the name yourself.
   */
  function add(name: string) {
    onAdd(name, checked, checked ? reason : undefined);
    setAddedNames((was) => [...was, name]);
    setValue('');
    // A kit is a one-off; a shelf of consumables is not. Only the latter stays armed.
    if (!check.stickyCheck) setChecked(false);
    setAdded((n) => n + 1);
  }

  function submit() {
    if (!trimmed || duplicate) return;
    add(trimmed);
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

      {/* SAID ON THE BUTTON ITSELF. A dead button with no reason reads as broken, and a sentence
          appearing above it shoves everything below down a line at the exact moment you are
          reading — so the button says why it is unavailable and nothing moves. */}
      <Button
        label={duplicate ? duplicateLabel : 'Add'}
        onPress={submit}
        disabled={!trimmed || duplicate}
        full
      />

      {/* BOTH GROUPS LIVE BELOW THE BUTTON, and that is a layout decision rather than a visual
          one. Completions change on every keystroke; put them under the field and the check row
          and the button jitter downward the whole time you are typing, which is the same shifting
          the duplicate warning was moved onto the button to avoid. Below it, nothing above ever
          moves and the only thing that reflows is a tally nobody is reaching for.

          Two groups rather than one merged list, because they answer different questions and only
          one of them is evidence. "Packed before" is a fact about this household; "Probably need"
          is the app guessing. Merging them would need a heading honest about both, and there
          isn't one. */}
      {completions.length ? (
        <View style={{ gap: t.space.sm }}>
          <Text variant="label" tone="muted">
            Packed before
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {completions.map((row) => (
              <Chip
                key={row.key}
                label={row.name}
                // Never the signal fill: amber means PACKED, and an offer is its opposite.
                selected={false}
                onPress={() => add(row.name)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Below the field, not above it: someone who opened this sheet already had something in
          mind, and a wall of guesses between them and the keyboard would be in the way. These
          are for the moment AFTER, when the thing they came for is written down. */}
      {offered.length ? (
        <View style={{ gap: t.space.sm }}>
          <Text variant="label" tone="muted">
            Probably need
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {offered.map((seed) => (
              <Chip
                key={slugify(seed.name)}
                label={seed.name}
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
