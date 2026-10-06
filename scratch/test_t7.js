const https = require('https');
const querystring = require('querystring');
const fs = require('fs');

async function testBlock() {
  const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  const user = cfg.general.triple7.user || 'AREYES';
  const pass = cfg.general.triple7.password || '220126';

  console.log('1. Autenticando usuario:', user);
  const postData = querystring.stringify({ usuario: user, password: pass });
  
  const loginRes = await new Promise((resolve, reject) => {
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
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  const rawCookies = loginRes.headers['set-cookie'] || [];
  const cookie = rawCookies.map(c => c.split(';')[0]).join('; ');
  console.log('Cookie recibida:', cookie);

  // Probar llamar a la URL exacta: lista_sor_ag.php?idsol=178988&idani=1&fecha=2026-10-06
  const targetPath = '/Venta_Animalitos/lista_sor_ag.php?idsol=178988&idani=1&fecha=2026-10-06';
  console.log('\n2. Llamando a targetPath:', targetPath);

  const blockRes = await new Promise((resolve, reject) => {
    https.get({
      hostname: 'ny7.undo.it',
      path: targetPath,
      headers: {
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
  });

  console.log('Status:', blockRes.status);
  console.log('Headers:', blockRes.headers);
  console.log('Body length:', blockRes.body.length);
  console.log('Body exacto:', JSON.stringify(blockRes.body));

  console.log('\n3. Consultando aquistring con idsol=0&idani=0...');
  const aquiRes = await new Promise((resolve, reject) => {
    https.get({
      hostname: 'ny7.undo.it',
      path: '/Venta_Animalitos/lista_sor_ag.php?idsol=0&idani=0&fecha=2026-10-06',
      headers: {
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
  });
  console.log('Aquistring status:', aquiRes.status, 'Body exacto:', JSON.stringify(aquiRes.body));
}

testBlock().catch(console.error);
