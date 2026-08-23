/**
 * Metro applies babel-preset-expo implicitly, so the app builds without this file. Jest does
 * NOT — without it, Babel can't strip the Flow annotations in React Native's own jest setup
 * and every suite dies parsing node_modules.
 *
 * Keep it in sync with what Metro assumes; a divergence here means tests exercise a different
 * transform than the app ships.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
  };
};
