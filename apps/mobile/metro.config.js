const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, "../..");

// Resolves to the real package location as installed for this workspace
function resolvePkgDir(pkg) {
  return path.dirname(
    require.resolve(`${pkg}/package.json`, { paths: [projectRoot] })
  );
}

const reactDir = resolvePkgDir("react");
const rnDir = resolvePkgDir("react-native");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo + pnpm virtual store (EAS often needs this to hash files)
config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules/.pnpm"),
];

// Ensure this project resolves modules from its own node_modules first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm uses symlinks heavily; Metro needs to support them in monorepos
config.resolver.unstable_enableSymlinks = true;

// Disable hierarchical lookup to avoid picking up wrong versions
config.resolver.disableHierarchicalLookup = true;

// Force React 18 + RN to come from this workspace's resolution,
// but point at the *real* directories (not the symlink path).
config.resolver.extraNodeModules = {
  react: reactDir,
  "react/jsx-runtime": path.join(reactDir, "jsx-runtime"),
  "react/jsx-dev-runtime": path.join(reactDir, "jsx-dev-runtime"),
  "react-native": rnDir,
};

module.exports = config;
