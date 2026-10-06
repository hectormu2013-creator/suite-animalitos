const https = require('https');
const querystring = require('querystring');

function login() {
  return new Promise((resolve) => {
    const postData = querystring.stringify({ usuario: 'AREYES', password: '220126' });
    const req = https.request({
      hostname: 'ny7.undo.it',
      path: '/index.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      resolve(cookies);
    });
    req.write(postData);
    req.end();
  });
}

(async () => {
  const cookie = await login();
  const req = https.request({
    hostname: 'ny7.undo.it',
    path: '/Venta_Animalitos/lista_sor_ag.php',
    method: 'GET',
    headers: { 'Cookie': cookie }
  }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      const inputs = body.match(/<input[^>]+>/gi) || [];
      console.log('Total inputs in page:', inputs.length);
      const reincInputs = inputs.filter(i => i.toLowerCase().includes('reinc') || i.toLowerCase().includes('detalle_ticket') || i.toLowerCase().includes('button'));
      console.log('Matching button inputs:', reincInputs);
      
      // Look for any string mentioning reincorporar in the HTML
      const matches = body.match(/.{0,50}reincorporar.{0,50}/gi) || [];
      console.log('Mentions of reincorporar in page (first 5):', matches.slice(0, 5));
    });
  });
  req.end();
})();
