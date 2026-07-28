import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Input, PersonChip, Sheet, Text, useTheme } from '../design';

/**
 * Naming a trip and saying who's on it, in one step.
 *
 * Attendance is asked for here rather than left to the details screen because it's what the
 * trip gets BUILT from: every person selected gets their own list seeded, and a trip that
 * opens with the wrong set of lists has to be repaired by hand before anything can be packed.
 *
 * Everyone starts selected. A household's default trip is the whole household, and deselecting
 * the kid who's staying at grandma's is a smaller ask than selecting three people every time.
 */
export function NewTripSheet({
  visible,
  people,
  submitLabel = 'Create',
  onSubmit,
  onClose,
}: {
  visible: boolean;
  people: { id: string; name: string; color?: string }[];
  submitLabel?: string;
  onSubmit: (name: string, attendees: { id: string; name: string }[]) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [going, setGoing] = useState<string[]>([]);

  // Reopening starts clean, and re-seeds in case someone was added to the household since.
  useEffect(() => {
    if (!visible) return;
    setName('');
    setGoing(people.map((p) => p.id));
  }, [visible, people]);

  const trimmed = name.trim();
  const chosen = new Set(going);

  function toggle(personId: string) {
    setGoing((prev) =>
      prev.includes(personId) ? prev.filter((p) => p !== personId) : [...prev, personId],
    );
  }

  function submit() {
    if (!trimmed) return;
    // Ordered by the household's own order, not by tap order, so the seeded lists come out in
    // a stable sequence trip after trip.
    onSubmit(
      trimmed,
      people.filter((p) => chosen.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
    );
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="New trip">
      <Input
        label="Name"
        placeholder="Uintas, Labor Day"
        value={name}
        onChangeText={setName}
        autoFocus
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
      />

      {people.length > 0 ? (
        <View style={{ gap: t.space.sm }}>
          <Text variant="label" tone="muted">
            Who's going
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {people.map((person) => (
              <PersonChip
                key={person.id}
                name={person.name}
                color={person.color}
                active={chosen.has(person.id)}
                onPress={() => toggle(person.id)}
              />
            ))}
          </View>
          <Text
            variant="label"
            tone="muted"
            style={{ textTransform: 'none', letterSpacing: 0, opacity: 0.8 }}
          >
            {going.length === 0
              ? 'Just a shared list, then. You can add people later.'
              : `${going.length} list${going.length === 1 ? '' : 's'}, plus the shared one.`}
          </Text>
        </View>
      ) : null}

      <Button label={submitLabel} onPress={submit} disabled={!trimmed} full />
    </Sheet>
  );
}
