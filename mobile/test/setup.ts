/**
 * Global test setup. RNTL v14 registers its own matchers, so nothing to extend here.
 *
 * `expo-font` is mocked because the design system holds first paint until Source Sans 3
 * resolves; under test there is no font loader and every render would hang waiting on it.
 */
jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(async () => {}),
  isLoaded: () => true,
}));
