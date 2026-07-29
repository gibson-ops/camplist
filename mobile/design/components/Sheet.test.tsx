import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Dimensions, Text as RNText } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import type { PanGesture } from 'react-native-gesture-handler';
import { renderWithTheme } from '../../test/render';
import { Sheet, shouldDismiss } from './Sheet';

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
  /** A middling sheet. Everything below is judged against half of this. */
  const SHEET = 300;
  const release = (translationY: number, velocityY = 0) =>
    shouldDismiss({ translationY, velocityY, sheetHeight: SHEET });

  it('dismisses a drag taken past halfway', () => {
    expect(release(SHEET / 2 + 1)).toBe(true);
  });

  it('holds on to one that stopped short of it', () => {
    expect(release(SHEET / 2 - 1)).toBe(false);
  });

  // Speed is intent. A real throw buys the travel it was going to make anyway.
  it('dismisses a short flick thrown hard', () => {
    expect(release(40, 1500)).toBe(true);
  });

  /**
   * The report this was rewritten for: "if I don't go down past a certain point, the sheet will
   * pop back up". A small quick swipe is not a throw, and the rule this replaced — a flat
   * 500pt/s — dismissed on it, because 500pt/s is an ordinary swipe.
   */
  it('holds on to a small quick swipe, which is not a throw', () => {
    expect(release(30, 400)).toBe(false);
  });

  /**
   * Half of a SHEET, not a fixed number of points. The rule this replaced used 90pt for
   * everything, which is a third of a short sheet and a seventh of a tall one — so the same
   * gesture meant different things depending on what happened to be inside.
   */
  it('scales with the sheet, so the same drag means the same thing in both', () => {
    const drag = 120;
    expect(shouldDismiss({ translationY: drag, velocityY: 0, sheetHeight: 200 })).toBe(true);
    expect(shouldDismiss({ translationY: drag, velocityY: 0, sheetHeight: 600 })).toBe(false);
  });

  // Numbers measured off a real device: an unhurried 67pt drag over 700ms reports velocity 108.
  it('treats an unhurried drag as unhurried, at the scale a device actually reports', () => {
    expect(release(67, 108)).toBe(false);
  });

  // An upward throw is a scroll that got away, not a dismissal, however fast it was.
  it('is not fooled by speed in the wrong direction', () => {
    expect(release(-200, -3000)).toBe(false);
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
  /**
   * A sheet that has been laid out, which is the only kind a finger can reach.
   *
   * The height matters to the assertions rather than being scenery: everything the sheet does on
   * release — how far it travels to leave, and whether a release counts as leaving at all — is
   * measured against it. Skip this and the tests run against an unmeasured screenful, where a
   * 200pt drag is a fifth of the way rather than two thirds.
   */
  async function openSheet(onClose: () => void, sheetHeight = 300) {
    const view = await renderWithTheme(
      <Sheet visible onClose={onClose}>
        <RNText>Body</RNText>
      </Sheet>,
    );
    await fireEvent(view.getByTestId('sheet-surface'), 'layout', {
      nativeEvent: { layout: { height: sheetHeight, width: 390, x: 0, y: 0 } },
    });
    return view;
  }

  it('dismisses when the drag is released past halfway', async () => {
    const onClose = jest.fn();
    await openSheet(onClose);

    drag({ translationY: 200 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('dismisses on a short fast flick', async () => {
    const onClose = jest.fn();
    await openSheet(onClose);

    drag({ translationY: 24, velocityY: 1400 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('holds on when the drag is short and slow', async () => {
    const onClose = jest.fn();
    await openSheet(onClose);

    drag({ translationY: 30 });
    await settle();
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * The same 120pt drag, on two sheets, in two tests.
   *
   * It is past halfway on the short one and nowhere near it on the tall one, so it dismisses one
   * and not the other — which is the whole reason the rule is a fraction rather than a distance.
   *
   * Deliberately NOT one test with two sheets in it. Both would be mounted at once, both would
   * register a gesture under the same test id, and the drag meant for the second could land on
   * the first — which is a passing test that proves nothing, since "the tall sheet stayed" is
   * also what you see when the tall sheet was never touched.
   */
  it('dismisses a 120pt drag on a short sheet, which is past its halfway', async () => {
    const onClose = jest.fn();
    await openSheet(onClose, 200);

    drag({ translationY: 120 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('holds on to the same 120pt drag on a tall sheet, which is nowhere near it', async () => {
    const onClose = jest.fn();
    await openSheet(onClose, 600);

    drag({ translationY: 120 });
    await settle();
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

/**
 * Wait long enough that a dismissal would have arrived, so "it didn't close" means something.
 *
 * The gesture runs on the UI thread and reaches `onClose` through `runOnJS`, which delivers on a
 * LATER tick. An `expect(onClose).not.toHaveBeenCalled()` straight after a drag therefore passes
 * whatever the sheet decided — it is asserting that the message hasn't arrived yet, not that it
 * was never sent. This was caught by mutation: a rule change that should have broken the
 * hold-on tests left every one of them green.
 */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** RN styles arrive as arbitrarily nested arrays. */
function flatten(style: unknown): Record<string, number> | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten).filter(Boolean));
  return typeof style === 'object' ? (style as Record<string, number>) : undefined;
}
