const fs = require('fs');

const file = 'C:/Users/Hector/Fenix_2026_1/PROYECTO_VISUAL_FX/lottery_stats.js';
let content = fs.readFileSync(file, 'utf8');

const target = `  const allNumbers = [];
  if (isAnimal) {
    allNumbers.push('00');
    for (let i = 0; i <= max; i++) allNumbers.push(i.toString().padStart(2, '0'));
  }`;

const replacement = `  const allNumbers = [];
  if (isAnimal) {
    allNumbers.push('00');
    allNumbers.push('0');
    for (let i = 1; i <= max; i++) allNumbers.push(i.toString().padStart(2, '0'));
  }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully fixed allNumbers in FX lottery_stats.js');
} else {
  console.log('Target not found or already fixed');
}
