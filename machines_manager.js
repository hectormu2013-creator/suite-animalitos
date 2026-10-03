const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

/**
 * Plataformas soportadas (Premier 2.0 actual + Preparación para Premier Viejo y Maplay)
 */
const PLATAFORMAS_DISPONIBLES = [
  { id: 'PREMIER_PLUS_20', nombre: 'Premier Pluss 2.0 (PC Windows)', estado: 'ACTIVO' },
  { id: 'PREMIER_VIEJO', nombre: 'Premier Clásico / Viejo (Próximamente)', estado: 'EN_DESARROLLO' },
  { id: 'MAPLAY', nombre: 'Plataforma Maplay (Próximamente)', estado: 'EN_DESARROLLO' }
];

/**
 * Obtener lista completa de máquinas configuradas ordenadas por prioridad
 */
function getMachinesList(config) {
  const cfg = config || {};
  const maquinas = (cfg.general && cfg.general.maquinas) || [];

  if (maquinas.length === 0) {
    // Si no existen máquinas configuradas, inicializar con Máquina 1 (Primaria) y Máquina 2 (Secundaria)
    const premierDefault = (cfg.general && cfg.general.premierPluss) || {};
    return [
      {
        id: 'maquina_1',
        nombre: 'Máquina 1 (Primera Opción / Taquilla Principal)',
        activa: true,
        prioridad: 1,
        esEncargadaVerificaciones: true,
        tipoPlataforma: 'PREMIER_PLUS_20',
        usuarioPremier: 'TCOP101',
        clavePremier: '123',
        executablePath: premierDefault.executablePath || 'C:\\Program Files (x86)\\Premier Pluss 2.0\\PremierPlussPC20.exe',
        keepOpen: true,
        ipOUrl: 'http://192.168.1.100:4500',
        notas: 'Taquilla designada como primera opción de pesca'
      },
      {
        id: 'maquina_2',
        nombre: 'Máquina 2 (Segunda Opción / Taquilla Actual)',
        activa: true,
        prioridad: 2,
        esEncargadaVerificaciones: false,
        tipoPlataforma: 'PREMIER_PLUS_20',
        usuarioPremier: premierDefault.user || 'TCOP102',
        clavePremier: premierDefault.password || '123',
        executablePath: premierDefault.executablePath || 'C:\\Program Files (x86)\\Premier Pluss 2.0\\PremierPlussPC20.exe',
        keepOpen: true,
        ipOUrl: 'http://127.0.0.1:4500',
        notas: 'Taquilla de respaldo / failover en este equipo'
      }
    ];
  }

  // Ordenar por prioridad ascendente (1 es la primera opción)
  return maquinas.sort((a, b) => (a.prioridad || 99) - (b.prioridad || 99));
}

/**
 * Obtener la máquina local actual configurada para este equipo
 */
function getLocalMachine(config) {
  const list = getMachinesList(config);
  const localId = (config.general && config.general.maquinaLocalId) || 'maquina_2';
  return list.find(m => m.id === localId) || list[0] || null;
}

/**
 * Obtener la única máquina designada como encargada de verificaciones
 */
function getVerificationMachine(config) {
  const list = getMachinesList(config);
  const explicitId = config.general && config.general.maquinaEncargadaVerificacionesId;
  if (explicitId) {
    const found = list.find(m => m.id === explicitId);
    if (found) return found;
  }
  return list.find(m => m.esEncargadaVerificaciones) || list[0] || null;
}

/**
 * Comprobar si la computadora local es la encargada de ejecutar verificaciones en Visual-FX
 */
function isLocalMachineVerifier(config) {
  const local = getLocalMachine(config);
  const verifier = getVerificationMachine(config);
  if (!local || !verifier) return true; // Por defecto permitir si no está configurado
  return local.id === verifier.id;
}

/**
 * Designar una única máquina como encargada de verificaciones (regla estricta: sólo 1)
 */
function setVerifierMachine(config, targetMachineId) {
  if (!config.general) config.general = {};
  config.general.maquinaEncargadaVerificacionesId = targetMachineId;

  if (Array.isArray(config.general.maquinas)) {
    config.general.maquinas.forEach(m => {
      m.esEncargadaVerificaciones = (m.id === targetMachineId);
    });
  }
  return config;
}

/**
 * Establecer qué máquina del pool representa este equipo físico
 */
function setLocalMachineId(config, machineId) {
  if (!config.general) config.general = {};
  config.general.maquinaLocalId = machineId;

  // Sincronizar premierPluss legacy con las credenciales de la máquina local
  const list = getMachinesList(config);
  const target = list.find(m => m.id === machineId);
  if (target) {
    if (!config.general.premierPluss) config.general.premierPluss = {};
    config.general.premierPluss.user = target.usuarioPremier;
    config.general.premierPluss.password = target.clavePremier;
    config.general.premierPluss.executablePath = target.executablePath;
  }
  return config;
}

/**
 * Guardar o actualizar la lista de máquinas en la configuración
 */
function updateMachinesInConfig(config, newMachinesList) {
  if (!config.general) config.general = {};
  config.general.maquinas = newMachinesList;

  // Asegurar que exactamente una máquina sea la verificadora
  let verifierCount = newMachinesList.filter(m => m.esEncargadaVerificaciones).length;
  if (verifierCount !== 1) {
    // Si ninguna o más de una está marcada, asignar a la primera opción (prioridad 1)
    newMachinesList.forEach((m, idx) => {
      m.esEncargadaVerificaciones = (idx === 0);
    });
    config.general.maquinaEncargadaVerificacionesId = newMachinesList[0].id;
  } else {
    const v = newMachinesList.find(m => m.esEncargadaVerificaciones);
    if (v) config.general.maquinaEncargadaVerificacionesId = v.id;
  }

  // Sincronizar máquina local
  const local = getLocalMachine(config);
  if (local) {
    setLocalMachineId(config, local.id);
  }

  return config;
}

module.exports = {
  PLATAFORMAS_DISPONIBLES,
  getMachinesList,
  getLocalMachine,
  getVerificationMachine,
  isLocalMachineVerifier,
  setVerifierMachine,
  setLocalMachineId,
  updateMachinesInConfig
};
