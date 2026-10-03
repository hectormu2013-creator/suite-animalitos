const fs = require('fs');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const predictive = require('../predictive_service');

['guacharo_activo', 'lotto_activo', 'la_granjita'].forEach(lotId => {
  const c = predictive.buildConsolidatedBlockList(cfg, lotId, { rojos: [], naranjas: [] });
  console.log('====================================');
  console.log('LOTERIA:', lotId.toUpperCase());
  console.log('Total a bloquear:', c.totalNumerosABloquear);
  console.log('Lista final:', c.listaFinalNumeros);
  console.log('Fijos:', c.fijosSeleccionados.map(f => `${f.numero} ${f.nombre}`));
  console.log('Predictivos Visual-FX:', c.predictivosSeleccionados.map(p => `${p.numero} ${p.nombre} (${p.sorteosAtraso}s)`));
  console.log('Aleatorios Sistema:', c.aleatoriosSeleccionados.map(a => `${a.numero} ${a.nombre}`));
});
