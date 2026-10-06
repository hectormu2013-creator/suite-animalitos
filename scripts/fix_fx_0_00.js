const fs = require('fs');

const file = 'C:/Users/Hector/Fenix_2026_1/PROYECTO_VISUAL_FX/lottery_stats.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add helper normalizeAnimalKey if not present
if (!content.includes('function normalizeAnimalKey(')) {
  const helper = `function normalizeAnimalKey(num) {
  const s = String(num || '').trim();
  if (s === '00') return '00';
  if (s === '0') return '0';
  return s.padStart(2, '0');
}
`;
  content = helper + content;
}

// 2. Fix occurrencesMap in getColdNumbers
content = content.replace(
  `const nKey = d.number.toString().padStart(2, '0');`,
  `const nKey = isAnimal ? normalizeAnimalKey(d.number) : d.number.toString().padStart(2, '0');`
);

// 3. Fix matching in getColdNumbers
content = content.replace(
  `if (isAnimal) return d.number === num || parseInt(d.number) === parseInt(num);`,
  `if (isAnimal) {
          const k1 = normalizeAnimalKey(d.number);
          const k2 = normalizeAnimalKey(num);
          return k1 === k2;
        }`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully fixed normalizeAnimalKey in FX lottery_stats.js');
