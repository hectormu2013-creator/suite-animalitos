// reconcile_and_verify_today.js
// Cruce y reconciliación definitiva de todos los sorteos de hoy (2026-10-13) con fuentes oficiales

const fs = require('fs');
const path = require('path');
const historyMgr = require('../history_manager');
const cloudStore = require('../cloud_store');
const scraper = require('../scraper_service');

async function main() {
  console.log('🔄 [RECONCILIACIÓN] Iniciando reconciliación definitiva de resultados...');

  // 1. Obtener registros de Supabase y local
  const cloudData = await cloudStore.getMasterHistory();
  const cloudRecords = (cloudData && Array.isArray(cloudData.records)) ? cloudData.records : [];
  let localRecords = [];
  try {
    localRecords = JSON.parse(fs.readFileSync(historyMgr.DB_PATH, 'utf8') || '[]');
  } catch (e) {}

  console.log(`📦 Registros en Supabase: ${cloudRecords.length}, Registros locales: ${localRecords.length}`);

  // 2. Fusionar con la regla monotónica inmutable
  let currentHistory = historyMgr.mergeHistories(localRecords, cloudRecords);
  console.log(`🔗 Total tras fusión inmutable: ${currentHistory.length}`);

  // 3. Consultar TuAzar para hoy
  const todayStr = '2026-10-13';
  const tuAzarResults = await scraper.scrapeTuAzarAnimalitos(todayStr);

  const loteriaKeyMap = {
    'lotto activo': 'lotto-activo',
    'la granjita': 'la-granjita',
    'guacharo activo': 'guacharo-activo',
    'guacharo millonario': 'guacharito-millonario'
  };

  function parseTime12ToMinutes(str) {
    if (!str) return null;
    const m = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ampm = (m[3] || '').toUpperCase();
    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
  }

  let updatedCount = 0;
  let trophiesCount = 0;

  for (const rec of currentHistory) {
    if (rec.fecha !== todayStr) continue;
    if (rec.ganador && rec.ganador.verificado && rec.ganador.numero) continue; // Ya verificado

    const normLot = (rec.loteria || '').toLowerCase();
    let matchedKey = null;
    for (const [sub, tKey] of Object.entries(loteriaKeyMap)) {
      if (normLot.includes(sub)) {
        matchedKey = tKey;
        break;
      }
    }

    if (!matchedKey || !tuAzarResults[matchedKey]) continue;

    const drawTimeStr = rec.sorteo || rec.horaSorteo;
    const targetMins = historyMgr.parseTimeToMinutes(drawTimeStr);
    if (targetMins === null) continue;

    const tuAzarDraws = tuAzarResults[matchedKey];
    const match = tuAzarDraws.find(d => {
      if (d.isPending || !d.number) return false;
      const dMins = parseTime12ToMinutes(d.time);
      return dMins !== null && Math.abs(dMins - targetMins) <= 20;
    });

    if (match && match.number) {
      const normWinner = String(match.number).padStart(2, '0');
      const resolvedName = match.name || historyMgr.getAnimalName(normWinner);

      // Evaluar acierto/trofeo
      const bloqueados = rec.rojos || [];
      const salioBloqueado = bloqueados.some(b => {
        const bClean = String(typeof b === 'object' ? b.numero : b).padStart(2, '0');
        return bClean === normWinner || parseInt(bClean, 10) === parseInt(normWinner, 10);
      });

      rec.ganador = {
        verificado: true,
        numero: normWinner,
        nombre: resolvedName,
        bloqueoAcertado: salioBloqueado,
        origenAcierto: salioBloqueado ? 'BLOQUEO' : null,
        origenTexto: salioBloqueado ? 'Número Bloqueado' : null,
        mensaje: salioBloqueado 
          ? `🏆 ¡GOLPE DE BANCA EVITADO! Salió el ${normWinner} (${resolvedName}) que estaba bloqueado.`
          : `Resultado oficial: ${normWinner} - ${resolvedName}`,
        fechaVerificacion: new Date().toISOString()
      };

      rec.revision = {
        estado: 'RESUELTO',
        intentos: 1,
        fechaResolucion: new Date().toISOString(),
        origen: 'RECONCILIACION_OFICIAL'
      };

      updatedCount++;
      if (salioBloqueado) trophiesCount++;
      console.log(`✅ [${rec.sorteo}] ${rec.loteria}: ${normWinner} (${resolvedName}) ${salioBloqueado ? '🏆 ¡TROFEO!' : ''}`);
    }
  }

  // 4. Guardar en disco local
  fs.writeFileSync(historyMgr.DB_PATH, JSON.stringify(currentHistory, null, 2), 'utf8');
  historyMgr.rewriteCSV(currentHistory);

  // 5. Guardar en Supabase
  const savedCloud = await cloudStore.saveMasterHistory(currentHistory);

  console.log(`\n🎉 Reconciliación completada con éxito:`);
  console.log(`   - Sorteos recién verificados: ${updatedCount}`);
  console.log(`   - Trofeos / Golpes de banca evitados confirmados: ${trophiesCount}`);
  console.log(`   - Guardado en disco local: OK`);
  console.log(`   - Guardado en Supabase (Nube): ${savedCloud ? 'OK' : 'Error en Supabase'}`);
}

main().catch(console.error);
