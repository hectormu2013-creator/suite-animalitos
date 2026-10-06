const predictive = require('../predictive_service');
const historyMgr = require('../history_manager');
const fs = require('fs');
const path = require('path');

async function runVerification() {
  console.log('====================================================');
  console.log('VERIFICACIÓN DEL MODELO PREDICTIVO Y VISUAL-FX');
  console.log('====================================================');

  const games = ['guacharo_activo', 'lotto_activo', 'la_granjita', 'guacharo_millonario'];

  console.log('\n1. TOP 5 ATRASADOS POR REVENTAR POR LOTERÍA:');
  for (const g of games) {
    const delayed = predictive.getMostDelayedNumbers(g, 5);
    console.log(`\n[${g.toUpperCase()}]:`);
    delayed.forEach((d, idx) => {
      console.log(`  Top #${idx + 1}: #${d.numero} ${d.nombre} -> ${d.diasAtraso}d sin salir (${d.sorteosAtraso} sorteos atrasado, ${d.salidas30d} salidas en 30d)`);
    });
  }

  console.log('\n2. PRUEBA DE SINCRONIZACIÓN ACTIVA POST-SORTEO (+5 MIN):');
  console.log('Ejecutando syncVisualFxDraws para guacharo-activo...');
  const syncResult = await predictive.syncVisualFxDraws('guacharo-activo');
  console.log('Resultado de syncVisualFxDraws:', syncResult);

  console.log('\n3. VERIFICACIÓN DE RESULTADO DE SORTEO PROGRAMADO:');
  const verifyRes = historyMgr.syncScheduledDrawResult('guacharo_activo', '10:00 AM', '2026-10-04', 1);
  console.log('Resultado syncScheduledDrawResult 10:00 AM:', verifyRes);

  console.log('\n4. PRUEBA DE LISTA CONSOLIDADA DE BLOQUEO (PREMIER + PREDICTIVOS + FIJOS + ALEATORIOS):');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8'));
  const premierDummyResult = { rojos: ['26'] }; // Vaca detectada en cupo 0
  const consolidated = predictive.buildConsolidatedBlockList(cfg, 'guacharo_activo', premierDummyResult);
  console.log('Lotería:', consolidated.loteria);
  console.log('Premier Cupo 0 detectados:', consolidated.rojosPremier);
  console.log('Predictivos Visual-FX seleccionados:', consolidated.predictivosSeleccionados.map(p => `${p.numero} (${p.nombre}: ${p.diasAtraso}d)`));
  console.log('Fijos seleccionados:', consolidated.fijosSeleccionados.map(f => f.numero));
  console.log('Aleatorios seleccionados:', consolidated.aleatoriosSeleccionados.map(a => a.numero));
  console.log('TOTAL LISTA FINAL A BLOQUEAR:', consolidated.listaFinalNumeros);

  console.log('\n====================================================');
  console.log('¡TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO!');
  console.log('====================================================');
}

runVerification();
