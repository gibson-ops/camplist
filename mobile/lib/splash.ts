/**
 * Takes down the static splash in `public/index.html`.
 *
 * WHY THE APP DECIDES, rather than the splash removing itself when React mounts: mounting is not
 * arriving. A cold open signs in a guest, reads a profile and counts trips before it knows whether
 * the next screen is the welcome flow or a list of trips, and hiding on mount put a flash of the
 * empty trips screen in that gap. So this is called from the screens that are actually a
 * destination.
 *
 * No-op off web, and safe to call as often as anybody likes — the second call finds nothing.
 */
export function hideSplash() {
  if (typeof document === 'undefined') return;

  const el = document.getElementById('camplist-splash');
  if (!el) return;

  // Faded rather than cut, because the app underneath is already painted and a hard swap reads as a
  // flicker. Removed after, so it can never intercept a touch.
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 200);
}
