const https = require('https');
const querystring = require('querystring');
const cfg = require('../config.json');

async function run() {
  const t7 = cfg.general.triple7;

  function req(url, opt = {}) {
    return new Promise((resolve, reject) => {
      const p = new URL(url);
      const r = https.request({
        hostname: p.hostname,
        path: p.pathname + p.search,
        method: opt.method || 'GET',
        headers: opt.headers || {}
      }, (resp) => {
        let b = '';
        resp.on('data', c => b += c);
        resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: b }));
      });
      r.on('error', reject);
      if (opt.body) r.write(opt.body);
      r.end();
    });
  }

  // Login
  const pData = querystring.stringify({ usuario: t7.user, password: t7.password });
  const lRes = await req('https://ny7.undo.it/index.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(pData)
    },
    body: pData
  });

  const cookie = (lRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  console.log('Cookie:', cookie);

  // Fetch list
  const listRes = await req('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', {
    headers: { 'Cookie': cookie }
  });

  // Find GUACHARO MILLONARIO 12:30 or any open lottery
  const rows = listRes.body.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let foundTarget = null;
  for (const r of rows) {
    if (r.includes('GUACHARO') && r.includes('12:30')) {
      foundTarget = r;
      break;
    }
  }

  if (!foundTarget) {
    console.log('GUACHARO 12:30 not found. Picking first open draw:');
    foundTarget = rows[1];
  }

  console.log('Target row snippet:', foundTarget ? foundTarget.slice(0, 300) : 'NONE');

  // Match option 99 or option in this row
  const m = (foundTarget || '').match(/data-url=["'](lista_sor_ag\.php\?[^"']+)["']/i);
  console.log('Matched data-url:', m ? m[1] : 'NONE');

  if (m) {
    const bUrl = 'https://ny7.undo.it/Venta_Animalitos/' + m[1];
    console.log('Testing GET on:', bUrl);
    const bRes = await req(bUrl, {
      headers: {
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php'
      }
    });

    console.log('Block HTTP Status:', bRes.status);
    console.log('Block HTTP Response Body:\n', bRes.body);
  }
}

run().catch(console.error);
