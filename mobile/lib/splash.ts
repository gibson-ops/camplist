import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/**
 * Holds the launch screen until the app knows which screen it is going to, then takes it down.
 *
 * WHY THE APP DECIDES, rather than the splash removing itself when React mounts: mounting is not
 * arriving. A cold open signs in a guest, reads a profile and counts trips before it knows whether
 * the next screen is the welcome flow or a list of trips, and hiding on mount put a flash of the
 * empty trips screen in that gap. So this is called from the screens that are actually a
 * destination.
 *
 * TWO MECHANISMS, ONE CALL. On web the splash is markup in `public/index.html`, because a splash
 * that has to be fetched is not a splash. On native it is the platform's own launch screen, held
 * open past its natural life. Both are hidden by calling this, so the destination screens do not
 * have to know which platform they are on.
 *
 * Native was missing entirely until iOS was first run on a device: `hideSplash` returned early
 * off web, nothing ever called `preventAutoHideAsync`, and the root layout renders `null` until
 * Inter resolves. So a cold start showed the system splash for an instant and then blank screens
 * while the router decided — the exact flash the web splash exists to cover, uncovered.
 *
 * Safe to call as often as anybody likes; the second call finds nothing to do.
 */

/**
 * Asked for at module load, which is the only time it works — the launch screen hides itself as
 * soon as the first frame is drawn, and that can happen before any component mounts.
 *
 * The rejection is swallowed on purpose. It throws only when the splash has already gone, which is
 * not a failure, and a rejected promise nobody awaits is an unhandled rejection warning in the
 * console for a condition that needs no action.
 */
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export function hideSplash() {
  if (Platform.OS !== 'web') {
    SplashScreen.hideAsync().catch(() => {});
    return;
  }

  if (typeof document === 'undefined') return;

  const el = document.getElementById('camplist-splash');
  if (!el) return;

  // Faded rather than cut, because the app underneath is already painted and a hard swap reads as a
  // flicker. Removed after, so it can never intercept a touch.
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 200);
}
