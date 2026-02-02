/**
 * Expo Config Plugin to fix Gradle plugin resolution + Expo autolinking in pnpm monorepos.
 *
 * Fixes:
 * 1) Plugin resolution: ensure expo-modules-core/expo-module-gradle-plugin is discoverable via
 *    android/settings.gradle -> pluginManagement { includeBuild(...) }
 *
 * 2) Autolinking crash: prevent expo-modules-autolinking from applying module plugins to the root
 *    project or to :app (projects that already apply com.android.application), which can trigger:
 *    "'com.android.library' and 'com.android.application' plugins cannot be applied in the same project."
 */

const fs = require("fs");
const path = require("path");
const {
  withSettingsGradle,
  withDangerousMod,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const PLUGIN_NAME = "withMonorepoGradle";
const PLUGIN_VERSION = "1.1.0";

function toPosixPath(p) {
  return p.replace(/\\/g, "/");
}

function resolvePackageDir(pkgName, projectRoot) {
  const roots = [
    projectRoot,
    path.resolve(projectRoot, ".."),
    path.resolve(projectRoot, "../.."),
    path.resolve(projectRoot, "../../.."),
    path.resolve(projectRoot, "../../../.."),
  ];

  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: roots });
    return path.dirname(pkgJsonPath);
  } catch (e) {
    const tried = roots.map((r) => `- ${r}`).join("\n");
    throw new Error(
      `${PLUGIN_NAME}: failed to resolve ${pkgName}/package.json.\nTried:\n${tried}\nOriginal error: ${
        e?.message ?? String(e)
      }`
    );
  }
}

/**
 * Find a `{ ... }` block following a keyword by brace counting.
 * Returns { start, end } indices of the braces in the original string, or null.
 */
function findBraceBlock(contents, keyword) {
  const idx = contents.indexOf(keyword);
  if (idx < 0) return null;

  const braceStart = contents.indexOf("{", idx);
  if (braceStart < 0) return null;

  let depth = 0;
  for (let i = braceStart; i < contents.length; i++) {
    const ch = contents[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { start: braceStart, end: i };
    }
  }

  return null;
}

function insertIntoPluginManagement(contents, insertBlock) {
  if (contents.includes(insertBlock.trim())) return contents;

  const block = findBraceBlock(contents, "pluginManagement");
  if (!block) return contents;

  const bodyStart = block.start + 1;
  const bodyEnd = block.end;

  const before = contents.slice(0, bodyStart);
  const body = contents.slice(bodyStart, bodyEnd);
  const after = contents.slice(bodyEnd);

  // Append near the end of pluginManagement
  return `${before}${body}\n${insertBlock}\n${after}`;
}

function patchAutolinkingImplementation(projectRoot, { verbose = false } = {}) {
  const autolinkingDir = resolvePackageDir("expo-modules-autolinking", projectRoot);
  const filePath = path.join(
    autolinkingDir,
    "scripts",
    "android",
    "autolinking_implementation.gradle"
  );

  if (!fs.existsSync(filePath)) {
    if (verbose) {
      console.log(`${PLUGIN_NAME}: autolinking file not found:\n  ${filePath}`);
    }
    return { didPatch: false, reason: "file-not-found", filePath };
  }

  let contents = fs.readFileSync(filePath, "utf8");

  // Idempotency: if already patched, do nothing.
  if (
    contents.includes("Skipping applying ${modulePlugin.id} to root project") ||
    contents.includes("because it already has com.android.application")
  ) {
    return { didPatch: false, reason: "already-patched", filePath };
  }

  // This is the exact line that causes the crash in the Expo issue diff.
  const applyLineRegex = /^(\s*)project\.plugins\.apply\(modulePlugin\.id\)\s*$/m;
  const match = contents.match(applyLineRegex);

  if (!match) {
    return { didPatch: false, reason: "target-line-not-found", filePath };
  }

  const indent = match[1] ?? "";
  const replacement = [
    `${indent}// Patched by withMonorepoGradle to avoid applying library-only module plugins to the app/root project.`,
    `${indent}// Prevents: 'com.android.library' and 'com.android.application' plugins cannot be applied in the same project.`,
    `${indent}// See expo/expo#41188`,
    `${indent}if (project == rootProject) {`,
    `${indent}  logger.lifecycle("Skipping applying \${modulePlugin.id} to root project \${project.name}")`,
    `${indent}} else if (project.plugins.hasPlugin('com.android.application')) {`,
    `${indent}  logger.lifecycle("Skipping applying \${modulePlugin.id} to \${project.path} because it already has com.android.application")`,
    `${indent}} else if (!project.plugins.hasPlugin(modulePlugin.id)) {`,
    `${indent}  project.plugins.apply(modulePlugin.id)`,
    `${indent}}`,
  ].join("\n");

  contents = contents.replace(applyLineRegex, replacement);
  fs.writeFileSync(filePath, contents);

  return { didPatch: true, reason: "patched", filePath };
}

function withMonorepoGradle(config, options = {}) {
  const verbose =
    options.verbose ??
    (process.env.EXPO_MONOREPO_GRADLE_VERBOSE === "1" ||
    process.env.EXPO_MONOREPO_GRADLE_VERBOSE === "true");

  // 1) settings.gradle: ensure Expo module plugin build is included for plugin resolution
  config = withSettingsGradle(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;

    const expoModulesCoreDir = resolvePackageDir("expo-modules-core", projectRoot);
    const pluginDir = path.join(expoModulesCoreDir, "expo-module-gradle-plugin");
    const pluginDirPosix = toPosixPath(pluginDir);

    const insertBlock =
      `  // Added by withMonorepoGradle (pnpm monorepo): allow resolving 'expo-module-gradle-plugin' and 'expo-root-project'\n` +
      `  includeBuild(file("${pluginDirPosix}"))`;

    let contents = config.modResults.contents;

    // Only patch Groovy settings.gradle
    if (!contents || contents.includes("settings.gradle.kts")) {
      if (verbose) console.log(`${PLUGIN_NAME}: skipping settings.gradle.kts`);
      return config;
    }

    const next = insertIntoPluginManagement(contents, insertBlock);

    if (verbose) {
      if (next !== contents) {
        console.log(
          `${PLUGIN_NAME}: settings.gradle patched (includeBuild added):\n  ${pluginDirPosix}`
        );
      } else {
        console.log(`${PLUGIN_NAME}: settings.gradle already contains expo-module-gradle-plugin includeBuild`);
      }
    }

    config.modResults.contents = next;
    return config;
  });

  // 2) Patch expo-modules-autolinking script to guard module plugin application
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const result = patchAutolinkingImplementation(projectRoot, { verbose });

      if (verbose || result.didPatch) {
        console.log(
          `${PLUGIN_NAME}: ${result.didPatch ? "patched" : "skipped"} autolinking_implementation.gradle (${result.reason})\n` +
            `  ${result.filePath}`
        );
      }

      return config;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(withMonorepoGradle, PLUGIN_NAME, PLUGIN_VERSION);
