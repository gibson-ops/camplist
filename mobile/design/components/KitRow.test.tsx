import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../../test/render';
import { KitRow, type KitChild } from './KitRow';

/**
 * `checked` arrives resolved: the caller applies the rule in lib/kitChecks.ts and this component
 * only renders ticks and counts them. So a skillet — nothing about it needs verifying — is green
 * without anybody having touched it, and the propane is not.
 */
const SKILLET: KitChild = {
  id: 'c1',
  name: 'Skillet',
  state: 'unpacked',
  consumable: false,
  checked: true,
};
const PROPANE: KitChild = {
  id: 'c2',
  name: 'Propane',
  state: 'unpacked',
  consumable: true,
  checked: false,
};
const SOAP: KitChild = {
  id: 'c3',
  name: 'Dish soap',
  state: 'unpacked',
  consumable: true,
  checked: false,
};

const noop = () => {};

describe('KitRow gating', () => {
  /**
   * The product claim: the skillet lives in the box permanently and should never need ticking,
   * while the propane genuinely might be empty. Only unverified CONSUMABLES may block.
   */
  it('does not block on a non-consumable, however unpacked it is', async () => {
    const onAdvance = jest.fn();
    const { getByLabelText, getByText, queryByText } = await renderWithTheme(
      <KitRow
        name="Kitchen box"
        state="unpacked"
        contents={[SKILLET]}
        expanded={false}
        onToggle={noop}
        onAdvance={onAdvance}
      />,
    );

    await fireEvent.press(getByLabelText('Kitchen box, unpacked'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(getByText('checked')).toBeTruthy();
  });

  it('blocks while an unverified consumable remains', async () => {
    const onAdvance = jest.fn();
    const { getByLabelText } = await renderWithTheme(
      <KitRow
        name="Kitchen box"
        state="unpacked"
        contents={[SKILLET, PROPANE, SOAP]}
        expanded={false}
        onToggle={noop}
        onAdvance={onAdvance}
      />,
    );

    await fireEvent.press(getByLabelText('Kitchen box, unpacked'));
    expect(onAdvance).not.toHaveBeenCalled();
  });

  // The state must never be communicated by dimming alone: the badge carries the reason, and
  // it names a count so "why can't I check this" is answerable without expanding the box.
  it('says how many are outstanding rather than only dimming', async () => {
    const { getByLabelText, getByText, queryByText } = await renderWithTheme(
      <KitRow
        name="Kitchen box"
        state="unpacked"
        contents={[SKILLET, PROPANE, SOAP]}
        expanded={false}
        onToggle={noop}
        onAdvance={noop}
      />,
    );

    expect(getByText('2 to check')).toBeTruthy();
    expect(queryByText('checked')).toBeNull();
  });

  it('unblocks once the consumables are handled', async () => {
    const onAdvance = jest.fn();
    const { getByLabelText, getByText, queryByText } = await renderWithTheme(
      <KitRow
        name="Kitchen box"
        state="unpacked"
        contents={[
          SKILLET,
          { ...PROPANE, state: 'packed', checked: true },
          { ...SOAP, state: 'loaded', checked: true },
        ]}
        expanded={false}
        onToggle={noop}
        onAdvance={onAdvance}
      />,
    );

    expect(getByText('checked')).toBeTruthy();
    await fireEvent.press(getByLabelText('Kitchen box, unpacked'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('announces the outstanding count to a screen reader too', async () => {
    const { getByLabelText, getByText, queryByText } = await renderWithTheme(
      <KitRow
        name="Kitchen box"
        state="unpacked"
        contents={[PROPANE]}
        expanded={false}
        onToggle={noop}
      />,
    );
    expect(getByLabelText('Kitchen box, 1 item, 1 to check')).toBeTruthy();
  });
});

describe('KitRow disclosure', () => {
  it('hides contents until expanded', async () => {
    const { rerender, getByText, queryByText } = await renderWithTheme(
      <KitRow
        name="Kitchen box"
        state="unpacked"
        contents={[SKILLET]}
        expanded={false}
        onToggle={noop}
      />,
    );
    expect(queryByText('Skillet')).toBeNull();

    await rerender(
      <KitRow name="Kitchen box" state="unpacked" contents={[SKILLET]} expanded onToggle={noop} />,
    );
    expect(getByText('Skillet')).toBeTruthy();
  });

  it('offers an add row inside the box only when it can accept one', async () => {
    const { rerender, getByText, queryByText } = await renderWithTheme(
      <KitRow name="Kitchen box" state="unpacked" contents={[SKILLET]} expanded onToggle={noop} />,
    );
    expect(queryByText('Add to Kitchen box')).toBeNull();

    await rerender(
      <KitRow
        name="Kitchen box"
        state="unpacked"
        contents={[SKILLET]}
        expanded
        onToggle={noop}
        onAdd={noop}
      />,
    );
    expect(getByText('Add to Kitchen box')).toBeTruthy();
  });

  // An empty box is not a checked box. Showing "checked" on something with nothing in it
  // would be the app asserting something it can't know.
  it('reads as empty, with no verification badge, when it has no contents', async () => {
    const { getByLabelText, getByText, queryByText } = await renderWithTheme(
      <KitRow name="Kitchen box" state="unpacked" contents={[]} expanded={false} onToggle={noop} />,
    );
    expect(getByText('empty')).toBeTruthy();
    expect(queryByText('checked')).toBeNull();
  });

  it('pluralises the count', async () => {
    const { rerender, getByText, queryByText } = await renderWithTheme(
      <KitRow name="Box" state="unpacked" contents={[SKILLET]} expanded={false} onToggle={noop} />,
    );
    expect(getByText('1 item')).toBeTruthy();

    await rerender(
      <KitRow
        name="Box"
        state="unpacked"
        contents={[SKILLET, PROPANE]}
        expanded={false}
        onToggle={noop}
      />,
    );
    expect(getByText('2 items')).toBeTruthy();
  });
});
