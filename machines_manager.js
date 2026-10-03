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

const http = require('http');
const https = require('https');

/**
 * Ping rápido a un nodo remoto para comprobar si está en línea (timeout 3000ms)
 */
function pingNode(url) {
  return new Promise((resolve) => {
    try {
      if (!url || typeof url !== 'string') return resolve(false);
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(`${url.replace(/\/$/, '')}/api/tunnel/info`, { timeout: 3000 }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Solicitar ejecución remota de pesca a un nodo de la red
 */
function requestRemoteScan(url, loteriaId) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const postData = JSON.stringify({ loteriaId });

      const req = client.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: '/api/trigger-test',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 90000 // El sondeo completo puede tomar hasta 60s
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsedRes = JSON.parse(data);
            resolve(parsedRes);
          } catch (e) {
            reject(new Error(`Respuesta no válida del nodo remoto: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Tiempo de espera agotado al consultar nodo remoto (${url})`));
      });

      req.on('error', (err) => reject(err));
      req.write(postData);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * MOTOR DE CASCADA DE PESCA MULTI-MÁQUINAS:
 * 1. Intenta pescar con la máquina de Prioridad 1 (Principal).
 * 2. Si la máquina no está en línea o no puede acceder a la taquilla, pasa automáticamente a la Prioridad 2.
 * 3. Continúa sucesivamente con todas las máquinas activas habilitadas en el pool.
 * 4. Si todas las máquinas fallan, la protección WEB (Fijos, Visual-FX, Aleatorios y Memoria)
 *    permanece 100% activa para proteger la banca en Triple 7.
 */
async function ejecutarPescaEnCascada(config, loteriaId, logFn = console.log) {
  const list = getMachinesList(config)
    .filter(m => m.activa !== false)
    .sort((a, b) => (a.prioridad || 99) - (b.prioridad || 99));

  if (list.length === 0) {
    logFn('⚠️ [CASCADA PESCA] No hay máquinas activas configuradas para la pesca.', 'log-warn');
    return { sorteo: 'Próximo Sorteo', rojos: [], failoverAgotado: true };
  }

  const localId = (config.general && config.general.maquinaLocalId) || 'maquina_2';
  let intento = 0;

  for (const maquina of list) {
    intento++;
    const esLocal = (maquina.id === localId);
    logFn(`🎣 [CASCADA PESCA: INTENTO ${intento}/${list.length}] Evaluando ${maquina.nombre} (Prioridad ${maquina.prioridad || intento}, Modo: ${esLocal ? 'Local' : 'Remoto'})...`, 'log-info');

    if (esLocal) {
      // 1. Ejecutar en taquilla local en esta computadora
      try {
        const robot = require('./premier_robot');
        // Configurar credenciales específicas de esta máquina para el intento
        const tempConfig = JSON.parse(JSON.stringify(config));
        if (!tempConfig.general) tempConfig.general = {};
        tempConfig.general.premierPluss = {
          user: maquina.usuarioPremier,
          password: maquina.clavePremier,
          executablePath: maquina.executablePath,
          keepOpen: maquina.keepOpen !== false
        };

        const result = await robot.ejecutarSondeoPremier(tempConfig, loteriaId);
        if (result && !result.cancelado) {
          logFn(`✅ [PESCA EXITOSA] ${maquina.nombre} completó el sondeo en taquilla local. Cupo 0 detectados: [${(result.rojos || []).join(', ') || 'Ninguno'}]`, 'log-success');
          return {
            ...result,
            maquinaUsadaId: maquina.id,
            maquinaUsadaNombre: maquina.nombre,
            intentoCascada: intento,
            failoverActivado: intento > 1
          };
        } else {
          logFn(`⚠️ [FALLO EN TAQUILLA] ${maquina.nombre} no obtuvo resultado de taquilla. Pasando a la siguiente máquina...`, 'log-warn');
        }
      } catch (err) {
        logFn(`⚠️ [FALLO EN TAQUILLA] ${maquina.nombre} no pudo acceder a la taquilla: ${err.message}. Activando de inmediato la siguiente máquina de respaldo...`, 'log-warn');
      }
    } else {
      // 2. Ejecutar en nodo remoto
      const targetUrl = maquina.ipOUrl;
      if (!targetUrl) {
        logFn(`⚠️ [NODO SIN URL] ${maquina.nombre} no tiene IP/URL configurada. Saltando a la siguiente máquina...`, 'log-warn');
        continue;
      }

      const isOnline = await pingNode(targetUrl);
      if (!isOnline) {
        logFn(`⚠️ [NODO REMOTO OFFLINE] ${maquina.nombre} (${targetUrl}) no responde o está apagada. Saltando a la siguiente opción en cascada...`, 'log-warn');
        continue;
      }

      logFn(`📡 [DELEGANDO PESCA REMOTA] Nodo ${maquina.nombre} está EN LÍNEA. Disparando sondeo remoto en ${targetUrl}...`, 'log-info');
      try {
        const remoteRes = await requestRemoteScan(targetUrl, loteriaId);
        if (remoteRes && remoteRes.ok) {
          logFn(`✅ [PESCA REMOTA EXITOSA] ${maquina.nombre} completó el sondeo remotamente.`, 'log-success');
          return {
            ...(remoteRes.result || remoteRes),
            maquinaUsadaId: maquina.id,
            maquinaUsadaNombre: maquina.nombre,
            intentoCascada: intento,
            failoverActivado: intento > 1
          };
        } else {
          logFn(`⚠️ [NODO REMOTO FALLÓ] ${maquina.nombre} respondió con error: ${remoteRes ? remoteRes.message : 'Falla'}. Pasando a la siguiente máquina...`, 'log-warn');
        }
      } catch (remErr) {
        logFn(`⚠️ [ERROR NODO REMOTO] ${maquina.nombre}: ${remErr.message}. Pasando a la siguiente máquina...`, 'log-warn');
      }
    }
  }

  // 3. Si todas las máquinas del pool fallaron:
  logFn(`⚠️ [CASCADA DE PESCA AGOTADA] Ninguna máquina de pesca pudo consultar la taquilla en este sorteo. La protección WEB autónoma (Fijos, Visual-FX, Aleatorios y Memoria) continúa protegiendo la banca al 100% en Triple 7.`, 'log-warn');
  return {
    sorteo: 'Próximo Sorteo',
    rojos: [],
    fallaronTodasLasMaquinas: true,
    intentoCascada: intento
  };
}

module.exports = {
  PLATAFORMAS_DISPONIBLES,
  getMachinesList,
  getLocalMachine,
  getVerificationMachine,
  isLocalMachineVerifier,
  setVerifierMachine,
  setLocalMachineId,
  updateMachinesInConfig,
  pingNode,
  requestRemoteScan,
  ejecutarPescaEnCascada
};
