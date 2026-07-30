import { useEffect, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Drawer } from 'vaul';
/**
 * REQUIRED, and its absence was the bug behind most of this file's history.
 *
 * vaul ships the stylesheet that makes its drawer a drawer, and nothing imported it — not us and
 * not `@expo/ui`, whose web wrapper has the same omission. Without it the drawer has no
 * `touch-action: none`, so touches on it SCROLL THE DOCUMENT rather than drag the sheet; no
 * `transition: transform`, so nothing eases; no slide keyframes, so it appears and vanishes
 * instead of arriving; no `::after` mask, so the background does not extend past its own edge;
 * and no handle styling, which is why the grabber needed dressing by hand.
 *
 * The `scrollY 309` in Jared's probe reading was the document scrolling under a fixed sheet,
 * because nothing had told the browser that those touches belonged to the drawer.
 */
import 'vaul/style.css';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * The height of what is actually visible, which no CSS unit reports.
 *
 * `vh` is the viewport with browser chrome hidden. `dvh` turns out to be the same thing on iOS
 * Safari — measured at 655 while 346 was visible. Only `visualViewport` shrinks for a keyboard.
 */
/** Scrim left reachable above the sheet. Small, because the exits no longer depend on it. */
const SCRIM_STRIP = 24;

function useVisibleHeight(enabled: boolean) {
  const [box, setBox] = useState(() => ({
    height: globalThis.visualViewport?.height ?? globalThis.innerHeight ?? 0,
    inset: 0,
  }));

  /**
   * POLLED, not evented, and that is a considered choice rather than laziness.
   *
   * This needs two numbers that iOS updates independently — `visualViewport.height` for what you
   * can see, `window.innerHeight` for the box `position: fixed` resolves against — and it needs
   * them to agree at the moment it reads them. An event-driven version got that wrong in both
   * directions on Jared's phone:
   *
   *     win 402  vv 346  bot 0px    the inset was never applied, sheet 56px into the keys
   *     win 595  vv 328  bot 0px    read while innerHeight was still 328, then it became 595
   *
   * The second one is the tell. `maxH 302px` proves the listener DID fire and did see vv 328, so
   * the inset was computed against an `innerHeight` of 328 — and `innerHeight` then changed to 595
   * without firing anything this hook was listening to. There is no event to add: the two values
   * settle at different times and neither announces the other.
   *
   * The debug probe polls at 250ms and has been right in every reading Jared has sent, including
   * the ones where this hook was wrong. So: sample while a sheet is open, stop when it closes.
   */
  useEffect(() => {
    if (!enabled) return;
    const read = () => {
      const height = globalThis.visualViewport?.height ?? globalThis.innerHeight;
      // What the layout viewport has that you cannot see — the keyboard, until `resizes-content`
      // catches up with it.
      const inset = Math.max(0, globalThis.innerHeight - height);
      setBox((prev) => (prev.height === height && prev.inset === inset ? prev : { height, inset }));
    };
    read();
    const id = setInterval(read, 120);
    return () => clearInterval(id);
  }, [enabled]);

  return box;
}

