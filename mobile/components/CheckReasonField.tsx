import { View } from 'react-native';
import { CheckRow, Chip, Text, useTheme } from '../design';
import { CHECK_REASONS, type CheckReason } from '../lib/checkReasons';

/**
 * "Does this need checking, and what for" — the question a kit's content answers.
 *
 * SHARED BY BOTH SHEETS, which is the whole reason it exists as a component. The add sheet and the
 * edit sheet ask the same thing about the same field, and they had already drifted: one still said
 * "Runs out" with a bare checkbox while the other said "Needs checking" and offered reasons. Two
 * surfaces asking one question in two different ways is how a user learns the answers are
 * different, and they aren't.
 *
 * @param checked whether it needs a look at all — the gate the kit reads
 * @param reason what to look for; only meaningful while `checked`, and hidden otherwise because a
 *               reason for a check nobody is doing is a question about nothing
 */
export function CheckReasonField({
  checked,
  onCheckedChange,
  reason,
  onReasonChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  reason: CheckReason;
  onReasonChange: (next: CheckReason) => void;
}) {
  const t = useTheme();

  return (
    <>
      <CheckRow
        label="Needs checking"
        hint="Gets checked when you pack the kit, instead of just counted"
        checked={checked}
        onChange={onCheckedChange}
      />

      {/*
        THE REASON IS THE POINT, not bookkeeping: it is the word the kit row says out loud, and
        "charged?" is an instruction where "check" is a shrug. Chips rather than more switches
        because exactly one applies — see lib/checkReasons.ts.
      */}
      {checked ? (
        <View style={{ gap: t.space.sm }}>
          <Text variant="label" tone="muted">
            What needs checking?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {CHECK_REASONS.map((entry) => (
              <Chip
                key={entry.value}
                label={entry.label}
                selected={reason === entry.value}
                onPress={() => onReasonChange(entry.value)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}
