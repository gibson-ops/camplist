import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';
import { Text, icon, useTheme } from '../design';
import { formatDateRange, toCalendarDate } from '../lib/tripMeta';

type Which = 'depart' | 'return';

/**
 * When you leave and when you're back.
 *
 * The two dates are one component because they have a rule between them: a return date with no
 * departure date is not half a range, it's nothing — nothing derives from it, nothing displays
 * it. So return stays inert until depart is set, and clearing depart clears return with it
 * rather than leaving an orphan behind.
 *
 * Dates are normalised to local noon on the way in (see `toCalendarDate`): a trip date is a
 * calendar day, and midnight is the one time of day that can fail to exist.
 */
export function DateRangeField({
  departAt,
  returnAt,
  layout = 'stack',
  onChange,
}: {
  departAt?: Date;
  returnAt?: Date;
  /** `row` for a form where each field is named above it; `stack` for a stepper screen. */
  layout?: 'row' | 'stack';
  onChange: (next: { departAt: Date | null; returnAt: Date | null }) => void;
}) {
  const t = useTheme();
  // iOS keeps a picker mounted in the layout; Android opens its own dialog and needs no state.
  const [openOnIOS, setOpenOnIOS] = useState<Which | null>(null);

  function commit(which: Which, picked: Date) {
    const value = toCalendarDate(picked);
    if (which === 'depart') {
      // Moving departure past the return date would invert the range. Drop the stale end
      // rather than silently showing "Sep 8–4".
      const keepReturn = returnAt && +returnAt >= +value ? returnAt : null;
      onChange({ departAt: value, returnAt: keepReturn ?? null });
    } else {
      onChange({ departAt: departAt ?? null, returnAt: value });
    }
  }

  function open(which: Which) {
    const current = which === 'depart' ? departAt : returnAt;
    // Default the return picker to the departure day, not to today: nobody scrolls back.
    const initial = current ?? (which === 'return' ? (departAt ?? new Date()) : new Date());

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: which === 'return' ? departAt : undefined,
        onChange: (event, picked) => {
          if (event.type === 'set' && picked) commit(which, picked);
        },
      });
      return;
    }
    setOpenOnIOS(which);
  }

  function clear(which: Which) {
    if (which === 'depart') onChange({ departAt: null, returnAt: null });
    else onChange({ departAt: departAt ?? null, returnAt: null });
  }

  return (
    <View style={{ gap: t.space.sm }}>
      <View style={{ flexDirection: layout === 'row' ? 'row' : 'column', gap: t.space.sm }}>
        <DateBox
          caption="Depart"
          value={departAt ? formatDateRange(departAt) : undefined}
          onPress={() => open('depart')}
          onClear={departAt ? () => clear('depart') : undefined}
        />
        <DateBox
          caption="Return"
          value={returnAt ? formatDateRange(returnAt) : undefined}
          disabled={!departAt}
          onPress={() => open('return')}
          onClear={returnAt ? () => clear('return') : undefined}
        />
      </View>

      {openOnIOS ? (
        <DateTimePicker
          value={(openOnIOS === 'depart' ? departAt : (returnAt ?? departAt)) ?? new Date()}
          mode="date"
          display="inline"
          minimumDate={openOnIOS === 'return' ? departAt : undefined}
          themeVariant={t.scheme}
          accentColor={t.color.signal}
          onChange={(event, picked) => {
            setOpenOnIOS(null);
            if (event.type === 'set' && picked) commit(openOnIOS, picked);
          }}
        />
      ) : null}
    </View>
  );
}

/** One date, styled as an Input so a tappable value doesn't read as a different kind of field. */
function DateBox({
  caption,
  value,
  disabled = false,
  onPress,
  onClear,
}: {
  caption: string;
  value?: string;
  disabled?: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${value ?? 'not set'}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.box,
        {
          minHeight: t.touch.primary,
          paddingLeft: t.space.md,
          paddingRight: onClear ? t.space.xs : t.space.md,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: t.color.border,
          backgroundColor: pressed ? t.color.raised : t.color.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.boxBody}>
        <Text variant="label" tone="muted" numberOfLines={1}>
          {caption}
        </Text>
        <Text variant="title" tone={value ? 'default' : 'muted'} numberOfLines={1}>
          {value ?? 'Pick a day'}
        </Text>
      </View>

      {onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${caption.toLowerCase()} date`}
          hitSlop={10}
          style={({ pressed }) => ({ padding: t.space.sm, opacity: pressed ? 0.5 : 1 })}
        >
          <X size={16} color={t.color.textMuted} strokeWidth={icon.stroke} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  boxBody: { flex: 1, gap: 1, minWidth: 0 },
});
