const { execSync } = require('child_process');

const shouldBuild = process.env.RENDER === 'true' || process.env.CI === 'true';

if (!shouldBuild) {
  process.exit(0);
}

console.log('[postinstall] Render/CI detected. Building Next app...');
execSync('npm run build', {
  stdio: 'inherit',
  env: process.env,
});