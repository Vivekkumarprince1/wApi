const fs = require('fs');
const path = require('path');
function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}
walk('./src', (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let updated = content.replace(/(['"`])\/dashboard(['"`])/g, '$1/$2');
    updated = updated.replace(/(['"`]\/?)\/dashboard\//g, '$1/');
    updated = updated.replace(/(['"`])\/dashboard\?/g, '$1/?');
    if (content !== updated) {
      fs.writeFileSync(filepath, updated);
      console.log('Updated routes in ' + filepath);
    }
  }
});
