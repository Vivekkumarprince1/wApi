const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const buildIdPath = path.join(appRoot, '.next', 'BUILD_ID');

if (!fs.existsSync(buildIdPath)) {
  console.log('[start] Production build missing. Running npm run build before startup...');
  execSync('npm run build', {
    cwd: appRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

process.env.NODE_ENV = 'production';
require(path.join(appRoot, 'server.js'));