import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../../test/render';
import { ItemRow } from './ItemRow';

const noop = () => {};

describe('ItemRow', () => {
  /**
   * Two targets share the row on purpose: the state control advances packing, the rest opens
   * detail. Advancing is the high-frequency action done one-handed, and must never require
   * the precision of hitting a small box versus the row around it.
   */
  it('separates advancing state from opening detail', async () => {
    const onAdvance = jest.fn();
    const onPress = jest.fn();
    const { getByLabelText, getByText } = await renderWithTheme(
      <ItemRow name="Headlamp" state="unpacked" onAdvance={onAdvance} onPress={onPress} />,
    );

    await fireEvent.press(getByLabelText('Headlamp, unpacked'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    await fireEvent.press(getByText('Headlamp'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  // Lists are owned by a person, so an avatar on every row is noise. The one genuinely
  // ambiguous case is the shared list, and there the useful fact is how many, not who.
  it('shows the each tag only when told to', async () => {
    const { queryByText, rerender } = await renderWithTheme(
      <ItemRow name="Towel" state="unpacked" onAdvance={noop} />,
    );
    expect(queryByText('each')).toBeNull();

    await rerender(<ItemRow name="Towel" state="unpacked" each onAdvance={noop} />);
    expect(queryByText('each')).toBeTruthy();
  });

  it('shows quantity only when there is more than one', async () => {
    const { queryByText, rerender } = await renderWithTheme(
      <ItemRow name="Chair" state="unpacked" qty={1} onAdvance={noop} />,
    );
    expect(queryByText('×1')).toBeNull();

    await rerender(<ItemRow name="Chair" state="unpacked" qty={4} onAdvance={noop} />);
    expect(queryByText('×4')).toBeTruthy();
  });

  /**
   * The marker only means something inside a kit, which is the only place the flag has a
   * consequence: a kit can't be packed while its consumables are unverified. On a top-level row
   * ticking the item IS the check — you can't pack zero diapers — so the badge would be labelling
   * a fact the row already states.
   */
  it('marks a consumable only inside a kit, where the flag actually gates something', async () => {
    const { queryByText, rerender } = await renderWithTheme(
      <ItemRow name="Propane" state="unpacked" consumable onAdvance={noop} />,
    );
    expect(queryByText('consumable')).toBeNull();

    await rerender(<ItemRow name="Propane" state="unpacked" consumable nested onAdvance={noop} />);
    expect(queryByText('consumable')).toBeTruthy();
  });

  it('surfaces a note in preference to the consumable marker', async () => {
    const { queryByText, rerender } = await renderWithTheme(
      <ItemRow name="Propane" state="unpacked" consumable nested onAdvance={noop} />,
    );
    expect(queryByText('consumable')).toBeTruthy();

    // A real note is more useful than the generic marker, so it wins the slot.
    await rerender(
      <ItemRow
        name="Propane"
        state="unpacked"
        consumable
        nested
        note="one full, one spare"
        onAdvance={noop}
      />,
    );
    expect(queryByText('one full, one spare')).toBeTruthy();
    expect(queryByText('consumable')).toBeNull();
  });

  it('exposes each packing state to a screen reader', async () => {
    const { getByLabelText, rerender } = await renderWithTheme(
      <ItemRow name="Tent" state="unpacked" onAdvance={noop} />,
    );
    expect(getByLabelText('Tent, unpacked')).toBeTruthy();

    await rerender(<ItemRow name="Tent" state="packed" onAdvance={noop} />);
    expect(getByLabelText('Tent, packed')).toBeTruthy();

    await rerender(<ItemRow name="Tent" state="loaded" onAdvance={noop} />);
    expect(getByLabelText('Tent, loaded')).toBeTruthy();
  });
});
