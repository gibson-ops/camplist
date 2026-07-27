import { act, fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../test/render';
import { ConfirmButton } from './ConfirmButton';

const LABEL = 'Delete trip';
const CONFIRM = 'Tap again to delete';

describe('ConfirmButton', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('arms on the first tap without firing', async () => {
    const onConfirm = jest.fn();
    const { getByText } = await renderWithTheme(
      <ConfirmButton label={LABEL} confirmLabel={CONFIRM} onConfirm={onConfirm} />,
    );

    await fireEvent.press(getByText(LABEL));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(getByText(CONFIRM)).toBeTruthy();
  });

  it('fires on the second tap', async () => {
    const onConfirm = jest.fn();
    const { getByText } = await renderWithTheme(
      <ConfirmButton label={LABEL} confirmLabel={CONFIRM} onConfirm={onConfirm} />,
    );

    await fireEvent.press(getByText(LABEL));
    await fireEvent.press(getByText(CONFIRM));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /**
   * A half-committed delete must not sit waiting for a stray thumb. This is the whole reason
   * the pattern is acceptable in place of a confirmation dialog.
   */
  it('disarms itself if the second tap never comes', async () => {
    const onConfirm = jest.fn();
    const { getByText, queryByText } = await renderWithTheme(
      <ConfirmButton label={LABEL} confirmLabel={CONFIRM} onConfirm={onConfirm} />,
    );

    await fireEvent.press(getByText(LABEL));
    expect(queryByText(CONFIRM)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    expect(queryByText(CONFIRM)).toBeNull();
    expect(getByText(LABEL)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('returns to resting after firing, so a reused sheet is never pre-armed', async () => {
    const onConfirm = jest.fn();
    const { getByText } = await renderWithTheme(
      <ConfirmButton label={LABEL} confirmLabel={CONFIRM} onConfirm={onConfirm} />,
    );

    await fireEvent.press(getByText(LABEL));
    await fireEvent.press(getByText(CONFIRM));
    expect(getByText(LABEL)).toBeTruthy();
  });
});
