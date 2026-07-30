import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * A counter that ticks when the screen is worth re-sorting: on arrival, and whenever you come back
 * to the app.
 *
 * WHY NOT ON EVERY TAP. Re-sorting as you tick is what makes a row leave the screen while you are
 * looking at it, and on a long list that costs you your place. Sorting only on arrival is what a
 * paper list does: it is in order when you pick it up and it stays put while you work. Cheap, and
 * it removes the failure mode instead of animating around it.
 *
 * COMING BACK COUNTS AS ARRIVING. Packing is interrupted constantly — you put the phone down,
 * check something in the car, take a call. Returning to a tidied list is the same feeling as
 * arriving at one, and it is the moment you have most obviously stopped mid-tap.
 *
 * Web and native have different names for the same event, so both are listened for.
 */
export function useResortSignal(): number {
  const [signal, setSignal] = useState(0);
  const bump = useCallback(() => setSignal((n) => n + 1), []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const onVisible = () => {
        if (document.visibilityState === 'visible') bump();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') bump();
    });
    return () => sub.remove();
  }, [bump]);

  return signal;
}
