#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const packageJson = require.resolve("expo-device/package.json");
const sourcePath = path.join(path.dirname(packageJson), "ios", "UIDevice.swift");
let source = fs.readFileSync(sourcePath, "utf8");

const macro = "    return TARGET_OS_SIMULATOR != 0";
if (!source.includes(macro)) {
  if (source.includes("#if targetEnvironment(simulator)")) process.exit(0);
  throw new Error("Unexpected expo-device UIDevice.swift; cannot apply Xcode 26 compatibility fix.");
}

source = source.replace("import TargetConditionals\n", "");
source = source.replace(macro, "#if targetEnvironment(simulator)\n    return true\n#else\n    return false\n#endif");
fs.writeFileSync(sourcePath, source);
