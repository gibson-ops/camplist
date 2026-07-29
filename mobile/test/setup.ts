/**
 * Global test setup. RNTL v14 registers its own matchers, so nothing to extend here.
 *
 * `expo-font` is mocked because the design system holds first paint until Source Sans 3
 * resolves; under test there is no font loader and every render would hang waiting on it.
 */

// The gesture handler's native module, swapped for a mock so anything containing a
// GestureDetector can render at all under Jest.
require('react-native-gesture-handler/jestSetup');

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(async () => {}),
  isLoaded: () => true,
}));

/**
 * `@expo/ui`'s BottomSheet is a real SwiftUI/Compose view, and reaching for it under Jest dies
 * on `getMaterialColors is not a function` — the native module isn't there. So the sheet becomes
 * a plain View that renders its children when presented.
 *
 * That is the right amount of mock, because the sheet's BEHAVIOUR is no longer ours to test:
 * the drag, the dismiss threshold, the scrim and the exits all belong to the platform now. What
 * these suites still care about is what's INSIDE a sheet — which chips appear, when a create
 * affordance shows — and that is exactly what survives here.
 */
jest.mock('@expo/ui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BottomSheet: ({
      isPresented,
      children,
    }: {
      isPresented: boolean;
      children: React.ReactNode;
    }) => (isPresented ? React.createElement(View, { testID: 'bottom-sheet' }, children) : null),
  };
});
