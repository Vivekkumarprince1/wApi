const fs = require('fs');
const file = '/Users/vivek/devlopment projects/wApi/wApi/server/src/services/messaging/contactService.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/workspaceId\.toString\(\)\.toString\(\)/g, 'workspaceId.toString()');

fs.writeFileSync(file, code);
