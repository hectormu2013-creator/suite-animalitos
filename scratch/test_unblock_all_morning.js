const https = require('https');
const querystring = require('querystring');

async function testUnblockAll() {
  const postData = querystring.stringify({ usuario: 'AREYES', password: '220126' });
  const cookie = await new Promise(resolve => {
    const req = https.request({
      hostname: 'ny7.undo.it',
      path: '/index.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        'User-Agent': 'Mozilla/5.0'
      }
    }, res => {
      const c = (res.headers['set-cookie'] || []).map(s => s.split(';')[0]).join('; ');
      resolve(c);
    });
    req.write(postData);
    req.end();
  });

  console.log('Cookie:', cookie);

  // Lista de sorteos viejos de la mañana atascados en aquistring
  const morningIdsols = ['179039', '178980', '178992', '179109', '179040', '178981', '178993', '179041', '178982', '178994', '179111'];

  for (const id of morningIdsols) {
    console.log(`Liberando sorteo culminado idsol=${id}...`);
    const pData = querystring.stringify({ nticket: id, jtipo: '0', modulo: '2' });
    await new Promise(r => {
      const req = https.request({
        hostname: 'ny7.undo.it',
        path: '/Venta_Animalitos/reiniciar_animalitos.php',
        method: 'POST',
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': pData.length,
          'User-Agent': 'Mozilla/5.0'
        }
      }, res => {
        let b = ''; res.on('data', d => b += d); res.on('end', () => {
          console.log(`Respuesta ${id}:`, b.includes('FUERON REINCORPORADOS') ? 'OK REINCORPORADOS' : b.slice(0, 100));
          r();
        });
      });
      req.write(pData);
      req.end();
    });
  }

  // Ahora consultar aquistring
  console.log('\nConsultando aquistring tras liberar sorteos de la mañana...');
  await new Promise(r => {
    https.get({
      hostname: 'ny7.undo.it',
      path: '/Venta_Animalitos/lista_sor_ag.php?idsol=0&idani=0&fecha=2026-10-06',
      headers: { 'Cookie': cookie, 'X-Requested-With': 'XMLHttpRequest' }
    }, res => {
      let b = ''; res.on('data', d => b += d); res.on('end', () => {
        console.log('Aquistring ahora:', b);
        r();
      });
    });
  });
}

testUnblockAll().catch(console.error);