/**
 * The web fork of `Sheet`, on the same library the platform wrapper uses — vaul — but styled.
 *
 * Metro swaps this in for web, the same trick as `lib/db.web.ts`. Native keeps `Sheet.tsx` and its
 * SwiftUI/Compose sheet, and both files export the same props, so no screen knows the difference.
 *
 * WHY FORK AT ALL, having just deleted a hand-rolled sheet to stop owning this. Because `@expo/ui`
 * gives web no styling at all, and one of its hardcoded values is wrong for a dark app:
 *
 *     ...(isDark && { backgroundColor: '#000' })
 *
 * Camp List's dark background is `basalt` #0a0b0c. A #000 sheet on top of it is about 1.05:1 — no
 * visible edge — and it is inverted besides: a sheet is the one FLOATING layer in this app
 * (DESIGN.md, The Flat Field Rule) so it has to be LIGHTER than the field, not darker. iOS and
 * Android both get this right on their own, with genuinely elevated system material. This fork
 * exists so web matches them rather than to diverge from them.
 *
 * The other value worth fixing while here: `@expo/ui` caps the sheet at `85vh`, which on mobile
 * Safari is measured as though the browser chrome were hidden, so the bottom of a full sheet sits
 * under the toolbar. `dvh` tracks the chrome instead.
 *
 * Everything else is still vaul's: the drag from anywhere, the dismiss threshold, the scroll
 * handoff, the keyboard avoidance. No physics here, and no ✕ — the exits are the grabber, the
 * swipe and the tap outside.
 *
 * @param title optional heading; omit for sheets whose content is self-evident
 * @param contentStyle overrides for the content container, e.g. a tighter gap for chip grids
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: visibleHeight, inset: keyboardInset } = useVisibleHeight(visible);

  return (
    <Drawer.Root
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      /**
       * OFF, and the docs say off is right for a drawer like ours: "@default true when snapPoints
       * is defined". We define no snap points.
       *
       * With it on, vaul lifts the drawer clear of the keyboard by writing `bottom`, while iOS is
       * ALREADY scrolling the page to reveal the focused field. Two mechanisms, one sheet, and it
       * lands nowhere. Worse, vaul's number goes stale: it computes
       * `window.innerHeight - visualViewport.height` and only recomputes on a visualViewport
       * resize, so when Safari's toolbars appear and `window.innerHeight` drops from 655 to 428,
       * `bottom` keeps the 309 it derived from the taller window. Measured off Jared's phone:
       *
       *     win 428  vv 346@227  h 320px  bot 309px  top -201
       *     top = win - bot - h = 428 - 309 - 320 = -201
       *
       * Off, `bottom` stays 0 and the browser's own behavior handles the keyboard, which is what
       * the doc means by "fall back to the default browser behavior".
       */
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          style={{ position: 'fixed', inset: 0, backgroundColor: t.color.scrim, zIndex: 50 }}
        />
        <Drawer.Content
          data-testid="sheet-surface"
          style={{
            position: 'fixed',
            /**
             * The VISIBLE bottom, not the layout one.
             *
             * `interactive-widget=resizes-content` shrinks the layout viewport for a keyboard, but
             * not instantly — and the gap is exactly the bug. Two readings off Jared's phone, same
             * sheet, same 318px ceiling:
             *
             *     initial focus   win 402  vv 346@253  bot 0px  top 84   <- content behind the keys
             *     refocus         win 346  vv 346@309  bot 0px  top 28   <- correct
             *
             * The only difference is `win`. On first focus it is still 402 while 346 is visible, so
             * a sheet anchored to `bottom: 0` hangs 56px into the keyboard. `win - vv` is that 56,
             * and it is 0 once the layout viewport catches up — so this is a correction in the
             * transient state and a no-op in the settled one. Both readings then put the sheet at
             * top 28, which is where the good one already was.
             *
             * This is the lift vaul was attempting with `repositionInputs`. The difference is that
             * it snapshotted the number once and restored it later; this recomputes from
             * `visualViewport` every time either viewport changes.
             */
            bottom: keyboardInset,
            left: 0,
            right: 0,
            zIndex: 50,
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
            // Raised, not black: the whole reason this fork exists.
            backgroundColor: t.color.raised,
            borderTopLeftRadius: t.radius.sheet,
            borderTopRightRadius: t.radius.sheet,
            boxShadow: `0 -8px 32px ${t.color.sheetShadow}`,
            /**
             * A ceiling is the app's job — vaul doesn't set one, by design. Measured off the
             * VISIBLE viewport, because neither CSS unit describes it: `maxH 556.75px` was 85dvh
             * resolving to 85% of 655 while 346 was visible, so `dvh` on iOS Safari is the LARGE
             * viewport and behaves like `lvh`.
             *
             * RESERVE A STRIP, DON'T RESERVE A FRACTION. 15% was inherited from `@expo/ui`'s
             * `85vh`, and it costs the most exactly where space is scarcest: with a keyboard up
             * the reading was `maxH 294px  top 134`, so a seventh of the screen sat empty above
             * the sheet while content scrolled out of reach below it. A fixed strip is what the
             * scrim actually needs to stay tappable, and it stops being a tax on small viewports.
             *
             * The 8% bound keeps a sheet from filling a desktop window, where a strip alone would
             * leave it near full height. Only sheets whose content exceeds the cap notice either.
             */
            maxHeight: Math.round(Math.min(visibleHeight - SCRIM_STRIP, visibleHeight * 0.92)),
            paddingTop: t.space.sm,
            /**
             * WITHOUT THIS THE SHEET GROWS EVERY TIME THE KEYBOARD OPENS.
             *
             * vaul manages this element's height directly: on each keyboard appearance it reads
             * the rendered height and writes it back as an inline `height`. A bare `div` is
             * `content-box`, so `height` there EXCLUDES padding — the 8px above gets added on top
             * of a number that already contained it, and the sheet ratchets up 8px per cycle.
             * Open a sheet, dismiss the keyboard, tap the field again, and it climbs until the
             * title and grabber are above the top of the screen.
             *
             * Measured: 258 → 266 → 274 across two cycles, and `border-box` holds it at 258.
             */
            boxSizing: 'border-box',
          }}
        >
          {/* Radix requires a dialog title. Screen readers get it; nobody sees it twice. */}
          <Drawer.Title style={SR_ONLY}>{title ?? 'Sheet'}</Drawer.Title>
          <Drawer.Handle style={{ backgroundColor: t.color.border }} />

          {/* vaul scrolls this. `minHeight: 0` is what lets it: a flex child defaults to
              `min-height: auto`, which refuses to shrink below its content and pushes the drawer
              past its own cap instead of scrolling inside it. */}
          <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: 0 }}>
            <View
              style={[
                {
                  padding: t.space.lg,
                  paddingBottom: insets.bottom + t.space.lg,
                  gap: t.space.md,
                },
                contentStyle,
              ]}
            >
              {title ? <Text variant="headline">{title}</Text> : null}
              {children}
            </View>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * IF THE KEYBOARD PATH REGRESSES, PUT THE PROBE BACK. It was a fixed-position readout of
 * `window.innerHeight`, `visualViewport.height`/`offsetTop`, `scrollY`, and the drawer's own
 * `height`/`bottom`/`maxHeight`/`getBoundingClientRect().top`, polled at 250ms and screenshotted
 * from Jared's phone — the only instrument that can read this, since Chrome cannot be made to raise
 * an iOS keyboard. Every number in the comments above came from it.
 *
 * Two things to get right when rebuilding it. Anchor it at `top: visualViewport.offsetTop`, not
 * `top: 0`: the first version did not appear on screen AT ALL, because fixed positioning resolves
 * against the layout viewport and iOS had offset the visual one below it. And read the drawer's
 * inline styles (`d.style.height`) separately from its computed ones — the gap between what vaul
 * wrote and what the browser resolved is where the bugs lived.
 */

/** Present to assistive tech, absent to everyone else. */
const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
