import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, CheckRow, Input, Sheet, Text, useTheme } from '../design';
import { CHECK_REASONS, DEFAULT_CHECK_REASON, type CheckReason } from '../lib/checkReasons';
import { CheckReasonField } from './CheckReasonField';
import { ConfirmButton } from './ConfirmButton';

export type EditableItem = {
  id: string;
  name: string;
  note?: string;
  consumable: boolean;
  /** Why it needs a look, when it does — see lib/checkReasons.ts. Absent means depletion. */
  checkReason?: string;
  sharing: string;
  /** Sits on the shared list, which is the only place `sharing` means anything. */
  shared: boolean;
  /** True for a kit; its contents get deleted alongside it. */
  isKit: boolean;
  /** A kit's child. The only place `consumable` changes anything. */
  nested: boolean;
  /** Kept out of the learning loop, so it is never suggested on a later trip. */
  oneOff: boolean;
  childCount: number;
};

/**
 * Editing one existing thing.
 *
 * The sharing choice only appears on the shared list. Everywhere else the list's owner
 * already answers "whose is this", and offering the control anyway would imply the answer
 * is in doubt.
 */
export function ItemSheet({
  item,
  onSave,
  onDelete,
  onClose,
}: {
  item: EditableItem | null;
  onSave: (patch: {
    name: string;
    note?: string;
    consumable: boolean;
    checkReason?: string;
    sharing: string;
    oneOff: boolean;
  }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [consumable, setConsumable] = useState(false);
  const [reason, setReason] = useState<CheckReason>(DEFAULT_CHECK_REASON);
  const [each, setEach] = useState(false);
  const [oneOff, setOneOff] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setNote(item.note ?? '');
    setConsumable(item.consumable);
    // Unrecognized or absent means depletion, which is all `consumable` used to be able to mean.
    setReason(
      CHECK_REASONS.some((r) => r.value === item.checkReason)
        ? (item.checkReason as CheckReason)
        : DEFAULT_CHECK_REASON,
    );
    setEach(item.sharing === 'each');
    setOneOff(item.oneOff);
  }, [item]);

  const trimmed = name.trim();

  function save() {
    if (!item || !trimmed) return;
    onSave({
      name: trimmed,
      note: note.trim() || undefined,
      consumable,
      // Omitted rather than nulled when unchecked: `reasonOf` already ignores it without the flag,
      // and sending `undefined` into a transaction writes a key nothing reads.
      ...(consumable ? { checkReason: reason } : {}),
      sharing: each ? 'each' : 'one',
      oneOff,
    });
    onClose();
  }

  return (
    <Sheet visible={Boolean(item)} onClose={onClose} title={item?.isKit ? 'Kit' : 'Item'}>
      <Input value={name} onChangeText={setName} autoCapitalize="sentences" returnKeyType="done" />
      <Input
        label="Note"
        placeholder="Optional"
        value={note}
        onChangeText={setNote}
        autoCapitalize="sentences"
      />

      {/*
        CONSUMABLES ONLY EXIST INSIDE KITS. The flag's single consequence is the gate — a kit
        can't be marked packed while its consumables are unverified — and a top-level item has no
        gate to fail. Ticking it is already the check: you cannot pack zero diapers. A diaper BAG
        you can pack while the diapers in it ran out months ago, which is the whole reason the
        flag exists and exactly where it belongs.
      */}
      {item?.nested ? (
        <CheckReasonField
          checked={consumable}
          onCheckedChange={setConsumable}
          reason={reason}
          onReasonChange={setReason}
        />
      ) : null}

      {item?.shared ? (
        <CheckRow
          label="Everyone brings their own"
          hint="Off means one of these covers the whole group"
          checked={each}
          onChange={setEach}
        />
      ) : null}

      {/*
        OFFERED WHEN EDITING, NEVER WHEN ADDING. Adding is a burst — "headlamp, matches, lighter" —
        and a decision per item would end that. Editing one row is already deliberate, which is the
        moment someone knows a thing was for this trip only.

        Phrased as the trip rather than the mechanism. "Just this trip" is a fact about the item;
        "exclude from learning" asks the user to model the suggester.
      */}
      <CheckRow
        label="Just this trip"
        hint="Won't be suggested for future trips"
        checked={oneOff}
        onChange={setOneOff}
      />

      <Button label="Save" onPress={save} disabled={!trimmed} full />

      <ConfirmButton
        label="Delete"
        confirmLabel={
          item && item.childCount > 0
            ? `Tap again — deletes ${item.childCount} inside`
            : 'Tap again to delete'
        }
        onConfirm={() => {
          onDelete();
          onClose();
        }}
      />
    </Sheet>
  );
}
