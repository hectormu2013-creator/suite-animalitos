const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');
const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

function inspectRow(rowIdx, name) {
  const row = rows[rowIdx];
  const options = row.match(/<option[^>]*>[\s\S]*?<\/option>/gi) || [];
  console.log(`\n=================== ${name} (Row ${rowIdx}) options: ${options.length} ===================`);
  // print first 6 and last 4
  options.slice(0, 7).forEach(opt => {
    const val = (opt.match(/value="([^"]*)"/) || [])[1];
    const url = (opt.match(/data-url="([^"]*)"/) || [])[1];
    const nombre = (opt.match(/data-nombre="([^"]*)"/) || [])[1];
    const text = opt.replace(/<[^>]+>/g, '').trim();
    console.log(`  text="${text}", val="${val}", nombre="${nombre}", url="${url}"`);
  });
  console.log('  ...');
  options.slice(-4).forEach(opt => {
    const val = (opt.match(/value="([^"]*)"/) || [])[1];
    const url = (opt.match(/data-url="([^"]*)"/) || [])[1];
    const nombre = (opt.match(/data-nombre="([^"]*)"/) || [])[1];
    const text = opt.replace(/<[^>]+>/g, '').trim();
    console.log(`  text="${text}", val="${val}", nombre="${nombre}", url="${url}"`);
  });
}

inspectRow(3, 'LA GRANJITA 06:00 PM');
inspectRow(5, 'GRANJA MILLONARIA 06:00 PM');
inspectRow(14, 'GUACHARO ACTIVO 06:00 PM');
