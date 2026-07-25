import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Button,
  EmptyState,
  Input,
  ItemRow,
  PersonChip,
  SectionHeader,
  Sheet,
  StateBox,
  Text,
  ThemeProvider,
  palette,
  useTheme,
  type ColorScheme,
} from '../../design';

const PEOPLE = [
  { id: '1', name: 'Jared', color: palette.signal },
  { id: '2', name: 'Brooke', color: '#7aa2c4' },
  { id: '3', name: 'Walker', color: palette.loaded },
];

/**
 * Living gallery of the design system. Not a product screen: it exists so the system can be
 * reviewed as a whole, in both schemes, without hunting through features.
 *
 * If a component looks wrong here, fix the component, not the screen using it.
 */
export default function DesignGallery() {
  const [scheme, setScheme] = useState<ColorScheme>('dark');

  return (
    <ThemeProvider force={scheme}>
      <Gallery scheme={scheme} onToggle={() => setScheme((s) => (s === 'dark' ? 'light' : 'dark'))} />
    </ThemeProvider>
  );
}

function Gallery({ scheme, onToggle }: { scheme: ColorScheme; onToggle: () => void }) {
  const t = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState('');
  const [states, setStates] = useState<Record<string, 'unpacked' | 'packed' | 'loaded'>>({
    tent: 'unpacked',
    stove: 'packed',
    chairs: 'loaded',
  });

  const advance = (key: string) =>
    setStates((s) => ({
      ...s,
      [key]: s[key] === 'unpacked' ? 'packed' : s[key] === 'packed' ? 'loaded' : 'unpacked',
    }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ paddingTop: 64, paddingBottom: t.space.xxl }}
    >
      <View style={{ paddingHorizontal: t.space.lg, gap: t.space.md }}>
        <Text variant="display">Camp List</Text>
        <Text variant="body" tone="muted">
          The Trailhead Sign. Flat surfaces, one signal color, squared geometry.
        </Text>
        <Button label={`Scheme: ${scheme}`} variant="secondary" onPress={onToggle} />
      </View>

      <SectionHeader title="Type scale" />
      <Surface>
        <View style={{ padding: t.space.lg, gap: t.space.sm }}>
          <Text variant="display">Display 32/800</Text>
          <Text variant="headline">Headline 24/700</Text>
          <Text variant="title">Title 17/600</Text>
          <Text variant="body">Body 16/400 — notes and explanatory copy.</Text>
          <Text variant="label" tone="muted">
            Label 12/700 tracked
          </Text>
          <Text variant="numeric">Numeric 15/600 · 1234567890</Text>
        </View>
      </Surface>

      <SectionHeader title="Color roles" />
      <Surface>
        <View style={{ padding: t.space.lg, gap: t.space.sm }}>
          <Swatch name="signal (fill only in light)" color={t.color.signal} />
          <Swatch name="loaded" color={t.color.loaded} />
          <Swatch name="danger" color={t.color.danger} />
          <Swatch name="surface" color={t.color.surface} />
          <Swatch name="raised" color={t.color.raised} />
          <Swatch name="border" color={t.color.border} />
        </View>
      </Surface>

      <SectionHeader title="Item rows" count="1/3" />
      <Surface>
        <ItemRow
          name="4-person tent"
          state={states.tent}
          onAdvance={() => advance('tent')}
          people={[PEOPLE[0], PEOPLE[1]]}
          note="one for both of us"
        />
        <ItemRow
          name="Camp stove"
          state={states.stove}
          onAdvance={() => advance('stove')}
          qty={1}
          people={[PEOPLE[0]]}
        />
        <ItemRow
          name="Camp chairs"
          state={states.chairs}
          onAdvance={() => advance('chairs')}
          effectiveQty={3}
          people={PEOPLE}
          isLast
        />
      </Surface>

      <SectionHeader title="State control" />
      <Surface>
        <View style={{ flexDirection: 'row', padding: t.space.lg, gap: t.space.xl, alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: t.space.sm }}>
            <StateBox state="unpacked" label="demo" />
            <Text variant="label" tone="muted">unpacked</Text>
          </View>
          <View style={{ alignItems: 'center', gap: t.space.sm }}>
            <StateBox state="packed" label="demo" />
            <Text variant="label" tone="muted">packed</Text>
          </View>
          <View style={{ alignItems: 'center', gap: t.space.sm }}>
            <StateBox state="loaded" label="demo" />
            <Text variant="label" tone="muted">loaded</Text>
          </View>
        </View>
      </Surface>

      <SectionHeader title="People" />
      <Surface>
        <View style={{ flexDirection: 'row', padding: t.space.lg, gap: t.space.sm, flexWrap: 'wrap' }}>
          {PEOPLE.map((p) => (
            <PersonChip key={p.id} name={p.name} color={p.color} />
          ))}
          <PersonChip name="Filter: active" active />
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
          <Button label="Loading" loading onPress={() => {}} />
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
        <View style={{ height: 200 }}>
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
    </ScrollView>
  );
}

function Surface({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.color.surface,
        borderRadius: t.radius.sm,
        marginHorizontal: t.space.lg,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function Swatch({ name, color }: { name: string; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
      <View
        style={{
          width: 40,
          height: 24,
          borderRadius: t.radius.xs,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: t.color.border,
        }}
      />
      <Text variant="label" tone="muted">
        {name}
      </Text>
    </View>
  );
}
