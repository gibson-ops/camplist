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
 * THE KEYBOARD. By default a mobile keyboard shrinks only the VISUAL viewport and leaves the
 * layout viewport alone, so `position: fixed` still resolves against a box that extends behind the
 * keyboard, `window.innerHeight` and `dvh` both stay at their pre-keyboard values, and anything
 * anchored to the bottom of the screen sits underneath the keys. Every bottom sheet bug in this
 * app's history has been some consequence of that, and each one was met with more arithmetic off
 * `visualViewport`.
 *
 * `interactive-widget=resizes-content` says to shrink the LAYOUT viewport instead. Then
 * `window.innerHeight` is keyboard-aware, `dvh` is keyboard-aware, `visualViewport.offsetTop`
 * stays 0, and a sheet pinned to `bottom: 0` lands above the keys without being told. It is the
 * platform's answer to the problem we were computing our way around.
 *
 * React Native apps scroll inside ScrollViews rather than scrolling the document, so pinning
 * the document to the visible viewport is what the layout model already assumes.
 *
 * No-op off web. Safe to call more than once.
 */
export function tuneWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // Expo writes the tag; it does not write this part of it.
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    const content = viewport.getAttribute('content') ?? '';
    if (!content.includes('interactive-widget')) {
      viewport.setAttribute('content', `${content}, interactive-widget=resizes-content`);
    }
  }

  for (const node of [document.documentElement, document.body]) {
    if (!node) continue;
    node.style.overscrollBehaviorY = 'contain';
  }

  /**
   * `<html>` and `#root` get the height; `<body>` deliberately does NOT.
   *
   * Body height belongs to the sheet library. vaul locks scrolling by saving
   * `document.body.style.height`, setting `position: fixed !important`, and restoring what it
   * saved when the sheet closes. Writing our own height there imperatively means it saves ours,
   * and two things are then deciding how tall the body is — which is the shape of the bug where a
   * sheet comes back at the wrong height after a keyboard closes.
   *
   * The reason this was on body at all is that it predates the platform sheet: it was propping up
   * a hand-rolled one that had no opinion about the document. That sheet is gone.
   */
  for (const node of [document.documentElement, document.getElementById('root')]) {
    if (node) node.style.height = '100dvh';
  }
}
