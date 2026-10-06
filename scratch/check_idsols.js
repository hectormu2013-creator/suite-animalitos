const fs = require('fs');
const html = fs.readFileSync('scratch/triple7_page.html', 'utf8');

const targetIdsols = ['179039', '178980', '178992', '179109', '179040', '178981', '178993', '179041', '178982', '178994', '179111'];

for (const idsol of targetIdsols) {
  const regex = new RegExp(`idsol=${idsol}[^"']*`, 'g');
  const index = html.indexOf(`idsol=${idsol}`);
  if (index !== -1) {
    // Buscar la fila <tr> que contiene este idsol
    const trStart = html.lastIndexOf('<tr', index);
    const trEnd = html.indexOf('</tr>', index);
    const trContent = html.slice(trStart, trEnd);
    const tds = [...trContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    console.log(`idsol ${idsol}: Loteria="${tds[0]}", Sorteo="${tds[1]}"`);
  } else {
    console.log(`idsol ${idsol}: No encontrado en la tabla de hoy`);
  }
}
