import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  EmptyState,
  Input,
  ItemRow,
  KitRow,
  Screen,
  SectionHeader,
  Chip,
  AddChip,
  Sheet,
  StateBox,
  Text,
  ThemeProvider,
  useTheme,
  type ColorScheme,
  type KitChild,
  type PackState,
} from '../../design';
import { TRIP_TYPES } from '../../lib/seeds';

/**
 * Living gallery of the design system, in both schemes.
 *
 * If a component looks wrong here, fix the component, not this screen.
 */
export default function DesignGallery() {
  const [scheme, setScheme] = useState<ColorScheme>('dark');
  return (
    <ThemeProvider force={scheme}>
      <Gallery scheme={scheme} onToggle={() => setScheme((s) => (s === 'dark' ? 'light' : 'dark'))} />
    </ThemeProvider>
  );
}

/** Placeholder household, per the no-personal-info rule for fixtures. */
const DEMO_PEOPLE = [
  { id: 'a', name: 'Alex', color: '#7aa2c4' },
  { id: 'b', name: 'Rowan', color: '#c49a7a' },
  { id: 'c', name: 'Sam', color: '#8fc47a' },
];

const KIT_CHILDREN: KitChild[] = [
  { id: 'p', name: 'Propane', state: 'unpacked', consumable: true },
  { id: 'd', name: 'Dish soap', state: 'packed', consumable: true },
  { id: 'g', name: 'Garbage bags', state: 'unpacked', consumable: true, note: 'running low' },
  { id: 's', name: 'Skillet', state: 'packed', consumable: false },
  { id: 'u', name: 'Utensils', state: 'packed', consumable: false },
];

