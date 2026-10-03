const fs = require('fs');
const path = require('path');
const historyMgr = require('../history_manager');

async function main() {
  console.log('===============================================================');
  console.log('🏆 REGISTRANDO RESULTADOS REALES DEL SORTEO DE LAS 7:00 PM');
  console.log('===============================================================\n');

  const todayStr = '2026-10-02';

  // 1. Actualizar base de datos de Visual-FX con los resultados reales de hoy a las 7:00 PM
  const fxResultsPath = path.join('C:', 'Users', 'Hector', 'Fenix_2026_1', 'PROYECTO_VISUAL_FX', 'data', 'lottery_results.json');
  const fxHistoryPath = path.join('C:', 'Users', 'Hector', 'Fenix_2026_1', 'PROYECTO_VISUAL_FX', 'data', 'lottery_history.json');

  const realResults = {
    'la-granjita': { time: '07:00 PM', number: '19', name: 'Chivo' },
    'guacharo-activo': { time: '07:00 PM', number: '45', name: 'Garza' },
    'lotto-activo': { time: '07:00 PM', number: '28', name: 'Zamuro' }
  };

  if (fs.existsSync(fxResultsPath)) {
    try {
      const fxData = JSON.parse(fs.readFileSync(fxResultsPath, 'utf8'));
      if (!fxData[todayStr]) fxData[todayStr] = {};

      for (const [gameKey, info] of Object.entries(realResults)) {
        if (!fxData[todayStr][gameKey]) {
          fxData[todayStr][gameKey] = {
            gameId: gameKey,
            id: gameKey,
            name: gameKey.toUpperCase(),
            draws: []
          };
        }
        const draws = fxData[todayStr][gameKey].draws || [];
        const existingIdx = draws.findIndex(d => d.time === info.time);
        if (existingIdx !== -1) {
          draws[existingIdx].number = info.number;
          draws[existingIdx].name = info.name;
          draws[existingIdx].isPending = false;
        } else {
          draws.push({
            time: info.time,
            isPending: false,
            number: info.number,
            name: info.name
          });
        }
        fxData[todayStr][gameKey].draws = draws;
      }
      fs.writeFileSync(fxResultsPath, JSON.stringify(fxData, null, 2), 'utf8');
      console.log('✅ Archivo lottery_results.json de Visual-FX actualizado con resultados de hoy.');
    } catch (e) {
      console.warn('Aviso actualizando lottery_results.json:', e.message);
    }
  }

  if (fs.existsSync(fxHistoryPath)) {
    try {
      const histData = JSON.parse(fs.readFileSync(fxHistoryPath, 'utf8'));
      for (const [gameKey, info] of Object.entries(realResults)) {
        if (!histData[gameKey]) histData[gameKey] = {};
        if (!histData[gameKey][todayStr]) histData[gameKey][todayStr] = [];
        const dList = histData[gameKey][todayStr];
        const ex = dList.find(d => d.time === info.time);
        if (ex) {
          ex.number = info.number;
          ex.name = info.name;
        } else {
          dList.push({ time: info.time, number: info.number, name: info.name });
        }
      }
      fs.writeFileSync(fxHistoryPath, JSON.stringify(histData, null, 2), 'utf8');
      console.log('✅ Archivo lottery_history.json de Visual-FX actualizado con resultados de hoy.');
    } catch (e) {
      console.warn('Aviso actualizando lottery_history.json:', e.message);
    }
  }

  // 2. Verificar cada registro del sorteo de las 7:00 PM en history_manager
  const history = historyMgr.getHistory({ fecha: todayStr });
  console.log(`\nVerificando ${history.length} registros del día...`);

  const resultsTable = [];

  for (const rec of history) {
    const is7pm = (rec.sorteo === '07:00 PM' || rec.horaSorteo === '07:00 PM' || rec.sorteo === '19:00' || rec.horaSorteo === '19:00');
    if (!is7pm) continue;

    let winnerInfo = null;
    const lotName = (rec.loteria || '').toUpperCase();
    if (lotName.includes('GRANJITA')) {
      winnerInfo = realResults['la-granjita'];
    } else if (lotName.includes('GUACHARO')) {
      winnerInfo = realResults['guacharo-activo'];
    } else if (lotName.includes('LOTTO')) {
      winnerInfo = realResults['lotto-activo'];
    }

    if (winnerInfo) {
      console.log(`\nEvaluando ${rec.loteria} (${rec.sorteo}) [ID: ${rec.id}]...`);
      console.log(` -> Números bloqueados en este registro: [${(rec.rojos || []).join(', ')}]`);
      console.log(` -> Número ganador oficial: ${winnerInfo.number} (${winnerInfo.name})`);

      const res = historyMgr.verifyRecordWinner(rec.id, winnerInfo.number, winnerInfo.name);
      console.log(` -> Resultado: ${res.bloqueoAcertado ? '🏆 ¡TROFEO CONFIRMADO!' : 'No bloqueado'} | Origen: ${res.origenAcierto}`);
      console.log(` -> Mensaje: ${res.record.ganador.mensaje}`);

      resultsTable.push({
        Lotería: rec.loteria,
        Sorteo: rec.sorteo,
        'Ganador Oficial': `${winnerInfo.number} ${winnerInfo.name}`,
        'Bloqueados': (rec.rojos || []).join(', '),
        '¿Trofeo Obtenido?': res.bloqueoAcertado ? '🏆 SÍ (¡TROFEO!)' : 'NO',
        'Origen del Acierto': res.origenAcierto
      });
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 RESUMEN DE TROFEOS CONFIRMADOS PARA EL SORTEO DE LAS 7:00 PM');
  console.log('===============================================================');
  console.table(resultsTable);

  const stats = historyMgr.getTrophyStats();
  console.log(`\n📊 ESTADÍSTICAS TOTALES DE TROFEOS:`);
  console.log(` -> Trofeos Históricos Ganados: ${stats.trofeosGanados}`);
  console.log(` -> Tasa de Éxito de Bloqueo: ${stats.tasaExito}%`);
  console.log(` -> Riesgo de Banca Evitado: ${stats.riesgoEvitadoBs.toLocaleString('es-VE')} Bs`);

  return { resultsTable, stats };
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
