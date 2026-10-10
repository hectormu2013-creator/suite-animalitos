const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'history_db.json');
const CSV_PATH = path.join(__dirname, 'reportes_agotados.csv');
const VISUAL_FX_DIR = path.join('C:', 'Users', 'Hector', 'Fenix_2026_1', 'PROYECTO_VISUAL_FX', 'data');
const VISUAL_FX_RESULTS_PATH = path.join(VISUAL_FX_DIR, 'lottery_results.json');
const VISUAL_FX_HISTORY_PATH = path.join(VISUAL_FX_DIR, 'lottery_history.json');

// Diccionario de animales para nombres legibles
let animalDict = {};
try {
  const dictRaw = fs.readFileSync(path.join(__dirname, 'scripts', 'animal_dictionary.json'), 'utf8');
  animalDict = JSON.parse(dictRaw);
} catch (e) {}

/**
 * Obtener nombre del animal por número
 */
function getAnimalName(num) {
  const norm = String(num).padStart(2, '0');
  const rawNum = String(parseInt(num, 10));
  return animalDict[norm] || animalDict[rawNum] || animalDict[num] || `Animal ${norm}`;
}

/**
 * Normalizar ID de lotería para búsqueda en Visual-FX
 */
function mapLoteriaToVisualFx(loteriaStr) {
  const clean = (loteriaStr || '').toLowerCase().trim();
  if (clean.includes('millonario') || clean.includes('guacharito')) return 'guacharito-millonario';
  if (clean.includes('guacharo')) return 'guacharo-activo';
  if (clean.includes('granjita')) return 'la-granjita';
  if (clean.includes('lotto')) return 'lotto-activo';
  return clean;
}

/**
 * Convertir cadena de tiempo (ej: "04:00 PM", "16:00", "09:00 AM") a minutos del día
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Inicializar archivo CSV si no existe
 */
function initCSV() {
  if (!fs.existsSync(CSV_PATH)) {
    const headers = [
      'ID',
      'Fecha',
      'Hora Chequeo',
      'Loteria',
      'Sorteo',
      'Monto Sondeo (Bs)',
      'Total Bloqueados',
      'Agotados Premier (Cupo 0)',
      'Fijos Permanentes (Configurados)',
      'Predictivos Visual-FX (Atrasados)',
      'Aleatorios Sistema (Cobertura)',
      'Todos los Numeros Bloqueados',
      'Numero Ganador Sorteo',
      'Animal Ganador',
      'Golpe Evitado (Trofeo)',
      'Origen Trofeo',
      'Estado Triple 7'
    ].join(';') + '\n';
    fs.writeFileSync(CSV_PATH, '\uFEFF' + headers, 'utf8'); // BOM UTF-8 para Excel en español
  }
}

/**
 * Obtener todos los registros históricos
 */
function getHistory(filters = {}) {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    let records = JSON.parse(raw);

    if (filters.loteria) {
      records = records.filter(r => r.loteria.toLowerCase().includes(filters.loteria.toLowerCase()));
    }
    if (filters.fecha) {
      records = records.filter(r => r.fecha === filters.fecha);
    }
    if (filters.soloTrofeos) {
      records = records.filter(r => r.ganador && r.ganador.bloqueoAcertado === true);
    }

    return records;
  } catch (err) {
    console.error(`[HISTORY ERROR] ${err.message}`);
    return [];
  }
}

/**
 * Registrar un nuevo evento de sondeo con las 3 categorías de bloqueo:
 * 1. Premier Pluss (Cupo Cero)
 * 2. Visual-FX Predictivo (Atrasados)
 * 3. Sistema Autónomo (Aleatorios / Cobertura de Riesgo del Sistema)
 */
