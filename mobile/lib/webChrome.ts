import { Platform } from 'react-native';

/**
 * Two things the browser gets wrong for an app that isn't a document.
 *
 * PULL-TO-REFRESH. A downward swipe anywhere the app isn't scrolling — the top of a bottom
 * sheet, most of all — gets picked up by the document and reloads everything. That's
 * destructive in a way no in-app gesture is: it throws away the sheet, the keyboard, and any
 * half-typed field, and it fires on exactly the gesture a sheet handle invites.
 *
 * VIEWPORT HEIGHT. `100vh` on a phone means the viewport with the browser chrome HIDDEN, which
 * is taller than what you can actually see. A screen sized to it overflows by the height of the
 * URL bar, so a stepper with one question on it still scrolls — and the button you're reaching
 * for sits just under the fold. `100dvh` tracks the chrome as it comes and goes, which is the
 * only honest answer on a surface whose height changes while you use it.
 *
 * React Native apps scroll inside ScrollViews rather than scrolling the document, so pinning
 * the document to the visible viewport is what the layout model already assumes.
 *
 * No-op off web. Safe to call more than once.
 */
export function tuneWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  for (const node of [document.documentElement, document.body]) {
    if (!node) continue;
    node.style.overscrollBehaviorY = 'contain';
    node.style.height = '100dvh';
  }

  // Expo renders into #root; without this it keeps the 100% it inherited from the taller
  // measurement and the fix stops one element short of mattering.
  const root = document.getElementById('root');
  if (root) root.style.height = '100dvh';
}
