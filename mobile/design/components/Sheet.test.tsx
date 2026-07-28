import { fireEvent } from '@testing-library/react-native';
import { Dimensions, Text as RNText } from 'react-native';
import { renderWithTheme } from '../../test/render';
import { Sheet } from './Sheet';

/**
 * These exist because of a shipped bug: the sheet grew without limit while the scrim took
 * whatever was left, so the tag picker with forty chips in it squeezed the scrim to nothing.
 * Tapping outside was the only way out, the handle was a decorative View, and on web there's no
 * hardware back button — a modal that could not be closed.
 */
describe('Sheet', () => {
  it('closes from the scrim', async () => {
    const onClose = jest.fn();
    const view = await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    await fireEvent.press(view.getAllByLabelText('Close')[0]);
    expect(onClose).toHaveBeenCalled();
  });

  // The exit that doesn't depend on reaching the scrim, and the only one a screen reader can
  // find. There have to be at least two.
  it('offers more than one way out', async () => {
    const view = await renderWithTheme(
      <Sheet visible onClose={jest.fn()}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    expect(view.getAllByLabelText('Close').length).toBeGreaterThanOrEqual(2);
  });

  it('closes from the handle as well as the scrim', async () => {
    const onClose = jest.fn();
    const view = await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    const exits = view.getAllByLabelText('Close');
    for (const exit of exits) await fireEvent.press(exit);
    expect(onClose).toHaveBeenCalledTimes(exits.length);
  });

  /**
   * THE ACTUAL BUG. However much content goes in, the sheet has to stop short of the screen so
   * a strip of scrim survives to be tapped.
   */
  it('caps its height so the scrim can never be squeezed out', async () => {
    const tall = Array.from({ length: 200 }, (_, i) => <RNText key={i}>Chip {i}</RNText>);
    const view = await renderWithTheme(
      <Sheet visible onClose={jest.fn()}>
        {tall}
      </Sheet>,
    );

    // However much goes in, the sheet stops short of the window — that leftover strip IS the
    // scrim, and it's the primary way out.
    const { maxHeight } = flatten(view.getByTestId('sheet-surface').props.style)!;
    const window = Dimensions.get('window').height;

    expect(maxHeight).toBeGreaterThan(0);
    expect(maxHeight).toBeLessThan(window);
    // A one-pixel scrim is not a tap target. Leave a real strip.
    expect(window - maxHeight).toBeGreaterThan(44);
  });
});

/** RN styles arrive as arbitrarily nested arrays. */
function flatten(style: unknown): Record<string, number> | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten).filter(Boolean));
  return typeof style === 'object' ? (style as Record<string, number>) : undefined;
}
