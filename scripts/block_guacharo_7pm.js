const fs = require('fs');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const t7Robot = require('../triple7_robot');
const predictive = require('../predictive_service');

(async () => {
  console.log('=== BLOQUEANDO GUACHARO ACTIVO 07:00 PM EN TRIPLE 7 ===');
  const consolidated = predictive.buildConsolidatedBlockList(cfg, 'guacharo_activo', { rojos: [], naranjas: [] });
  console.log('Números a bloquear:', consolidated.listaFinalNumeros);
  const res = await t7Robot.bloquearNumeros(cfg, 'GUACHARO ACTIVO', '07:00 PM', consolidated.listaFinalNumeros);
  console.log('Resultado GUACHARO ACTIVO 07:00 PM:', res);
})();
