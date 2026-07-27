import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { StateBox, type PackState } from './StateBox';
import { ItemRow } from './ItemRow';
import { AddRow } from './AddRow';
import { Chevron } from './Chevron';

export type KitChild = {
  id: string;
  name: string;
  state: PackState;
  consumable: boolean;
  note?: string;
};

/**
 * A reusable kit (the camp kitchen box) sitting on a list.
 *
 * It is just an item that happens to contain other items: it packs and loads like anything
 * else, AND it holds contents that need checking. Expanding shows everything, but only
 * unverified CONSUMABLES gate the parent — the skillet lives in the box permanently and
 * shouldn't need ticking every trip, while the propane genuinely might be empty.
 *
 * @param contents this trip's contents, instantiated from the kit template
 * @param onAdvance ignored while `toCheck > 0`; the badge explains why
 * @param onAdd shows an add row as the last child when expanded; omit to make contents read-only
 */
export function KitRow({
  name,
  state,
  contents,
  expanded,
  onToggle,
  onAdvance,
  onChildAdvance,
  onChildPress,
  onAdd,
  isLast = false,
}: {
  name: string;
  state: PackState;
  contents: KitChild[];
  expanded: boolean;
  onToggle: () => void;
  onAdvance?: () => void;
  onChildAdvance?: (id: string) => void;
  onChildPress?: (id: string) => void;
  onAdd?: () => void;
  isLast?: boolean;
}) {
  const t = useTheme();

  // Only consumables block. Everything else is reference, not a checklist.
  const toCheck = contents.filter((c) => c.consumable && c.state === 'unpacked').length;
  const blocked = toCheck > 0;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}, ${countLabel(contents.length)}${blocked ? `, ${toCheck} to check` : ''}`}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight: t.touch.row,
            paddingVertical: t.space.sm,
            paddingHorizontal: t.space.lg,
            gap: t.space.sm + 2,
            backgroundColor: pressed ? t.color.raised : t.color.surface,
            borderBottomWidth: isLast && !expanded ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: t.color.border,
          },
        ]}
      >
        <Chevron direction={expanded ? 'down' : 'right'} />

        <StateBox
          state={state}
          // Blocking here is the whole point: you can't call the box packed while its
          // consumables are unverified.
          onAdvance={blocked ? undefined : onAdvance}
          label={name}
          size={24}
          dimmed={blocked}
        />

        <View style={styles.body}>
          <Text variant="title" tone={state === 'loaded' ? 'muted' : 'default'} numberOfLines={1}>
            {name}
          </Text>
          <Text variant="label" tone="muted" style={styles.meta}>
            {countLabel(contents.length)}
          </Text>
        </View>

        {blocked ? (
          <View style={[styles.badge, { backgroundColor: t.color.signal, borderRadius: t.radius.xs }]}>
            <Text variant="label" tone="onSignal">
              {toCheck} to check
            </Text>
          </View>
        ) : contents.length > 0 ? (
          // Outline matches the label inside it, so the badge reads as one object rather
          // than a green box that happens to contain green text.
          <View style={[styles.badge, styles.badgeOk, { borderColor: t.color.loadedText, borderRadius: t.radius.xs }]}>
            <Text variant="label" tone="loaded">
              checked
            </Text>
          </View>
        ) : null}
      </Pressable>

      {expanded ? (
        <>
          {contents.map((c, i) => (
            <ItemRow
              key={c.id}
              name={c.name}
              state={c.state}
              note={c.note}
              consumable={c.consumable}
              nested
              onAdvance={() => onChildAdvance?.(c.id)}
              onPress={onChildPress ? () => onChildPress(c.id) : undefined}
              isLast={isLast && !onAdd && i === contents.length - 1}
            />
          ))}
          {onAdd ? <AddRow label={`Add to ${name}`} onPress={onAdd} nested isLast={isLast} /> : null}
        </>
      ) : null}
    </View>
  );
}

/** Shared by the visible meta and the accessible name so a screen reader hears the same words. */
function countLabel(n: number) {
  return n === 0 ? 'empty' : `${n} item${n === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0 },
  meta: { textTransform: 'none', letterSpacing: 0 },
  badge: { paddingHorizontal: 5, paddingVertical: 2 },
  badgeOk: { borderWidth: 1, backgroundColor: 'transparent' },
});
