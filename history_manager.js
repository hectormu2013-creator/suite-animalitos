const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'history_db.json');
const CSV_PATH = path.join(__dirname, 'reportes_agotados.csv');
const WINNERS_VAULT_PATH = path.join(__dirname, 'boveda_resultados.json');
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
 * Normalizar clave de animal (00 vs 0 vs 01..99)
 */
function normalizeAnimalKey(num, name = '') {
  const s = String(num ?? '').trim();
  const n = String(name ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('delfin')) return '0';
  if (n.includes('ballena')) return '00';
  if (s === '00') return '00';
  if (s === '0') return '0';
  const parsed = parseInt(s, 10);
  if (!isNaN(parsed)) return String(parsed).padStart(2, '0');
  return s.padStart(2, '0');
}

/**
 * Obtener nombre del animal por número
 */
function getAnimalName(num) {
  const norm = normalizeAnimalKey(num);
  if (norm === '00') return 'Ballena';
  if (norm === '0') return 'Delfin';
  const rawNum = String(parseInt(num, 10));
  return animalDict[norm] || animalDict[rawNum] || animalDict[num] || `Animal ${norm}`;
}

/**
 * Normalizar ID de lotería para búsqueda en Visual-FX y Scrapers
 */
function mapLoteriaToVisualFx(loteriaStr) {
  const clean = (loteriaStr || '').toLowerCase().trim();
  if (clean.includes('millonario') || clean.includes('guacharito')) return 'guacharito-millonario';
  if (clean.includes('guacharo')) return 'guacharo-activo';
  if (clean.includes('granjita')) return 'la-granjita';
  if (clean.includes('lotto')) return 'lotto-activo';
  if (clean.includes('selva')) return 'selva-plus';
  return clean;
}

/**
 * Normalizar formato de hora de sorteo a HH:mm estándar militar de 24h
 */
function normalizeDrawTime(t) {
  if (!t) return '';
  const s = String(t).trim().toUpperCase();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = m[3];
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  return s.replace(/^0/, '');
}

/**
 * Normalizar nombre de lotería para clave canónica
 */
