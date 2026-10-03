const fs = require('fs');
const path = require('path');

// Ruta estándar hacia el proyecto Visual-FX
const VISUAL_FX_HISTORY_PATH = path.join('C:', 'Users', 'Hector', 'Fenix_2026_1', 'PROYECTO_VISUAL_FX', 'data', 'lottery_history.json');
const LOCAL_FALLBACK_PATH = path.join(__dirname, 'lottery_history_cache.json');

// Diccionario de animales de soporte
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
  if (clean.includes('guacharo')) return 'guacharo-activo';
  if (clean.includes('granjita')) return 'la-granjita';
  if (clean.includes('lotto')) return 'lotto-activo';
  return clean;
}

/**
 * Cargar datos históricos desde Visual-FX
 */
function loadVisualFxHistory() {
  try {
    if (fs.existsSync(VISUAL_FX_HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(VISUAL_FX_HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn(`[PREDICTIVE] Aviso al leer Visual-FX en ${VISUAL_FX_HISTORY_PATH}: ${err.message}`);
  }

  try {
    if (fs.existsSync(LOCAL_FALLBACK_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_FALLBACK_PATH, 'utf8'));
    }
  } catch (e) {}

  return null;
}

/**
 * Obtener los números más atrasados (que tienen más tiempo sin salir)
 * @param {string} loteriaId - 'la_granjita', 'guacharo_activo', 'lotto_activo' o nombre
 * @param {number} limit - Cantidad a retornar (1 a 5, por defecto 5)
 */
function getMostDelayedNumbers(loteriaId, limit = 5) {
  const historyData = loadVisualFxHistory();
  if (!historyData) return [];

  const gameId = mapLoteriaToVisualFx(loteriaId);
  const gameData = historyData[gameId] || {};
  const dates = Object.keys(gameData).sort().reverse();
  if (dates.length === 0) return [];

  const isGuacharo = gameId.includes('guacharo');
  const maxN = isGuacharo ? 75 : 36;

  // Lista de todos los números del juego
  const allNumbers = ['00', '0'];
  for (let i = 1; i <= maxN; i++) {
    allNumbers.push(String(i).padStart(2, '0'));
  }

  // Aplanar todos los sorteos en orden cronológico inverso
  const drawsFlat = [];
  for (const date of dates) {
    const dailyDraws = gameData[date] || [];
    for (let i = dailyDraws.length - 1; i >= 0; i--) {
      drawsFlat.push({ date, ...dailyDraws[i] });
    }
  }

  const results = allNumbers.map(num => {
    let drawsAgo = drawsFlat.length;
    let daysAgo = dates.length;
    let name = '';
    const numInt = parseInt(num, 10);

    for (let i = 0; i < drawsFlat.length; i++) {
      const d = drawsFlat[i];
      const dNumInt = parseInt(d.number, 10);
      if (d.number === num || dNumInt === numInt) {
        drawsAgo = i;
        daysAgo = dates.indexOf(d.date);
        name = d.name;
        break;
      }
    }

    if (!name) {
      name = animalDict[num] || animalDict[String(numInt)] || `Animal ${num}`;
    }

    return {
      numero: num,
      nombre: name,
      sorteosAtraso: drawsAgo,
      diasAtraso: daysAgo
    };
  });

  // Ordenar por mayor atraso (más sorteos sin salir)
  results.sort((a, b) => b.sorteosAtraso - a.sorteosAtraso);

  const top = results.slice(0, Math.min(Math.max(limit, 1), 10));
  return top;
}

/**
 * Generar hasta 3 números aleatorios escogidos por el sistema para cobertura adicional de riesgo
 * @param {string} loteriaId - ID de lotería
 * @param {number} count - Máximo 3 números (por defecto 2)
 * @param {string[]} excludeList - Números a excluir para no duplicar bloqueos
 */
function getRandomSystemBlockNumbers(loteriaId, count = 2, excludeList = []) {
  const gameId = mapLoteriaToVisualFx(loteriaId);
  const isGuacharo = gameId.includes('guacharo');
  const maxN = isGuacharo ? 77 : 36;

  // Pool de números válidos para este juego
  const pool = ['00', '0'];
  for (let i = 1; i <= maxN; i++) {
    pool.push(String(i).padStart(2, '0'));
  }

  // Filtrar números que ya estén bloqueados
  const normExclude = (excludeList || []).map(n => String(n).padStart(2, '0'));
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
    nombre: animalDict[num] || animalDict[String(parseInt(num, 10))] || `Animal ${num}`,
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
  if (!lot) lot = (config.loterias || []).find(l => l.activo) || config.loterias[0];
  if (!lot || lot.bloqueoFijos === false) return [];

  let rawList = lot.numerosFijos || [];
  if (typeof rawList === 'string') {
    rawList = rawList.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  }

  // Estricto: máximo 3, mínimo 0
  const normalized = Array.from(new Set(
    rawList.slice(0, 3).map(num => String(num).trim().padStart(2, '0'))
  )).filter(Boolean);

  return normalized.map(num => ({
    numero: num,
    nombre: animalDict[num] || animalDict[String(parseInt(num, 10))] || `Animal ${num}`,
    origen: 'FIJO',
    origenTexto: 'Número Fijo (Siempre Bloqueado)',
    detalle: 'Configuración fija del usuario (máx 3)'
  }));
}

/**
 * Consolidar lista final de números para bloqueo combinando 4 vías:
 * 1. Premier Pluss (Cupo Cero / Agotados)
 * 2. Números Fijos (Siempre Bloqueados - Máx 3, Mín 0)
 * 3. Visual-FX Predictivo (Atrasados / Demora)
 * 4. Sistema Autónomo (Aleatorios / Cobertura de Riesgo del Sistema - Máx 3)
 * @param {object} config - Configuración de loterías
 * @param {string} loteriaId - ID de la lotería
 * @param {object} premierResult - Resultado de la detección de Premier Pluss
 */
function buildConsolidatedBlockList(config, loteriaId, premierResult) {
  let lot = (config.loterias || []).find(l => l.id === loteriaId);
  if (!lot) lot = (config.loterias || []).find(l => l.activo) || config.loterias[0];

  // 1. Premier Pluss Agotados (Solo Cupo 0)
  const rojosPremier = (premierResult && premierResult.rojos) || [];
  const bloqueadosPremier = (lot.bloqueoPremierAgotados !== false) ? rojosPremier : [];

  // 2. Números Fijos (Máximo 3, Mínimo 0)
  const fijosSeleccionados = getFixedBlockNumbers(config, lot.id);
  const numFijos = fijosSeleccionados.map(f => f.numero);

  // 3. Modelo Predictivo Visual-FX (Atrasados)
  const cantidadPredictivos = parseInt(lot.cantidadPredictivosABloquear, 10) || 0;
  const activarPredictivos = lot.bloqueoPredictivosAtrasados !== false && cantidadPredictivos > 0;

  let predictivosSeleccionados = [];
  if (activarPredictivos) {
    const yaBloqueados = [...bloqueadosPremier, ...numFijos];
    const atrasados = getMostDelayedNumbers(lot.id, cantidadPredictivos);
    predictivosSeleccionados = atrasados.filter(item => !yaBloqueados.includes(item.numero));
  }

  // 4. Sistema Autónomo (Números Aleatorios, máximo 3)
  const cantidadAleatorios = parseInt(lot.cantidadAleatoriosABloquear, 10) || 0;
  const activarAleatorios = lot.bloqueoAleatorioSistema !== false && cantidadAleatorios > 0;

  let aleatoriosSeleccionados = [];
  if (activarAleatorios) {
    const yaBloqueados = [
      ...bloqueadosPremier,
      ...numFijos,
      ...predictivosSeleccionados.map(p => p.numero)
    ];
    aleatoriosSeleccionados = getRandomSystemBlockNumbers(lot.id, Math.min(cantidadAleatorios, 3), yaBloqueados);
  }

  // Lista única final de números para bloqueo
  const listaNumerosFinal = Array.from(new Set([
    ...bloqueadosPremier,
    ...numFijos,
    ...predictivosSeleccionados.map(p => p.numero),
    ...aleatoriosSeleccionados.map(a => a.numero)
  ]));

  return {
    loteria: lot.nombre,
    bloquearPremierActivo: lot.bloqueoPremierAgotados !== false,
    rojosPremier,
    bloquearFijosActivo: lot.bloqueoFijos !== false,
    fijosSeleccionados,
    numFijos,
    bloquearPredictivosActivo: activarPredictivos,
    cantidadPredictivosConfigurada: cantidadPredictivos,
    predictivosSeleccionados,
    bloquearAleatoriosActivo: activarAleatorios,
    cantidadAleatoriosConfigurada: cantidadAleatorios,
    aleatoriosSeleccionados,
    listaFinalNumeros: listaNumerosFinal,
    totalNumerosABloquear: listaNumerosFinal.length
  };
}

module.exports = {
  getMostDelayedNumbers,
  getRandomSystemBlockNumbers,
  getFixedBlockNumbers,
  buildConsolidatedBlockList,
  mapLoteriaToVisualFx
};

