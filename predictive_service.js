const fs = require('fs');
const path = require('path');

// Rutas estándar hacia los datos de Visual-FX (Prioridad: Local empaquetado en el repo)
const LOCAL_DATA_DIR = path.join(__dirname, 'data');
const LOCAL_HISTORY_PATH = path.join(LOCAL_DATA_DIR, 'lottery_history.json');
const LOCAL_RESULTS_PATH = path.join(LOCAL_DATA_DIR, 'lottery_results.json');
const LOCAL_STATS_PATH = path.join(LOCAL_DATA_DIR, 'lottery_stats.js');

const VISUAL_FX_DIR = path.join('C:', 'Users', 'Hector', 'Fenix_2026_1', 'PROYECTO_VISUAL_FX');
const VISUAL_FX_HISTORY_PATH = fs.existsSync(LOCAL_HISTORY_PATH) ? LOCAL_HISTORY_PATH : path.join(VISUAL_FX_DIR, 'data', 'lottery_history.json');
const VISUAL_FX_RESULTS_PATH = fs.existsSync(LOCAL_RESULTS_PATH) ? LOCAL_RESULTS_PATH : path.join(VISUAL_FX_DIR, 'data', 'lottery_results.json');
const VISUAL_FX_STATS_PATH = fs.existsSync(LOCAL_STATS_PATH) ? LOCAL_STATS_PATH : path.join(VISUAL_FX_DIR, 'lottery_stats.js');
const VISUAL_FX_ENGINE_PATH = path.join(VISUAL_FX_DIR, 'lottery_engine.js');
const LOCAL_FALLBACK_PATH = LOCAL_HISTORY_PATH;

// Diccionario de animales oficial
let animalDict = {};
try {
  const dictRaw = fs.readFileSync(path.join(__dirname, 'scripts', 'animal_dictionary.json'), 'utf8');
  animalDict = JSON.parse(dictRaw);
} catch (e) {}

/**
 * Normalizar ID de lotería para Visual-FX
 */
function mapLoteriaToVisualFx(loteriaKeyOrName) {
  const clean = (loteriaKeyOrName || '').toLowerCase().trim();
  if (clean.includes('millonario') || clean.includes('guacharito')) return 'guacharito-millonario';
  if (clean.includes('guacharo')) return 'guacharo-activo';
  if (clean.includes('granjita')) return 'la-granjita';
  if (clean.includes('lotto')) return 'lotto-activo';
  if (clean.includes('ruleta')) return 'ruleta-activa';
  if (clean.includes('ricachona')) return 'la-ricachona';
  if (clean.includes('selva')) return 'selva-plus';
  return clean.replace(/_/g, '-');
}

/**
 * Normalizar clave de animal (00 vs 0 vs 01..99)
 */
function normalizeAnimalKey(num) {
  const s = String(num || '').trim();
  if (s === '00') return '00';
  if (s === '0') return '0';
  return s.padStart(2, '0');
}

/**
 * Obtener nombre formateado del animal
 */
function getAnimalDisplayName(num, fallbackName = '') {
  const norm = normalizeAnimalKey(num);
  if (norm === '00') return 'Ballena';
  if (norm === '0') return 'Delfin';
  if (animalDict[norm]) return animalDict[norm];
  const numInt = parseInt(norm, 10);
  if (animalDict[String(numInt)]) return animalDict[String(numInt)];
  if (fallbackName && !fallbackName.toLowerCase().startsWith('animal')) {
    return fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1).toLowerCase();
  }
  return `Animal ${norm}`;
}

/**
 * Cargar datos históricos desde Visual-FX
 */
