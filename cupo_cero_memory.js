const fs = require('fs');
const path = require('path');

const MEMORY_DB_PATH = path.join(__dirname, 'memoria_cupo_cero.json');

// Diccionario de animales para nombres legibles
let animalDict = {};
try {
  const dictRaw = fs.readFileSync(path.join(__dirname, 'scripts', 'animal_dictionary.json'), 'utf8');
  animalDict = JSON.parse(dictRaw);
} catch (e) {}

function getAnimalName(num) {
  const norm = String(num).padStart(2, '0');
  const rawNum = String(parseInt(num, 10));
  return animalDict[norm] || animalDict[rawNum] || animalDict[num] || `Animal ${norm}`;
}

function normalizeLotId(id) {
  return (id || '').toString().toLowerCase().replace(/[-_\s]/g, '').trim();
}

/**
 * Calcular los siguientes N sorteos a partir de un sorteo actual dentro de la lista de horarios
 * @param {Array<string>} horarios - Lista de horarios ordenada (ej: ["09:00", "10:00", ...])
 * @param {string} sorteoActual - Sorteo actual (ej: "16:00" o "04:00 PM")
 * @param {number} cantidad - Máximo de sorteos siguientes a obtener (1 a 5)
 */
function obtenerSiguientesSorteos(horarios, sorteoActual, cantidad = 3) {
  if (!Array.isArray(horarios) || horarios.length === 0) return [];
  const maxSorteos = Math.min(Math.max(parseInt(cantidad, 10) || 3, 1), 5);

  function toMinutes(tStr) {
    if (!tStr) return -1;
    const clean = tStr.trim().toUpperCase();
    const isPM = clean.includes('PM');
    const isAM = clean.includes('AM');
    const match = clean.match(/(\d{1,2}):(\d{2})/);
    if (!match) return -1;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  }

  const currentMins = toMinutes(sorteoActual);
  
  // Buscar índice o sorteos que sean estrictamente posteriores en minutos
  const sorteosPosteriores = horarios
    .map(h => ({ hora: h, mins: toMinutes(h) }))
    .filter(item => item.mins > currentMins)
    .sort((a, b) => a.mins - b.mins)
    .map(item => item.hora);

  return sorteosPosteriores.slice(0, maxSorteos);
}

/**
 * Cargar estado de memoria desde disco
 */
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_DB_PATH)) {
      return JSON.parse(fs.readFileSync(MEMORY_DB_PATH, 'utf8'));
    }
  } catch (err) {
    console.error(`[MEMORIA CUPO 0] Error leyendo memoria: ${err.message}`);
  }
  return { items: [] };
}

/**
 * Guardar estado de memoria en disco
 */
