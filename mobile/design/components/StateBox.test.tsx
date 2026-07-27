import { fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { renderWithTheme } from '../../test/render';
import { StateBox } from './StateBox';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const impact = Haptics.impactAsync as jest.Mock;
const selection = Haptics.selectionAsync as jest.Mock;

beforeEach(() => {
  impact.mockClear();
  selection.mockClear();
  impact.mockImplementation(async () => {});
});

describe('StateBox haptics', () => {
  /**
   * Weight escalates with progress: a light tick for packed, a heavier one for loaded, and a
   * soft selection for undo. Undo is deliberately the quietest — taking something back out of
   * the car is a correction, and a correction shouldn't feel like an achievement.
   */
  it('escalates weight as packing progresses', async () => {
    const { getByLabelText, rerender } = await renderWithTheme(
      <StateBox state="unpacked" label="Tent" onAdvance={jest.fn()} />,
    );

    await fireEvent.press(getByLabelText('Tent, unpacked'));
    expect(impact).toHaveBeenCalledWith('light');

    await rerender(<StateBox state="packed" label="Tent" onAdvance={jest.fn()} />);
    await fireEvent.press(getByLabelText('Tent, packed'));
    expect(impact).toHaveBeenCalledWith('medium');

    await rerender(<StateBox state="loaded" label="Tent" onAdvance={jest.fn()} />);
    await fireEvent.press(getByLabelText('Tent, loaded'));
    expect(selection).toHaveBeenCalledTimes(1);
  });

  // Web has no haptic engine, and neither does a dev build made before expo-haptics was
  // added. Neither is a reason to drop a tap on the floor.
  it('still advances when the haptic engine throws', async () => {
    impact.mockImplementation(() => {
      throw new Error('no haptic engine');
    });
    const onAdvance = jest.fn();
    const { getByLabelText } = await renderWithTheme(
      <StateBox state="unpacked" label="Tent" onAdvance={onAdvance} />,
    );

    await fireEvent.press(getByLabelText('Tent, unpacked'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('stays silent when there is nothing to advance', async () => {
    const { getByLabelText } = await renderWithTheme(<StateBox state="unpacked" label="Tent" />);
    await fireEvent.press(getByLabelText('Tent, unpacked'));
    expect(impact).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
  });

  // A blocked kit passes no onAdvance. Buzzing while refusing to act would be a lie.
  it('stays silent when blocked', async () => {
    const { getByLabelText } = await renderWithTheme(
      <StateBox state="unpacked" label="Kitchen box" dimmed />,
    );
    await fireEvent.press(getByLabelText('Kitchen box, unpacked'));
    expect(impact).not.toHaveBeenCalled();
  });
});

describe('StateBox accessibility', () => {
  it('reports checked for both filled states', async () => {
    const { getByRole, rerender } = await renderWithTheme(
      <StateBox state="unpacked" label="Tent" onAdvance={jest.fn()} />,
    );
    expect(getByRole('checkbox').props.accessibilityState.checked).toBe(false);

    await rerender(<StateBox state="packed" label="Tent" onAdvance={jest.fn()} />);
    expect(getByRole('checkbox').props.accessibilityState.checked).toBe(true);

    await rerender(<StateBox state="loaded" label="Tent" onAdvance={jest.fn()} />);
    expect(getByRole('checkbox').props.accessibilityState.checked).toBe(true);
  });

  it('leaves the tree entirely when decorative', async () => {
    const { queryByRole } = await renderWithTheme(
      <StateBox state="packed" label="This is a box or kit" decorative />,
    );
    expect(queryByRole('checkbox')).toBeNull();
  });
});
