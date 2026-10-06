const https = require('https');
const querystring = require('querystring');
const cfg = require('../config.json');

async function test() {
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
        resp.on('end', () => resolve({ body: b }));
      });
      r.on('error', reject);
      if (opt.body) r.write(opt.body);
      r.end();
    });
  }

  const pData = querystring.stringify({ usuario: t7.user, password: t7.password });
  const lReq = https.request('https://ny7.undo.it/index.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(pData)
    }
  }, async (lRes) => {
    const cookie = (lRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const res = await req('https://ny7.undo.it/agente/1ani.php', { headers: { 'Cookie': cookie } });
    const links = res.body.match(/href=["'][^"']+["']/gi) || [];
    console.log('Links on agente/1ani.php:', [...new Set(links)]);
    const iframes = res.body.match(/src=["'][^"']+["']/gi) || [];
    console.log('Iframes/sources:', [...new Set(iframes)]);
  });
  lReq.write(pData);
  lReq.end();
}

test().catch(console.error);
