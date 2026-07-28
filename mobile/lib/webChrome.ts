import { Platform } from 'react-native';

/**
 * Turns off the browser's own pull-to-refresh.
 *
 * A downward swipe anywhere the app isn't scrolling — the top of a bottom sheet, most of all —
 * gets picked up by the document and reloads the whole app. That is destructive in a way no
 * in-app gesture is: it throws away the sheet, the keyboard, and any half-typed field, and it
 * fires on exactly the gesture a sheet handle invites.
 *
 * `overscroll-behavior-y: contain` on the scrolling root is the documented fix, and it only
 * suppresses the browser's own chrome — real scrolling inside the app is untouched.
 *
 * No-op off web. Safe to call more than once.
 */
export function suppressPullToRefresh() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  for (const node of [document.documentElement, document.body]) {
    if (node) node.style.overscrollBehaviorY = 'contain';
  }
}
