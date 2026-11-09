// Metro config for a monorepo: the app lives in mobile/ but shares instant.schema.ts
// (and later the engine's types) from the workspace root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so edits to instant.schema.ts trigger a reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Only use the paths above — stops Metro walking up past the workspace root.
config.resolver.disableHierarchicalLookup = true;

// 4. PowerSync spike: @powersync/adapter-sql-js's bundle imports `node:fs` and `node:crypto`
//    from Emscripten code that only runs under Node. Upstream aliases `fs`/`crypto` to an empty
//    module for exactly this reason, but the `node:` spellings slip past it (0.0.27+). Resolve
//    them to nothing, for that one package only.
const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    (moduleName === 'node:fs' || moduleName === 'node:crypto') &&
    context.originModulePath.includes(`${path.sep}@powersync${path.sep}adapter-sql-js${path.sep}`)
  ) {
    return { type: 'empty' };
  }
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};
module.exports = config;
