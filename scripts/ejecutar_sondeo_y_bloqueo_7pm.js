const path = require('path');
const fs = require('fs');

async function main() {
  console.log('===============================================================');
  console.log('🚀 INICIANDO PROCESO INTEGRAL DE SONDEO Y BLOQUEO PARA LAS 7:00 PM');
  console.log('===============================================================\n');

  const configPath = path.join(__dirname, '..', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const premierRobot = require('../premier_robot');
  const predictive = require('../predictive_service');
  const historyMgr = require('../history_manager');
  const triple7 = require('../triple7_robot');

  const targetLotteries = ['lotto_activo', 'la_granjita', 'guacharo_activo'];
  const resultsSummary = [];

  for (const lotId of targetLotteries) {
    const lot = config.loterias.find(l => l.id === lotId);
    if (!lot) continue;

    console.log(`\n---------------------------------------------------------------`);
    console.log(`🎯 PROCESANDO LOTERÍA: ${lot.nombre} (Sorteo 07:00 PM)`);
    console.log(`---------------------------------------------------------------`);

    // 1. Sondeo Real en Premier Pluss 2.0
    console.log(`[PASO 1] Ejecutando sondeo de cupo cero en Premier Pluss 2.0 para ${lot.nombre}...`);
    let premierResult = { ok: false, rojos: [], totalAnimalesAnalizados: lot.totalAnimales || 38 };
    try {
      premierResult = await premierRobot.ejecutarSondeoPremier(config, lot.id);
      console.log(`[PASO 1 RESULTADO] Premier Pluss analizó ${premierResult.totalAnimalesAnalizados} animales.`);
      console.log(`[PASO 1 RESULTADO] Rojos (Cupo 0) detectados: [${(premierResult.rojos || []).join(', ') || 'Ninguno'}]`);
    } catch (errPrem) {
      console.warn(`[PASO 1 AVISO] Premier Pluss sondeo no completó: ${errPrem.message}. Continuando con reglas predictivas, fijas y del sistema.`);
    }

    // 2. Construir lista consolidada aplicando las 4 reglas de riesgo
    console.log(`[PASO 2] Consolidando reglas de bloqueo (Premier + Fijos + Visual-FX + Sistema)...`);
    const consolidated = predictive.buildConsolidatedBlockList(config, lot.id, premierResult);

    const descFijos = (consolidated.fijosSeleccionados || []).map(f => `${f.numero} ${f.nombre}`).join(', ');
    const descPredictivos = (consolidated.predictivosSeleccionados || []).map(p => `${p.numero} ${p.nombre} (${p.sorteosAtraso}s)`).join(', ');
    const descAleatorios = (consolidated.aleatoriosSeleccionados || []).map(a => `${a.numero} ${a.nombre}`).join(', ');

    console.log(` -> 🔴 Premier Pluss (Cupo 0): [${consolidated.rojosPremier.join(', ') || 'Ninguno'}]`);
    console.log(` -> 📌 Números Fijos: [${descFijos || 'Ninguno'}]`);
    console.log(` -> 🔮 Visual-FX (Atrasados): [${descPredictivos || 'Ninguno'}]`);
    console.log(` -> 🎲 Sistema (Aleatorios): [${descAleatorios || 'Ninguno'}]`);
    console.log(` -> 🛡️ TOTAL FINAL A BLOQUEAR: ${consolidated.totalNumerosABloquear} números: [${consolidated.listaFinalNumeros.join(', ')}]`);

    // 3. Ejecutar Bloqueo Real en Triple 7
    let t7Res = { ok: false, message: 'Triple 7 desactivado' };
    if (config.general.triple7.enabled && consolidated.listaFinalNumeros.length > 0) {
      console.log(`[PASO 3] Enviando ${consolidated.listaFinalNumeros.length} números a Triple 7 para ${lot.nombre} (07:00 PM)...`);
      try {
        t7Res = await triple7.bloquearNumeros(config, lot.nombre, '07:00 PM', consolidated.listaFinalNumeros);
        console.log(`[PASO 3 RESULTADO] Triple 7 respuesta: ok=${t7Res.ok} | ${t7Res.message || ''}`);
        if (t7Res.bloqueados && t7Res.bloqueados.length > 0) {
          console.log(`[PASO 3 VERIFICADO] Animales bloqueados con éxito en Triple 7: ${t7Res.bloqueados.map(b => `${b.numero} (${b.animal})`).join(', ')}`);
        }
      } catch (t7Err) {
        console.error(`[PASO 3 ERROR] Error en Triple 7: ${t7Err.message}`);
        t7Res = { ok: false, message: t7Err.message };
      }
    }

    // 4. Registrar en Base de Datos Histórica / Muro de Trofeos
    console.log(`[PASO 4] Registrando auditoría en el Muro de Trofeos y Base de Datos...`);
    const statusText = t7Res.ok ? `Bloqueados (${consolidated.listaFinalNumeros.length}) en Triple 7` : `Triple 7: ${t7Res.message}`;
    const persistentRecord = historyMgr.recordScan({
      loteria: lot.nombre,
      sorteo: '07:00 PM',
      montoSondeo: lot.montoSondeo || 3000,
      totalAnimalesAnalizados: premierResult.totalAnimalesAnalizados || lot.totalAnimales || 38,
      rojos: consolidated.listaFinalNumeros,
      rojosPremier: consolidated.rojosPremier,
      detallePremier: (consolidated.rojosPremier || []).map(n => ({ numero: n, nombre: historyMgr.getAnimalName(n), origen: 'PREMIER' })),
      numFijos: consolidated.numFijos,
      fijosSeleccionados: consolidated.fijosSeleccionados,
      numPredictivos: (consolidated.predictivosSeleccionados || []).map(p => p.numero),
      predictivosVisualFx: consolidated.predictivosSeleccionados,
      numAleatorios: (consolidated.aleatoriosSeleccionados || []).map(a => a.numero),
      aleatoriosSistema: consolidated.aleatoriosSeleccionados,
      bloqueosConsolidados: consolidated.bloqueosConsolidados,
      totalBloqueados: consolidated.totalNumerosABloquear,
      t7Status: statusText,
      t7Blocked: t7Res.ok
    });

    resultsSummary.push({
      loteria: lot.nombre,
      sorteo: '07:00 PM',
      totalBloqueados: consolidated.totalNumerosABloquear,
      numeros: consolidated.listaFinalNumeros,
      premier: consolidated.rojosPremier,
      fijos: consolidated.numFijos,
      predictivos: (consolidated.predictivosSeleccionados || []).map(p => p.numero),
      aleatorios: (consolidated.aleatoriosSeleccionados || []).map(a => a.numero),
      t7Ok: t7Res.ok,
      t7Status: statusText
    });
  }

  console.log('\n===============================================================');
  console.log('🎉 RESUMEN DE EJECUCIÓN COMPLETA PARA EL SORTEO DE LAS 7:00 PM');
  console.log('===============================================================');
  console.table(resultsSummary.map(r => ({
    Lotería: r.loteria,
    Sorteo: r.sorteo,
    'Total Bloq': r.totalBloqueados,
    'Premier (Cupo 0)': r.premier.join(',') || '0',
    'Fijos': r.fijos.join(',') || '0',
    'Visual-FX': r.predictivos.join(',') || '0',
    'Aleatorios': r.aleatorios.join(',') || '0',
    'Triple 7': r.t7Ok ? 'BLOQUEADO' : 'ERROR'
  })));

  return resultsSummary;
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
}

module.exports = { main };
