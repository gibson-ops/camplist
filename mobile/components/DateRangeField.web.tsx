import { View } from 'react-native';
import { Text, font, useTheme } from '../design';
import { formatDateRange, toCalendarDate } from '../lib/tripMeta';

/**
 * The web build's date fields. Metro swaps this in for DateRangeField.tsx, the same way it
 * swaps db.web.ts for db.ts.
 *
 * `@react-native-community/datetimepicker` is a native module with no working web
 * implementation — on web the picker never opened at all. The browser already has the right
 * control: `<input type="date">` renders the platform's own date UI, including the good one on
 * mobile Safari. Reaching for a DOM element here is the point of the file, not a shortcut.
 *
 * STACKED, NOT SIDE BY SIDE. A date input has a wide intrinsic minimum — the widget inside it
 * is a fixed size — and a flex row will let two of them overlap rather than shrink. That is
 * what happened: Return drew on top of Depart, so tapping "Return" actually edited Depart,
 * which then cleared the return date by design. It read as the return date refusing to move
 * past departure. Full width each, one above the other, and that failure can't recur.
 */
export function DateRangeField({
  departAt,
  returnAt,
  onChange,
}: {
  departAt?: Date;
  returnAt?: Date;
  onChange: (next: { departAt: Date | null; returnAt: Date | null }) => void;
}) {
  const t = useTheme();

  function pick(which: 'depart' | 'return', value: string) {
    const picked = value ? fromInputValue(value) : null;

    if (which === 'depart') {
      // Clearing departure clears return with it: a return with nothing to return from is not
      // half a range, it's nothing.
      if (!picked) return onChange({ departAt: null, returnAt: null });
      // Moving departure past the return would invert the range. Drop the stale end rather
      // than silently showing "Sep 8–4".
      const keep = returnAt && +returnAt >= +picked ? returnAt : null;
      return onChange({ departAt: picked, returnAt: keep });
    }

    onChange({ departAt: departAt ?? null, returnAt: picked });
  }

  /** Matches the Input component: 46px, 6px radius, 1px border, surface fill. */
  const field: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    boxSizing: 'border-box',
    display: 'block',
    width: '100%',
    // Flex children refuse to shrink below their content by default, and a date widget's
    // content is wide. Without this the field overflows its column.
    minWidth: 0,
    height: 46,
    padding: '0 12px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.color.border}`,
    background: t.color.surface,
    color: t.color.text,
    // NOT `inherit`. React Native Web puts the app font on Text nodes, not on containers, so an
    // inheriting form control falls back to the browser's default — which for a date input on
    // Safari is a serif.
    fontFamily: font.regular,
    fontSize: t.type.title.fontSize,
    // Makes the browser's own picker chrome follow the app's scheme instead of always
    // rendering the light one.
    colorScheme: t.scheme,
  };

  return (
    <View style={{ gap: t.space.md }}>
      <View style={{ gap: t.space.xs }}>
        <Text variant="label" tone="muted">
          Depart
        </Text>
        <input
          type="date"
          aria-label="Depart"
          value={toInputValue(departAt)}
          onChange={(e) => pick('depart', e.target.value)}
          style={field}
        />
      </View>

      <View style={{ gap: t.space.xs }}>
        <Text variant="label" tone="muted">
          Return
        </Text>
        <input
          type="date"
          aria-label="Return"
          // Inert until there's a departure to return from.
          disabled={!departAt}
          // A lower bound, never an upper one: you can come back any time after you leave.
          min={toInputValue(departAt)}
          value={toInputValue(returnAt)}
          onChange={(e) => pick('return', e.target.value)}
          style={{ ...field, opacity: departAt ? 1 : 0.5 }}
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

/** Parsed from its parts for the same reason, then pinned to local noon like every trip date. */
function fromInputValue(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return toCalendarDate(new Date(y, m - 1, d));
}
