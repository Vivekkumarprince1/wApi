const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'node_modules', '@xyflow', 'react', 'dist', 'esm', 'additional-components');

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.d.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let updated = content;
      
      // Replace '../../src/additional-components/' with './'
      updated = updated.replace(/\.\.\/\.\.\/src\/additional-components\//g, './');
      
      // Replace '../../../src/additional-components/<DirName>/' with './'
      updated = updated.replace(/\.\.\/\.\.\/\.\.\/src\/additional-components\/[a-zA-Z]+\//g, './');
      
      if (content !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Fixed paths in: ${path.relative(targetDir, fullPath)}`);
      }
    }
  });
}

console.log('Fixing @xyflow/react additional-components type definitions...');
walk(targetDir);
console.log('Done.');
