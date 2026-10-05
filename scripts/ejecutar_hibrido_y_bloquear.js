const path = require('path');
const fs = require('fs');

async function main() {
  console.log('===============================================================');
  console.log('🎯 EJECUTANDO SONDEO HÍBRIDO + BLOQUEO AUTOMÁTICO EN TRIPLE 7');
  console.log('===============================================================\n');

  const configPath = path.join(__dirname, '..', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const premierRobot = require('../premier_robot');
  const predictive = require('../predictive_service');
  const historyMgr = require('../history_manager');
  const triple7 = require('../triple7_robot');

  // Argumentos de línea de comandos: node scripts/ejecutar_hibrido_y_bloquear.js [loteriaId] [horaSorteo] [modo]
  const args = process.argv.slice(2);
  let targetLoteriaId = args[0] || '';
  let targetHoraSorteo = args[1] || '';
  let modoArg = (args[2] || '').toLowerCase();
  let esModoHibrido = (modoArg === 'hibrido' || modoArg === '--hibrido');

  let lot = null;
  if (targetLoteriaId) {
    lot = config.loterias.find(l => l.id === targetLoteriaId || l.nombre.toUpperCase().includes(targetLoteriaId.toUpperCase()));
  }
  if (!lot) {
    lot = config.loterias.find(l => l.activo) || config.loterias[0];
  }

  const horaSorteo = targetHoraSorteo || predictive.calcularProximoSorteo(lot.horarios) || '12:00';

  console.log(`📌 Lotería seleccionada: ${lot.nombre}`);
  console.log(`⏰ Sorteo a procesar: ${horaSorteo}`);
  console.log(`⚙️  Modalidad Premier:   ${esModoHibrido ? 'HÍBRIDO (Selección en Pantalla)' : '100% AUTOMÁTICO (OCR + Teclado)'}`);

  // Ejecutar sondeo en Premier Pluss
  let premierResult = { ok: false, rojos: [], totalAnimalesAnalizados: lot.totalAnimales || 38 };
  try {
    if (esModoHibrido) {
      console.log(`\n[PASO 1] Ejecutando Sondeo Híbrido en Premier Pluss (Respetando selección actual en pantalla)...`);
      premierResult = await premierRobot.ejecutarSondeoPremier(config, lot.id, horaSorteo, false, true);
    } else {
      console.log(`\n[PASO 1] Ejecutando Sondeo Automático en Premier Pluss (Selección OCR + Limpieza + Sorteo Q)...`);
      premierResult = await premierRobot.ejecutarSondeoPremier(config, lot.id, horaSorteo, false, false);
    }

    console.log(`\n[PASO 1 EXITOSO] Premier Pluss analizó ${premierResult.totalAnimalesAnalizados} animales.`);
    console.log(`[PASO 1 EXITOSO] Rojos (Cupo 0) detectados: [${(premierResult.rojos || []).join(', ') || 'Ninguno'}]`);
    
    // Si el resultado trajo un nombre de lotería detectado por OCR, ajustarlo
    if (premierResult.loteria) {
      const match = config.loterias.find(l => premierResult.loteria.toUpperCase().includes(l.nombre.toUpperCase()) || l.nombre.toUpperCase().includes(premierResult.loteria.toUpperCase()));
      if (match) lot = match;
    }
  } catch (errPrem) {
    console.warn(`[PASO 1 AVISO] Premier Pluss aviso: ${errPrem.message}`);
  }

  // 2. Consolidar reglas de bloqueo
  console.log(`\n[PASO 2] Consolidando reglas de bloqueo (Premier + Fijos + Visual-FX + Sistema)...`);
  const consolidated = predictive.buildConsolidatedBlockList(config, lot.id, premierResult);

  const descFijos = (consolidated.fijosSeleccionados || []).map(f => `${f.numero} ${f.nombre}`).join(', ');
  const descPredictivos = (consolidated.predictivosSeleccionados || []).map(p => `${p.numero} ${p.nombre} (${p.sorteosAtraso}s)`).join(', ');
  const descAleatorios = (consolidated.aleatoriosSeleccionados || []).map(a => `${a.numero} ${a.nombre}`).join(', ');
  const descMemoria = (consolidated.memoriaSeleccionados || []).map(m => `${m.numero} ${m.nombre} (${m.sorteosRestantes}s)`).join(', ');

  console.log(` -> 🔴 Premier Pluss (Cupo 0): [${consolidated.rojosPremier.join(', ') || 'Ninguno'}]`);
  console.log(` -> 📌 Números Fijos: [${descFijos || 'Ninguno'}]`);
  console.log(` -> 🔮 Visual-FX (Atrasados): [${descPredictivos || 'Ninguno'}]`);
  console.log(` -> 🎲 Sistema (Aleatorios): [${descAleatorios || 'Ninguno'}]`);
  console.log(` -> 🧠 Memoria Persistente: [${descMemoria || 'Ninguna'}]`);
  console.log(` -> 🛡️ TOTAL FINAL A BLOQUEAR: ${consolidated.totalNumerosABloquear} números: [${consolidated.listaFinalNumeros.join(', ')}]`);

  // 3. Ejecutar Bloqueo Real en Triple 7
  let t7Res = { ok: false, message: 'Triple 7 desactivado en configuración' };
  if (config.general.triple7.enabled && consolidated.listaFinalNumeros.length > 0) {
    console.log(`\n[PASO 3] Enviando ${consolidated.listaFinalNumeros.length} números a Triple 7 para ${lot.nombre} (${horaSorteo})...`);
    try {
      t7Res = await triple7.bloquearNumeros(config, lot.nombre, horaSorteo, consolidated.listaFinalNumeros);
      if (t7Res.ok) {
        console.log(`✅ [PASO 3 ÉXITO] ¡Triple 7 bloqueó los números correctamente!`);
        if (t7Res.bloqueados && t7Res.bloqueados.length > 0) {
          console.log(`   Animales asegurados: ${t7Res.bloqueados.map(b => `${b.numero} (${b.animal})`).join(', ')}`);
        }
      } else {
        console.warn(`⚠️ [PASO 3 RESPUESTA] Triple 7: ${t7Res.message || 'Sin confirmación'}`);
      }
    } catch (t7Err) {
      console.error(`❌ [PASO 3 ERROR] Error comunicando con Triple 7: ${t7Err.message}`);
      t7Res = { ok: false, message: t7Err.message };
    }
  } else if (!config.general.triple7.enabled) {
    console.log(`[PASO 3 INFO] Módulo Triple 7 está desactivado en config.json.`);
  }

  // 4. Registrar en Base de Datos e Historial
  console.log(`\n[PASO 4] Registrando en Base de Datos e Historial...`);
  const statusText = t7Res.ok ? `Bloqueados (${consolidated.listaFinalNumeros.length}) en Triple 7` : `Triple 7: ${t7Res.message}`;
  historyMgr.recordScan({
    loteria: lot.nombre,
    sorteo: horaSorteo,
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
    memoriaCupoCero: consolidated.memoriaSeleccionados,
    numMemoriaCupoCero: consolidated.numMemoria,
    bloqueosConsolidados: consolidated.bloqueosConsolidados,
    totalBloqueados: consolidated.totalNumerosABloquear,
    t7Status: statusText,
    t7Blocked: t7Res.ok
  });

  console.log('\n===============================================================');
  console.log('🎉 PROCESO HÍBRIDO + BLOQUEO COMPLETADO CON ÉXITO');
  console.log('===============================================================');
  console.log(`Lotería:    ${lot.nombre}`);
  console.log(`Sorteo:     ${horaSorteo}`);
  console.log(`Cupo 0:     [${consolidated.rojosPremier.join(', ') || 'Ninguno'}]`);
  console.log(`Total Bloq: ${consolidated.totalNumerosABloquear} números`);
  console.log(`Triple 7:   ${t7Res.ok ? '✅ BLOQUEADO EXITOSAMENTE' : '⚠️ ' + t7Res.message}`);
  console.log('===============================================================\n');
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
