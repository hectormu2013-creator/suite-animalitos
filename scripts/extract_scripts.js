const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');

const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
console.log('Total scripts found:', scripts.length);
scripts.forEach((s, idx) => {
  console.log(`\n=================== Script ${idx + 1} ===================`);
  console.log(s);
});
