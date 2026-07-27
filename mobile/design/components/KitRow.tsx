import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';
import { StateBox, type PackState } from './StateBox';
import { ItemRow } from './ItemRow';

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
 * @param children this trip's contents, instantiated from the kit template
 * @param onAdvance ignored while `toCheck > 0`; the badge explains why
 */
export function KitRow({
  name,
  state,
  children,
  expanded,
  onToggle,
  onAdvance,
  onChildAdvance,
  isLast = false,
}: {
  name: string;
  state: PackState;
  children: KitChild[];
  expanded: boolean;
  onToggle: () => void;
  onAdvance?: () => void;
  onChildAdvance?: (id: string) => void;
  isLast?: boolean;
}) {
  const t = useTheme();

  // Only consumables block. Everything else is reference, not a checklist.
  const toCheck = children.filter((c) => c.consumable && c.state === 'unpacked').length;
  const blocked = toCheck > 0;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${name}, ${children.length} items${blocked ? `, ${toCheck} to check` : ''}`}
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
        <Chevron open={expanded} color={t.color.textMuted} />

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
            {children.length} items
          </Text>
        </View>

        {blocked ? (
          <View style={[styles.badge, { backgroundColor: t.color.signal, borderRadius: t.radius.xs }]}>
            <Text variant="label" tone="onSignal">
              {toCheck} to check
            </Text>
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeOk, { borderColor: t.color.loaded, borderRadius: t.radius.xs }]}>
            <Text variant="label" tone="loaded">
              checked
            </Text>
          </View>
        )}
      </Pressable>

      {expanded
        ? children.map((c, i) => (
            <ItemRow
              key={c.id}
              name={c.name}
              state={c.state}
              note={c.note}
              consumable={c.consumable}
              nested
              onAdvance={() => onChildAdvance?.(c.id)}
              isLast={isLast && i === children.length - 1}
            />
          ))
        : null}
    </View>
  );
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0 },
  meta: { textTransform: 'none', letterSpacing: 0 },
  badge: { paddingHorizontal: 5, paddingVertical: 2 },
  badgeOk: { borderWidth: 1, backgroundColor: 'transparent' },
});
