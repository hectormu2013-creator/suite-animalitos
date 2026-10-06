const fs = require('fs');
const https = require('https');

const html = fs.readFileSync('scratch/triple7_page.html', 'utf8');
const sample = html.match(/idsol[^\s"\'<>]+/gi) || [];
console.log('Total idsol matches:', sample.length);
console.log('Sample matches:', sample.slice(0, 15));

// Revisar un bloque de fila con select
const firstSelect = html.match(/<select[^>]*>[\s\S]*?<\/select>/i);
if (firstSelect) {
  console.log('\nPrimer Select encontrado (primeros 500 caracteres):');
  console.log(firstSelect[0].slice(0, 500));
}

// Revisar los scripts en la pagina
const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
console.log('\nTotal de scripts en pagina:', scripts.length);
const ajaxScripts = scripts.filter(s => s.includes('ajax') || s.includes('updateListado') || s.includes('bloquear'));
console.log('Scripts con ajax/bloquear:', ajaxScripts.length);
if (ajaxScripts.length > 0) {
  console.log('Primer script relevante:');
  console.log(ajaxScripts[0]);
}
