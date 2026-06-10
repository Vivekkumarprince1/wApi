const fs = require('fs');
const lines = fs.readFileSync('lint-output.txt', 'utf8').split('\n');
let currentFile = '';
for(let line of lines) {
  if(line.startsWith('/')) currentFile = line.trim();
  if(line.includes('error')) {
    console.log(currentFile, line.trim());
  }
}