function loadVisualFxHistory() {
  try {
    if (fs.existsSync(LOCAL_HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_HISTORY_PATH, 'utf8'));
    }
  } catch (e) {}

  try {
    if (fs.existsSync(VISUAL_FX_HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(VISUAL_FX_HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn(`[PREDICTIVE] Error al leer Visual-FX en ${VISUAL_FX_HISTORY_PATH}: ${err.message}`);
  }

  return null;
}

/**
 * Cargar resultados del día desde Visual-FX
 */
function loadVisualFxResults() {
  try {
    if (fs.existsSync(LOCAL_RESULTS_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_RESULTS_PATH, 'utf8'));
    }
  } catch (e) {}

  try {
    if (fs.existsSync(VISUAL_FX_RESULTS_PATH)) {
      return JSON.parse(fs.readFileSync(VISUAL_FX_RESULTS_PATH, 'utf8'));
    }
  } catch (e) {}
  return {};
}

/**
 * Sincronizar sorteos en vivo desde los scrapers oficiales de Visual-FX
 * Consulta 1000Resultados y TuAzar 5 minutos después del sorteo
 */
async function syncVisualFxDraws(loteriaId) {
  const gameId = mapLoteriaToVisualFx(loteriaId);
  try {
    if (fs.existsSync(VISUAL_FX_ENGINE_PATH)) {
      delete require.cache[require.resolve(VISUAL_FX_ENGINE_PATH)];
      const engine = require(VISUAL_FX_ENGINE_PATH);
      if (typeof engine.syncGame === 'function') {
        await engine.syncGame(gameId);
        return { ok: true, gameId, message: `Sincronización completada para ${gameId}` };
      }
    }
  } catch (e) {
    console.warn(`[PREDICTIVE SYNC] Error sincronizando ${gameId}: ${e.message}`);
  }
  return { ok: false, gameId, message: 'Motor de scraping no disponible' };
}

/**
 * Obtener todos los sorteos aplanados en orden cronológico inverso (el más reciente primero)
 */
function getFlattenedDrawsReversed(gameId) {
  const draws = [];
  const historyData = loadVisualFxHistory() || {};
  const resultsData = loadVisualFxResults() || {};

  // 1. Sorteos del día de hoy desde lottery_results.json
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  if (resultsData[todayStr] && resultsData[todayStr][gameId] && Array.isArray(resultsData[todayStr][gameId].draws)) {
    const valid = resultsData[todayStr][gameId].draws.filter(d => !d.isPending && (d.number || d.tripleA));
    for (let i = valid.length - 1; i >= 0; i--) {
      draws.push({ date: todayStr, ...valid[i] });
    }
  }

  // 2. Histórico de días anteriores desde lottery_history.json
  const gameHist = historyData[gameId] || {};
  const dates = Object.keys(gameHist).sort().reverse();
  for (const date of dates) {
    if (date === todayStr && draws.length > 0) continue; // Ya cargado desde resultados vivos
    const dayDraws = gameHist[date] || [];
    for (let i = dayDraws.length - 1; i >= 0; i--) {
      if (dayDraws[i].number || dayDraws[i].tripleA) {
        draws.push({ date, ...dayDraws[i] });
      }
    }
  }

  return draws;
}

/**
 * Obtener los números más atrasados (Modelo Predictivo Visual-FX - Menos salidos en 30 días)
 * Corresponde a la pantalla "TOP 5 ANIMALITOS POR REVENTAR (MENOS SALIDOS 30 DÍAS)" de Visual-FX
 * @param {string} loteriaId - 'la_granjita', 'guacharo_activo', 'lotto_activo', 'guacharo_millonario'
 * @param {number} limit - Cantidad a retornar (1 a 5, por defecto 5)
 */
function getMostDelayedNumbers(loteriaId, limit = 5) {
  const gameId = mapLoteriaToVisualFx(loteriaId);
  const drawsFlat = getFlattenedDrawsReversed(gameId);

  // 1. Intentar usar la lógica oficial directa de Visual-FX
  let coldFromFx = null;
  try {
    if (fs.existsSync(VISUAL_FX_STATS_PATH)) {
      delete require.cache[require.resolve(VISUAL_FX_STATS_PATH)];
      const fxStats = require(VISUAL_FX_STATS_PATH);
      if (typeof fxStats.getColdNumbers === 'function') {
        coldFromFx = fxStats.getColdNumbers(gameId, Math.max(limit, 10));
      }
    }
  } catch (e) {
    console.warn(`[PREDICTIVE] Aviso al llamar lottery_stats.js: ${e.message}`);
  }

  // 2. Si no estuvo disponible Visual-FX en disco, calcular internamente de forma determinística
  if (!coldFromFx || coldFromFx.length === 0) {
    const historyData = loadVisualFxHistory() || {};
    const gameHistory = historyData[gameId] || {};
    const dates = Object.keys(gameHistory).sort().reverse();

    // Si no hay historial disponible en disco para este juego, no inventar atrasados ni seleccionar 00 por defecto
    if (dates.length === 0 && drawsFlat.length === 0) {
      return [];
    }

    const isAnimal = !gameId.includes('triple');
    const isGuacharo = gameId.includes('guacharo');
    let max = 36;
    if (gameId === 'guacharito-millonario' || gameId === 'la-ricachona' || gameId === 'animalitos-la-ricachona') {
      max = 70;
    } else if (gameId.includes('centena')) {
      max = 99;
    }

    const allNumbers = [];
    if (isAnimal) {
      allNumbers.push('00');
      allNumbers.push('0');
      for (let i = 1; i <= max; i++) allNumbers.push(String(i).padStart(2, '0'));
    } else {
      for (let i = 0; i <= 99; i++) allNumbers.push(String(i).padStart(2, '0'));
    }

    const occurrencesMap = {};
    const names = {};

    for (const d of drawsFlat) {
      if (d.number) {
        const nKey = normalizeAnimalKey(d.number);
        occurrencesMap[nKey] = (occurrencesMap[nKey] || 0) + 1;
        if (d.name) names[nKey] = d.name;
      }
    }

    coldFromFx = allNumbers.map(num => {
      let daysAgo = 30;
      for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        const dayDraws = gameHistory[dateStr] || [];
        const found = dayDraws.some(d => normalizeAnimalKey(d.number) === num);
        if (found) {
          daysAgo = i;
          break;
        }
      }
      return {
        number: num,
        name: names[num] || getAnimalDisplayName(num),
        occurrences: occurrencesMap[num] || 0,
        daysOverdue: daysAgo
      };
    }).sort((a, b) => {
      if (a.occurrences !== b.occurrences) return a.occurrences - b.occurrences;
      return b.daysOverdue - a.daysOverdue;
    });
  }

  // 3. Enriquecer los resultados con conteo exacto de sorteos sin salir (drawsAgo)
  const results = coldFromFx.map(item => {
    const norm = normalizeAnimalKey(item.number || item.num);
    const cleanName = getAnimalDisplayName(norm, item.name);
    const occurrences = item.occurrences !== undefined ? item.occurrences : 0;
    const daysOverdue = item.daysOverdue !== undefined ? item.daysOverdue : 30;

    // Calcular cuántos sorteos exactos han pasado desde la última vez que salió
    let drawsAgo = drawsFlat.length;
    for (let i = 0; i < drawsFlat.length; i++) {
      const d = drawsFlat[i];
      if (normalizeAnimalKey(d.number) === norm) {
        drawsAgo = i;
        break;
      }
    }

    return {
      numero: norm,
      nombre: cleanName,
      sorteosAtraso: drawsAgo,
      diasAtraso: daysOverdue,
      salidas30d: occurrences,
      detalle: `${occurrences} salidas (hace ${daysOverdue}d / ${drawsAgo} sorteos)`
    };
  });

  const effectiveLimit = Math.min(Math.max(limit, 1), 10);
  return results.slice(0, effectiveLimit);
}