function recordScan(scanData) {
  try {
    initCSV();

    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora = now.toLocaleTimeString('es-VE', { hour12: false });
    const id = `${fecha}_${Date.now()}`;

    // 1. Números y detalle de Premier Pluss (Cupo Cero / Agotados) - Estricto: solo si viene de sondeo real
    const rojosPremier = (Array.isArray(scanData.rojosPremier) ? scanData.rojosPremier : []).map(n => String(n).padStart(2, '0'));
    const detallePremier = rojosPremier.map(n => ({
      numero: n,
      nombre: getAnimalName(n),
      origen: 'PREMIER',
      origenTexto: 'Premier Pluss (Cupo 0 / Agotado)'
    }));

    // 2. Números Fijos Permanentes (Máx 3, Mín 0)
    const rawFijos = scanData.fijosSeleccionados || scanData.numFijos || [];
    const detalleFijos = rawFijos.slice(0, 3).map(f => {
      const numStr = String(typeof f === 'object' ? f.numero : f).padStart(2, '0');
      return {
        numero: numStr,
        nombre: (typeof f === 'object' && f.nombre) || getAnimalName(numStr),
        origen: 'FIJO',
        origenTexto: 'Número Fijo (Siempre Bloqueado)',
        detalle: 'Configuración fija del usuario (máx 3)'
      };
    });
    const numFijos = detalleFijos.map(f => f.numero);

    // 3. Números y detalle de Visual-FX (Predictivo Atrasados)
    const rawPredictivos = scanData.predictivosVisualFx || scanData.predictivosSeleccionados || [];
    const detallePredictivos = rawPredictivos.map(p => {
      const numStr = String(p.numero).padStart(2, '0');
      return {
        numero: numStr,
        nombre: p.nombre || getAnimalName(numStr),
        sorteosAtraso: p.sorteosAtraso || 0,
        diasAtraso: p.diasAtraso || 0,
        origen: 'PREDICTIVO',
        origenTexto: `Visual-FX (Atrasado: ${p.sorteosAtraso || 0} sorteos)`
      };
    });
    const numPredictivos = detallePredictivos.map(p => p.numero);

    // 4. Números y detalle del Sistema Autónomo (Cobertura Aleatoria, máx 3)
    const rawAleatorios = scanData.aleatoriosSistema || scanData.aleatoriosSeleccionados || [];
    const detalleAleatorios = rawAleatorios.slice(0, 3).map(a => {
      const numStr = String(typeof a === 'object' ? a.numero : a).padStart(2, '0');
      return {
        numero: numStr,
        nombre: (typeof a === 'object' && a.nombre) || getAnimalName(numStr),
        origen: 'ALEATORIO',
        origenTexto: 'Sistema Autónomo (Cobertura Aleatoria)',
        detalle: 'Selección algorítmica del sistema'
      };
    });
    const numAleatorios = detalleAleatorios.map(a => a.numero);

    // 5. Números heredados por Memoria de Cupo Cero Premier (Arrastre Preventivo)
    const rawMemoria = scanData.numMemoriaCupoCero || scanData.memoriaCupoCero || [];
    const detalleMemoria = rawMemoria.map(m => {
      const numStr = String(typeof m === 'object' ? m.numero : m).padStart(2, '0');
      const sortRest = typeof m === 'object' && m.sorteosRestantes !== undefined ? m.sorteosRestantes : null;
      return {
        numero: numStr,
        nombre: (typeof m === 'object' && m.nombre) || getAnimalName(numStr),
        sorteosRestantes: sortRest,
        origen: 'MEMORIA_CUPO_0',
        origenTexto: sortRest !== null ? `Memoria Cupo 0 (${sortRest} rest.)` : 'Memoria Cupo Cero Premier',
        detalle: 'Arrastre preventivo de agotado'
      };
    });
    const numMemoriaCupoCero = detalleMemoria.map(m => m.numero);

    // 6. Lista final consolidada de números bloqueados con origen (5 Vías de Riesgo)
    const todosNumeros = Array.from(new Set([...rojosPremier, ...numFijos, ...numPredictivos, ...numAleatorios, ...numMemoriaCupoCero]));
    const bloqueosConsolidados = todosNumeros.map(num => {
      const esPremier = rojosPremier.includes(num);
      const esFijo = numFijos.includes(num);
      const predObj = detallePredictivos.find(p => p.numero === num);
      const esPredictivo = !!predObj;
      const esAleatorio = numAleatorios.includes(num);
      const esMemoria = numMemoriaCupoCero.includes(num);

      let origen = 'PREMIER';
      let origenTexto = 'Premier Pluss (Cupo 0)';
      let detalle = 'Agotado en taquilla';

      const origenesCount = (esPremier ? 1 : 0) + (esFijo ? 1 : 0) + (esPredictivo ? 1 : 0) + (esAleatorio ? 1 : 0) + (esMemoria ? 1 : 0);

      if (origenesCount > 1) {
        origen = 'AMBOS';
        origenTexto = 'Múltiple Coincidencia';
        detalle = 'Coincidencia entre varios modelos de bloqueo';
      } else if (esPremier) {
        origen = 'PREMIER';
        origenTexto = 'Premier Pluss (Cupo 0)';
        detalle = 'Agotado en taquilla';
      } else if (esFijo) {
        origen = 'FIJO';
        origenTexto = 'Número Fijo (Siempre Bloqueado)';
        detalle = 'Configuración fija del usuario (máx 3)';
      } else if (esPredictivo) {
        origen = 'PREDICTIVO';
        origenTexto = 'Modelo Predictivo Visual-FX';
        detalle = `${predObj.sorteosAtraso} sorteos sin salir`;
      } else if (esAleatorio) {
        origen = 'ALEATORIO';
        origenTexto = 'Sistema Autónomo (Cobertura Aleatoria)';
        detalle = 'Selección de riesgo del sistema (máx 3)';
      } else if (esMemoria) {
        origen = 'MEMORIA_CUPO_0';
        origenTexto = 'Memoria Cupo Cero Premier';
        detalle = 'Arrastre preventivo de agotado previo';
      }

      return {
        numero: num,
        nombre: getAnimalName(num),
        origen,
        origenTexto,
        detalle
      };
    });

    const newRecord = {
      id,
      timestamp: now.toISOString(),
      fecha,
      hora,
      horaSorteo: scanData.sorteo || 'Próximo Sorteo',
      loteria: scanData.loteria || 'DESCONOCIDA',
      sorteo: scanData.sorteo || 'Próximo Sorteo',
      montoSondeo: scanData.montoSondeo || 3000,
      totalAnimales: scanData.totalAnimalesAnalizados || 38,
      
      // Categorías de Bloqueo (Solo Cupo 0 + Fijos + Predictivos + Aleatorios)
      rojos: todosNumeros,
      rojosPremier,
      detallePremier,
      numFijos,
      fijosSeleccionados: detalleFijos,
      numPredictivos,
      predictivosVisualFx: detallePredictivos,
      numAleatorios,
      aleatoriosSistema: detalleAleatorios,
      numMemoriaCupoCero,
      memoriaCupoCero: detalleMemoria,
      bloqueosConsolidados,
      totalBloqueados: todosNumeros.length,

      // Estado Triple 7
      t7Status: scanData.t7Status || 'Pendiente',
      t7Blocked: !!scanData.t7Blocked,
      captureFile: 'premier_tabla_sondeo.png',

      // Auditoría y Trofeo
      ganador: null
    };

    // 1. Guardar en JSON DB (Actualizar si ya existe para este sorteo hoy, o Insertar)
    let history = [];
    if (fs.existsSync(DB_PATH)) {
      try {
        history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      } catch (e) {
        history = [];
      }
    }

    const normLot = (scanData.loteria || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normDraw = (scanData.sorteo || '').trim().toUpperCase();

    const existingIndex = history.findIndex(r => 
      r.fecha === fecha && 
      (r.loteria || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normLot &&
      ((r.sorteo || '').trim().toUpperCase() === normDraw || (r.horaSorteo || '').trim().toUpperCase() === normDraw)
    );

    if (existingIndex !== -1) {
      const rec = history[existingIndex];
      // Fusionar orígenes y números
      const mergedPremier = Array.from(new Set([...(rec.rojosPremier || []), ...rojosPremier]));
      const mergedPremierDetalle = [...(rec.detallePremier || [])];
      for (const d of detallePremier) {
        if (!mergedPremierDetalle.some(x => x.numero === d.numero)) mergedPremierDetalle.push(d);
      }

      const mergedFijos = Array.from(new Set([...(rec.numFijos || []), ...numFijos]));
      const mergedFijosDetalle = [...(rec.fijosSeleccionados || [])];
      for (const d of detalleFijos) {
        if (!mergedFijosDetalle.some(x => x.numero === d.numero)) mergedFijosDetalle.push(d);
      }

      // Predictivos Atrasados: Reutilizar existentes si ya habían para este sorteo, o adoptar los nuevos
      let finalPredDetalle = (rec.predictivosVisualFx && rec.predictivosVisualFx.length > 0)
        ? rec.predictivosVisualFx
        : detallePredictivos;
      const maxPredConfig = (scanData.cantidadPredictivosConfigurada !== undefined)
        ? scanData.cantidadPredictivosConfigurada
        : finalPredDetalle.length;
      finalPredDetalle = finalPredDetalle.slice(0, Math.max(0, maxPredConfig));
      const mergedPred = finalPredDetalle.map(p => p.numero);
      const mergedPredDetalle = finalPredDetalle;

      // Cobertura Aleatoria: Reutilizar existentes si ya habían para este sorteo, o adoptar los nuevos
      // NUNCA acumular números de ejecuciones distintas ni superar la cantidad configurada
      let finalAleatDetalle = (rec.aleatoriosSistema && rec.aleatoriosSistema.length > 0)
        ? rec.aleatoriosSistema
        : detalleAleatorios;
      const maxAleatConfig = (scanData.cantidadAleatoriosConfigurada !== undefined)
        ? scanData.cantidadAleatoriosConfigurada
        : finalAleatDetalle.length;
      finalAleatDetalle = finalAleatDetalle.slice(0, Math.min(Math.max(0, maxAleatConfig), 3));
      const mergedAleat = finalAleatDetalle.map(a => a.numero);
      const mergedAleatDetalle = finalAleatDetalle;

      const allMergedNumbers = Array.from(new Set([...mergedPremier, ...mergedFijos, ...mergedPred, ...mergedAleat]));
      
      const newConsolidados = allMergedNumbers.map(num => {
        const esPremier = mergedPremier.includes(num);
        const esFijo = mergedFijos.includes(num);
        const predObj = mergedPredDetalle.find(p => p.numero === num);
        const esPredictivo = !!predObj;
        const esAleatorio = mergedAleat.includes(num);

        let origen = 'PREMIER';
        let origenTexto = 'Premier Pluss (Cupo 0)';
        let detalle = 'Agotado en taquilla';

        const origenesCount = (esPremier ? 1 : 0) + (esFijo ? 1 : 0) + (esPredictivo ? 1 : 0) + (esAleatorio ? 1 : 0);

        if (origenesCount > 1) {
          origen = 'AMBOS';
          origenTexto = 'Múltiple Coincidencia';
          detalle = 'Coincidencia entre varios modelos de bloqueo';
        } else if (esFijo) {
          origen = 'FIJO';
          origenTexto = 'Número Fijo (Siempre Bloqueado)';
          detalle = 'Configuración fija del usuario (máx 3)';
        } else if (esPredictivo) {
          origen = 'PREDICTIVO';
          origenTexto = 'Modelo Predictivo Visual-FX';
          detalle = `${predObj.sorteosAtraso || 0} sorteos sin salir`;
        } else if (esAleatorio) {
          origen = 'ALEATORIO';
          origenTexto = 'Sistema Autónomo (Cobertura Aleatoria)';
          detalle = 'Selección de riesgo del sistema (máx 3)';
        }

        return {
          numero: num,
          nombre: getAnimalName(num),
          origen,
          origenTexto,
          detalle
        };
      });

      rec.rojos = allMergedNumbers;
      rec.rojosPremier = mergedPremier;
      rec.detallePremier = mergedPremierDetalle;
      rec.numFijos = mergedFijos;
      rec.fijosSeleccionados = mergedFijosDetalle;
      rec.numPredictivos = mergedPred;
      rec.predictivosVisualFx = mergedPredDetalle;
      rec.numAleatorios = mergedAleat;
      rec.aleatoriosSistema = mergedAleatDetalle;
      rec.bloqueosConsolidados = newConsolidados;
      rec.totalBloqueados = allMergedNumbers.length;
      rec.timestamp = now.toISOString();
      rec.hora = hora;
      if (scanData.t7Status) rec.t7Status = scanData.t7Status;
      if (scanData.t7Blocked !== undefined) rec.t7Blocked = rec.t7Blocked || scanData.t7Blocked;

      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
      rewriteCSV(history);
      return rec;
    } else {
      history.push(newRecord);
      if (history.length > 1000) history.shift();
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
      appendRecordToCSV(newRecord);
      return newRecord;
    }
  } catch (err) {
    console.error(`[HISTORY ERROR] Error guardando registro: ${err.message}`);
    return null;
  }
}

/**
 * Anexar fila al archivo CSV
 */
function appendRecordToCSV(rec) {
  try {
    initCSV();
    const premioInfo = rec.ganador ? (rec.ganador.bloqueoAcertado ? 'SI (¡TROFEO!)' : 'NO') : 'PENDIENTE';
    const csvRow = [
      rec.id,
      rec.fecha,
      rec.hora,
      `"${rec.loteria}"`,
      `"${rec.sorteo}"`,
      rec.montoSondeo,
      rec.totalBloqueados || (rec.rojos ? rec.rojos.length : 0),
      `"${(rec.rojosPremier || []).join(', ')}"`,
      `"${(rec.numFijos || []).join(', ')}"`,
      `"${(rec.numPredictivos || []).join(', ')}"`,
      `"${(rec.numAleatorios || []).join(', ')}"`,
      `"${(rec.rojos || []).join(', ')}"`,
      rec.ganador ? `"${rec.ganador.numero}"` : 'Pendiente',
      rec.ganador ? `"${rec.ganador.nombre}"` : 'Pendiente',
      premioInfo,
      rec.ganador ? `"${rec.ganador.origenAcierto || 'N/A'}"` : 'N/A',
      `"${rec.t7Status}"`
    ].join(';') + '\n';
    fs.appendFileSync(CSV_PATH, csvRow, 'utf8');
  } catch (e) {}
}

/**
 * Re-escribir CSV completo (usado al actualizar ganadores / trofeos)
 */
function rewriteCSV(records) {
  try {
    if (fs.existsSync(CSV_PATH)) fs.unlinkSync(CSV_PATH);
    initCSV();
    records.forEach(r => appendRecordToCSV(r));
  } catch (e) {}
}

/**
 * Verificar el número ganador de un sorteo y determinar si salvamos la banca (¡TROFEO!)
 */
function verifyRecordWinner(recordId, winnerNumber, winnerName = null) {
  try {
    if (!fs.existsSync(DB_PATH)) return { ok: false, message: 'Base de datos no encontrada' };
    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const rec = history.find(r => r.id === recordId);
    if (!rec) return { ok: false, message: 'Registro no encontrado' };

    const normWinner = String(winnerNumber).padStart(2, '0');
    const winnerInt = parseInt(winnerNumber, 10);
    const resolvedName = winnerName || getAnimalName(normWinner);

    // Normalizar listas de bloqueados
    const premierList = (rec.rojosPremier || []).map(n => String(n).padStart(2, '0'));
    const fijoList = (rec.numFijos || (rec.fijosSeleccionados || []).map(f => String(typeof f === 'object' ? f.numero : f).padStart(2, '0')));
    const predictivoList = (rec.numPredictivos || (rec.predictivosVisualFx || []).map(p => String(p.numero).padStart(2, '0')));
    const aleatorioList = (rec.numAleatorios || (rec.aleatoriosSistema || []).map(a => String(a.numero).padStart(2, '0')));
    const memoriaList = (rec.numMemoriaCupoCero || (rec.memoriaCupoCero || []).map(m => String(typeof m === 'object' ? m.numero : m).padStart(2, '0')));
    const allBlocked = (rec.rojos || []).map(n => String(n).padStart(2, '0'));

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

    const aciertosCount = metodosAcierto.length;

    if (aciertosCount > 1) {
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

    // Auto-liberar de la memoria de cupo cero si este número estaba en persistencia
    try {
      const cupoMem = require('./cupo_cero_memory');
      const gameKey = mapLoteriaToVisualFx(rec.loteria);
      cupoMem.verificarYAutoLiberarPorGanador(gameKey, normWinner, resolvedName, rec.sorteo || rec.horaSorteo, rec.fecha);
    } catch (e) {}

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

    fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
    rewriteCSV(history);

    return {
      ok: true,
      bloqueoAcertado: salioBloqueado,
      origenAcierto,
      record: rec,
      mensaje
    };
  } catch (err) {
    console.error(`[HISTORY VERIFY ERROR] ${err.message}`);
    return { ok: false, message: err.message };
  }
}

/**
 * Sincronizar automáticamente resultados con Visual-FX y scrapers oficiales en vivo
 * (TOTALMENTE AUTÓNOMO: Funciona en Localhost y en Render con scrapers nativos)
 */
async function syncResultsWithVisualFx() {
  try {
    if (!fs.existsSync(DB_PATH)) return { ok: false, message: 'Sin registros históricos', updatedCount: 0, trophiesCount: 0 };
    
    // Cargar bases de datos de Visual-FX si existen en disco
    let fxResults = null;
    let fxHistory = null;

    if (fs.existsSync(VISUAL_FX_RESULTS_PATH)) {
      try { fxResults = JSON.parse(fs.readFileSync(VISUAL_FX_RESULTS_PATH, 'utf8')); } catch (e) {}
    }
    if (fs.existsSync(VISUAL_FX_HISTORY_PATH)) {
      try { fxHistory = JSON.parse(fs.readFileSync(VISUAL_FX_HISTORY_PATH, 'utf8')); } catch (e) {}
    }

    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let updatedCount = 0;
    let trophiesCount = 0;

    const scraper = require('./scraper_service');

    for (const rec of history) {
      // Si ya está verificado, saltar
      if (rec.ganador && rec.ganador.verificado) continue;

      const recDate = rec.fecha; // ej: 2026-10-06
      const gameKey = mapLoteriaToVisualFx(rec.loteria);
      const recTimeMinutes = parseTimeToMinutes(rec.sorteo || rec.horaSorteo);

      let candidateDraws = [];

      // 1. Buscar en lottery_results.json local
      if (fxResults) {
        const dayData = fxResults[recDate];
        if (dayData && dayData[gameKey] && Array.isArray(dayData[gameKey].draws)) {
          candidateDraws = candidateDraws.concat(dayData[gameKey].draws);
        }
      }

      // 2. Si no hay suficientes, buscar en lottery_history.json
      if (candidateDraws.length === 0 && fxHistory && fxHistory[gameKey]) {
        const historyDay = fxHistory[gameKey][recDate];
        if (Array.isArray(historyDay)) {
          candidateDraws = candidateDraws.concat(historyDay);
        }
      }

      let matchedDraw = null;

      if (candidateDraws.length > 0) {
        if (recTimeMinutes !== null) {
          matchedDraw = candidateDraws.find(d => {
            if (d.isPending || !d.number) return false;
            const drawMinutes = parseTimeToMinutes(d.time);
            if (drawMinutes === null) return false;
            return Math.abs(drawMinutes - recTimeMinutes) <= 25;
          });
        } else {
          const completedDraws = candidateDraws.filter(d => !d.isPending && d.number);
          if (completedDraws.length > 0) matchedDraw = completedDraws[completedDraws.length - 1];
        }
      }

      // 3. Si no se encontró en disco local, usar scraper_service en vivo (TuAzar / 1000Resultados)
      if (!matchedDraw || !matchedDraw.number) {
        try {
          const liveLookup = await scraper.lookupDrawResult(rec.loteria, rec.sorteo || rec.horaSorteo, rec.fecha);
          if (liveLookup && liveLookup.found && liveLookup.number) {
            matchedDraw = { number: liveLookup.number, name: liveLookup.name };
          }
        } catch (eScrap) {}
      }

      if (matchedDraw && matchedDraw.number) {
        const res = verifyRecordWinner(rec.id, matchedDraw.number, matchedDraw.name);
        if (res.ok) {
          updatedCount++;
          if (res.bloqueoAcertado) trophiesCount++;
        }
      }
    }

    if (updatedCount > 0) {
      try {
        const cloudStore = require('./cloud_store');
        cloudStore.saveMasterHistory(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
      } catch (eCloud) {}
    }

    return {
      ok: true,
      updatedCount,
      trophiesCount,
      message: `Extracción completada: ${updatedCount} sorteos verificados, ${trophiesCount} trofeos confirmados.`
    };
  } catch (err) {
    console.error(`[SYNC ERROR] ${err.message}`);
    return { ok: false, message: err.message, updatedCount: 0, trophiesCount: 0 };
  }
}

/**
 * Buscar y actualizar de forma inmediata e individual un sorteo pendiente por su ID
 * Se ejecuta al hacer clic sobre el botón "Por verificar" en la tabla o en la tarjeta
 */
async function lookupAndUpdateRecord(recordId) {
  try {
    if (!fs.existsSync(DB_PATH)) return { ok: false, message: 'Base de datos no encontrada' };
    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const rec = history.find(r => r.id === recordId);
    if (!rec) return { ok: false, message: 'Registro no encontrado' };

    const scraper = require('./scraper_service');
    const drawTime = rec.sorteo || rec.horaSorteo;
    const lookup = await scraper.lookupDrawResult(rec.loteria, drawTime, rec.fecha);

    if (lookup.found && lookup.number) {
      const verifyRes = verifyRecordWinner(rec.id, lookup.number, lookup.name);
      
      try {
        const cloudStore = require('./cloud_store');
        const freshHistory = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        cloudStore.saveMasterHistory(freshHistory);
      } catch (eC) {}

      return {
        ok: true,
        found: true,
        winnerNumber: lookup.number,
        winnerName: lookup.name,
        bloqueoAcertado: verifyRes.bloqueoAcertado,
        mensaje: verifyRes.mensaje,
        record: verifyRes.record,
        source: lookup.source
      };
    } else {
      return {
        ok: true,
        found: false,
        pending: true,
        mensaje: lookup.message || `El sorteo de ${rec.loteria} (${drawTime}) aún está en espera de publicación oficial.`
      };
    }
  } catch (err) {
    return { ok: false, message: `Error en búsqueda: ${err.message}` };
  }
}

/**
 * Extraer resultado de un sorteo programado específico en Visual-FX
 * Sigue la regla:
 * - Intento 1: Exactamente a los 5 minutos tras el sorteo (+5 min)
 * - Intento 2: Exactamente a los 10 minutos tras el sorteo (+10 min, si el 1 no lo consiguió)
 * - Al segundo intento sin conseguirlo, PARA por completo para evitar consultas innecesarias.
 * @param {string} loteriaKeyOrId - Lotería
 * @param {string} sorteoHora - Hora del sorteo
 * @param {string} fechaStr - Fecha YYYY-MM-DD
 * @param {number} intentoNum - 1 o 2
 */
async function syncScheduledDrawResult(loteriaKeyOrId, sorteoHora, fechaStr, intentoNum = 1) {
  try {
    if (!fs.existsSync(DB_PATH)) return { ok: false, found: false, message: 'Sin registros históricos' };

    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const gameKey = mapLoteriaToVisualFx(loteriaKeyOrId);
    const targetMinutes = parseTimeToMinutes(sorteoHora);

    // Buscar registros en nuestra historia que correspondan a este sorteo y no estén verificados
    const matchingRecords = history.filter(rec => {
      const matchGame = mapLoteriaToVisualFx(rec.loteria) === gameKey;
      const recMins = parseTimeToMinutes(rec.sorteo || rec.horaSorteo);
      const matchTime = targetMinutes !== null && recMins !== null 
        ? Math.abs(recMins - targetMinutes) <= 25 
        : (rec.sorteo && rec.sorteo.includes(sorteoHora));
      const matchDate = !fechaStr || rec.fecha === fechaStr;
      const pendiente = !rec.ganador || !rec.ganador.verificado;
      return matchGame && matchTime && matchDate && pendiente;
    });

    // Si ya no hay registros pendientes para este sorteo, no realizar ninguna petición innecesaria
    if (matchingRecords.length === 0) {
      return { ok: true, found: false, yaVerificado: true, message: 'Todos los registros de este sorteo ya están verificados' };
    }

    let fxResults = null;
    let fxHistory = null;
    if (fs.existsSync(VISUAL_FX_RESULTS_PATH)) {
      try { fxResults = JSON.parse(fs.readFileSync(VISUAL_FX_RESULTS_PATH, 'utf8')); } catch (e) {}
    }
    if (fs.existsSync(VISUAL_FX_HISTORY_PATH)) {
      try { fxHistory = JSON.parse(fs.readFileSync(VISUAL_FX_HISTORY_PATH, 'utf8')); } catch (e) {}
    }

    // 1. Buscar en la base de datos de Visual-FX en disco (si existe localmente)
    let candidateDraws = [];
    if (fxResults) {
      const dayData = fxResults[fechaStr];
      if (dayData && dayData[gameKey] && Array.isArray(dayData[gameKey].draws)) {
        candidateDraws = candidateDraws.concat(dayData[gameKey].draws);
      }
    }

    if (candidateDraws.length === 0 && fxHistory && fxHistory[gameKey]) {
      const historyDay = fxHistory[gameKey][fechaStr];
      if (Array.isArray(historyDay)) {
        candidateDraws = candidateDraws.concat(historyDay);
      }
    }

    let matchedDraw = null;
    if (candidateDraws.length > 0 && targetMinutes !== null) {
      matchedDraw = candidateDraws.find(d => {
        if (d.isPending || !d.number) return false;
        const dMins = parseTimeToMinutes(d.time);
        return dMins !== null && Math.abs(dMins - targetMinutes) <= 25;
      });
    }

    // 2. Si no se encontró en disco local, realizar UNA ÚNICA consulta puntual al scraper
    if (!matchedDraw || !matchedDraw.number) {
      try {
        const scraper = require('./scraper_service');
        const liveLookup = await scraper.lookupDrawResult(loteriaKeyOrId, sorteoHora, fechaStr);
        if (liveLookup && liveLookup.found && liveLookup.number) {
          matchedDraw = { number: liveLookup.number, name: liveLookup.name };
        }
      } catch (eScrap) {}
    }

    if (matchedDraw && matchedDraw.number) {
      let trophiesWon = 0;
      matchingRecords.forEach(rec => {
        const res = verifyRecordWinner(rec.id, matchedDraw.number, matchedDraw.name);
        rec.revision = {
          estado: 'RESUELTO',
          intentos: intentoNum,
          fechaResolucion: new Date().toISOString()
        };
        if (res.ok && res.bloqueoAcertado) trophiesWon++;
      });

      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');

      return {
        ok: true,
        found: true,
        intentoNum,
        winnerNumber: matchedDraw.number,
        winnerName: matchedDraw.name,
        verifiedCount: matchingRecords.length,
        trophiesWon,
        message: `Resultado obtenido en Intento ${intentoNum}: ${matchedDraw.number} (${matchedDraw.name})`
      };
    } else {
      matchingRecords.forEach(rec => {
        rec.revision = {
          estado: intentoNum >= 2 ? 'AGOTADO_2_INTENTOS' : 'INTENTO_1_PENDIENTE',
          intentos: intentoNum,
          ultimoIntento: new Date().toISOString()
        };
      });
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');

      return {
        ok: true,
        found: false,
        intentoNum,
        detenerIntentos: intentoNum >= 2,
        message: intentoNum >= 2 
          ? `Resultado no publicado tras 2do intento (+10 min). Deteniendo revisiones automáticas.`
          : `Resultado no publicado en 1er intento (+5 min). Se reintentará al minuto +10.`
      };
    }
  } catch (err) {
    console.error(`[SYNC SCHEDULED DRAW ERROR] ${err.message}`);
    return { ok: false, found: false, message: err.message };
  }
}

/**
 * Obtener estadísticas globales de Trofeos (Golpes de Banca Evitados)
 */
function getTrophyStats() {
  try {
    const records = getHistory();
    const totalSondeos = records.length;
    const verificados = records.filter(r => r.ganador && r.ganador.verificado);
    const trofeos = records.filter(r => r.ganador && r.ganador.bloqueoAcertado === true);

    const trofeosPremier = trofeos.filter(r => r.ganador.origenAcierto === 'PREMIER' || r.ganador.origenAcierto === 'AMBOS').length;
    const trofeosFijo = trofeos.filter(r => r.ganador.origenAcierto === 'FIJO' || r.ganador.origenAcierto === 'AMBOS').length;
    const trofeosPredictivo = trofeos.filter(r => r.ganador.origenAcierto === 'PREDICTIVO' || r.ganador.origenAcierto === 'AMBOS').length;
    const trofeosAleatorio = trofeos.filter(r => r.ganador.origenAcierto === 'ALEATORIO' || r.ganador.origenAcierto === 'AMBOS').length;
    const trofeosAmbos = trofeos.filter(r => r.ganador.origenAcierto === 'AMBOS').length;

    const totalTrofeos = trofeos.length;
    const tasaEficacia = verificados.length > 0 ? ((totalTrofeos / verificados.length) * 100).toFixed(1) : '0.0';

    // Estimado de banca salvada (30x sobre montos de sondeo protegidos)
    let capitalEstimadoSalvado = 0;
    trofeos.forEach(t => {
      const monto = t.montoSondeo || 3000;
      capitalEstimadoSalvado += (monto * 30);
    });

    return {
      totalSondeos,
      totalVerificados: verificados.length,
      totalTrofeos,
      trofeosPremier,
      trofeosFijo,
      trofeosPredictivo,
      trofeosAleatorio,
      trofeosAmbos,
      tasaEficacia,
      capitalEstimadoSalvado,
      trofeosRecientes: trofeos.slice(-10).reverse()
    };
  } catch (err) {
    console.error(`[TROPHY STATS ERROR] ${err.message}`);
    return {
      totalSondeos: 0,
      totalVerificados: 0,
      totalTrofeos: 0,
      trofeosPremier: 0,
      trofeosPredictivo: 0,
      trofeosAleatorio: 0,
      trofeosAmbos: 0,
      tasaEficacia: '0.0',
      capitalEstimadoSalvado: 0,
      trofeosRecientes: []
    };
  }
}

/**
 * Actualizar el estado de bloqueo en Triple 7 para un registro
 */
function updateT7Status(recordId, t7Status, t7Blocked) {
  try {
    if (!fs.existsSync(DB_PATH)) return false;
    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const rec = history.find(r => r.id === recordId);
    if (rec) {
      rec.t7Status = t7Status;
      rec.t7Blocked = t7Blocked;
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
      rewriteCSV(history);
      return true;
    }
  } catch (e) {}
  return false;
}

module.exports = {
  getHistory,
  recordScan,
  verifyRecordWinner,
  syncResultsWithVisualFx,
  syncScheduledDrawResult,
  lookupAndUpdateRecord,
  getTrophyStats,
  updateT7Status,
  rewriteCSV,
  getAnimalName,
  parseTimeToMinutes,
  CSV_PATH,
  DB_PATH
};


