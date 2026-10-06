const https = require('https');
const querystring = require('querystring');
const fs = require('fs');

async function test() {
  const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  const user = cfg.general.triple7.user || 'AREYES';
  const pass = cfg.general.triple7.password || '220126';

  const postData = querystring.stringify({ usuario: user, password: pass });
  const loginRes = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'ny7.undo.it',
      path: '/index.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ headers: res.headers }));
    });
    req.write(postData);
    req.end();
  });

  const cookie = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  console.log('Cookie:', cookie);

  // 1. Bloquear Ballena (idani=1) en LOTTO ACTIVO 04:00 PM (idsol=178988)
  console.log('\n1. Bloqueando idsol=178988, idani=1...');
  const blockRes = await new Promise((resolve) => {
    https.get({
      hostname: 'ny7.undo.it',
      path: '/Venta_Animalitos/lista_sor_ag.php?idsol=178988&idani=1&fecha=2026-10-06',
      headers: {
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve(b));
    });
  });
  console.log('Respuesta bloqueo:', blockRes.slice(0, 300));

  // 2. Consultar la pagina normal SIN idsol=0&idani=0
  console.log('\n2. Consultando pagina normal lista_sor_ag.php?fecha=2026-10-06...');
  const pageHtml = await new Promise((resolve) => {
    https.get({
      hostname: 'ny7.undo.it',
      path: '/Venta_Animalitos/lista_sor_ag.php?fecha=2026-10-06',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve(b));
    });
  });

  // Buscar la fila de 178988 en la pagina normal
  const idx = pageHtml.indexOf('idsol=178988');
  if (idx !== -1) {
    const trStart = pageHtml.lastIndexOf('<tr', idx);
    const trEnd = pageHtml.indexOf('</tr>', idx);
    const row = pageHtml.slice(trStart, trEnd);
    console.log('\nFila de LOTTO ACTIVO 04:00 PM (178988):');
    console.log(row);
  } else {
    console.log('No encontrada en HTML');
  }
}

test().catch(console.error);
