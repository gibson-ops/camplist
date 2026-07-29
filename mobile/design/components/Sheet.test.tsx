import { fireEvent, waitFor } from '@testing-library/react-native';
import {
  Dimensions,
  PanResponder,
  Text as RNText,
  type PanResponderGestureState,
} from 'react-native';
import { renderWithTheme } from '../../test/render';
import { Sheet } from './Sheet';

/**
 * These exist because of a shipped bug: the sheet grew without limit while the scrim took
 * whatever was left, so the tag picker with forty chips in it squeezed the scrim to nothing.
 * Tapping outside was the only way out, the handle was a decorative View, and on web there's no
 * hardware back button — a modal that could not be closed.
 */
/** Reaching into the config PanResponder was built with is the only way to exercise the
 *  gesture rules directly; RNTL can't synthesise a real drag. */
const createSpy = jest.spyOn(PanResponder, 'create');
const lastConfig = () => createSpy.mock.calls.at(-1)![0];

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

  /**
   * Every exit here was earned by a bug, so the count is the assertion. Scrim, handle, and an
   * unambiguous ✕ — a handle reads as a sheet affordance, and someone who has just been trapped
   * in a sheet is looking for something that reads as an exit.
   */
  it('offers three ways out', async () => {
    const view = await renderWithTheme(
      <Sheet visible onClose={jest.fn()}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    expect(view.getAllByLabelText('Close').length).toBeGreaterThanOrEqual(3);
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

/**
 * A handle is a DRAG affordance, so people drag it — and on web a downward drag the app
 * doesn't claim becomes pull-to-refresh, which reloads the app out from under the sheet.
 * Something that looks draggable has to be draggable.
 *
 * These assert the CAPTURE hook specifically, and that's the whole point of them. The handle is
 * a Pressable, which takes the responder the instant a finger lands, so a claim on the bubble
 * phase never runs and swipe-to-dismiss silently did nothing on every sheet in the app. Only the
 * capture phase can take a gesture a child is already holding — so a test that accepts either
 * hook would have passed throughout the entire time the feature was broken.
 */
describe('Sheet, dragging', () => {
  it('claims a deliberate downward drag, on the capture phase', async () => {
    await renderWithTheme(
      <Sheet visible onClose={jest.fn()}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    const claim = lastConfig().onMoveShouldSetPanResponderCapture!;
    expect(claim({} as never, gesture({ dy: 40 }))).toBe(true);
  });

  // Anything we claim and then ignore is worse than not claiming it: a sideways swipe or an
  // upward scroll belongs to the content underneath.
  it('leaves every other direction alone', async () => {
    await renderWithTheme(
      <Sheet visible onClose={jest.fn()}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    const claim = lastConfig().onMoveShouldSetPanResponderCapture!;
    expect(claim({} as never, gesture({ dy: -40 }))).toBe(false);
    expect(claim({} as never, gesture({ dy: 2 }))).toBe(false);
    expect(claim({} as never, gesture({ dy: 10, dx: 60 }))).toBe(false);
  });

  it('dismisses on a long drag and on a fast flick', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    const release = lastConfig().onPanResponderRelease!;
    release({} as never, gesture({ dy: 200 }));
    // The throw is carried to the bottom before closing, so the callback lands after the
    // animation rather than mid-air; `visible` flipping would otherwise fight it for the pixels.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    // A short but fast flick counts too — velocity dismisses where distance alone wouldn't.
    release({} as never, gesture({ dy: 20, vy: 2 }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });

  // A half-drag has to spring back, not dismiss. Otherwise a stray thumb closes the sheet.
  it('holds on when the drag is short and slow', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    const release = lastConfig().onPanResponderRelease!;
    release({} as never, gesture({ dy: 30 }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

const gesture = (over: Partial<PanResponderGestureState>) =>
  ({ dx: 0, dy: 0, vx: 0, vy: 0, ...over }) as PanResponderGestureState;

/** RN styles arrive as arbitrarily nested arrays. */
function flatten(style: unknown): Record<string, number> | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten).filter(Boolean));
  return typeof style === 'object' ? (style as Record<string, number>) : undefined;
}
