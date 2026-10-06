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
  const postData = querystring.stringify({ nticket: '179047', jtipo: '0', modulo: '2' });
  const req = https.request({
    hostname: 'ny7.undo.it',
    path: '/Venta_Animalitos/reiniciar_animalitos.php',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('reiniciar_animalitos response for 179047:', res.statusCode, body);
    });
  });
  req.write(postData);
  req.end();
})();
