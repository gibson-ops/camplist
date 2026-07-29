import { fireEvent, waitFor } from '@testing-library/react-native';
import { Dimensions, Text as RNText } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import type { PanGesture } from 'react-native-gesture-handler';
import { renderWithTheme } from '../../test/render';
import { DISMISS_DISTANCE, DISMISS_VELOCITY, Sheet, shouldDismiss } from './Sheet';

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
   * The scrim covers the WHOLE screen, including the part the sheet sits on.
   *
   * It used to be a flex sibling above the sheet, which dims everything you can see and so
   * looks right in a still frame. It isn't: undimmed app showed through the sheet's own rounded
   * corners, and dragging the sheet down opened a bright band between the two that grew with
   * the drag. Anything that makes the scrim's size depend on the sheet's brings both back.
   */
  it('dims the whole screen, not just the part above the sheet', async () => {
    const view = await renderWithTheme(
      <Sheet visible onClose={jest.fn()}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    const scrim = flatten(view.getAllByLabelText('Close')[0].props.style)!;
    const layer = flatten(view.getAllByLabelText('Close')[0].parent!.props.style)!;

    expect(layer.position).toBe('absolute');
    expect([layer.top, layer.right, layer.bottom, layer.left]).toEqual([0, 0, 0, 0]);
    // And the scrim paints across all of it rather than hugging its own content.
    expect(scrim.flex).toBe(1);
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
 * The release rule, on its own. Two ways to earn a dismissal, and each one covers a hole the
 * other leaves: distance alone punishes the quick flick that is how most people close a sheet
 * once they know they can, and velocity alone dismisses a slow careful drag that deliberately
 * stopped short.
 */
describe('shouldDismiss', () => {
  it('dismisses a drag that went far enough', () => {
    expect(shouldDismiss({ translationY: DISMISS_DISTANCE + 1, velocityY: 0 })).toBe(true);
  });

  it('dismisses a flick that never went far but left fast', () => {
    expect(shouldDismiss({ translationY: 20, velocityY: DISMISS_VELOCITY + 1 })).toBe(true);
  });

  it('holds on when the drag is both short and slow', () => {
    expect(shouldDismiss({ translationY: DISMISS_DISTANCE - 1, velocityY: 100 })).toBe(false);
  });

  /**
   * The unit test in the literal sense. Gesture handler reports velocity in points per SECOND
   * and PanResponder reported points per millisecond, so the threshold this replaced was a
   * thousand times too low and dismissed on any movement at all. These are numbers measured off
   * a real device: an unhurried 67pt drag over 700ms comes back as 108.
   */
  it('treats an unhurried drag as unhurried, at the scale a device actually reports', () => {
    expect(shouldDismiss({ translationY: 67, velocityY: 108 })).toBe(false);
  });

  // An upward throw is a scroll that got away, not a dismissal, however fast it was.
  it('is not fooled by speed in the wrong direction', () => {
    expect(shouldDismiss({ translationY: -200, velocityY: -3000 })).toBe(false);
  });
});

/**
 * A handle is a DRAG affordance, so people drag it — and on web a downward drag the app
 * doesn't claim becomes pull-to-refresh, which reloads the app out from under the sheet.
 * Something that looks draggable has to be draggable.
 *
 * THESE DRIVE THE REAL GESTURE, and that is the entire point of them. The previous version of
 * this sheet used a PanResponder, and the previous version of these tests reached into the
 * config it was built with and called the hooks by hand. Every rule passed. The gesture was
 * nonetheless dead on web from the day it shipped, because React Native Web never dispatched
 * those hooks to that node at all — a test that calls a handler directly can only ever prove
 * the handler is right, never that anything calls it.
 */
describe('Sheet, dragging', () => {
  it('dismisses when the drag is released past the threshold', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    drag({ translationY: 200 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('dismisses on a short fast flick', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    drag({ translationY: 24, velocityY: 1400 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('holds on when the drag is short and slow', async () => {
    const onClose = jest.fn();
    await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    drag({ translationY: 30 });
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * The handle is both draggable and tappable, and ONE finger lift ends both. Without the guard
   * that separates them, a 30px tug springs the sheet back AND fires the tap, so the sheet
   * closes on exactly the gesture that just decided not to close it.
   *
   * Read this together with "closes from the handle as well as the scrim" above — the pair is
   * the assertion, and neither half means much alone. That one presses the handle with no drag
   * before it and demands a close; this one drags first and demands silence. Widen the guard and
   * the first fails; drop it and the second does.
   *
   * There is deliberately no third test for a tap that BEGINS the pan without activating it.
   * `fireGestureHandler` always fills in an ACTIVE and an END, so it cannot express one — and a
   * test that quietly drove a full drag while claiming to be a tap would be worse than none.
   */
  it('does not also fire the handle tap when a drag springs back', async () => {
    const onClose = jest.fn();
    const view = await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );

    drag({ translationY: 30 });
    // The same finger lift the browser turns into a click on whatever was underneath.
    await fireEvent.press(view.getAllByLabelText('Close')[1]);
    expect(onClose).not.toHaveBeenCalled();
  });
});

/** A full downward drag on the sheet's handle, from touch-down to finger-up. */
function drag({ translationY, velocityY = 0 }: { translationY: number; velocityY?: number }) {
  fireGestureHandler<PanGesture>(getByGestureTestId('sheet-drag'), [
    { state: State.BEGAN, translationY: 0 },
    { state: State.ACTIVE, translationY: translationY / 2 },
    { translationY },
    { state: State.END, translationY, velocityY },
  ]);
}

/** RN styles arrive as arbitrarily nested arrays. */
function flatten(style: unknown): Record<string, number> | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten).filter(Boolean));
  return typeof style === 'object' ? (style as Record<string, number>) : undefined;
}