/**
 * Generar hasta 3 números aleatorios escogidos por el sistema para cobertura adicional de riesgo
 * @param {string} loteriaId - ID de lotería
 * @param {number} count - Máximo 3 números (por defecto 2)
 * @param {string[]} excludeList - Números a excluir para no duplicar bloqueos
 */
function getRandomSystemBlockNumbers(loteriaId, count = 2, excludeList = []) {
  const gameId = mapLoteriaToVisualFx(loteriaId);
  const isMillonario = gameId.includes('millonario');
  const isGuacharo = gameId.includes('guacharo');
  const maxN = isMillonario ? 70 : isGuacharo ? 75 : 36;

  // Pool de números válidos para este juego (00 Ballena y 0 Delfín incluidos)
  const pool = ['00', '0'];
  for (let i = 1; i <= maxN; i++) {
    pool.push(String(i).padStart(2, '0'));
  }

  // Filtrar números que ya estén bloqueados
  const normExclude = (excludeList || []).map(n => normalizeAnimalKey(n));
  const candidates = pool.filter(n => !normExclude.includes(n));

  // Algoritmo Fisher-Yates para selección aleatoria uniforme
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Límite estricto de máximo 3 números aleatorios
  const effectiveCount = Math.min(Math.max(parseInt(count, 10) || 0, 0), 3);
  const selected = candidates.slice(0, effectiveCount);

  return selected.map(num => ({
    numero: num,
    nombre: getAnimalDisplayName(num),
    origen: 'ALEATORIO',
    origenTexto: 'Sistema Autónomo (Cobertura Aleatoria)',
    detalle: 'Selección algorítmica del sistema'
  }));
}

