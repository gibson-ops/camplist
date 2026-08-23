import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../design';
import type { ColorScheme } from '../design';

/*
 * READ THIS BEFORE WRITING A COMPONENT TEST.
 *
 * Under React 19's concurrent renderer, RNTL v14 made BOTH `render` and `fireEvent` async.
 * Forgetting either await fails in two different and equally confusing ways:
 *
 *   • un-awaited render   -> you hold a Promise. "getByText is not a function", or the
 *                            `screen` global reports "`render` function has not been called".
 *   • un-awaited fireEvent -> the test itself usually still passes, but it leaks an open
 *                            act() scope that breaks EVERY LATER TEST IN THE FILE. The tell is
 *                            "You seem to have overlapping act() calls" above the failures,
 *                            and tests that pass alone (`-t "name"`) but fail in the suite.
 *
 * So: `await renderWithTheme(...)`, `await fireEvent.press(...)`, `await rerender(...)`.
 */

/** Fixed insets so a test can't depend on whatever device metrics happen to be around. */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Renders a component inside the providers every screen actually has.
 *
 * Uses RNTL's `wrapper` option rather than nesting the element by hand, so `rerender` keeps
 * the providers instead of remounting a bare component.
 *
 * MUST BE AWAITED. RNTL v14's `render` is async under React 19's concurrent renderer; without
 * the await you get a Promise, and every query on it fails with "getByText is not a function"
 * or an unpopulated `screen`.
 *
 * @param scheme which palette to resolve against; dark is the design origin
 * @returns the RNTL render result — query off it directly rather than the `screen` global
 */
export async function renderWithTheme(ui: ReactElement, scheme: ColorScheme = 'dark') {
  const Providers = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider force={scheme}>{children}</ThemeProvider>
    </SafeAreaProvider>
  );

  return render(ui, { wrapper: Providers });
}
