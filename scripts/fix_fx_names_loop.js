const fs = require('fs');

const file = 'C:/Users/Hector/Fenix_2026_1/PROYECTO_VISUAL_FX/lottery_stats.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'for (let i = 0; i <= 9; i++) {',
  'for (let i = 1; i <= 9; i++) {'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed ANIMAL_NAMES loop in FX lottery_stats.js');
