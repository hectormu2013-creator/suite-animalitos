const fs = require('fs');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const t7Robot = require('../triple7_robot');
const predictive = require('../predictive_service');

(async () => {
  console.log('=== INICIANDO BLOQUEO REAL EN TRIPLE 7 ===');
  
  // 1. Obtener estado en vivo de sorteos
  const estado = await t7Robot.obtenerEstadoBloqueos(cfg);
  console.log(`Sorteos activos en Triple 7: ${estado.draws.length}`);

  // Verificar cuáles sorteos están disponibles para LOTTO ACTIVO y LA GRANJITA
  const targetLotteries = ['LOTTO ACTIVO', 'LA GRANJITA'];

  for (const lotName of targetLotteries) {
    const lotId = lotName === 'LOTTO ACTIVO' ? 'lotto_activo' : 'la_granjita';
    const consolidated = predictive.buildConsolidatedBlockList(cfg, lotId, { rojos: [], naranjas: [] });
    console.log(`\n--- Estrategia 4-Vías para ${lotName} ---`);
    console.log(`Números a bloquear (${consolidated.totalNumerosABloquear}):`, consolidated.listaFinalNumeros);

    // Buscar sorteos disponibles para esta lotería (06:00 PM y 07:00 PM)
    const matchingDraws = estado.draws.filter(d => d.loteria.toUpperCase().includes(lotName));
    console.log(`Sorteos encontrados para ${lotName}:`, matchingDraws.map(d => `${d.sorteo} (idsol: ${d.idsol}, bloqueado: ${d.bloqueado})`));

    for (const draw of matchingDraws) {
      console.log(`\n>>> Ejecutando bloqueo real en ${lotName} (${draw.sorteo}) idsol: ${draw.idsol}...`);
      const res = await t7Robot.bloquearNumeros(cfg, lotName, draw.sorteo, consolidated.listaFinalNumeros);
      console.log(`Resultado bloqueo ${draw.sorteo}:`, res);
    }
  }

  console.log('\n=== BLOQUEO REAL COMPLETADO ===');
})();
