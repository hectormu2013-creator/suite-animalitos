const fs = require('fs');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const t7Robot = require('../triple7_robot');

(async () => {
  console.log('=== BLOQUEANDO LA GRANJITA 07:00 PM EN TRIPLE 7 ===');
  const res = await t7Robot.bloquearNumeros(cfg, 'LA GRANJITA', '07:00 PM', ['11', '14', '33', '35']);
  console.log('Resultado LA GRANJITA 07:00 PM:', res);
})();
