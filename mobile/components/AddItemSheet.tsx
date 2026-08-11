import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, CheckRow, Chip, Input, Sheet, Text, useTheme } from '../design';
import { slugify } from '../lib/tripMeta';
import { isAlreadyPresent, itemKey } from '../lib/itemKey';
import { rankNames } from '../lib/fuzzy';
import type { KnownName } from '../lib/itemNames';
import type { Place } from '../lib/places';
import type { KitTemplate } from '../lib/kitHistory';
import type { ItemSeed } from '../lib/itemSeeds';
import { DEFAULT_CHECK_REASON, type CheckReason } from '../lib/checkReasons';
import { CheckReasonField } from './CheckReasonField';

/**
 * How many names to offer as you type.
 *
 * THREE, AND THE ROW NEVER WRAPS — which is what makes the space it takes a constant. A list that
 * grows and shrinks under the field is the thing that made the sheet breathe in and out on every
 * keystroke, and a bottom sheet grows upward from a fixed edge, so every reflow moved the field
 * you were typing in.
 *
 * Small is also just right. A completion list you have to READ is slower than finishing the word,
 * and these sit above a raised keyboard where the space is worth the most.
 */
const OFFER_LIMIT = 3;

/**
 * The height the offers keep whether or not there is anything to show.
 *
 * One `Chip` tall — see design/components/Chip, which is 30 and carries its touch target in
 * hitSlop rather than in height.
 */
