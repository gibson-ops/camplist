import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text, font, useTheme } from '../design';
import { formatDateRange } from '../lib/tripMeta';
import { nextRange } from '../lib/tripDates';

/**
 * The web build's date fields. Metro swaps this in for DateRangeField.tsx, the same way it
 * swaps db.web.ts for db.ts.
 *
 * `@react-native-community/datetimepicker` is a native module with no working web
 * implementation — on web the picker never opened at all. The browser already has the right
 * control: `<input type="date">` renders the platform's own date UI, including the good one on
 * mobile Safari. Reaching for a DOM element here is the point of the file, not a shortcut.
 *
 * @param layout `row` puts the two side by side, which suits a form where the label above each
 *               field is doing the naming. `stack` is for a stepper screen, where the heading
 *               already asks "When?" and there's a whole screen to spend.
 */
export function DateRangeField({
  departAt,
  returnAt,
  layout = 'stack',
  onChange,
}: {
  departAt?: Date;
  returnAt?: Date;
  layout?: 'row' | 'stack';
  onChange: (next: { departAt: Date | null; returnAt: Date | null }) => void;
}) {
  const t = useTheme();

  // `min` on the input constrains the widget, not the value — a desktop browser will let
  // someone type an earlier date straight in. The rules live in lib/tripDates.
  function pick(which: 'depart' | 'return', value: string) {
    const range = { departAt: departAt ?? null, returnAt: returnAt ?? null };
    onChange(nextRange(range, which, value ? fromInputValue(value) : null));
  }

  const row = layout === 'row';

  return (
    <View style={{ gap: t.space.md }}>
      <View
        style={{
          flexDirection: row ? 'row' : 'column',
          gap: row ? t.space.sm : t.space.md,
        }}
      >
        <DateInput
          caption="Depart"
          value={departAt}
          onPick={(next) => pick('depart', next)}
        />
        <DateInput
          caption="Return"
          value={returnAt}
          // Inert until there's a departure to return from.
          disabled={!departAt}
          // A lower bound, never an upper one: you can come back any time after you leave.
          min={departAt}
          onPick={(next) => pick('return', next)}
        />
      </View>

      {departAt ? (
        <Text variant="caption" tone="muted">
          {formatDateRange(departAt, returnAt)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One date input that shows what you just picked, immediately.
 *
 * A controlled input can't do that here. React restores a controlled input's DOM value
 * synchronously right after the change event, and the value it restores is whatever the prop
 * still says — which, while the write is in flight, is the OLD date. The pick landed in the
 * database and vanished from the screen until you navigated away and back.
 *
 * So the input holds its own value and reconciles when the stored one arrives. The local value
 * is the truth for the length of a round trip; the prop is the truth after that.
 */
function DateInput({
  caption,
  value,
  min,
  disabled = false,
  onPick,
}: {
  caption: string;
  value?: Date;
  min?: Date;
  disabled?: boolean;
  onPick: (value: string) => void;
}) {
  const t = useTheme();
  const stored = toInputValue(value);
  const [local, setLocal] = useState(stored);

  // Adopt the stored value whenever it actually changes — the write landing, another device,
  // or departure clearing the return date out from under this field.
  useEffect(() => setLocal(stored), [stored]);

  return (
    <View style={{ flex: 1, minWidth: 0, gap: t.space.xs }}>
      <Text variant="label" tone="muted">
        {caption}
      </Text>
      <input
        type="date"
        aria-label={caption}
        disabled={disabled}
        min={toInputValue(min) || undefined}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onPick(e.target.value);
        }}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          boxSizing: 'border-box',
          display: 'block',
          width: '100%',
          // Flex children refuse to shrink below their content by default, and a date widget's
          // content is wide. Without this the two fields overlap instead of sharing the row.
          minWidth: 0,
          height: 46,
          padding: '0 12px',
          borderRadius: t.radius.md,
          border: `1px solid ${t.color.border}`,
          background: t.color.surface,
          color: t.color.text,
          // NOT `inherit`. React Native Web puts the app font on Text nodes rather than on
          // containers, so an inheriting form control falls through to the browser's default —
          // which for a date input on Safari is a serif.
          fontFamily: font.regular,
          fontSize: t.type.title.fontSize,
          // Makes the browser's own picker follow the app's scheme instead of always rendering
          // the light one.
          colorScheme: t.scheme,
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </View>
  );
}

/**
 * `<input type="date">` speaks YYYY-MM-DD in LOCAL time.
 *
 * `toISOString()` would be the obvious way to produce it and is wrong: it converts to UTC
 * first, so anywhere west of Greenwich a date pinned to local noon comes back as the previous
 * day for half the year. Built from the local parts instead.
 */
function toInputValue(date?: Date): string {
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parsed from its parts for the same reason; `nextRange` pins it to local noon. */
function fromInputValue(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