/**
 * Obtener números fijos configurados para la lotería (Máximo 3, Mínimo 0)
 * @param {object} config - Configuración de loterías
 * @param {string} loteriaId - ID de la lotería
 */
function getFixedBlockNumbers(config, loteriaId) {
  let lot = (config.loterias || []).find(l => l.id === loteriaId);
  if (!lot) lot = (config.loterias || []).find(l => l.activo) || (config.loterias && config.loterias[0]);
  if (!lot || lot.bloqueoFijos === false) return [];

  let rawList = lot.numerosFijos || [];
  if (typeof rawList === 'string') {
    rawList = rawList.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  }

  // Estricto: máximo 3, mínimo 0
  const normalized = Array.from(new Set(
    rawList.slice(0, 3).map(num => normalizeAnimalKey(num))
  )).filter(Boolean);

  return normalized.map(num => ({
    numero: num,
    nombre: getAnimalDisplayName(num),
    origen: 'FIJO',
    origenTexto: 'Número Fijo (Siempre Bloqueado)',
    detalle: 'Configuración fija del usuario (máx 3)'
  }));
}

/**
 * Consolidar lista final de números para bloqueo combinando 5 vías:
 * 1. Premier Pluss (Cupo Cero / Agotados)
 * 2. Números Fijos (Siempre Bloqueados - Máx 3, Mín 0)
 * 3. Visual-FX Predictivo (Atrasados dinámicos)
 * 4. Sistema Autónomo (Aleatorios / Cobertura de Riesgo del Sistema - Máx 3)
 * 5. Memoria de Cupo Cero Premier (Arrastre Preventivo de Sorteos Anteriores)
 * @param {object} config - Configuración de loterías
 * @param {string} loteriaId - ID de la lotería
 * @param {object} premierResult - Resultado de la detección de Premier Pluss
 */
/**
 * Consolidar lista final de números para bloqueo combinando las 5 vías con jerarquía estricta y tope máximo:
 * 1. Resultantes del sondeo para el sorteo actual (Premier Pluss Cupo 0)
 * 2. Persistentes del sorteo inmediatamente anterior (Memoria Cupo 0, distancia = 1)
 * 3. Persistentes del segundo sorteo anterior (Memoria Cupo 0, distancia = 2 o remotos)
 * 4. Provenientes de más tiempo sin salir (Visual-FX Atrasados) y Números Fijos
 * 5. Generados por el sistema aleatorio (Cobertura de Riesgo del Sistema)
 *
 * REGLA DE ORO DE RENTABILIDAD:
 * Se respeta estrictamente el límite maximoBloqueosPorSorteo (entre 0 y 10).
 * Si la suma de candidatos excede el tope, se corta de forma estricta según el orden de prioridad
 * para garantizar la máxima disponibilidad de ventas en la taquilla.
 *
 * @param {object} config - Configuración de loterías
 * @param {string} loteriaId - ID de la lotería
 * @param {object} premierResult - Resultado de la detección de Premier Pluss
 * @param {string} sorteoHora - Hora objetivo del sorteo (ej: '16:00' o '04:00 PM')
 */
