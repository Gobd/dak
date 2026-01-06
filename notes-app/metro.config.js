const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Add html to asset extensions so Metro can bundle tiptap-editor.html for native
config.resolver.assetExts.push('html');

// Exclude test files and vitest config from bundling
config.resolver.blockList = [
  /.*\.test\.(ts|tsx|js|jsx)$/,
  /vitest\.config\.(ts|js)$/,
  /playwright\.config\.(ts|js)$/,
  /e2e\/.*/,
];

// Enable package exports with react-native condition prioritized
// This ensures zustand uses CJS build instead of ESM (which has import.meta)
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'default'];

// Custom resolution for web platform
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Polyfill crypto for web
    if (moduleName === 'crypto') {
      return {
        filePath: require.resolve('expo-crypto'),
        type: 'sourceFile',
      };
    }
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
