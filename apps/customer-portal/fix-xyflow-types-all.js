const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'node_modules', '@xyflow', 'react', 'dist', 'esm');

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.d.ts')) {
      const relativePath = path.relative(targetDir, fullPath);
      const pathParts = relativePath.split(path.sep);
      
      let content = fs.readFileSync(fullPath, 'utf8');
      let updated = content;
      
      if (pathParts[0] === 'types') {
        // Inside dist/esm/types/
        // Replace '../../src/types/' with './'
        updated = updated.replace(/\.\.\/\.\.\/src\/types\//g, './');
        // Replace '../../src/types' with './'
        updated = updated.replace(/\.\.\/\.\.\/src\/types/g, './');
      } else if (pathParts.length === 2) {
        // One level deep (e.g. hooks/useNodes.d.ts, utils/changes.d.ts)
        // Replace '../../src/types' with '../types'
        updated = updated.replace(/\.\.\/\.\.\/src\/types/g, '../types');
      } else if (pathParts.length === 3) {
        // Two levels deep (e.g. components/Edges/EdgeText.d.ts, container/ReactFlow/index.d.ts)
        // Replace '../../../src/types' with '../../types'
        updated = updated.replace(/\.\.\/\.\.\/\.\.\/src\/types/g, '../../types');
      } else if (pathParts.length === 4) {
        // Three levels deep (e.g. additional-components/Controls/Icons/Plus.d.ts if any)
        // Replace '../../../../src/types' with '../../../types'
        updated = updated.replace(/\.\.\/\.\.\/\.\.\/\.\.\/src\/types/g, '../../../types');
      }
      
      if (content !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Fixed types in: ${relativePath}`);
      }
    }
  });
}

console.log('Fixing all ESM typescript types in @xyflow/react...');
walk(targetDir);
console.log('Done.');
