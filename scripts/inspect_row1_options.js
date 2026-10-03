const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');
const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

// Row 1 is Lotto Activo 06:00 PM
const row1 = rows[1];
const options = row1.match(/<option[^>]*>[\s\S]*?<\/option>/gi) || [];

console.log(`Row 1 has ${options.length} options:\n`);
options.forEach(opt => {
  const val = (opt.match(/value="([^"]*)"/) || [])[1];
  const url = (opt.match(/data-url="([^"]*)"/) || [])[1];
  const nombre = (opt.match(/data-nombre="([^"]*)"/) || [])[1];
  const text = opt.replace(/<[^>]+>/g, '').trim();
  console.log(`Option: text="${text}", value="${val}", data-nombre="${nombre}", data-url="${url}"`);
});
