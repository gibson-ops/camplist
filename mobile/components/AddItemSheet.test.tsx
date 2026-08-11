import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../test/render';
import { AddItemSheet } from './AddItemSheet';
import type { KnownName } from '../lib/itemNames';
import type { KitTemplate } from '../lib/kitHistory';

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

    expect(view.queryByLabelText('Lantern')).toBeNull();
  });

  it('offers a remembered name once typing narrows to it', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} known={known(['🔦 Lantern', 3], ['Tent', 9])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'lant');

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
   * SURFACING THE DUPLICATE IS THE POINT, and hiding what you already had was the earlier
   * mistake — the reasoning was that an offer the button would refuse is a trap, which threw away
   * the case this feature is most useful for. A variant spelling of something already on the list
   * is invisible precisely when it matters.
   */
  it('shows what is already in the destination rather than hiding it', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} existing={['🔦 Lantern']} known={known(['🔦 Lantern', 3])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'lantern');

    expect(view.getByLabelText('🔦 Lantern, already added')).toBeTruthy();
  });

  it('names the container when the copy is somewhere else on the trip', async () => {
    // The duplicate that actually gets made: a kit hides its contents, so matches in the camp
    // kitchen look perfectly new from the shared list.
    const view = await renderWithTheme(
      <AddItemSheet
        {...props}
        known={known(['Matches', 2])}
        elsewhere={[{ key: 'matches', where: 'Camp kitchen' }]}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'match');

    expect(view.getByLabelText('Matches, already in Camp kitchen')).toBeTruthy();
  });

  it('fills the field instead of adding when you already have one', async () => {
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet
        {...props}
        onAdd={onAdd}
        existing={['🔦 Lantern']}
        known={known(['🔦 Lantern', 3])}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'lantern');
    await fireEvent.press(view.getByLabelText('🔦 Lantern, already added'));

    expect(onAdd).not.toHaveBeenCalled();
    // The button now explains it, which is the whole reason tapping fills rather than doing nothing.
    expect(view.getByLabelText('Already in the list')).toBeTruthy();
  });

  it('leads with what you already have, so the warning is never the chip that fell off', async () => {
    const view = await renderWithTheme(
      <AddItemSheet
        {...props}
        known={known(['Tent poles', 9], ['Tent stakes', 8], ['Tent footprint', 7], ['Tent', 1])}
        elsewhere={[{ key: 'tent', where: 'Camp kitchen' }]}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'tent');

    // Ranked last of the four by weight, and still shown — because it is the one that matters.
    expect(view.getByLabelText('Tent, already in Camp kitchen')).toBeTruthy();
    expect(view.queryByLabelText('Tent footprint')).toBeNull();
  });

  it('marks a name this burst has already added', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} known={known(['Lantern', 3], ['Lantern mantles', 1])} />,
    );

    const field = view.getByPlaceholderText('Sleeping bag');
    await fireEvent.changeText(field, 'lantern');
    await fireEvent.press(view.getByLabelText('Lantern'));
    await fireEvent.changeText(field, 'lantern');

    expect(view.getByLabelText('Lantern, already added')).toBeTruthy();
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

/**
 * A NAME THAT HAS BEEN IN A KIT BEFORE ARRIVES KNOWING WHY. Propane needs stocking on every trip
 * there has ever been, and re-answering that each time is the thing the learning loop exists to
 * stop. Applied when the row is written rather than reflected in the field as you type — ticking
 * the box live would unfold the reason picker under your thumb mid-word.
 */