function buildConsolidatedBlockList(config, loteriaId, premierResult, sorteoHora = '') {
  let lot = (config.loterias || []).find(l => l.id === loteriaId);
  if (!lot) lot = (config.loterias || []).find(l => l.activo) || (config.loterias && config.loterias[0]);

  // Límite máximo de números a bloquear por sorteo (Rango estricto 0 a 10, por defecto 6)
  const maxBloqueosConfigurado = lot.maximoBloqueosPorSorteo !== undefined 
    ? parseInt(lot.maximoBloqueosPorSorteo, 10) 
    : 6;
  const maxBloqueos = Math.min(Math.max(isNaN(maxBloqueosConfigurado) ? 6 : maxBloqueosConfigurado, 0), 10);

  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDrawTime = sorteoHora || (premierResult && premierResult.sorteo) || '';

  // 1. PRIORIDAD 1: Sondeo actual Premier Pluss (Cupo 0 directo)
  const rojosPremier = (premierResult && premierResult.rojos) || [];
  const bloqueadosPremier = (lot.bloqueoPremierAgotados !== false) 
    ? rojosPremier.map(n => normalizeAnimalKey(n)) 
    : [];

  // 2 y 3. PRIORIDAD 2 y 3: Memoria Cupo Cero Premier clasificada por antigüedad
  let persistentes = { inmediatamenteAnterior: [], segundoAnterior: [], otrosAnteriores: [] };
  if (lot.memoriaCupoCero && lot.memoriaCupoCero.activo !== false) {
    try {
      const cupoMem = require('./cupo_cero_memory');
      persistentes = cupoMem.obtenerPersistentesPorAntiguedad(lot.id, todayStr, targetDrawTime, lot.horarios || []);
    } catch (eMem) {
      console.warn(`[PREDICTIVE] Error leyendo memoria clasificada: ${eMem.message}`);
    }
  }

  // 4. PRIORIDAD 4: Más tiempo sin salir (Visual-FX Atrasados) y Fijos configurados
  const fijosSeleccionados = getFixedBlockNumbers(config, lot.id);
  const numFijos = fijosSeleccionados.map(f => f.numero);

  // Consultar si este sorteo ya tiene números predictivos o aleatorios asignados hoy (ej: por alarma previa)
  let existingRec = null;
  try {
    const historyMgr = require('./history_manager');
    const hist = historyMgr.getHistory({ fecha: todayStr });
    if (targetDrawTime) {
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

      const normLot = (l) => (l || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const lotNorm = normLot(lot.nombre);
      const targetTimeNorm = normTime(targetDrawTime);

      existingRec = hist.find(r => {
        const rLotNorm = normLot(r.loteria);
        const lotMatch = rLotNorm === lotNorm || 
          (lotNorm.includes('millonario') && rLotNorm.includes('millonario')) ||
          (!lotNorm.includes('millonario') && !rLotNorm.includes('millonario') && lotNorm.includes('guacharo') && rLotNorm.includes('guacharo')) ||
          (lotNorm.includes('granjita') && rLotNorm.includes('granjita')) ||
          (lotNorm.includes('lotto') && rLotNorm.includes('lotto')) ||
          (lotNorm.includes('selva') && rLotNorm.includes('selva'));
        
        const timeMatch = normTime(r.sorteo) === targetTimeNorm || 
                          normTime(r.horaSorteo) === targetTimeNorm ||
                          (r.sorteo && r.sorteo === targetDrawTime);
        return lotMatch && timeMatch;
      });
    }
  } catch (e) {}

  const cantidadPredictivos = parseInt(lot.cantidadPredictivosABloquear, 10) || 0;
  const activarPredictivos = lot.bloqueoPredictivosAtrasados !== false && cantidadPredictivos > 0;
  let predictivosCandidatos = [];
  if (activarPredictivos) {
    if (existingRec && Array.isArray(existingRec.predictivosVisualFx) && existingRec.predictivosVisualFx.length > 0) {
      predictivosCandidatos = existingRec.predictivosVisualFx.slice(0, cantidadPredictivos);
    } else {
      predictivosCandidatos = getMostDelayedNumbers(lot.id, Math.max(cantidadPredictivos, 5));
    }
  }

  // 5. PRIORIDAD 5: Sistema Autónomo (Cobertura Aleatoria, máximo 3)
  const cantidadAleatorios = parseInt(lot.cantidadAleatoriosABloquear, 10) || 0;
  const activarAleatorios = lot.bloqueoAleatorioSistema !== false && cantidadAleatorios > 0;
  let aleatoriosCandidatos = [];
  if (activarAleatorios) {
    if (existingRec && Array.isArray(existingRec.aleatoriosSistema) && existingRec.aleatoriosSistema.length > 0) {
      aleatoriosCandidatos = existingRec.aleatoriosSistema.slice(0, Math.min(cantidadAleatorios, 3));
    } else {
      // Excluir números ya vistos en prioridades superiores para la selección aleatoria inicial
      const poolExcluir = [
        ...bloqueadosPremier,
        ...persistentes.inmediatamenteAnterior.map(p => p.numero),
        ...persistentes.segundoAnterior.map(p => p.numero),
        ...numFijos,
        ...predictivosCandidatos.map(p => p.numero)
      ];
      aleatoriosCandidatos = getRandomSystemBlockNumbers(lot.id, Math.min(cantidadAleatorios, 3), poolExcluir);
    }
  }

  // =========================================================================
  // ENSAMBLE SECUENCIAL CON TOPE ESTRICTO (0 a 10) Y JERARQUÍA DE 5 NIVELES
  // =========================================================================
  const listaFinalNumeros = [];
  const listaFinalDetallada = [];
  const yaIncluidos = new Set();

  function agregarCandidato(item, nivel, nivelNombre) {
    if (listaFinalNumeros.length >= maxBloqueos) return false;
    const raw = typeof item === 'string' ? item : (item.numero || item);
    const num = normalizeAnimalKey(raw);
    if (!num || yaIncluidos.has(num)) return false;

    yaIncluidos.add(num);
    listaFinalNumeros.push(num);

    const obj = (typeof item === 'object' && item !== null) ? { ...item } : {
      numero: num,
      nombre: getAnimalDisplayName(num)
    };
    obj.numero = num;
    obj.prioridadNivel = nivel;
    obj.prioridadNombre = nivelNombre;
    listaFinalDetallada.push(obj);
    return true;
  }

  // 1️⃣ PRIORIDAD 1: Resultantes del sondeo para el sorteo actual (Premier Cupo 0)
  for (const n of bloqueadosPremier) {
    if (listaFinalNumeros.length >= maxBloqueos) break;
    agregarCandidato({
      numero: n,
      nombre: getAnimalDisplayName(n),
      origen: 'PREMIER_CUPO_0',
      origenTexto: 'Sondeo Premier Pluss (Cupo 0 Actual)'
    }, 1, '1. Sondeo Premier Actual');
  }

  // 2️⃣ PRIORIDAD 2: Persistentes del sorteo inmediatamente anterior
  for (const m of persistentes.inmediatamenteAnterior) {
    if (listaFinalNumeros.length >= maxBloqueos) break;
    agregarCandidato(m, 2, '2. Persistente Sorteo Anterior');
  }

  // 3️⃣ PRIORIDAD 3: Persistentes del segundo sorteo anterior
  for (const m of persistentes.segundoAnterior) {
    if (listaFinalNumeros.length >= maxBloqueos) break;
    agregarCandidato(m, 3, '3. Persistente 2do Anterior');
  }
  // Si aún queda cupo y hay de sorteos más antiguos:
  for (const m of (persistentes.otrosAnteriores || [])) {
    if (listaFinalNumeros.length >= maxBloqueos) break;
    agregarCandidato(m, 3, '3. Persistente Anterior Remoto');
  }

  // 4️⃣ PRIORIDAD 4: Más tiempo sin salir (Visual-FX Atrasados) y Números Fijos
  for (const f of fijosSeleccionados) {
    if (listaFinalNumeros.length >= maxBloqueos) break;
    agregarCandidato(f, 4, '4. Número Fijo Configurado');
  }
  for (const p of predictivosCandidatos) {
    if (listaFinalNumeros.length >= maxBloqueos) break;
    agregarCandidato(p, 4, '4. Más Tiempo Sin Salir (Visual-FX)');
  }

  // 5️⃣ PRIORIDAD 5: Generados por el sistema aleatorio (Cobertura)
  for (const a of aleatoriosCandidatos) {
    if (listaFinalNumeros.length >= maxBloqueos) break;
    agregarCandidato(a, 5, '5. Cobertura Aleatoria');
  }

  // Desgloses por categoría para auditoría y visualización
  const fijosAceptados = listaFinalDetallada.filter(d => d.prioridadNivel === 4 && (d.origen === 'FIJO' || d.prioridadNombre.includes('Fijo')));
  const predictivosAceptados = listaFinalDetallada.filter(d => d.prioridadNivel === 4 && !d.prioridadNombre.includes('Fijo'));
  const aleatoriosAceptados = listaFinalDetallada.filter(d => d.prioridadNivel === 5);
  const memoriaAceptados = listaFinalDetallada.filter(d => d.prioridadNivel === 2 || d.prioridadNivel === 3);

  return {
    loteria: lot.nombre,
    maximoBloqueosConfigurado: maxBloqueos,
    bloquearPremierActivo: lot.bloqueoPremierAgotados !== false,
    rojosPremier,
    bloquearFijosActivo: lot.bloqueoFijos !== false,
    fijosSeleccionados: fijosAceptados,
    numFijos: fijosAceptados.map(f => f.numero),
    bloquearPredictivosActivo: activarPredictivos,
    cantidadPredictivosConfigurada: cantidadPredictivos,
    predictivosSeleccionados: predictivosAceptados,
    bloquearAleatoriosActivo: activarAleatorios,
    cantidadAleatoriosConfigurada: cantidadAleatorios,
    aleatoriosSeleccionados: aleatoriosAceptados,
    bloquearMemoriaActivo: lot.memoriaCupoCero && lot.memoriaCupoCero.activo !== false,
    memoriaSeleccionados: memoriaAceptados,
    numMemoria: memoriaAceptados.map(m => m.numero),
    listaFinalNumeros,
    listaFinalDetallada,
    totalNumerosABloquear: listaFinalNumeros.length,
    detallePrioridades: {
      p1_sondeoActual: listaFinalDetallada.filter(d => d.prioridadNivel === 1).map(d => d.numero),
      p2_persistenteAnterior: listaFinalDetallada.filter(d => d.prioridadNivel === 2).map(d => d.numero),
      p3_persistente2doAnterior: listaFinalDetallada.filter(d => d.prioridadNivel === 3).map(d => d.numero),
      p4_masTiempoSinSalirYFijos: listaFinalDetallada.filter(d => d.prioridadNivel === 4).map(d => d.numero),
      p5_aleatorios: listaFinalDetallada.filter(d => d.prioridadNivel === 5).map(d => d.numero)
    }
  };
}

/**
 * Determinar el próximo sorteo de una lotería según la hora actual
 */
function calcularProximoSorteo(horarios) {
  if (!Array.isArray(horarios) || horarios.length === 0) return '10:00';
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  for (const hStr of horarios) {
    const match = hStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (hStr.toUpperCase().includes('PM') && h < 12) h += 12;
    if (hStr.toUpperCase().includes('AM') && h === 12) h = 0;
    const drawMinutes = h * 60 + m;
    if (drawMinutes > currentTotalMinutes) {
      return hStr;
    }
  }
  return horarios[0]; // Primer sorteo del siguiente día si ya pasaron todos
}

module.exports = {
  getMostDelayedNumbers,
  getRandomSystemBlockNumbers,
  getFixedBlockNumbers,
  buildConsolidatedBlockList,
  mapLoteriaToVisualFx,
  syncVisualFxDraws,
  normalizeAnimalKey,
  calcularProximoSorteo
};
