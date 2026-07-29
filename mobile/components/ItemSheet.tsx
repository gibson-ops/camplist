import { useEffect, useState } from 'react';
import { Button, CheckRow, Input, Sheet } from '../design';
import { ConfirmButton } from './ConfirmButton';

export type EditableItem = {
  id: string;
  name: string;
  note?: string;
  consumable: boolean;
  sharing: string;
  /** Sits on the shared list, which is the only place `sharing` means anything. */
  shared: boolean;
  /** True for a kit; its contents get deleted alongside it. */
  isKit: boolean;
  /** A kit's child. The only place `consumable` changes anything. */
  nested: boolean;
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
  onSave: (patch: { name: string; note?: string; consumable: boolean; sharing: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [consumable, setConsumable] = useState(false);
  const [each, setEach] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setNote(item.note ?? '');
    setConsumable(item.consumable);
    setEach(item.sharing === 'each');
  }, [item]);

  const trimmed = name.trim();

  function save() {
    if (!item || !trimmed) return;
    onSave({
      name: trimmed,
      note: note.trim() || undefined,
      consumable,
      sharing: each ? 'each' : 'one',
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
        <CheckRow
          label="Runs out"
          hint="Gets checked for restock instead of just packed"
          checked={consumable}
          onChange={setConsumable}
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
