#!/usr/bin/env node
// Wrapper to call fix-hermesc.sh but only on Linux/ARM64
const { execSync } = require('child_process');
const path = require('path');

if (process.platform !== 'linux') {
  // Not Linux, skip
  process.exit(0);
}

try {
  const scriptPath = path.join(__dirname, 'fix-hermesc.sh');
  execSync(`bash ${scriptPath}`, { stdio: 'inherit' });
} catch (e) {
  // Non-fatal
  process.exit(0);
}
