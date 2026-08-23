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
const preset = require('jest-expo/android/jest-preset.js');

/**
 * Packages that ship untransformed ESM and must be run through Babel.
 *
 * Derived from the preset's own first pattern rather than retyped, so an Expo upgrade that
 * adds a package to the allowlist doesn't silently get dropped here.
 */
const TRANSFORM_ALSO = ['lucide-react-native'];
const [presetAllowlist, ...restIgnores] = preset.transformIgnorePatterns;

module.exports = {
  preset: 'jest-expo/android',
  rootDir: __dirname,
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // Replaces the preset's rather than adding to it — Jest allows exactly one, so ours has to
  // do React Native's job as well as its own. See test/resolver.js.
  resolver: '<rootDir>/test/resolver.js',
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  collectCoverageFrom: ['design/**/*.tsx', 'lib/**/*.ts'],
  transformIgnorePatterns: [
    presetAllowlist.replace('))', `|${TRANSFORM_ALSO.join('|')}))`),
    ...restIgnores,
  ],

  /**
   * The preset only transforms `\.[jt]sx?$`, and Lucide's ESM build is `.mjs` — so allowing it
   * past transformIgnorePatterns is necessary but NOT sufficient. Without this the file is
   * handed to Node verbatim and dies on `Unexpected token 'export'`, which reads like a
   * transformIgnorePatterns problem and sends you round the same loop twice.
   */
  transform: {
    ...preset.transform,
    '^.+\\.mjs$': [
      'babel-jest',
      { caller: { name: 'metro', bundler: 'metro', platform: 'android' } },
    ],
  },
  moduleFileExtensions: [...preset.moduleFileExtensions, 'mjs'],
};
