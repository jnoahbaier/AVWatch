const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages, prioritising the app's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Map the shared package name to the source directory so Metro can find it
// without requiring a build step.
config.resolver.extraNodeModules = {
  '@avwatch/shared': path.resolve(workspaceRoot, 'packages/shared'),
};

module.exports = config;