function canonicalLotteryKey(lot) {
  const c = String(lot || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (c.includes('millonario') || c.includes('guacharito')) return 'guacharomillonario';
  if (c.includes('guacharo')) return 'guacharoactivo';
  if (c.includes('rey')) return 'lottorey';
  if (c.includes('granjita')) return 'lagranjita';
  if (c.includes('lotto')) return 'lottoactivo';
  if (c.includes('selva')) return 'laselvita';
  return c;
}

/**
 * Generar clave canónica única e inequívoca para un sorteo (fecha_loteria_hora)
 */
function makeCanonicalDrawKey(r) {
  if (!r) return '';
  const d = r.fecha || (r.timestamp && r.timestamp.slice(0, 10)) || '';
  const l = canonicalLotteryKey(r.loteria);
  const s = normalizeDrawTime(r.sorteo || r.horaSorteo || '');
  return `${d}_${l}_${s}`;
}

/**
 * Cargar Bóveda Inmutable de Resultados Oficiales (boveda_resultados.json)
 */
function loadWinnersVault() {
  try {
    if (fs.existsSync(WINNERS_VAULT_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(WINNERS_VAULT_PATH, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}
  return {};
}

/**
 * Guardar Bóveda Inmutable de Resultados Oficiales en disco y en Supabase
 */
function saveWinnersVault(vaultObj, syncCloud = true) {
  if (!vaultObj || typeof vaultObj !== 'object') return {};
  try {
    const existing = loadWinnersVault();
    const merged = { ...existing, ...vaultObj };
    fs.writeFileSync(WINNERS_VAULT_PATH, JSON.stringify(merged, null, 2), 'utf8');
    if (syncCloud) {
      try {
        const cloudStore = require('./cloud_store');
        cloudStore.saveMasterWinnersVault(merged).catch(() => {});
      } catch (eC) {}
    }
    return merged;
  } catch (e) {
    return vaultObj;
  }
}

/**
 * Consultar si un sorteo específico ya tiene resultado oficial en la Bóveda Inmutable
 */
function getWinnerFromVault(loteria, fecha, sorteo) {
  const ckey = makeCanonicalDrawKey({ loteria, fecha, sorteo });
  if (!ckey) return null;
  const vault = loadWinnersVault();
  return vault[ckey] || null;
}

/**
 * Guardar un resultado oficial individual en la Bóveda Inmutable
 */
function saveWinnerToVault(loteria, fecha, sorteo, numero, nombre = null, syncCloud = false) {
  const ckey = makeCanonicalDrawKey({ loteria, fecha, sorteo });
  if (!ckey || numero === undefined || numero === null || numero === '') return null;
  const normNum = normalizeAnimalKey(numero, nombre);
  const normName = nombre || getAnimalName(normNum);
  const entry = {
    numero: normNum,
    nombre: normName,
    fecha,
    loteria: canonicalLotteryKey(loteria),
    sorteo: normalizeDrawTime(sorteo),
    updatedAt: new Date().toISOString()
  };
  saveWinnersVault({ [ckey]: entry }, syncCloud);
  return entry;
}

/**
 * Calcular de forma determinista el objeto ganador y trofeo para un registro dado
 */
function computeGanadorObjectForRecord(rec, winnerNumber, winnerName = null, fechaVerif = null) {
  const normWinner = normalizeAnimalKey(winnerNumber, winnerName);
  const resolvedName = winnerName || getAnimalName(normWinner);

  const normList = (arr) => (arr || []).map(x => normalizeAnimalKey(typeof x === 'object' ? x.numero : x));
  const premierList = normList(rec.rojosPremier);
  const fijoList = normList(rec.numFijos && rec.numFijos.length ? rec.numFijos : rec.fijosSeleccionados);
  const predictivoList = normList(rec.numPredictivos && rec.numPredictivos.length ? rec.numPredictivos : rec.predictivosVisualFx);
  const aleatorioList = normList(rec.numAleatorios && rec.numAleatorios.length ? rec.numAleatorios : rec.aleatoriosSistema);
  const memoriaList = normList(rec.numMemoriaCupoCero && rec.numMemoriaCupoCero.length ? rec.numMemoriaCupoCero : rec.memoriaCupoCero);
  const allBlocked = normList(rec.rojos);

  const matchNum = (list) => list.some(n => n === normWinner);

  const esPremier = matchNum(premierList);
  const esFijo = matchNum(fijoList);
  const esPredictivo = matchNum(predictivoList);
  const esAleatorio = matchNum(aleatorioList);
  const esMemoria = matchNum(memoriaList);
  const salioBloqueado = esPremier || esFijo || esPredictivo || esAleatorio || esMemoria || matchNum(allBlocked);

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

  return {
    verificado: true,
    numero: normWinner,
    nombre: resolvedName,
    bloqueoAcertado: salioBloqueado,
    origenAcierto,
    origenTexto,
    metodosAcierto,
    mensaje,
    fechaVerificacion: fechaVerif || new Date().toISOString()
  };
}

/**
 * Hidratar registros con la Bóveda Inmutable de Resultados Oficiales.
 * Si un registro perdió su campo `ganador` por sincronización externa pero el sorteo ya existe
 * en la bóveda, lo restaura instantáneamente. También absorbe ganadores nuevos hacia la bóveda.
 */
function hydrateRecordsWithWinnersVault(records, externalVault = null) {
  if (!Array.isArray(records)) return { records: [], healedCount: 0, vaultUpdated: false };
  const vault = { ...loadWinnersVault(), ...(externalVault || {}) };
  let vaultUpdated = !!(externalVault && Object.keys(externalVault).length > 0);
  let healedCount = 0;

  // 1. Absorber cualquier ganador ya verificado en los registros hacia la bóveda
  for (const r of records) {
    if (!r) continue;
    const ckey = makeCanonicalDrawKey(r);
    if (!ckey) continue;
    if (r.ganador && r.ganador.verificado && r.ganador.numero !== undefined && r.ganador.numero !== null && r.ganador.numero !== '') {
      const normNum = normalizeAnimalKey(r.ganador.numero, r.ganador.nombre);
      const normName = r.ganador.nombre || getAnimalName(normNum);
      if (!vault[ckey] || vault[ckey].numero !== normNum) {
        vault[ckey] = {
          numero: normNum,
          nombre: normName,
          fecha: r.fecha,
          loteria: canonicalLotteryKey(r.loteria),
          sorteo: normalizeDrawTime(r.sorteo || r.horaSorteo || ''),
          updatedAt: r.ganador.fechaVerificacion || new Date().toISOString()
        };
        vaultUpdated = true;
      }
    }
  }

  // 2. Restaurar/hidratar cualquier registro cuyo sorteo esté en la bóveda pero no tenga ganador verificado
  for (const r of records) {
    if (!r) continue;
    const ckey = makeCanonicalDrawKey(r);
    if (!ckey || !vault[ckey]) continue;
    const v = vault[ckey];
    if (!r.ganador || !r.ganador.verificado || r.ganador.numero === null || r.ganador.numero === undefined || r.ganador.numero === '') {
      r.ganador = computeGanadorObjectForRecord(r, v.numero, v.nombre, v.updatedAt);
      r.revision = {
        estado: 'RESUELTO',
        intentos: (r.revision && r.revision.intentos) || 1,
        fechaResolucion: v.updatedAt || new Date().toISOString()
      };
      healedCount++;
    }
  }

  if (vaultUpdated) {
    saveWinnersVault(vault, false);
  }

  return { records, healedCount, vaultUpdated, vault };
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
 * Obtener minutos actuales en la zona horaria oficial de Venezuela (America/Caracas)
 */
function getVenezuelaCurrentMinutes() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Caracas',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return h * 60 + m;
  } catch (e) {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

/**
 * Obtener fecha actual YYYY-MM-DD en la zona horaria oficial de Venezuela (America/Caracas)
 */
function getVenezuelaDateString() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${d}`;
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
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
 * Obtener todos los registros históricos (siempre hidratados con la Bóveda Inmutable)
 */
function getHistory(filters = {}) {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    let records = JSON.parse(raw);

    const { healedCount } = hydrateRecordsWithWinnersVault(records);
    if (healedCount > 0) {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2), 'utf8');
      } catch (eW) {}
    }

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
    const rojosPremier = (Array.isArray(scanData.rojosPremier) ? scanData.rojosPremier : []).map(n => normalizeAnimalKey(n));
    const detallePremier = rojosPremier.map(n => ({
      numero: n,
      nombre: getAnimalName(n),
      origen: 'PREMIER',
      origenTexto: 'Premier Pluss (Cupo 0 / Agotado)'
    }));

    // 2. Números Fijos Permanentes (Máx 3, Mín 0)
    const rawFijos = scanData.fijosSeleccionados || scanData.numFijos || [];
    const detalleFijos = rawFijos.slice(0, 3).map(f => {
      const numStr = normalizeAnimalKey(typeof f === 'object' ? f.numero : f);
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
      const numStr = normalizeAnimalKey(p.numero);
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
      const numStr = normalizeAnimalKey(typeof a === 'object' ? a.numero : a);
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
      const numStr = normalizeAnimalKey(typeof m === 'object' ? m.numero : m);
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
      rojos: (Array.isArray(scanData.rojos) && scanData.rojos.length > 0 && scanData.esConsolidado)
        ? scanData.rojos.slice(0, scanData.maximoBloqueosConfigurado || 6)
        : todosNumeros.slice(0, scanData.maximoBloqueosConfigurado || 6),
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
      bloqueosConsolidados: (scanData.bloqueosConsolidados && Array.isArray(scanData.bloqueosConsolidados))
        ? scanData.bloqueosConsolidados.slice(0, scanData.maximoBloqueosConfigurado || 6)
        : bloqueosConsolidados.slice(0, scanData.maximoBloqueosConfigurado || 6),
      totalBloqueados: Math.min((scanData.esConsolidado && scanData.rojos ? scanData.rojos.length : todosNumeros.length), (scanData.maximoBloqueosConfigurado || 6)),
      maximoBloqueosConfigurado: scanData.maximoBloqueosConfigurado || 6,

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
    const normTime = (t) => {
      if (!t) return '';
      const s = t.trim().toUpperCase();
      const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) {
        let h = parseInt(m24[1], 10);
        const m = m24[2];
        const ampm = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
      }
      const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
      if (m12) {
        const hh = m12[1].padStart(2, '0');
        return `${hh}:${m12[2]} ${m12[3] || 'AM'}`;
      }
      return s;
    };

    const normDraw = normTime(scanData.sorteo);

    const existingIndex = history.findIndex(r => {
      if (r.fecha !== fecha) return false;
      const lotMatch = canonicalLotteryKey(r.loteria) === canonicalLotteryKey(scanData.loteria);
      const timeMatch = normTime(r.sorteo) === normDraw || normTime(r.horaSorteo) === normDraw || (r.sorteo && r.sorteo === scanData.sorteo);
      return lotMatch && timeMatch;
    });

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

      // Memoria Cupo Cero Premier
      const mergedMemoria = Array.from(new Set([...(rec.numMemoriaCupoCero || []), ...numMemoriaCupoCero]));
      const mergedMemoriaDetalle = (rec.memoriaCupoCero && rec.memoriaCupoCero.length > 0)
        ? rec.memoriaCupoCero
        : detalleMemoria;

      const allMergedNumbers = Array.from(new Set([...mergedPremier, ...mergedFijos, ...mergedPred, ...mergedAleat, ...mergedMemoria]));
      
      const newConsolidados = allMergedNumbers.map(num => {
        const esPremier = mergedPremier.includes(num);
        const esFijo = mergedFijos.includes(num);
        const predObj = mergedPredDetalle.find(p => p.numero === num);
        const esPredictivo = !!predObj;
        const esAleatorio = mergedAleat.includes(num);
        const esMemoria = mergedMemoria.includes(num);

        let origen = 'PREMIER';
        let origenTexto = 'Premier Pluss (Cupo 0)';
        let detalle = 'Agotado en taquilla';

        const origenesCount = (esPremier ? 1 : 0) + (esFijo ? 1 : 0) + (esPredictivo ? 1 : 0) + (esAleatorio ? 1 : 0) + (esMemoria ? 1 : 0);

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
        } else if (esMemoria) {
          origen = 'MEMORIA_CUPO_0';
          origenTexto = 'Memoria Cupo Cero Premier';
          detalle = 'Arrastre preventivo de agotado';
        }

        return {
          numero: num,
          nombre: getAnimalName(num),
          origen,
          origenTexto,
          detalle
        };
      });

      rec.rojosPremier = mergedPremier;
      rec.detallePremier = mergedPremierDetalle;
      rec.numFijos = mergedFijos;
      rec.fijosSeleccionados = mergedFijosDetalle;
      rec.numPredictivos = mergedPred;
      rec.predictivosVisualFx = mergedPredDetalle;
      rec.numAleatorios = mergedAleat;
      rec.aleatoriosSistema = mergedAleatDetalle;
      rec.numMemoriaCupoCero = mergedMemoria;
      rec.memoriaCupoCero = mergedMemoriaDetalle;

      // Respetar estrictamente el límite máximo de bloqueos configurado (maximoBloqueosPorSorteo)
      const maxBloqueosConfig = scanData.maximoBloqueosConfigurado || rec.maximoBloqueosConfigurado || 6;
      let finalRojos = (Array.isArray(scanData.rojos) && scanData.rojos.length > 0 && scanData.esConsolidado)
        ? scanData.rojos.slice(0, maxBloqueosConfig)
        : allMergedNumbers.slice(0, maxBloqueosConfig);

      rec.rojos = finalRojos;
      rec.maximoBloqueosConfigurado = maxBloqueosConfig;
      rec.totalBloqueados = finalRojos.length;
      rec.bloqueosConsolidados = (scanData.bloqueosConsolidados && Array.isArray(scanData.bloqueosConsolidados))
        ? scanData.bloqueosConsolidados.slice(0, maxBloqueosConfig)
        : newConsolidados.filter(c => finalRojos.includes(c.numero));
      rec.timestamp = now.toISOString();
      rec.hora = hora;
      if (scanData.t7Status) rec.t7Status = scanData.t7Status;
      if (scanData.t7Blocked !== undefined) rec.t7Blocked = rec.t7Blocked || scanData.t7Blocked;

      hydrateRecordsWithWinnersVault(history);
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
      rewriteCSV(history);
      return rec;
    } else {
      history.push(newRecord);
      if (history.length > 1000) history.shift();
      hydrateRecordsWithWinnersVault(history);
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
 * Además sella el resultado en la Bóveda Inmutable (boveda_resultados.json + Supabase suite_verified_winners)
 */
function verifyRecordWinner(recordId, winnerNumber, winnerName = null) {
  try {
    if (!fs.existsSync(DB_PATH)) return { ok: false, message: 'Base de datos no encontrada' };
    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let rec = history.find(r => r.id === recordId);
    if (!rec) {
      rec = history.find(r => makeCanonicalDrawKey(r) === recordId || (r.id && r.id.includes(recordId)));
    }
    if (!rec) return { ok: false, message: 'Registro no encontrado' };

    const normWinner = normalizeAnimalKey(winnerNumber, winnerName);
    const resolvedName = winnerName || getAnimalName(normWinner);
    const nowIso = new Date().toISOString();

    // Auto-liberar de la memoria de cupo cero si este número estaba en persistencia
    try {
      const cupoMem = require('./cupo_cero_memory');
      const gameKey = mapLoteriaToVisualFx(rec.loteria);
      cupoMem.verificarYAutoLiberarPorGanador(gameKey, normWinner, resolvedName, rec.sorteo || rec.horaSorteo, rec.fecha);
    } catch (e) {}

    const targetCanonical = makeCanonicalDrawKey(rec);

    // 1. Sellar en la Bóveda Inmutable de Resultados Oficiales
    if (targetCanonical) {
      saveWinnersVault({
        [targetCanonical]: {
          numero: normWinner,
          nombre: resolvedName,
          fecha: rec.fecha,
          loteria: canonicalLotteryKey(rec.loteria),
          sorteo: normalizeDrawTime(rec.sorteo || rec.horaSorteo || ''),
          updatedAt: nowIso
        }
      }, true);
    }

    // 2. Actualizar este registro y cualquier duplicado existente para el mismo sorteo canónico
    let mainGanadorObj = null;
    history.forEach(r => {
      if (r.id === rec.id || (targetCanonical && makeCanonicalDrawKey(r) === targetCanonical)) {
        const gObj = computeGanadorObjectForRecord(r, normWinner, resolvedName, nowIso);
        r.ganador = gObj;
        r.revision = {
          estado: 'RESUELTO',
          intentos: ((r.revision && r.revision.intentos) || 0) + 1,
          fechaResolucion: nowIso
        };
        if (r.id === rec.id || !mainGanadorObj) {
          mainGanadorObj = gObj;
        }
      }
    });

    if (!mainGanadorObj) {
      mainGanadorObj = computeGanadorObjectForRecord(rec, normWinner, resolvedName, nowIso);
      rec.ganador = mainGanadorObj;
    }

    hydrateRecordsWithWinnersVault(history);
    fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
    rewriteCSV(history);

    // Persistir de inmediato en Supabase para que ningún refresco o sync pueda revertir el ganador
    try {
      const cloudStore = require('./cloud_store');
      cloudStore.saveMasterHistory(history).catch(() => {});
    } catch (eCloud) {}

    return {
      ok: true,
      bloqueoAcertado: mainGanadorObj.bloqueoAcertado,
      origenAcierto: mainGanadorObj.origenAcierto,
      record: rec,
      mensaje: mainGanadorObj.mensaje
    };
  } catch (err) {
    console.error(`[HISTORY VERIFY ERROR] ${err.message}`);
    return { ok: false, message: err.message };
  }
}

/**
 * Sincronizar automáticamente resultados con Visual-FX y scrapers oficiales en vivo
 * (TOTALMENTE AUTÓNOMO: Funciona en Localhost y en Render con scrapers nativos)
 * @param {boolean} forceReverify - Si es true, vuelve a verificar incluso registros previamente marcados
 * @param {string} targetDate - "YYYY-MM-DD" opcional para limitar la sincronización a una fecha específica
 */
async function syncResultsWithVisualFx(forceReverify = false, targetDate = null) {
  try {
    if (!fs.existsSync(DB_PATH)) return { ok: false, message: 'Sin registros históricos', updatedCount: 0, trophiesCount: 0 };

    const cloudStore = require('./cloud_store');
    let cloudVault = {};

    // 1. Fusionar historial y bóveda desde Supabase sin perder ningún ganador verificado
    try {
      const [cloudRes, vaultRes] = await Promise.all([
        cloudStore.getMasterHistory(true),
        cloudStore.getMasterWinnersVault(true)
      ]);
      if (vaultRes && typeof vaultRes === 'object') {
        cloudVault = vaultRes;
      }
      const local = JSON.parse(fs.readFileSync(DB_PATH, 'utf8') || '[]');
      const cloudRecs = (cloudRes && Array.isArray(cloudRes.records)) ? cloudRes.records : [];
      const merged = mergeHistories(local, cloudRecs, cloudVault);
      fs.writeFileSync(DB_PATH, JSON.stringify(merged, null, 2), 'utf8');
      rewriteCSV(merged);
    } catch (eCloudMerge) {}

    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const vault = { ...loadWinnersVault(), ...cloudVault };
    let updatedCount = 0;
    let trophiesCount = 0;
    let vaultDirty = false;
    let historyDirty = false;

    const scraper = require('./scraper_service');
    const todayVet = getVenezuelaDateString();

    for (const rec of history) {
      if (targetDate && rec.fecha !== targetDate) continue;

      const isAlreadyVerified = !!(rec.ganador && rec.ganador.verificado && rec.ganador.numero !== null && rec.ganador.numero !== undefined && rec.ganador.numero !== '');
      if (isAlreadyVerified && !forceReverify) continue;

      // Primero revisar si la Bóveda ya tiene el ganador de este sorteo
      const ckey = makeCanonicalDrawKey(rec);
      if (!forceReverify && ckey && vault[ckey] && vault[ckey].numero) {
        const gObj = computeGanadorObjectForRecord(rec, vault[ckey].numero, vault[ckey].nombre, vault[ckey].updatedAt);
        rec.ganador = gObj;
        rec.revision = {
          estado: 'RESUELTO',
          intentos: (rec.revision && rec.revision.intentos) || 1,
          fechaResolucion: vault[ckey].updatedAt || new Date().toISOString()
        };
        updatedCount++;
        if (gObj.bloqueoAcertado) trophiesCount++;
        historyDirty = true;
        continue;
      }

      const recTimeMinutes = parseTimeToMinutes(rec.sorteo || rec.horaSorteo);

      // Si es hoy en Venezuela, asegurar que ya hayan pasado al menos 5 minutos desde el sorteo
      if (rec.fecha === todayVet && recTimeMinutes !== null) {
        const currentMins = getVenezuelaCurrentMinutes();
        const diff = currentMins - recTimeMinutes;
        if (diff < 5) continue;
      }

      // Scraping en vivo desde 1000Resultados (usa caché en memoria de 45s por lotería/fecha)
      let matchedDraw = null;
      try {
        const liveLookup = await scraper.lookupDrawResult(rec.loteria, rec.sorteo || rec.horaSorteo, rec.fecha);
        if (liveLookup && liveLookup.found && liveLookup.number !== null && liveLookup.number !== undefined) {
          matchedDraw = { number: liveLookup.number, name: liveLookup.name };
        }
      } catch (eScrap) {}

      if (matchedDraw && matchedDraw.number !== null && matchedDraw.number !== undefined) {
        const nowIso = new Date().toISOString();
        const normWinner = normalizeAnimalKey(matchedDraw.number, matchedDraw.name);
        const resolvedName = matchedDraw.name || getAnimalName(normWinner);
        const gObj = computeGanadorObjectForRecord(rec, normWinner, resolvedName, nowIso);

        rec.ganador = gObj;
        rec.revision = {
          estado: 'RESUELTO',
          intentos: ((rec.revision && rec.revision.intentos) || 0) + 1,
          fechaResolucion: nowIso
        };

        if (ckey) {
          vault[ckey] = {
            numero: normWinner,
            nombre: resolvedName,
            fecha: rec.fecha,
            loteria: canonicalLotteryKey(rec.loteria),
            sorteo: normalizeDrawTime(rec.sorteo || rec.horaSorteo || ''),
            updatedAt: nowIso
          };
          vaultDirty = true;
        }

        try {
          const cupoMem = require('./cupo_cero_memory');
          const gameKey = mapLoteriaToVisualFx(rec.loteria);
          cupoMem.verificarYAutoLiberarPorGanador(gameKey, normWinner, resolvedName, rec.sorteo || rec.horaSorteo, rec.fecha);
        } catch (eMem) {}

        updatedCount++;
        if (gObj.bloqueoAcertado) trophiesCount++;
        historyDirty = true;
      } else if (!forceReverify) {
        const intentosPrev = (rec.revision && rec.revision.intentos) || 0;
        const nuevosIntentos = intentosPrev + 1;
        rec.revision = {
          estado: nuevosIntentos >= 2 ? 'AGOTADO_2_INTENTOS' : 'INTENTO_1_PENDIENTE',
          intentos: nuevosIntentos,
          ultimoIntento: new Date().toISOString()
        };
        historyDirty = true;
      }
    }

    if (vaultDirty) {
      saveWinnersVault(vault, false);
      try {
        await cloudStore.saveMasterWinnersVault(vault);
      } catch (eV) {}
    }

    if (historyDirty || updatedCount > 0) {
      hydrateRecordsWithWinnersVault(history, vault);
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
      rewriteCSV(history);
      try {
        await cloudStore.saveMasterHistory(history);
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
    let rec = history.find(r => r.id === recordId);
    if (!rec) {
      rec = history.find(r => makeCanonicalDrawKey(r) === recordId || (r.id && r.id.includes(recordId)));
    }
    if (!rec) return { ok: false, message: 'Registro no encontrado' };

    const scraper = require('./scraper_service');
    const drawTime = rec.sorteo || rec.horaSorteo;
    const lookup = await scraper.lookupDrawResult(rec.loteria, drawTime, rec.fecha);

    if (lookup.found && lookup.number !== null && lookup.number !== undefined) {
      const verifyRes = verifyRecordWinner(rec.id, lookup.number, lookup.name);

      try {
        const cloudStore = require('./cloud_store');
        const freshHistory = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        await Promise.all([
          cloudStore.saveMasterHistory(freshHistory),
          cloudStore.saveMasterWinnersVault(loadWinnersVault())
        ]);
      } catch (eC) {}

      return {
        ok: true,
        found: true,
        winnerNumber: lookup.number,
        winnerName: lookup.name,
        winner: { numero: lookup.number, nombre: lookup.name },
        bloqueoAcertado: verifyRes.bloqueoAcertado,
        isHit: verifyRes.bloqueoAcertado,
        mensaje: verifyRes.mensaje,
        message: verifyRes.mensaje,
        record: verifyRes.record,
        source: lookup.source
      };
    } else {
      return {
        ok: true,
        found: false,
        pending: true,
        mensaje: lookup.message || `El sorteo de ${rec.loteria} (${drawTime}) aún está en espera de publicación en 1000Resultados.`,
        message: lookup.message || `El sorteo de ${rec.loteria} (${drawTime}) aún está en espera de publicación en 1000Resultados.`
      };
    }
  } catch (err) {
    return { ok: false, message: `Error en búsqueda: ${err.message}` };
  }
}

/**
 * Extraer resultado de un sorteo programado específico en 1000Resultados
 * Sigue la regla estricta:
 * - Intento 1: A los 5 minutos tras el sorteo (+5 min)
 * - Intento 2: A los 10 minutos tras el sorteo (+10 min, si el 1 no lo consiguió)
 * - Al segundo intento sin conseguirlo, PARA por completo (máximo 2 intentos automáticos).
 * @param {string} loteriaKeyOrId - Lotería
 * @param {string} sorteoHora - Hora del sorteo
 * @param {string} fechaStr - Fecha YYYY-MM-DD
 * @param {number} intentoNum - 1 o 2
 */
async function syncScheduledDrawResult(loteriaKeyOrId, sorteoHora, fechaStr, intentoNum = 1) {
  try {
    if (!fs.existsSync(DB_PATH)) return { ok: false, found: false, message: 'Sin registros históricos' };

    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    hydrateRecordsWithWinnersVault(history);

    const targetCanLot = canonicalLotteryKey(loteriaKeyOrId);
    const targetMinutes = parseTimeToMinutes(sorteoHora);

    // Buscar registros en nuestra historia que correspondan exactamente a esta lotería y hora y no estén verificados
    const matchingRecords = history.filter(rec => {
      const matchGame = canonicalLotteryKey(rec.loteria) === targetCanLot;
      const recMins = parseTimeToMinutes(rec.sorteo || rec.horaSorteo);
      const matchTime = targetMinutes !== null && recMins !== null
        ? Math.abs(recMins - targetMinutes) <= 5
        : (normalizeDrawTime(rec.sorteo || rec.horaSorteo) === normalizeDrawTime(sorteoHora));
      const matchDate = !fechaStr || rec.fecha === fechaStr;
      const pendiente = !rec.ganador || !rec.ganador.verificado;
      return matchGame && matchTime && matchDate && pendiente;
    });

    if (matchingRecords.length === 0) {
      return { ok: true, found: false, alreadyVerified: true, message: 'No hay sorteos pendientes para verificar' };
    }

    // 1. Scraping directo desde 1000Resultados
    const scraper = require('./scraper_service');
    let matchedDraw = null;
    try {
      const lookup = await scraper.lookupDrawResult(loteriaKeyOrId, sorteoHora, fechaStr);
      if (lookup && lookup.found && lookup.number !== null && lookup.number !== undefined) {
        matchedDraw = { number: lookup.number, name: lookup.name };
      }
    } catch (eScrap) {}

    if (matchedDraw && matchedDraw.number !== null && matchedDraw.number !== undefined) {
      let trophiesWon = 0;
      for (const rec of matchingRecords) {
        const res = verifyRecordWinner(rec.id, matchedDraw.number, matchedDraw.name);
        if (res.ok && res.bloqueoAcertado) trophiesWon++;
      }

      // IMPORTANTE: Leer DB_PATH recién actualizado por verifyRecordWinner (NUNCA sobrescribir con history viejo en memoria)
      const freshHistory = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      try {
        const cloudStore = require('./cloud_store');
        await Promise.all([
          cloudStore.saveMasterHistory(freshHistory),
          cloudStore.saveMasterWinnersVault(loadWinnersVault())
        ]);
      } catch (eC) {}

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
      hydrateRecordsWithWinnersVault(history);
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
      try {
        const cloudStore = require('./cloud_store');
        await cloudStore.saveMasterHistory(history);
      } catch (eC) {}

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
      hydrateRecordsWithWinnersVault(history);
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2), 'utf8');
      rewriteCSV(history);
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Fusión Monotónica de Historiales + Hidratación con Bóveda Inmutable:
 * Garantiza de forma estricta que NINGÚN resultado o ganador verificado sea revertido jamás.
 * Si un sorteo está verificado en A, en B, o en la Bóveda de Resultados, SIEMPRE mantiene la verificación.
 */
function mergeHistories(baseRecords, incomingRecords, externalVault = null) {
  if (!Array.isArray(baseRecords)) baseRecords = [];
  if (!Array.isArray(incomingRecords)) incomingRecords = [];

  const map = new Map();
  const makeKey = r => makeCanonicalDrawKey(r) || r.id;

  for (const r of baseRecords) {
    if (!r) continue;
    const key = makeKey(r);
    map.set(key, { ...r });
  }

  for (const inc of incomingRecords) {
    if (!inc) continue;
    const key = makeKey(inc);
    if (map.has(key)) {
      const existing = map.get(key);
      let winnerToKeep = existing.ganador;

      // REGLA DE ORO DE INMUTABILIDAD DE GANADORES:
      if (existing.ganador && existing.ganador.verificado && (!inc.ganador || !inc.ganador.verificado)) {
        winnerToKeep = existing.ganador;
      } else if (inc.ganador && inc.ganador.verificado && (!existing.ganador || !existing.ganador.verificado)) {
        winnerToKeep = inc.ganador;
      } else if (existing.ganador && existing.ganador.verificado && inc.ganador && inc.ganador.verificado) {
        winnerToKeep = existing.ganador.bloqueoAcertado ? existing.ganador : inc.ganador;
      } else {
        winnerToKeep = (existing.ganador && existing.ganador.numero) ? existing.ganador : ((inc.ganador && inc.ganador.numero) ? inc.ganador : (existing.ganador || inc.ganador || null));
      }

      const revToKeep = (existing.revision && existing.revision.estado === 'RESUELTO' && existing.ganador && existing.ganador.verificado)
        ? existing.revision
        : ((inc.revision && inc.revision.estado === 'RESUELTO' && inc.ganador && inc.ganador.verificado) ? inc.revision : (existing.revision || inc.revision || null));

      map.set(key, {
        ...inc,
        ...existing,
        id: existing.id || inc.id,
        ganador: winnerToKeep,
        revision: revToKeep,
        rojosPremier: Array.from(new Set([...(existing.rojosPremier || []), ...(inc.rojosPremier || [])])),
        rojos: Array.from(new Set([...(existing.rojos || []), ...(inc.rojos || [])]))
      });
    } else {
      map.set(key, { ...inc });
    }
  }

  const result = Array.from(map.values());
  hydrateRecordsWithWinnersVault(result, externalVault);
  result.sort((a, b) => (new Date(a.timestamp || 0).getTime()) - (new Date(b.timestamp || 0).getTime()));
  return result;
}

module.exports = {
  getHistory,
  recordScan,
  verifyRecordWinner,
  mergeHistories,
  hydrateRecordsWithWinnersVault,
  loadWinnersVault,
  saveWinnersVault,
  getWinnerFromVault,
  saveWinnerToVault,
  syncResultsWithVisualFx,
  syncScheduledDrawResult,
  lookupAndUpdateRecord,
  getTrophyStats,
  updateT7Status,
  rewriteCSV,
  getAnimalName,
  parseTimeToMinutes,
  getVenezuelaCurrentMinutes,
  getVenezuelaDateString,
  normalizeDrawTime,
  canonicalLotteryKey,
  makeCanonicalDrawKey,
  CSV_PATH,
  DB_PATH,
  WINNERS_VAULT_PATH
};


