import { View } from 'react-native';
import { Text, useTheme } from '../design';
import { formatDateRange, toCalendarDate } from '../lib/tripMeta';

/**
 * The web build's date fields. Metro swaps this in for DateRangeField.tsx, the same way it
 * swaps db.web.ts for db.ts.
 *
 * `@react-native-community/datetimepicker` is a native module with no working web
 * implementation — on web the picker simply never opened, which is a field you cannot fill in
 * at all. The browser already has the right control: `<input type="date">` renders the
 * platform's own date UI, including the good one on mobile Safari and Chrome. Reaching for a
 * DOM element here is the point of the file, not a shortcut.
 *
 * The rules are the native version's, restated rather than shared because they're three lines
 * each and a shared module would be more indirection than saving: a return without a departure
 * is nothing, moving departure past the return drops the stale end, and clearing departure
 * clears both.
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
    width: '100%',
    minHeight: 46,
    padding: '0 12px',
    borderRadius: t.radius.md,
    border: `1px solid ${t.color.border}`,
    background: t.color.surface,
    color: t.color.text,
    fontFamily: 'inherit',
    fontSize: t.type.title.fontSize,
    // Safari renders an empty date input as a stack of grey placeholders otherwise.
    lineHeight: '44px',
  };

  return (
    <View style={{ gap: t.space.sm, paddingHorizontal: t.space.lg }}>
      <Text variant="label" tone="muted">
        Dates
      </Text>

      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        <View style={{ flex: 1, gap: 4 }}>
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

        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="label" tone="muted">
            Return
          </Text>
          <input
            type="date"
            aria-label="Return"
            // A return with no departure is not half a range, it's nothing: nothing derives
            // from it and nothing displays it.
            disabled={!departAt}
            min={toInputValue(departAt)}
            value={toInputValue(returnAt)}
            onChange={(e) => pick('return', e.target.value)}
            style={{ ...field, opacity: departAt ? 1 : 0.5 }}
          />
        </View>
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
