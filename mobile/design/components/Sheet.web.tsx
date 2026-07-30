import { useEffect, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Drawer } from 'vaul';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeProvider';
import { Text } from './Text';

/**
 * The height of what you can actually SEE, keyboard included in the reckoning.
 *
 * There is no CSS unit for this, which is the whole reason it's a hook. `vh` is the viewport as
 * though the browser chrome were hidden. `dvh` tracks the chrome but NOT the keyboard. On iOS a
 * keyboard shrinks only `visualViewport`, leaving `window.innerHeight` and both units unchanged.
 *
 * Getting that wrong is what pushed the sheet off the top of the screen. vaul correctly moves the
 * drawer up to sit above the keyboard — so its BOTTOM lands at the visual viewport's bottom — while
 * a `dvh` cap still permitted it to be as tall as the whole window. Measured with the visual
 * viewport pinned to 380 of a 780 window: the cap stayed 663, so a full-height sheet ran from
 * -283 to 380 and everything above the fold was unreachable.
 */
function useVisibleHeight() {
  const [height, setHeight] = useState(
    () => globalThis.visualViewport?.height ?? globalThis.innerHeight ?? 0,
  );

  useEffect(() => {
    const vv = globalThis.visualViewport;
    const read = () => setHeight(vv?.height ?? globalThis.innerHeight);
    // visualViewport fires for the keyboard; window fires for rotation and chrome.
    vv?.addEventListener('resize', read);
    window.addEventListener('resize', read);
    read();
    return () => {
      vv?.removeEventListener('resize', read);
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
 * under the toolbar. `dvh` fixes the toolbar but not a keyboard — see useVisibleHeight for why
 * this ended up as a measured pixel value rather than any CSS unit.
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
    >
      <Drawer.Portal>
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
            // Measured against what's visible RIGHT NOW, so a keyboard shortens the ceiling too.
            // No CSS unit does this — see useVisibleHeight.
            maxHeight: Math.round(visibleHeight * 0.85),
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
