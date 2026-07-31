import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../test/render';
import { AddItemSheet } from './AddItemSheet';
import type { KnownName } from '../lib/itemNames';

const known = (...rows: [string, number][]): KnownName[] =>
  rows.map(([name, weight]) => ({ name, key: name.trim().toLowerCase(), weight }));

const props = {
  visible: true,
  title: 'Shared',
  check: { label: 'This is a box or kit' },
  onAdd: jest.fn(),
  onClose: jest.fn(),
};

/**
 * The add sheet's job is to make the name the household already uses easier to reach than a new
 * spelling of it — the same discipline as the tag picker, for the same reason: suggestions match
 * past items by slug, so a second spelling is a second history that knows half of what they do.
 */
describe('AddItemSheet completions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers nothing until something is typed', async () => {
    const view = await renderWithTheme(<AddItemSheet {...props} known={known(['Lantern', 3])} />);

    expect(view.queryByText('Packed before')).toBeNull();
  });

  it('offers a remembered name once typing narrows to it', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} known={known(['🔦 Lantern', 3], ['Tent', 9])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'lant');

    expect(view.getByText('Packed before')).toBeTruthy();
    expect(view.getByLabelText('🔦 Lantern')).toBeTruthy();
    expect(view.queryByLabelText('Tent')).toBeNull();
  });

  it('adds the remembered spelling, not what was typed', async () => {
    // The whole point: the list ends up saying "🔦 Lantern" again rather than "lantern",
    // so both trips are one history instead of two.
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet {...props} onAdd={onAdd} known={known(['🔦 Lantern', 3])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'lantern');
    await fireEvent.press(view.getByLabelText('🔦 Lantern'));

    expect(onAdd).toHaveBeenCalledWith('🔦 Lantern', false, undefined);
  });

  /**
   * A COMPLETION THE ADD BUTTON WOULD REFUSE IS A TRAP. Both sides key names with `itemKey`, so
   * anything already in the destination is gone from the offers rather than sitting there
   * inviting a tap that does nothing.
   */
  it('never offers something already in the destination', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} existing={['Lantern']} known={known(['Lantern', 3])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'lant');

    expect(view.queryByText('Packed before')).toBeNull();
  });

  it('stops offering a name once this burst has already added it', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} known={known(['Lantern', 3], ['Lantern mantles', 1])} />,
    );

    const field = view.getByPlaceholderText('Sleeping bag');
    await fireEvent.changeText(field, 'lantern');
    await fireEvent.press(view.getByLabelText('Lantern'));
    await fireEvent.changeText(field, 'lantern');

    expect(view.queryByLabelText('Lantern')).toBeNull();
    expect(view.getByLabelText('Lantern mantles')).toBeTruthy();
  });

  it('leaves the deliberate duplicate reachable by typing it out', async () => {
    // itemKey keeps punctuation, so "Tent (spare)" is a different item on purpose — completing
    // must not be able to take that away.
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet {...props} onAdd={onAdd} existing={['Tent']} known={known(['Tent', 9])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'Tent (spare)');
    await fireEvent.press(view.getByLabelText('Add'));

    expect(onAdd).toHaveBeenCalledWith('Tent (spare)', false, undefined);
  });

  it('applies the modifier that is currently set, exactly as typing would', async () => {
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet
        {...props}
        check={{ label: 'Needs checking', reasons: true }}
        onAdd={onAdd}
        known={known(['Propane', 4])}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'prop');
    await fireEvent.press(view.getByLabelText('Needs checking'));
    await fireEvent.press(view.getByLabelText('Propane'));

    expect(onAdd).toHaveBeenCalledWith('Propane', true, 'empty');
  });
});

describe('AddItemSheet suggestions', () => {
  const suggestions = [
    { name: 'Fishing rod', sharing: 'each' as const, consumable: false },
    { name: 'Cooler', sharing: 'one' as const, consumable: false },
  ];

  it('shows what the trip needs while the field is empty', async () => {
    const view = await renderWithTheme(<AddItemSheet {...props} suggestions={suggestions} />);

    expect(view.getByText('Probably need')).toBeTruthy();
    expect(view.getByLabelText('Fishing rod')).toBeTruthy();
    expect(view.getByLabelText('Cooler')).toBeTruthy();
  });

  /**
   * Seeds are the ONLY source that can name something this household has never packed, so they
   * are narrowed rather than hidden while typing. On a first fishing trip the rod is in the seeds
   * and nowhere else, and dropping it the moment somebody types "ro" would lose the one
   * suggestion that mattered.
   */
  it('narrows the trip suggestions to what is being typed rather than hiding them', async () => {
    const view = await renderWithTheme(<AddItemSheet {...props} suggestions={suggestions} />);

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'ro');

    expect(view.getByLabelText('Fishing rod')).toBeTruthy();
    expect(view.queryByLabelText('Cooler')).toBeNull();
  });

  it('keeps the two groups apart, since only one of them is evidence', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} suggestions={suggestions} known={known(['Rope', 6])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'ro');

    expect(view.getByText('Packed before')).toBeTruthy();
    expect(view.getByLabelText('Rope')).toBeTruthy();
    expect(view.getByText('Probably need')).toBeTruthy();
    expect(view.getByLabelText('Fishing rod')).toBeTruthy();
  });
});
