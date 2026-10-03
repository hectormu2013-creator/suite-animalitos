const fs = require('fs');
const path = require('path');

const animalDict = JSON.parse(fs.readFileSync(path.join(__dirname, 'animal_dictionary.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');

function clean(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Function to find option by number for a given row select
function findOptionForNumber(options, numberStr) {
  const numInt = parseInt(numberStr, 10);
  const pad2 = numberStr.toString().padStart(2, '0');
  
  // 1. Get official animal name from dict
  let dictName = animalDict[numberStr] || animalDict[pad2] || animalDict[numInt.toString()];
  let cleanDict = clean(dictName);

  for (const opt of options) {
    const cleanOptText = clean(opt.text);
    if (!cleanOptText || cleanOptText.includes('selecione')) continue;

    // Check exact or root match
    if (cleanDict && (cleanOptText === cleanDict || cleanOptText.startsWith(cleanDict) || cleanDict.startsWith(cleanOptText))) {
      return opt;
    }
    // Special cases: Zebra / Cebra
    if ((cleanDict === 'zebra' || cleanDict === 'cebra') && (cleanOptText === 'zebra' || cleanOptText === 'cebra')) {
      return opt;
    }
    // Special case: Ciempie / Ciempies
    if (cleanDict.includes('ciempie') && cleanOptText.includes('ciempie')) {
      return opt;
    }
    // Special case: Elefante / Elefant
    if (cleanDict.includes('elefan') && cleanOptText.includes('elefan')) {
      return opt;
    }
  }
  return null;
}

// Test for Row 1 (LOTTO ACTIVO)
const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
const row1 = rows[1];
const optionsRaw = row1.match(/<option[^>]*>[\s\S]*?<\/option>/gi) || [];
const options = optionsRaw.map(opt => ({
  val: (opt.match(/value="([^"]*)"/) || [])[1],
  text: opt.replace(/<[^>]+>/g, '').trim(),
  url: (opt.match(/data-url="([^"]*)"/) || [])[1]
}));

console.log('Testing numbers 00, 0, 1..36 for LOTTO ACTIVO:');
const testNumbers = ['00', '0', ...Array.from({ length: 36 }, (_, i) => (i + 1).toString())];
let missing = 0;
testNumbers.forEach(n => {
  const matched = findOptionForNumber(options, n);
  if (!matched) {
    console.error(`MISSING match for number ${n}!`);
    missing++;
  } else {
    // console.log(`Num ${n} (${animalDict[n]}) -> matched "${matched.text}" (val: ${matched.val})`);
  }
});

console.log(`Lotto Activo matching test finished. Missing: ${missing} / ${testNumbers.length}`);

// Test for Row 14 (GUACHARO ACTIVO)
const row14 = rows[14];
const row14OptsRaw = row14.match(/<option[^>]*>[\s\S]*?<\/option>/gi) || [];
const row14Opts = row14OptsRaw.map(opt => ({
  val: (opt.match(/value="([^"]*)"/) || [])[1],
  text: opt.replace(/<[^>]+>/g, '').trim(),
  url: (opt.match(/data-url="([^"]*)"/) || [])[1]
}));

console.log('\nTesting numbers for GUACHARO ACTIVO (00, 0, 1..75):');
const testGuacharo = ['00', '0', ...Array.from({ length: 75 }, (_, i) => (i + 1).toString())];
let missingG = 0;
testGuacharo.forEach(n => {
  const matched = findOptionForNumber(row14Opts, n);
  if (!matched) {
    console.error(`MISSING match for Guacharo number ${n} (${animalDict[n]})!`);
    missingG++;
  }
});
console.log(`Guacharo Activo matching test finished. Missing: ${missingG} / ${testGuacharo.length}`);
