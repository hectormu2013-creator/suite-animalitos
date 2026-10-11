const fs = require('fs');
const path = require('path');
const scraper = require('../scraper_service');
const cloudStore = require('../cloud_store');
const historyMgr = require('../history_manager');

async function main() {
  console.log('🔄 [RECALCULAR RESULTADOS] Obteniendo historial maestro desde Supabase...');
  const cloudRes = await cloudStore.getMasterHistory();
  if (!cloudRes || !Array.isArray(cloudRes.records)) {
    console.error('❌ No se pudo cargar el historial desde Supabase');
    return;
  }

  const records = cloudRes.records;
  console.log(`📊 Total registros: ${records.length}`);

  const todayStr = '2026-10-11';
  let correctedCount = 0;
  let trophiesCount = 0;

  for (const rec of records) {
    if (rec.fecha !== todayStr) continue;

    const drawTime = rec.sorteo || rec.horaSorteo;
    console.log(`\n🔍 Consultando 1000Resultados para ${rec.loteria} (${drawTime})...`);

    const lookup = await scraper.lookupDrawResult(rec.loteria, drawTime, todayStr);

    if (lookup && lookup.found && lookup.number) {
      console.log(`  ✅ Oficial 1000Resultados: N° ${lookup.number} - ${lookup.name}`);
      
      // Re-verificar ganador usando la lógica oficial de modelos y trofeos
      const normWinner = String(lookup.number).padStart(2, '0');
      const resolvedName = lookup.name || historyMgr.getAnimalName(normWinner);

      // Normalizar listas de bloqueados
      const premierList = (rec.rojosPremier || []).map(n => String(n).padStart(2, '0'));
      const fijoList = (rec.numFijos || (rec.fijosSeleccionados || []).map(f => String(typeof f === 'object' ? f.numero : f).padStart(2, '0')));
      const predictivoList = (rec.numPredictivos || (rec.predictivosVisualFx || []).map(p => String(p.numero).padStart(2, '0')));
      const aleatorioList = (rec.numAleatorios || (rec.aleatoriosSistema || []).map(a => String(a.numero).padStart(2, '0')));
      const memoriaList = (rec.numMemoriaCupoCero || (rec.memoriaCupoCero || []).map(m => String(typeof m === 'object' ? m.numero : m).padStart(2, '0')));
      const allBlocked = (rec.rojos || []).map(n => String(n).padStart(2, '0'));

      const winnerInt = parseInt(normWinner, 10);
      const esPremier = premierList.some(n => n === normWinner || parseInt(n, 10) === winnerInt);
      const esFijo = fijoList.some(n => n === normWinner || parseInt(n, 10) === winnerInt);
      const esPredictivo = predictivoList.some(n => n === normWinner || parseInt(n, 10) === winnerInt);
      const esAleatorio = aleatorioList.some(n => n === normWinner || parseInt(n, 10) === winnerInt);
      const esMemoria = memoriaList.some(n => n === normWinner || parseInt(n, 10) === winnerInt);
      const salioBloqueado = esPremier || esFijo || esPredictivo || esAleatorio || esMemoria || allBlocked.some(n => n === normWinner || parseInt(n, 10) === winnerInt);

      let origenAcierto = 'NO_BLOQUEADO';
      let mensaje = `El número ${normWinner} (${resolvedName}) salió premiado, pero no estaba en la lista de bloqueos.`;

      const metodosAcierto = [];
      if (esPremier) metodosAcierto.push({ id: 'PREMIER', nombre: 'Premier Pluss (Cupo 0)', tag: '🔴 Premier Cupo 0', icono: '🔴' });
      if (esFijo) metodosAcierto.push({ id: 'FIJO', nombre: 'Número Fijo Permanente', tag: '📌 Número Fijo', icono: '📌' });
      if (esPredictivo) metodosAcierto.push({ id: 'PREDICTIVO', nombre: 'Modelo Predictivo Visual-FX', tag: '🔮 Visual-FX Atrasados', icono: '🔮' });
      if (esAleatorio) metodosAcierto.push({ id: 'ALEATORIO', nombre: 'Sistema Autónomo (Cobertura Aleatoria)', tag: '🎲 Cobertura Aleatoria', icono: '🎲' });
      if (esMemoria) metodosAcierto.push({ id: 'MEMORIA_CUPO_0', nombre: 'Memoria Cupo Cero Premier', tag: '🧠 Memoria Cupo 0', icono: '🧠' });
      if (metodosAcierto.length === 0 && salioBloqueado) {
        metodosAcierto.push({ id: 'GENERAL', nombre: 'Lista de Bloqueo', tag: '🛡️ Bloqueo Blindado', icono: '🛡️' });
      }

      const origenTexto = metodosAcierto.map(m => m.tag).join(' • ') || 'No bloqueado';

      if (metodosAcierto.length > 1) {
        origenAcierto = 'AMBOS';
        mensaje = `🏆 ¡GOLPE DE BANCA EVITADO! El número ganador fue ${normWinner} (${resolvedName}) y coincidió en MÚLTIPLES modelos de bloqueo: ${origenTexto}.`;
      } else if (esPremier) {
        origenAcierto = 'PREMIER';
        mensaje = `🏆 ¡GOLPE DE BANCA EVITADO! El número ganador fue ${normWinner} (${resolvedName}) y estaba BLOQUEADO por Premier Pluss (Cupo 0).`;
      } else if (esFijo) {
        origenAcierto = 'FIJO';
        mensaje = `🏆 ¡GOLPE DE BANCA EVITADO! El número ganador fue ${normWinner} (${resolvedName}) y estaba BLOQUEADO por Número Fijo Permanente.`;
      } else if (esPredictivo) {
        origenAcierto = 'PREDICTIVO';
        mensaje = `🏆 ¡GOLPE DE BANCA EVITADO! El número ganador fue ${normWinner} (${resolvedName}) y estaba BLOQUEADO por el Modelo Predictivo Visual-FX (Atrasado).`;
      } else if (esAleatorio) {
        origenAcierto = 'ALEATORIO';
        mensaje = `🏆 ¡GOLPE DE BANCA EVITADO! El número ganador fue ${normWinner} (${resolvedName}) y estaba BLOQUEADO por la Cobertura Aleatoria del Sistema Autónomo.`;
      } else if (esMemoria) {
        origenAcierto = 'MEMORIA_CUPO_0';
        mensaje = `🏆 ¡GOLPE DE BANCA EVITADO! El número ganador fue ${normWinner} (${resolvedName}) y estaba BLOQUEADO por la Memoria de Cupo Cero Premier (Arrastre Preventivo).`;
      } else if (salioBloqueado) {
        origenAcierto = 'GENERAL';
        mensaje = `🏆 ¡GOLPE DE BANCA EVITADO! El número ganador fue ${normWinner} (${resolvedName}) y estaba BLOQUEADO (${origenTexto}).`;
      }

      rec.ganador = {
        verificado: true,
        numero: normWinner,
        nombre: resolvedName,
        bloqueoAcertado: salioBloqueado,
        origenAcierto,
        origenTexto,
        metodosAcierto,
        mensaje,
        fechaVerificacion: new Date().toISOString()
      };

      rec.revision = {
        estado: 'RESUELTO',
        intentos: 1,
        fechaResolucion: new Date().toISOString()
      };

      correctedCount++;
      if (salioBloqueado) trophiesCount++;
      console.log(`  🏆 Estado trofeo: ${salioBloqueado ? '¡GOLPE EVITADO! ' + origenTexto : 'No bloqueado'}`);
    } else {
      console.log(`  ⏳ En espera de publicación oficial en 1000Resultados.`);
      // Limpiar datos erróneos previos si los tenía
      rec.ganador = {
        verificado: false,
        numero: null,
        nombre: null,
        bloqueoAcertado: false
      };
      rec.revision = {
        estado: 'AGOTADO_2_INTENTOS',
        intentos: 2,
        ultimoIntento: new Date().toISOString()
      };
    }
  }

  // Guardar en history_db.json local
  fs.writeFileSync(historyMgr.DB_PATH, JSON.stringify(records, null, 2), 'utf8');
  historyMgr.rewriteCSV(records);
  console.log(`\n💾 Guardado en disco local history_db.json y reportes_agotados.csv`);

  // Guardar en Supabase
  console.log('☁️ Sincronizando con Supabase (suite_history)...');
  const cloudOk = await cloudStore.saveMasterHistory(records);
  console.log(`✅ Supabase actualizado: ${cloudOk}`);

  // Actualizar también lottery_results.json de Visual-FX
  const fxPath = 'C:\\Users\\Hector\\Fenix_2026_1\\PROYECTO_VISUAL_FX\\data\\lottery_results.json';
  if (fs.existsSync(fxPath)) {
    try {
      const fxData = JSON.parse(fs.readFileSync(fxPath, 'utf8') || '{}');
      if (!fxData[todayStr]) fxData[todayStr] = {};

      const slugs = ['guacharo-activo', 'la-granjita', 'lotto-activo', 'guacharito-millonario'];
      for (const sl of slugs) {
        const d = await scraper.scrape1000Resultados(sl);
        if (d && d.length > 0) {
          fxData[todayStr][sl] = {
            gameId: sl,
            id: sl,
            name: sl.toUpperCase().replace(/-/g, ' '),
            draws: d
          };
        }
      }
      fs.writeFileSync(fxPath, JSON.stringify(fxData, null, 2), 'utf8');
      console.log('✅ Archivo local Visual-FX lottery_results.json actualizado');
    } catch (eFx) {}
  }

  console.log(`\n🎉 PROCESO COMPLETADO: ${correctedCount} sorteos verificados con 1000Resultados Oficial (${trophiesCount} trofeos).`);
}

main().catch(console.error);
