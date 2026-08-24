const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const workspaceRoot = path.resolve(projectRoot, '../..');
config.resolver.extraNodeModules = {
  '@infiny-stream/config': path.resolve(workspaceRoot, 'packages/config'),
  '@infiny-stream/shared': path.resolve(workspaceRoot, 'packages/shared'),
  '@infiny-stream/types': path.resolve(workspaceRoot, 'packages/types'),
};

module.exports = config;
