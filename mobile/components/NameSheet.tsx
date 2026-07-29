import { useEffect, useState } from 'react';
import { Button, Input, Sheet } from '../design';
import { ConfirmButton } from './ConfirmButton';

/**
 * One text field and a commit. Naming a trip, adding a person, renaming either.
 *
 * These are the same interaction wearing different words, so they're the same component: a
 * bespoke sheet per noun would drift in padding and button order for no gain.
 *
 * @param initialValue prefilled for a rename, empty for a create
 * @param destructive optional delete affordance, armed-then-fired (see ConfirmButton)
 */
export function NameSheet({
  visible,
  title,
  label,
  placeholder,
  initialValue = '',
  submitLabel = 'Save',
  onSubmit,
  onClose,
  destructive,
}: {
  visible: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
  destructive?: { label: string; confirmLabel: string; onConfirm: () => void };
}) {
  const [value, setValue] = useState(initialValue);

  // Reopening must not show the last thing typed into a different trip.
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();

  function submit() {
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={setValue}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Button label={submitLabel} onPress={submit} disabled={!trimmed} full />
      {destructive ? (
        <ConfirmButton
          label={destructive.label}
          confirmLabel={destructive.confirmLabel}
          onConfirm={() => {
            destructive.onConfirm();
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}
