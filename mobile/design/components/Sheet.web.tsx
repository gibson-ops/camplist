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

function useVisibleHeight() {
  const [height, setHeight] = useState(
    () => globalThis.visualViewport?.height ?? globalThis.innerHeight ?? 0,
  );

  useEffect(() => {
    const vv = globalThis.visualViewport;
    const read = () => setHeight(vv?.height ?? globalThis.innerHeight);
    vv?.addEventListener('resize', read);
    vv?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    read();
    return () => {
      vv?.removeEventListener('resize', read);
      vv?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return height;
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
  const visibleHeight = useVisibleHeight();

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
        {__DEV__ ? <KeyboardProbe /> : null}
        <Drawer.Overlay
          style={{ position: 'fixed', inset: 0, backgroundColor: t.color.scrim, zIndex: 50 }}
        />
        <Drawer.Content
          data-testid="sheet-surface"
          style={{
            position: 'fixed',
            bottom: 0,
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
 * TEMPORARY. A readout of the numbers that decide where the sheet ends up, pinned to the top-left
 * of the screen so it stays legible even when the sheet itself has gone off the top.
 *
 * Kept because Chrome cannot be made to raise an iOS keyboard, so the phone is the only
 * instrument that can read this. It has already earned its place once: the first reading off
 * Jared's device was
 *
 *     win 346  vv 346@309  scrollY 309  h 289.22px  bot 0px  maxH 294px  top 366
 *
 * which says the cap was working (294 is 85% of 346), that vaul was NOT lifting the drawer
 * (`bot 0px`, because `win` and `vv` are equal so it sees no keyboard), and that the sheet was
 * nonetheless at top 366 in a 346-tall viewport — below the fold, not above it. That killed the
 * `offsetTop` compensation which had been pushing it down by 309.
 *
 * Delete when the keyboard path stops producing surprises.
 */
function KeyboardProbe() {
  const [line, setLine] = useState('');
  /**
   * Anchored to the VISUAL viewport, not the layout one.
   *
   * The first version of this probe used `position: fixed; top: 0` and did not appear on Jared's
   * phone at all — while the sheet was visibly misplaced. That absence is itself the measurement:
   * `top: 0` on a fixed element means the top of the LAYOUT viewport, and if iOS has offset the
   * visual viewport downward then the layout top is above what you can see. Everything fixed goes
   * with it, probe included. Adding `offsetTop` back is what keeps it on screen.
   */
  const [offsetTop, setOffsetTop] = useState(0);

  useEffect(() => {
    const read = () => {
      const d = document.querySelector('[data-vaul-drawer]') as HTMLElement | null;
      const vv = globalThis.visualViewport;
      const r = d?.getBoundingClientRect();
      setOffsetTop(Math.round(vv?.offsetTop ?? 0));
      setLine(
        [
          `win ${window.innerHeight}`,
          `vv ${Math.round(vv?.height ?? 0)}@${Math.round(vv?.offsetTop ?? 0)}`,
          `scrollY ${Math.round(window.scrollY)}`,
          d ? `h ${d.style.height || '-'} bot ${d.style.bottom || '-'}` : 'no drawer',
          d ? `maxH ${getComputedStyle(d).maxHeight}` : '',
          r ? `top ${Math.round(r.top)}` : '',
        ].join('  '),
      );
    };
    const id = setInterval(read, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: offsetTop,
        left: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        color: '#7ef',
        font: '10px/1.4 monospace',
        padding: '2px 4px',
        pointerEvents: 'none',
        maxWidth: '100%',
      }}
    >
      {line}
    </div>
  );
}

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
