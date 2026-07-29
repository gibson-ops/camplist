/**
 * Global test setup. RNTL v14 registers its own matchers, so nothing to extend here.
 *
 * `expo-font` is mocked because the design system holds first paint until Source Sans 3
 * resolves; under test there is no font loader and every render would hang waiting on it.
 */

// Swaps the gesture handler's native module for a mock. That's what lets a component
// containing a GestureDetector render at all under Jest, and what makes `fireGestureHandler`
// able to drive a real gesture — see design/components/Sheet.test.tsx.
require('react-native-gesture-handler/jestSetup');

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(async () => {}),
  isLoaded: () => true,
}));
