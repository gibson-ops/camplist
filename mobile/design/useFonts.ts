import {
  useFonts as useExpoFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

/**
 * Loads Inter before first paint.
 *
 * The cost of a custom family: text rendered before the font resolves would flash in the
 * system face and reflow. The root layout holds the splash screen until this returns true.
 *
 * @returns whether the type system is ready to render
 */
export function useFonts(): boolean {
  const [loaded, error] = useExpoFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Never hold the app hostage to a font failure — fall through to the system face instead.
  if (error) {
    console.warn('[fonts] Inter failed to load, falling back to system:', error);
    return true;
  }

  return loaded;
}
