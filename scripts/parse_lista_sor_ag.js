const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');

// Match table rows
const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
console.log('Total rows:', rows.length);

if (rows.length > 0) {
  console.log('Header:\n', rows[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

for (let i = 1; i < Math.min(rows.length, 6); i++) {
  console.log(`\n=================== ROW ${i} ===================`);
  const tds = rows[i].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
  tds.forEach((td, idx) => {
    console.log(`--- TD [${idx}] ---`);
    console.log(td.trim());
  });
}

// Let's also check if there are any rows with existing blocked animals in TD 3 (Reincorporar animales)
let blockedCount = 0;
rows.forEach((row, i) => {
  const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
  if (tds.length >= 4) {
    const td3 = tds[3];
    // if td3 has content other than whitespace or empty
    const cleanText = td3.replace(/<[^>]+>/g, '').trim();
    if (cleanText.length > 0 || td3.includes('<a') || td3.includes('<button') || td3.includes('onclick')) {
      blockedCount++;
      console.log(`\nFound blocked items in Row ${i}:`);
      console.log('Loteria/Sorteo:', tds[0].replace(/<[^>]+>/g, ' ').trim(), tds[1].replace(/<[^>]+>/g, ' ').trim());
      console.log('TD 3 content:', td3.trim());
    }
  }
});
console.log(`\nTotal rows with blocked animals in TD 3: ${blockedCount}`);
