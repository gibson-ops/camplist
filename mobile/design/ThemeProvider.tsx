import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { buildTheme, type ColorScheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(buildTheme('dark'));

/**
 * Provides the resolved theme. Dark is the default and the design origin: the app's
 * defining moment is a campsite at dusk. Light exists because packing happens in a driveway
 * at noon, where dark mode is genuinely harder to read.
 *
 * @param force pin a scheme instead of following the OS (used by the design gallery)
 */
export function ThemeProvider({ children, force }: { children: ReactNode; force?: ColorScheme }) {
  const system = useColorScheme();
  const scheme: ColorScheme = force ?? (system === 'light' ? 'light' : 'dark');
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
