#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const packageJson = require.resolve("expo-device/package.json");
const sourcePath = path.join(path.dirname(packageJson), "ios", "UIDevice.swift");
const source = fs.readFileSync(sourcePath, "utf8");

if (source.includes("import TargetConditionals")) process.exit(0);
if (!source.includes("import UIKit\n")) {
  throw new Error("Unexpected expo-device UIDevice.swift; cannot apply Xcode 26 compatibility fix.");
}

fs.writeFileSync(sourcePath, source.replace("import UIKit\n", "import UIKit\nimport TargetConditionals\n"));
