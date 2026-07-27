/**
 * jest-expo supplies the React Native transform and Expo's module mocks.
 *
 * Pinned to the `android` preset rather than `universal`: running every suite three times
 * (ios/android/web) triples the wall clock, and what's worth testing here — packing state,
 * kit gating, collapse rules — is platform-agnostic. The web fork of the data layer
 * (lib/db.web.ts) is a one-file swap Metro resolves, not logic worth a third pass.
 *
 * Nothing here touches the network. `lib/db` is the only module importing an Instant SDK, and
 * suites that need it mock it (see lib/trips.test.ts).
 */
module.exports = {
  preset: 'jest-expo/android',
  rootDir: __dirname,
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  collectCoverageFrom: ['design/**/*.tsx', 'lib/**/*.ts'],
};
