import { useEffect, useState } from 'react';
import { Button, CheckRow, Input, Sheet, Text } from '../design';

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
 */
export function AddItemSheet({
  visible,
  title,
  placeholder,
  check,
  onAdd,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder?: string;
  check: { label: string; hint?: string; stickyCheck?: boolean };
  onAdd: (name: string, checked: boolean) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setValue('');
    setChecked(false);
    setAdded(0);
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

      {added > 0 ? (
        <Text variant="label" tone="muted" style={{ textAlign: 'center' }}>
          {added} added
        </Text>
      ) : null}
    </Sheet>
  );
}
