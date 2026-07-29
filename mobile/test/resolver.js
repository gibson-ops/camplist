/**
 * Module resolution for Jest, composing two rules that both have to hold.
 *
 * `react-native-worklets` ships a `.native` fork of its module bridge that reaches straight for
 * a TurboModule and dies at import time under Jest — which takes reanimated down with it, and
 * therefore anything that renders a Sheet. Hiding the `.native` extension for that package picks
 * up its plain fork instead. This is exactly what `react-native-worklets/jest/resolver.js` does;
 * it's reimplemented here rather than required because Jest allows only ONE resolver and React
 * Native's own is not optional — dropping it breaks `react-native` subpath imports everywhere.
 */
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');

module.exports = (request, options) => {
  const fromWorklets =
    options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets');

  return reactNativeResolver(
    request,
    fromWorklets
      ? { ...options, extensions: options.extensions?.filter((ext) => !ext.includes('native')) }
      : options,
  );
};
