const fs = require('fs');

const lines = fs.readFileSync('scripts/sondeo_completo.ps1', 'utf8').split('\n');
const code = lines.slice(31, 293);

let depth = 0;
code.forEach((line, idx) => {
  const lineNum = idx + 32;
  for (let c of line) {
    if (c === '{') depth++;
    if (c === '}') depth--;
  }
  if (lineNum >= 180 && lineNum <= 240) {
    console.log(`${lineNum} [depth=${depth}]: ${line}`);
  }
});
console.log('Final depth:', depth);
