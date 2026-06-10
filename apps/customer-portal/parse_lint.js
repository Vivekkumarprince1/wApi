const fs = require('fs');
const lines = fs.readFileSync('/Users/vivekkumar/.gemini/antigravity-ide/brain/079c9d2f-21be-40bc-a4a6-2aba02ec29bd/.system_generated/tasks/task-261.log', 'utf8').split('\n');
let currentFile = '';
for(let line of lines) {
  if(line.startsWith('/')) currentFile = line.trim();
  if(line.includes('error    Compilation Skipped: Existing memoization could not be preserved')) {
    console.log(currentFile, line.trim());
  }
}
