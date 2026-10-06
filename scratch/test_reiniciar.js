const https = require('https');
const querystring = require('querystring');
const fs = require('fs');

async function testReiniciar() {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64 x64)'
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

  // 1. Probar reiniciar un sorteo ya culminado de la mañana (ej: 179039)
  console.log('\n1. Llamando reiniciar_animalitos.php para nticket=179039...');
  const reinPost = querystring.stringify({
    nticket: '179039',
    jtipo: '0',
    modulo: '2'
  });

  const reinRes = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'ny7.undo.it',
      path: '/Venta_Animalitos/reiniciar_animalitos.php',
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(reinPost),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve(b));
    });
    req.write(reinPost);
    req.end();
  });
  console.log('Respuesta reiniciar_animalitos:', reinRes);

  // 2. Ver aquistring ahora
  console.log('\n2. Ver aquistring despues de reiniciar 179039...');
  const aquiRes = await new Promise((resolve) => {
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

  // Ver si aparece el string en el HTML o en una llamada AJAX
  const aquiMatch = aquiRes.match(/aquistring[^\n\r]+/);
  console.log('Aquistring en HTML:', aquiMatch ? aquiMatch[0] : 'No en HTML');
}

testReiniciar().catch(console.error);
