import { useEffect, useState } from 'react';
import { Button } from '../design';

/**
 * A destructive action that arms on the first tap and fires on the second.
 *
 * Inline rather than a confirmation dialog, per DESIGN.md: sheets are the app's only floating
 * layer, and stacking an alert on top of one to ask "are you sure" is exactly the reflex that
 * makes an app feel like paperwork. The armed state disarms itself after a few seconds so a
 * half-committed delete can't sit waiting for a stray thumb.
 *
 * @param label resting label, e.g. "Delete trip"
 * @param confirmLabel armed label; it should state what the next tap does, not ask a question
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  timeoutMs = 4000,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  timeoutMs?: number;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), timeoutMs);
    return () => clearTimeout(timer);
  }, [armed, timeoutMs]);

  return (
    <Button
      label={armed ? confirmLabel : label}
      variant={armed ? 'danger' : 'ghost'}
      onPress={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      full
    />
  );
}
