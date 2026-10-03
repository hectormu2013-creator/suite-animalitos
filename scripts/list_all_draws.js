const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');

const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

console.log(`Found ${rows.length} total rows.\n`);

const parsed = [];
rows.forEach((row, i) => {
  if (i === 0) return; // header
  const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
  if (tds.length >= 3) {
    const loteria = tds[0].replace(/<[^>]+>/g, '').trim();
    const sorteo = tds[1].replace(/<[^>]+>/g, '').trim();
    const selectMatch = tds[2].match(/id="([^"]+)"/);
    const selectId = selectMatch ? selectMatch[1] : '';
    const idsolMatch = tds[2].match(/idsol=(\d+)/);
    const idsol = idsolMatch ? idsolMatch[1] : '';
    const dateMatch = tds[2].match(/fecha=([\d-]+)/);
    const fecha = dateMatch ? dateMatch[1] : '';
    
    // count options
    const options = tds[2].match(/<option/gi) || [];
    
    // check td 3 (Reincorporar)
    const td3 = tds[3] ? tds[3].replace(/<[^>]+>/g, '').trim() : '';

    parsed.push({
      row: i,
      loteria,
      sorteo,
      selectId,
      idsol,
      fecha,
      optionCount: options.length,
      reincorporar: td3
    });
  }
});

console.table(parsed);