const OFFER_ROW = 30;

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
  kits = [],
  elsewhere = [],
  suggestions = [],
  onAdd,
  onKit,
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
  /**
   * Boxes the household has taken before, with what was in them. See `lib/kitHistory.ts`.
   *
   * Offered ahead of everything else when one matches, because a kit is not a suggestion — it is
   * a container you already defined, and its contents are an assertion rather than a guess. This
   * is also why kit names stay out of `known`: a kit is only worth offering with its contents
   * attached, and offering the name alone makes an empty box that reads as handled.
   */
  kits?: KitTemplate[];
  /**
   * Names already somewhere ELSE on this trip, with the container holding them. See `lib/places`.
   *
   * The Add button blocks on `existing` alone, which is right — a second box of matches in a
   * different place is a decision you are allowed to make. This is the half the button cannot do:
   * a kit hides its contents, so the duplicate you actually create is the one you could not see.
   */
  elsewhere?: Place[];
  suggestions?: ItemSeed[];
  onAdd: (name: string, checked: boolean, reason?: CheckReason) => void;
  onKit?: (kit: KitTemplate) => void;
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
   * Whether the offer row has claimed its space yet.
   *
   * ARMED BY THE FIRST KEYSTROKE AND NEVER DISARMED while the sheet is open, which buys exactly
   * one movement per sheet. Reserving it from the start would cost nothing to type against but
   * would open every sheet a row taller for a moment nobody has typed in yet; letting it come and
   * go with the matches is what made the field jump. One expansion, then still.
   *
   * It deliberately survives clearing the field and submitting — both of those empty `value`, and
   * collapsing on either would put the movement back in the middle of a burst of adds.
   */
  const [armed, setArmed] = useState(false);
  /**
   * Whether the check modifier has been set BY HAND this time round.
   *
   * What it guards: a name the household has put in a kit before arrives already knowing what it
   * needs looking at for, so nobody answers "propane? stocked" on every trip forever. That memory
   * has to lose to a person, though — somebody who just ticked "charged" said something, and
   * quietly overwriting it with what the history preferred would make the control feel broken.
   *
   * Untouched is not the same as unchecked, which is why this exists rather than reading `checked`.
   */
  const [touched, setTouched] = useState(false);

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
    setArmed(false);
    setTouched(false);
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

  /** Where a name already is, when that is somewhere other than here. */
  const elsewhereBy = useMemo(
    () => new Map(elsewhere.map((place) => [place.key, place.where])),
    [elsewhere],
  );

  /**
   * What the household has called things, narrowed to what is being typed.
   *
   * WHAT YOU ALREADY HAVE IS SHOWN, NOT FILTERED OUT, and it leads. Hiding it was the earlier
   * mistake: the reasoning was that an offer the Add button would refuse is a trap, which threw
   * away the thing this feature is most useful for. The duplicate you actually make is the one you
   * cannot see — a variant spelling of something already on the list, or a name sitting inside a
   * collapsed kit — and it is invisible precisely when it matters. Leading with it means the
   * warning is never the chip that fell off the end of the row.
   *
   * Only ever shown in response to typing. Offering the household's entire vocabulary to somebody
   * who has not typed anything is a dictionary, not a suggestion.
   */
  const offers = useMemo(() => {
    // Ranked deeper than the row can hold, so partitioning cannot drop a warning that ranked
    // below three ordinary matches.
    const ranked = rankNames(value, known, OFFER_LIMIT * 3).map((row) => ({
      row,
      have: present.has(row.key) || elsewhereBy.has(row.key),
      note: elsewhereBy.get(row.key),
    }));

    return [...ranked.filter((o) => o.have), ...ranked.filter((o) => !o.have)].slice(
      0,
      OFFER_LIMIT,
    );
  }, [value, known, present, elsewhereBy]);

  /**
   * Boxes matching what is being typed, ahead of loose names.
   *
   * Only where a kit can actually be made — the content sheet adds things INTO a box, so offering
   * a box there would be offering to nest one, which the model has no room for.
   */
  const kitOffers = useMemo(
    () => (check.reasons || !onKit ? [] : rankNames(value, kits, OFFER_LIMIT)),
    [value, kits, check.reasons, onKit],
  );

  /**
   * The trip's own suggestions. NOT narrowed as you type, deliberately.
   *
   * Narrowing them read well and was the second reason the sheet breathed: this block sits below
   * everything, and a bottom sheet grows upward, so shrinking it moved the field too. It bought
   * nothing — the case it existed for was typing "ro" on a first fishing trip and still seeing the
   * rod, which is in the seeds and nowhere else, and leaving the block alone shows it just as well.
   */
  const offered = useMemo(
    () => suggestions.filter((seed) => !taken.includes(slugify(seed.name))),
    [suggestions, taken],
  );

  /**
   * Writes one name and leaves the sheet ready for the next.
   *
   * Shared by the button and by tapping a remembered name, so the two cannot come to mean
   * different things — a completion applies whatever modifier is currently set, exactly as if you
   * had typed the name yourself.
   */
  function add(name: string) {
    /**
     * What this name has needed checking for before, when nobody has said otherwise.
     *
     * APPLIED AT ADD TIME, NOT REFLECTED IN THE FIELD as you type — and that is a layout decision,
     * the same one as the offer row. Ticking the box live would unfold the reason picker under
     * your thumb mid-word, which is precisely the shoving the offer row was just made to stop.
     * So the sheet stays still and the row behind it comes back already saying "stocked?".
     *
     * Only where a reason means something: `check.reasons` is what a kit's contents get, and a
     * plain list row is written `consumable: false` whatever anyone says.
     */
    const remembered =
      check.reasons && !touched
        ? known.find((row) => row.key === itemKey(name))?.checkReason
        : undefined;

    onAdd(name, remembered ? true : checked, remembered ?? (checked ? reason : undefined));
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
        onChangeText={(next) => {
          setValue(next);
          if (next.trim()) setArmed(true);
        }}
        autoFocus
        autoCapitalize="sentences"
        // "next", not "done": submitting is expected to be followed by another one.
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={submit}
      />

      {/* DIRECTLY UNDER THE FIELD, because otherwise the chips and the thing they are completing
          read as unrelated — and at a FIXED height, because a row that resizes with the number of
          matches is a row that shoves the field around while you type.

          No heading. One sits under "Probably need" below, where the chips are detached from
          anything and need saying; here they are inches under the letters that produced them. */}
      {/* A KIT LEADS, and says how much it brings. "Kitchen Box · 25 things" is a different offer
          from a name, and the count is the part that makes it obviously worth taking — it is the
          difference between retyping twenty-five rows and not. */}
      {armed && kitOffers.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {kitOffers.map((kit) => (
            <Chip
              key={kit.key}
              label={kit.name}
              note={`${kit.contents.length} things`}
              selected={false}
              onPress={() => onKit?.(kit)}
            />
          ))}
        </View>
      ) : null}

      {armed ? (
        <View style={{ height: OFFER_ROW, flexDirection: 'row', gap: t.space.sm }}>
          {offers.map(({ row, have, note }) => (
            <Chip
              key={row.key}
              label={row.name}
              // Never the signal fill: amber means PACKED, and an offer is its opposite.
              selected={false}
              have={have}
              note={note}
              // Something you already have fills the field instead of adding, which is not an
              // inconsistency but the only honest outcome: for one already here the button then
              // says so, and for one in another kit it lets you add it knowingly. Either way the
              // chip explains itself rather than being a tap that does nothing.
              onPress={() => (have ? setValue(row.name) : add(row.name))}
            />
          ))}
        </View>
      ) : null}

      {check.reasons ? (
        <CheckReasonField
          checked={checked}
          onCheckedChange={(next) => {
            setChecked(next);
            setTouched(true);
          }}
          reason={reason}
          onReasonChange={(next) => {
            setReason(next);
            setTouched(true);
          }}
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

      {/* Below the BUTTON, not under the field: someone who opened this sheet already had
          something in mind, and a wall of guesses between them and the keyboard would be in the
          way. These are for the moment AFTER, when the thing they came for is written down —
          which is also what separates them from the offer row above, whose whole job is to be
          about the word being typed right now. */}
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