describe('AddItemSheet remembered check reasons', () => {
  const kit = { check: { label: 'Needs checking', reasons: true, stickyCheck: true } };
  const propane = (): KnownName[] => [
    { name: 'Propane', key: 'propane', weight: 4, checkReason: 'empty' },
  ];

  it('applies what the household already said, without being asked again', async () => {
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet {...props} {...kit} onAdd={onAdd} known={propane()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'prop');
    await fireEvent.press(view.getByLabelText('Propane'));

    expect(onAdd).toHaveBeenCalledWith('Propane', true, 'empty');
  });

  it('applies it to a name typed out in full, not only to a tapped chip', async () => {
    // Otherwise the memory would depend on whether you happened to reach for the chip.
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet {...props} {...kit} onAdd={onAdd} known={propane()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'Propane');
    await fireEvent.press(view.getByLabelText('Add'));

    expect(onAdd).toHaveBeenCalledWith('Propane', true, 'empty');
  });

  it('loses to a person who just said otherwise', async () => {
    // Somebody who ticked the box and chose "charged" said something. Overwriting it with what
    // the history preferred would make the control feel broken.
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet {...props} {...kit} onAdd={onAdd} known={propane()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'prop');
    await fireEvent.press(view.getByLabelText('Needs checking'));
    await fireEvent.press(view.getByLabelText('Needs charging'));
    await fireEvent.press(view.getByLabelText('Propane'));

    expect(onAdd).toHaveBeenCalledWith('Propane', true, 'charged');
  });

  it('leaves a plain list row alone, where the flag has no consequence', async () => {
    const onAdd = jest.fn();
    const view = await renderWithTheme(<AddItemSheet {...props} onAdd={onAdd} known={propane()} />);

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'prop');
    await fireEvent.press(view.getByLabelText('Propane'));

    expect(onAdd).toHaveBeenCalledWith('Propane', false, undefined);
  });

  it('says nothing about a name the household has never put in a kit', async () => {
    const onAdd = jest.fn();
    const view = await renderWithTheme(
      <AddItemSheet
        {...props}
        {...kit}
        onAdd={onAdd}
        known={[{ name: 'Skillet', key: 'skillet', weight: 2 }]}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'skil');
    await fireEvent.press(view.getByLabelText('Skillet'));

    expect(onAdd).toHaveBeenCalledWith('Skillet', false, undefined);
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
   * THIS BLOCK DOES NOT MOVE WHILE YOU TYPE. It sits below everything and a bottom sheet grows
   * upward from a fixed edge, so narrowing it shifted the field being typed in — which was the
   * second, less obvious half of the jumping. It bought nothing either: the case for narrowing
   * was still seeing "Fishing rod" after typing "ro", and leaving the block alone shows it just
   * as well.
   */
  it('leaves the trip suggestions alone while you type, so nothing below reflows', async () => {
    const view = await renderWithTheme(<AddItemSheet {...props} suggestions={suggestions} />);

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'ro');

    expect(view.getByLabelText('Fishing rod')).toBeTruthy();
    expect(view.getByLabelText('Cooler')).toBeTruthy();
  });

  it('keeps the two groups apart, since only one of them is evidence', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} suggestions={suggestions} known={known(['Rope', 6])} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'ro');

    // The offer row has no heading — it is inches under the letters that produced it. Only the
    // detached block below the button needs saying what it is.
    expect(view.getByLabelText('Rope')).toBeTruthy();
    expect(view.getByText('Probably need')).toBeTruthy();
    expect(view.getByLabelText('Fishing rod')).toBeTruthy();
  });
});

/**
 * A KIT IS NOT A SUGGESTION. It is a container the household already defined, and its contents are
 * an assertion rather than a guess — which is why it can arrive filled where a list of guesses
 * could not. Kit names stay out of `known` for the opposite reason: offered alone, they make an
 * empty box that reads as handled.
 */
describe('AddItemSheet kits', () => {
  const kitchen = (): KitTemplate[] => [
    {
      name: 'Kitchen Box',
      key: 'kitchen box',
      from: 'Bryce Canyon YM',
      trips: 3,
      contents: [
        { name: 'Skillet', consumable: false },
        { name: 'Propane', consumable: true, checkReason: 'empty' },
      ],
    },
  ];

  it('offers a remembered box, and says how much it brings', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} kits={kitchen()} onKit={jest.fn()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'kitch');

    // The count is what makes the offer obviously worth taking — the difference between
    // retyping the box and not.
    expect(view.getByLabelText('Kitchen Box, 2 things')).toBeTruthy();
  });

  it('hands back the whole template, contents and all', async () => {
    const onKit = jest.fn();
    const view = await renderWithTheme(<AddItemSheet {...props} kits={kitchen()} onKit={onKit} />);

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'kitch');
    await fireEvent.press(view.getByLabelText('Kitchen Box, 2 things'));

    expect(onKit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kitchen Box' }));
    expect(onKit.mock.calls[0][0].contents).toHaveLength(2);
  });

  it('offers nothing until something is typed', async () => {
    const view = await renderWithTheme(
      <AddItemSheet {...props} kits={kitchen()} onKit={jest.fn()} />,
    );

    expect(view.queryByLabelText('Kitchen Box, 2 things')).toBeNull();
  });

  /** The content sheet adds things INTO a box. Offering a box there is offering to nest one. */
  it('never offers a kit inside a kit', async () => {
    const view = await renderWithTheme(
      <AddItemSheet
        {...props}
        check={{ label: 'Needs checking', reasons: true }}
        kits={kitchen()}
        onKit={jest.fn()}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Sleeping bag'), 'kitch');

    expect(view.queryByLabelText('Kitchen Box, 2 things')).toBeNull();
  });
});