function saveMemory(data) {
  try {
    fs.writeFileSync(MEMORY_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[MEMORIA CUPO 0] Error guardando memoria: ${err.message}`);
    return false;
  }
}

/**
 * Registrar números agotados pescados en Premier Pluss para arrastre de persistencia
 * @param {string} loteriaId - ID de la lotería (ej: 'guacharo_activo')
 * @param {string} loteriaNombre - Nombre de la lotería
 * @param {string} sorteoActual - Sorteo donde fue detectado (ej: '16:00')
 * @param {string} fechaActual - Fecha del sorteo (ej: '2026-10-03')
 * @param {Array<string>} numerosAgotados - Lista de números con Cupo 0
 * @param {number} sorteosPersistencia - Cantidad de sorteos a persistir (1 a 5)
 * @param {Array<string>} sorteosPrebloqueados - Lista de horas futuras que fueron pre-bloqueadas
 */
function registrarAgotadosPremier(loteriaId, loteriaNombre, sorteoActual, fechaActual, numerosAgotados, sorteosPersistencia = 3, sorteosPrebloqueados = []) {
  if (!Array.isArray(numerosAgotados) || numerosAgotados.length === 0) return [];
  const maxSorteos = Math.min(Math.max(parseInt(sorteosPersistencia, 10) || 3, 1), 5);
  const normTargetLotId = normalizeLotId(loteriaId);

  const memory = loadMemory();
  const addedOrUpdated = [];

  numerosAgotados.forEach(rawNum => {
    const norm = String(rawNum).padStart(2, '0');
    const existing = memory.items.find(item => 
      normalizeLotId(item.loteriaId) === normTargetLotId && 
      item.numero === norm && 
      item.fechaOrigen === fechaActual && 
      item.estado === 'ACTIVO'
    );

    if (existing) {
      existing.sorteosRestantes = maxSorteos;
      existing.sorteosConfigurados = maxSorteos;
      existing.ultimoSorteoDetectado = sorteoActual;
      existing.sorteosPrebloqueados = Array.from(new Set([...(existing.sorteosPrebloqueados || []), ...sorteosPrebloqueados]));
      existing.timestampActualizacion = new Date().toISOString();
      addedOrUpdated.push(existing);
    } else {
      const newItem = {
        id: `${loteriaId}_${norm}_${fechaActual}_${Date.now()}`,
        loteriaId,
        loteriaNombre,
        numero: norm,
        nombre: getAnimalName(norm),
        fechaOrigen: fechaActual,
        sorteoOrigen: sorteoActual,
        sorteosConfigurados: maxSorteos,
        sorteosRestantes: maxSorteos,
        sorteosPrebloqueados: [...sorteosPrebloqueados],
        sorteosProcesados: [],
        estado: 'ACTIVO',
        timestamp: new Date().toISOString()
      };
      memory.items.push(newItem);
      addedOrUpdated.push(newItem);
    }
  });

  saveMemory(memory);
  return addedOrUpdated;
}

/**
 * Obtener todos los números activos en memoria para una lotería y fecha dada
 */
function obtenerNumerosActivos(loteriaId, fechaActual) {
  const memory = loadMemory();
  const normTargetLotId = normalizeLotId(loteriaId);
  return memory.items.filter(item => 
    normalizeLotId(item.loteriaId) === normTargetLotId && 
    item.fechaOrigen === fechaActual && 
    item.estado === 'ACTIVO' && 
    item.sorteosRestantes > 0
  );
}

/**
 * Descontar un sorteo a los números en memoria para esta lotería
 * (Se ejecuta cuando finaliza o avanza un sorteo)
 */
function descontarSorteo(loteriaId, sorteoEjecutado, fechaActual) {
  const memory = loadMemory();
  const normTargetLotId = normalizeLotId(loteriaId);
  let cambios = false;
  const expirados = [];

  memory.items.forEach(item => {
    if (normalizeLotId(item.loteriaId) === normTargetLotId && item.fechaOrigen === fechaActual && item.estado === 'ACTIVO') {
      // Descontar si no ha sido procesado para este sorteo y no es el sorteo de origen
      if (item.sorteoOrigen !== sorteoEjecutado && !item.sorteosProcesados.includes(sorteoEjecutado)) {
        item.sorteosRestantes--;
        item.sorteosProcesados.push(sorteoEjecutado);
        cambios = true;

        if (item.sorteosRestantes <= 0) {
          item.estado = 'EXPIRADO';
          item.sorteosRestantes = 0;
          item.fechaExpiracion = new Date().toISOString();
          expirados.push(item);
        }
      }
    }
  });

  if (cambios) {
    saveMemory(memory);
  }

  return { cambios, expirados };
}

/**
 * Regla de Oro: Si un número sale premiado, liberarlo inmediatamente para todos los sorteos que vienen.
 * Retorna la lista de ítems liberados junto con los sorteos que aún estaban pendientes por jugar.
 */
function verificarYAutoLiberarPorGanador(loteriaId, numeroGanador, nombreGanador, sorteo, fecha) {
  const memory = loadMemory();
  const normTargetLotId = normalizeLotId(loteriaId);
  const normWinner = String(numeroGanador).padStart(2, '0');
  const winnerInt = parseInt(numeroGanador, 10);
  let liberados = [];

  memory.items.forEach(item => {
    if (normalizeLotId(item.loteriaId) === normTargetLotId && item.fechaOrigen === fecha && item.estado === 'ACTIVO') {
      const itemNumInt = parseInt(item.numero, 10);
      if (item.numero === normWinner || itemNumInt === winnerInt) {
        // Calcular los sorteos pre-bloqueados que aún no habían sido procesados
        const sorteosFuturosPendientes = (item.sorteosPrebloqueados || []).filter(
          s => s !== sorteo && !item.sorteosProcesados.includes(s)
        );

        item.estado = 'LIBERADO_POR_GANADOR';
        item.sorteosRestantes = 0;
        item.sorteoGanador = sorteo;
        item.sorteosFuturosPendientes = sorteosFuturosPendientes;
        item.fechaLiberacion = new Date().toISOString();
        liberados.push(item);
      }
    }
  });

  if (liberados.length > 0) {
    saveMemory(memory);
  }

  return liberados;
}

/**
 * Obtener estadísticas y resumen para la UI
 */
function getMemorySummary(fechaActual) {
  const memory = loadMemory();
  const hoy = fechaActual || new Date().toISOString().split('T')[0];
  const activos = memory.items.filter(i => i.fechaOrigen === hoy && i.estado === 'ACTIVO');
  const liberados = memory.items.filter(i => i.fechaOrigen === hoy && i.estado === 'LIBERADO_POR_GANADOR');
  const expirados = memory.items.filter(i => i.fechaOrigen === hoy && i.estado === 'EXPIRADO');

  return {
    totalActivos: activos.length,
    totalLiberadosPorGanador: liberados.length,
    totalExpirados: expirados.length,
    activos: activos.map(a => ({
      loteriaId: a.loteriaId,
      loteriaNombre: a.loteriaNombre,
      numero: a.numero,
      nombre: a.nombre,
      sorteoOrigen: a.sorteoOrigen,
      sorteosRestantes: a.sorteosRestantes,
      sorteosConfigurados: a.sorteosConfigurados,
      sorteosPrebloqueados: a.sorteosPrebloqueados || []
    })),
    liberados: liberados.map(l => ({
      loteriaId: l.loteriaId,
      numero: l.numero,
      nombre: l.nombre,
      sorteoGanador: l.sorteoGanador,
      sorteosLiberados: l.sorteosFuturosPendientes || []
    }))
  };
}

module.exports = {
  registrarAgotadosPremier,
  obtenerNumerosActivos,
  descontarSorteo,
  verificarYAutoLiberarPorGanador,
  obtenerSiguientesSorteos,
  getMemorySummary,
  loadMemory,
  saveMemory
};
