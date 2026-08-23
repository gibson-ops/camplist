import {
  useFonts as useExpoFonts,
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
  SourceSans3_800ExtraBold,
} from '@expo-google-fonts/source-sans-3';

/**
 * Loads Source Sans 3 before first paint.
 *
 * The cost of a custom family: text rendered before the font resolves would flash in the
 * system face and then reflow, which is especially obvious on dense list rows. The root
 * layout holds render until this returns true.
 */
export function useFonts(): boolean {
  const [loaded, error] = useExpoFonts({
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
    SourceSans3_800ExtraBold,
  });

  // Never hold the app hostage to a font failure — fall through to the system face instead.
  if (error) {
    console.warn('[fonts] Source Sans 3 failed to load, falling back to system:', error);
    return true;
  }

  return loaded;
}
