const fs = require('fs');
const path = require('path');

const animalDict = JSON.parse(fs.readFileSync(path.join(__dirname, 'animal_dictionary.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');

const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
const row14 = rows[14];
const optionsRaw = row14.match(/<option[^>]*>[\s\S]*?<\/option>/gi) || [];

optionsRaw.forEach((opt, idx) => {
  const text = opt.replace(/<[^>]+>/g, '').trim();
  const val = (opt.match(/value="([^"]*)"/) || [])[1];
  if (idx >= 48 && idx <= 55) {
    console.log(`Option [${idx}]: val=${val}, text="${text}"`);
  }
  if (idx >= 71 && idx <= 78) {
    console.log(`Option [${idx}]: val=${val}, text="${text}"`);
  }
});