function Gallery({ scheme, onToggle }: { scheme: ColorScheme; onToggle: () => void }) {
  const t = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState('');
  const [kitOpen, setKitOpen] = useState(true);
  const [going, setGoing] = useState<string[]>(['a', 'c']);
  const [tripType, setTripType] = useState('Camping');
  const [kids, setKids] = useState(KIT_CHILDREN);
  const [states, setStates] = useState<Record<string, PackState>>({
    tent: 'packed',
    stove: 'unpacked',
    cooler: 'loaded',
    towels: 'unpacked',
  });

  const next = (s: PackState): PackState =>
    s === 'unpacked' ? 'packed' : s === 'packed' ? 'loaded' : 'unpacked';
  const advance = (k: string) => setStates((p) => ({ ...p, [k]: next(p[k]) }));
  const advanceKid = (id: string) =>
    setKids((p) => p.map((c) => (c.id === id ? { ...c, state: next(c.state) } : c)));

  return (
    <Screen>
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.sm }}>
        <Text variant="display">Camp List</Text>
        <Text variant="body" tone="muted">
          The Trailhead Sign — flat, one signal color, squared geometry.
        </Text>
        <Button label={`Scheme: ${scheme}`} variant="secondary" onPress={onToggle} />
      </View>

      <SectionHeader title="Type scale · Source Sans 3" />
      <Surface>
        <View style={{ padding: t.space.lg, gap: t.space.sm }}>
          <Text variant="display">Display 28/800</Text>
          <Text variant="headline">Headline 22/700</Text>
          <Text variant="title">Title 15/500 — item names</Text>
          <Text variant="body">Body 15/400 — notes and explanatory copy.</Text>
          <Text variant="label" tone="muted">Label 12/700 tracked</Text>
          <Text variant="numeric">Numeric 13/600 · 1234567890</Text>
        </View>
      </Surface>

      {/* A list is owned by a person, so rows carry no per-item people. */}
      <SectionHeader title="Shared" count="1/4" />
      <Surface>
        <ItemRow name="4-person tent" state={states.tent} onAdvance={() => advance('tent')} />
        <ItemRow name="Camp stove" state={states.stove} onAdvance={() => advance('stove')} />
        <ItemRow name="Cooler" state={states.cooler} qty={2} onAdvance={() => advance('cooler')} />
        <ItemRow
          name="Towels"
          state={states.towels}
          each
          onAdvance={() => advance('towels')}
          isLast
        />
      </Surface>

      <SectionHeader title="Kit · expand to verify" />
      <Surface>
        <KitRow
          name="Kitchen box"
          state="unpacked"
          contents={kids}
          expanded={kitOpen}
          onToggle={() => setKitOpen((v) => !v)}
          onChildAdvance={advanceKid}
          isLast
        />
      </Surface>
      <View style={{ paddingHorizontal: t.space.lg, paddingTop: t.space.sm }}>
        <Text variant="body" tone="muted">
          Only unchecked consumables block the box. The skillet lives in there permanently.
        </Text>
      </View>

      <SectionHeader title="State control" />
      <Surface>
        <View style={{ flexDirection: 'row', padding: t.space.lg, gap: t.space.xl, alignItems: 'center' }}>
          {(['unpacked', 'packed', 'loaded'] as PackState[]).map((s) => (
            <View key={s} style={{ alignItems: 'center', gap: t.space.sm }}>
              <StateBox state={s} label="demo" />
              <Text variant="label" tone="muted">{s}</Text>
            </View>
          ))}
          <View style={{ alignItems: 'center', gap: t.space.sm }}>
            <StateBox state="unpacked" label="blocked" dimmed />
            <Text variant="label" tone="muted">blocked</Text>
          </View>
        </View>
      </Surface>

      {/* Both chip shapes together, because the contrast between them is the point: a pill
          names a PERSON, a squared chip names a FACT. On the trip form they sit inches apart. */}
      <SectionHeader title="Chips · pill = person, squared = fact" />
      <Surface>
        <View style={{ padding: t.space.lg, gap: t.space.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {DEMO_PEOPLE.map((person) => (
              <Chip
                key={person.id}
                label={person.name}
                color={person.color}
                avatar
                selected={going.includes(person.id)}
                onPress={() =>
                  setGoing((prev) =>
                    prev.includes(person.id)
                      ? prev.filter((p) => p !== person.id)
                      : [...prev, person.id],
                  )
                }
              />
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
            {TRIP_TYPES.map((option: string) => (
              <Chip
                key={option}
                label={option}
                single
                selected={tripType === option}
                onPress={() => setTripType(tripType === option ? '' : option)}
              />
            ))}
            <AddChip onPress={() => {}} />
          </View>
        </View>
      </Surface>

      <SectionHeader title="Buttons" />
      <Surface>
        <View style={{ padding: t.space.lg, gap: t.space.md, alignItems: 'flex-start' }}>
          <Button label="Primary action" onPress={() => {}} />
          <Button label="Secondary" variant="secondary" onPress={() => {}} />
          <Button label="Ghost" variant="ghost" onPress={() => {}} />
          <Button label="Danger" variant="danger" onPress={() => {}} />
          <Button label="Disabled" disabled onPress={() => {}} />
        </View>
      </Surface>

      <SectionHeader title="Input" />
      <Surface>
        <View style={{ padding: t.space.lg, gap: t.space.lg }}>
          <Input label="Item name" placeholder="Sleeping bag" value={text} onChangeText={setText} />
          <Input label="With error" placeholder="you@example.com" error="That code was not accepted." />
        </View>
      </Surface>

      <SectionHeader title="Empty state" />
      <Surface>
        <View style={{ height: 190 }}>
          <EmptyState
            title="No trips yet."
            body="Start one, or build it from a past trip."
            actionLabel="New trip"
            onAction={() => setSheetOpen(true)}
          />
        </View>
      </Surface>

      <View style={{ padding: t.space.lg }}>
        <Button label="Open bottom sheet" variant="secondary" onPress={() => setSheetOpen(true)} full />
      </View>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Add an item">
        <Input placeholder="What are you bringing?" />
        <Button label="Add" onPress={() => setSheetOpen(false)} full />
      </Sheet>
    </Screen>
  );
}

/** Edge-to-edge grouped rows — the pattern that replaces cards. No horizontal margin. */
function Surface({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ backgroundColor: t.color.surface }}>{children}</View>;
}
