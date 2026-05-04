const fs = require('fs');
const path = require('path');
function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}
walk('src', (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Replace "/dashboard" exactly -> "/"
    let updated = content.replace(/(['"`])\/dashboard(['"`])/g, '$1/$2');
    
    // Replace "/dashboard/..." -> "/..."
    updated = updated.replace(/(['"`]\/?)\/dashboard\//g, '$1/');
    
    // Replace "/dashboard?..." -> "/?..."
    updated = updated.replace(/(['"`])\/dashboard\?/g, '$1/?');
    
    // Wait, let's fix the components imports which are failing too!
    // @/components/dashboard... might not be changed, but `DashboardRouterHeaders` was failing.
    
    if (content !== updated) {
      fs.writeFileSync(filepath, updated);
      console.log('Updated routes in ' + filepath);
    }
  }
});
