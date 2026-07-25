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

module.exports = config;
