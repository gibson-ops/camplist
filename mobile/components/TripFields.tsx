import { View } from 'react-native';
import { Chip, Input, Text, useTheme } from '../design';
import { DateRangeField } from './DateRangeField';
import { TagField } from './TagField';
import type { TripContext } from '../lib/seeds';
import type { TripMetaPatch } from '../lib/trips';

/**
 * Every control the trip form is made of, in one place.
 *
 * Two screens ask these questions and they ask them differently — a stepper walks through them
 * one at a time when a trip is new, an accordion shows them all at once when you come back to
 * change something. Same fields, same writes, same canonicalization. Keeping the controls here
 * is what stops the two layouts drifting into two different forms.
 */

/**
 * Fields whose control names its own parts, so a container must not name them as well.
 *
 * Dates is the only one: "Depart" and "Return" above their own boxes say everything a "Dates"
 * heading above the pair would, and the heading only stutters against them.
 */
export const SELF_LABELED: FieldKey[] = ['dates'];

export type FieldKey =
  | 'name'
  | 'tripTypes'
  | 'attendees'
  | 'destination'
  | 'dates'
  | 'travelModes'
  | 'lodgings'
  | 'activities'
  | 'conditions'
  | 'notes';

/** The prompt for each field. Short, and answering its own question — see DESIGN.md. */
export const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'Name',
  tripTypes: 'What kind of trip',
  attendees: "Who else is going",
  destination: 'Where',
  dates: 'Dates',
  travelModes: 'Getting there',
  lodgings: "Where you're sleeping",
  activities: "What you'll be doing",
  conditions: "What you're up against",
  notes: 'Notes',
};

/** The one-line prompt a stepper puts at the top of its screen. */
export const FIELD_PROMPT: Record<FieldKey, string> = {
  name: 'What do you call this trip?',
  tripTypes: 'What kind of trip is it?',
  attendees: 'Who else is coming?',
  destination: 'Where are you headed?',
  dates: 'When?',
  travelModes: 'How are you getting there?',
  lodgings: 'Where will you sleep?',
  activities: "What will you be doing?",
  conditions: "What are you up against?",
  notes: 'Anything else?',
};

export type TripDraft = {
  name: string;
  tripTypes: string[];
  travelModes: string[];
  lodgings: string[];
  destination?: string;
  notes?: string;
  departAt?: Date;
  returnAt?: Date;
  activities: string[];
  conditions: string[];
  attendeeIds: string[];
};

export type FieldProps = {
  field: FieldKey;
  /** Passed through to the controls that can lay out more than one way. */
  layout?: 'row' | 'stack';
  draft: TripDraft;
  people: { id: string; name: string; color?: string }[];
  pastDestinations: string[];
  usedTags: { activities: string[]; conditions: string[] };
  ctx: TripContext;
  save: (patch: TripMetaPatch) => void;
  onAttendees: (next: string[]) => void;
  /** Text fields commit on blur, so they need their own local state; see useDraft. */
  text: (key: 'name' | 'destination' | 'notes') => {
    value: string;
    set: (next: string) => void;
    flush: () => void;
    commit: (next: string) => void;
  };
};

/** Renders one field's control, with no label and no page margin — the layout owns both. */
export function TripField({
  field,
  layout,
  draft,
  people,
  pastDestinations,
  usedTags,
  ctx,
  save,
  onAttendees,
  text,
}: FieldProps) {
  const t = useTheme();

  switch (field) {
    case 'name': {
      const f = text('name');
      return (
        <Input
          value={f.value}
          onChangeText={f.set}
          onBlur={f.flush}
          autoCapitalize="words"
          returnKeyType="done"
          placeholder="Uintas, Labor Day"
        />
      );
    }



    // The three axes that used to be pick-one. A trip has legs: camping AND visiting people,
    // driving out and flying back. Nothing here distinguishes them from activities any more.
    case 'tripTypes':
    case 'travelModes':
    case 'lodgings':
      return (
        <TagField
          kind={field}
          trip={ctx}
          selected={draft[field]}
          onChange={(next) => save({ [field]: next })}
        />
      );

    case 'attendees':
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {people.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              color={person.color}
              avatar
              selected={draft.attendeeIds.includes(person.id)}
              onPress={() =>
                onAttendees(
                  draft.attendeeIds.includes(person.id)
                    ? draft.attendeeIds.filter((id) => id !== person.id)
                    : [...draft.attendeeIds, person.id],
                )
              }
            />
          ))}
        </View>
      );

    case 'destination': {
      const f = text('destination');
      return (
        <View style={{ gap: t.space.sm }}>
          <Input
            value={f.value}
            onChangeText={f.set}
            onBlur={f.flush}
            autoCapitalize="words"
            returnKeyType="done"
            placeholder="Where you're headed"
          />
          {/* Somewhere you've been before, one tap away. Free text can't be matched across
              trips unless the spelling converges, and offering the old spelling is cheaper
              than asking anyone to remember whether they wrote "Uintas" or "the Uintas". */}
          {pastDestinations.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
              {pastDestinations.map((place) => (
                <Chip
                  key={place}
                  label={place}
                  selected={f.value.trim().toLowerCase() === place.toLowerCase()}
                  onPress={() => {
                    f.set(place);
                    f.commit(place);
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      );
    }

    case 'dates':
      return (
        <DateRangeField
          departAt={draft.departAt}
          returnAt={draft.returnAt}
          layout={layout}
          onChange={(next) => save(next)}
        />
      );


    case 'activities':
      return (
        <TagField
          kind="activities"
          trip={ctx}
          selected={draft.activities}
          used={usedTags.activities}
          onChange={(next) => save({ activities: next })}
        />
      );

    case 'conditions':
      return (
        <TagField
          kind="conditions"
          trip={ctx}
          selected={draft.conditions}
          used={usedTags.conditions}
          onChange={(next) => save({ conditions: next })}
        />
      );

    case 'notes': {
      const f = text('notes');
      return (
        <Input
          value={f.value}
          onChangeText={f.set}
          onBlur={f.flush}
          multiline
          placeholder="Anything the chips can't say"
          style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }}
        />
      );
    }
  }
}
