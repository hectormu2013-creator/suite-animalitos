const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn, exec } = require('child_process');
const machinesMgr = require('./machines_manager');

const app = express();
const PORT = process.env.PORT || 4500;
const CONFIG_PATH = path.join(__dirname, 'config.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Estado en memoria
let logsQueue = [];
let executionHistory = [];

function log(msg, level = 'log-info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { time: timestamp, msg, level };
  console.log(`[${level.toUpperCase()}] ${msg}`);
  logsQueue.push(entry);
  if (logsQueue.length > 100) logsQueue.shift();
}

// Cargar Configuración (Memoria / Disco / Nube Supabase)
function getConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    log(`Error leyendo config.json: ${e.message}`, 'log-danger');
    return null;
  }
}

// Guardar Configuración (Disco Local y Nube Supabase)
function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
    // Persistencia instantánea en Supabase para que la versión Web nunca se reinicie
    try {
      const cloudStore = require('./cloud_store');
      cloudStore.saveMasterConfig(cfg).catch(() => {});
    } catch (e) {}
    return true;
  } catch (e) {
    log(`Error guardando config.json: ${e.message}`, 'log-danger');
    return false;
  }
}

const IS_CLOUD = !!(process.env.RENDER || process.env.IS_RENDER);
// Token compartido para que solo la Web (Render) pueda empujar configuración a los nodos locales
const SYNC_TOKEN = process.env.SUITE_SYNC_TOKEN || 'fenix-suite-sync-2026';

// Escribe en disco una configuración recibida de la nube SIN reenviarla a Supabase (evita bucles)
// y conservando la identidad propia de este equipo (maquinaLocalId).
function adoptCloudConfigLocally(cloudCfg) {
  const localCfg = getConfig();
  const merged = JSON.parse(JSON.stringify(cloudCfg));
  if (localCfg && localCfg.general && localCfg.general.maquinaLocalId) {
    if (!merged.general) merged.general = {};
    merged.general.maquinaLocalId = localCfg.general.maquinaLocalId;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return { localCfg, merged };
}

// En Render el disco es efímero: antes de modificar y re-guardar la config partimos de la copia
// maestra en Supabase, para no pisar ajustes hechos desde la Web con una copia vieja del disco.
async function getConfigFresh() {
  if (IS_CLOUD) {
    try {
      const cloudRes = await require('./cloud_store').getMasterConfig();
      if (cloudRes && cloudRes.config) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cloudRes.config, null, 2), 'utf8');
        return cloudRes.config;
      }
    } catch (e) {}
  }
  return getConfig();
}

// Cargar persistencia maestra de Supabase al arrancar (Configuración, Historial y Memoria)
(async function initCloudConfigOnStartup() {
  try {
    const cloudStore = require('./cloud_store');
    const cloudRes = await cloudStore.getMasterConfig();
    if (cloudRes && cloudRes.config) {
      if (IS_CLOUD || !getConfig()) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cloudRes.config, null, 2), 'utf8');
        log(`☁️ [CONFIG MAESTRA NUBE] Configuración restaurada con éxito desde Supabase (Web Master).`, 'log-success');
      } else {
        // Nodo local: ponerse al día solo si hubo cambios en la Web mientras este equipo estaba apagado
        const localMtime = fs.statSync(CONFIG_PATH).mtime;
        if (cloudRes.updatedAt && new Date(cloudRes.updatedAt) > localMtime) {
          adoptCloudConfigLocally(cloudRes.config);
          log(`🌐 [ARRANQUE] Ajustes pendientes de la Web aplicados en este equipo.`, 'log-success');
        }
      }
    }

    // Hidratar historial y memoria en Render o si están vacíos
    if (IS_CLOUD || !fs.existsSync(path.join(__dirname, 'history_db.json'))) {
      const histRes = await cloudStore.getMasterHistory();
      if (histRes && Array.isArray(histRes.records) && histRes.records.length > 0) {
        const historyMgr = require('./history_manager');
        fs.writeFileSync(historyMgr.DB_PATH, JSON.stringify(histRes.records, null, 2), 'utf8');
        historyMgr.rewriteCSV(histRes.records);
        log(`☁️ [HISTORIAL MAESTRO NUBE] ${histRes.records.length} registros restaurados desde Supabase.`, 'log-success');
      }
    }

    if (IS_CLOUD || !fs.existsSync(path.join(__dirname, 'memoria_cupo_cero.json'))) {
      const memRes = await cloudStore.getMasterMemory();
      if (memRes && memRes.memory) {
        const cupoMem = require('./cupo_cero_memory');
        cupoMem.saveMemory(memRes.memory);
        log(`☁️ [MEMORIA MAESTRA NUBE] Memoria de persistencia restaurada desde Supabase.`, 'log-success');
      }
    }
  } catch (e) {
    console.warn(`[STARTUP CLOUD SYNC] Error: ${e.message}`);
  }
})();

// Render -> Nodos: empujar la configuración guardada a cada equipo vía su túnel
async function pushConfigToMachines(cfg) {
  if (!IS_CLOUD) return [];
  const maquinas = (cfg && cfg.general && Array.isArray(cfg.general.maquinas)) ? cfg.general.maquinas : [];
  const destinos = maquinas.filter(m =>
    m.activa !== false &&
    typeof m.ipOUrl === 'string' &&
    /^https:\/\//i.test(m.ipOUrl) // solo túneles públicos; IPs LAN/localhost no son alcanzables desde Render
  );

  return Promise.all(destinos.map(async (m) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(`${m.ipOUrl.replace(/\/$/, '')}/api/config/push-from-cloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-suite-sync-token': SYNC_TOKEN },
        body: JSON.stringify(cfg),
        signal: controller.signal
      });
      const ok = r.ok;
      log(`${ok ? '📤' : '⚠️'} [PUSH CONFIG] ${m.nombre || m.id}: ${ok ? 'actualizado' : 'HTTP ' + r.status}`, ok ? 'log-success' : 'log-warn');
      return { id: m.id, nombre: m.nombre, ok, status: r.status };
    } catch (e) {
      log(`⚠️ [PUSH CONFIG] ${m.nombre || m.id} no respondió (${e.name === 'AbortError' ? 'timeout' : e.message}). Se pondrá al día al reiniciar.`, 'log-warn');
      return { id: m.id, nombre: m.nombre, ok: false, error: e.message };
    } finally {
      clearTimeout(timer);
    }
  }));
}

// Nodo local: recibir configuración empujada desde la Web (Render)
app.post('/api/config/push-from-cloud', async (req, res) => {
  if (IS_CLOUD) return res.status(400).json({ ok: false, message: 'Endpoint exclusivo de nodos locales' });
  if (req.get('x-suite-sync-token') !== SYNC_TOKEN) {
    return res.status(401).json({ ok: false, message: 'Token de sincronización inválido' });
  }
  const cloudCfg = req.body;
  if (!cloudCfg || typeof cloudCfg !== 'object' || !Array.isArray(cloudCfg.loterias)) {
    return res.status(400).json({ ok: false, message: 'Configuración inválida' });
  }
  try {
    const { localCfg, merged } = adoptCloudConfigLocally(cloudCfg);
    log(`🌐 [PUSH DESDE WEB] Nueva configuración recibida desde OnRender y aplicada en este equipo.`, 'log-success');

    // La tarea programada de Windows solo puede actualizarse aquí (en Render no existe)
    const gNew = merged.general || {};
    const gOld = (localCfg && localCfg.general) || {};
    if (gNew.horaActivacionDiaria !== undefined &&
        (gNew.horaActivacionDiaria !== gOld.horaActivacionDiaria || gNew.activacionDiariaActiva !== gOld.activacionDiariaActiva)) {
      syncScheduledTask(gNew.horaActivacionDiaria, gNew.activacionDiariaActiva !== false).then(t => {
        if (t && t.ok) log(`⏰ [TAREA PROGRAMADA] ${t.message}`, 'log-info');
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

const { execFile } = require('child_process');

// Helper para sincronizar la tarea programada de Windows
function syncScheduledTask(hora, activo = true) {
  return new Promise((resolve) => {
    const psScript = path.join(__dirname, 'update_task_time.ps1');
    execFile('powershell', ['-ExecutionPolicy', 'Bypass', '-File', psScript, '-Hora', hora || '07:00', '-Activo', activo ? 'true' : 'false'], (err, stdout, stderr) => {
      if (err) {
        log(`Aviso al sincronizar tarea de Windows: ${err.message}`, 'log-warn');
        return resolve({ ok: false, message: err.message });
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        resolve({ ok: true, raw: stdout });
      }
    });
  });
}

// API: Obtener Config
app.get('/api/config', async (req, res) => {
  let cfg = getConfig();
  // En Render, si la memoria local está vacía o el cliente solicita versión fresca, consultar Supabase
  if ((process.env.RENDER || process.env.IS_RENDER || !cfg)) {
    try {
      const cloudStore = require('./cloud_store');
      const cloudRes = await cloudStore.getMasterConfig();
      if (cloudRes && cloudRes.config) {
        cfg = cloudRes.config;
      }
    } catch (e) {}
  }
  if (cfg && cfg.general) {
    cfg.general.maquinas = machinesMgr.getMachinesList(cfg);
    if (!cfg.general.maquinaLocalId) cfg.general.maquinaLocalId = 'maquina_2';
    if (!cfg.general.maquinaEncargadaVerificacionesId) cfg.general.maquinaEncargadaVerificacionesId = 'maquina_1';
  }
  res.json(cfg || {});
});

// API: Guardar Config (La Web es la Instancia Principal)
app.post('/api/config', async (req, res) => {
  const newCfg = req.body;
  if (newCfg && newCfg.general && Array.isArray(newCfg.general.maquinas)) {
    machinesMgr.updateMachinesInConfig(newCfg, newCfg.general.maquinas);
    if (newCfg.general.maquinaEncargadaVerificacionesId) {
      machinesMgr.setVerifierMachine(newCfg, newCfg.general.maquinaEncargadaVerificacionesId);
    }
    if (newCfg.general.maquinaLocalId) {
      machinesMgr.setLocalMachineId(newCfg, newCfg.general.maquinaLocalId);
    }
  }

  const success = saveConfig(newCfg);
  if (success) {
    log('Configuración actualizada y guardada con éxito (Persistencia Web en Nube activa).', 'log-success');

    // Sincronizar tarea de Windows si viene en general
    if (newCfg.general && newCfg.general.horaActivacionDiaria !== undefined) {
      const taskRes = await syncScheduledTask(
        newCfg.general.horaActivacionDiaria,
        newCfg.general.activacionDiariaActiva !== false
      );
      if (taskRes.ok) {
        log(`⏰ [TAREA PROGRAMADA] ${taskRes.message}`, 'log-info');
      }
    }

    // Desde la Web: notificar de inmediato a las computadoras con la automatización instalada
    const pushResults = await pushConfigToMachines(newCfg);

    res.json({ ok: true, message: 'Guardado correctamente en la nube y persistencia', pushResults });
  } else {
    res.status(500).json({ ok: false, message: 'Error al guardar archivo config.json' });
  }
});

// API: Obtener información de la Tarea Programada de Windows
app.get('/api/schedule/info', (req, res) => {
  const cfg = getConfig() || {};
  const hora = (cfg.general && cfg.general.horaActivacionDiaria) || '07:00';
  const activo = (cfg.general && cfg.general.activacionDiariaActiva !== false);

  execFile('powershell', ['-Command', `
    $task = Get-ScheduledTask -TaskName "Suite_Bloqueador_Animalitos_7AM" -ErrorAction SilentlyContinue
    $info = Get-ScheduledTaskInfo -TaskName "Suite_Bloqueador_Animalitos_7AM" -ErrorAction SilentlyContinue
    if ($task) {
      @{
        exists = $true
        state = $task.State.ToString()
        nextRun = if ($info) { $info.NextRunTime.ToString() } else { "No disponible" }
      } | ConvertTo-Json
    } else {
      @{ exists = $false } | ConvertTo-Json
    }
  `], (err, stdout) => {
    let taskData = { exists: false };
    try {
      taskData = JSON.parse(stdout);
    } catch (e) {}

    res.json({
      ok: true,
      hora,
      activo,
      task: taskData
    });
  });
});

// API: Actualizar Tarea Programada directamente
app.post('/api/schedule/update', async (req, res) => {
  const { hora, activo } = req.body;
  const cfg = getConfig();
  if (cfg) {
    if (!cfg.general) cfg.general = {};
    if (hora) cfg.general.horaActivacionDiaria = hora;
    if (activo !== undefined) cfg.general.activacionDiariaActiva = !!activo;
    saveConfig(cfg);
  }

  const result = await syncScheduledTask(hora, activo !== false);
  if (result.ok) {
    log(`⏰ [TAREA PROGRAMADA ACTUALIZADA] ${result.message}`, 'log-success');
  }
  res.json(result);
});

// --- API: RED DE MÁQUINAS PARA PESCA Y VERIFICACIONES (MULTI-NODOS) ---

// API: Listar Máquinas y Plataformas Disponibles
app.get('/api/nodes/list', (req, res) => {
  const cfg = getConfig() || {};
  const maquinas = machinesMgr.getMachinesList(cfg);
  const local = machinesMgr.getLocalMachine(cfg);
  const verifier = machinesMgr.getVerificationMachine(cfg);
  const isVerifier = machinesMgr.isLocalMachineVerifier(cfg);

  res.json({
    ok: true,
    plataformasDisponibles: machinesMgr.PLATAFORMAS_DISPONIBLES,
    maquinaLocalId: (local && local.id) || (cfg.general && cfg.general.maquinaLocalId) || 'maquina_2',
    maquinaEncargadaVerificacionesId: (verifier && verifier.id) || (cfg.general && cfg.general.maquinaEncargadaVerificacionesId) || 'maquina_1',
    esEstaMaquinaVerificadora: isVerifier,
    maquinas
  });
});

// API: Guardar Configuración de Toda la Red de Máquinas
app.post('/api/nodes/save', (req, res) => {
  const cfg = getConfig();
  if (!cfg) return res.status(500).json({ ok: false, message: 'No se pudo leer la configuración' });

  const { maquinas, maquinaLocalId, maquinaEncargadaVerificacionesId } = req.body;
  if (!Array.isArray(maquinas) || maquinas.length === 0) {
    return res.status(400).json({ ok: false, message: 'La lista de máquinas no puede estar vacía' });
  }

  if (maquinaLocalId) cfg.general.maquinaLocalId = maquinaLocalId;
  if (maquinaEncargadaVerificacionesId) cfg.general.maquinaEncargadaVerificacionesId = maquinaEncargadaVerificacionesId;

  machinesMgr.updateMachinesInConfig(cfg, maquinas);
  if (maquinaEncargadaVerificacionesId) {
    machinesMgr.setVerifierMachine(cfg, maquinaEncargadaVerificacionesId);
  }
  if (maquinaLocalId) {
    machinesMgr.setLocalMachineId(cfg, maquinaLocalId);
  }

  const saved = saveConfig(cfg);
  if (saved) {
    log(`🖥️ [MULTI-MÁQUINAS] Red de ${maquinas.length} máquinas guardada. Local: ${cfg.general.maquinaLocalId}, Verificadora: ${cfg.general.maquinaEncargadaVerificacionesId}`, 'log-success');
    res.json({
      ok: true,
      message: 'Red de máquinas guardada exitosamente',
      maquinas: machinesMgr.getMachinesList(cfg),
      maquinaLocalId: cfg.general.maquinaLocalId,
      maquinaEncargadaVerificacionesId: cfg.general.maquinaEncargadaVerificacionesId
    });
  } else {
    res.status(500).json({ ok: false, message: 'Error al guardar archivo config.json' });
  }
});

// API: Designar la ÚNICA Máquina Verificadora Oficial
app.post('/api/nodes/set-verifier', (req, res) => {
  const cfg = getConfig();
  if (!cfg) return res.status(500).json({ ok: false, message: 'No se pudo leer config' });
  const { machineId } = req.body;
  if (!machineId) return res.status(400).json({ ok: false, message: 'Falta machineId' });

  machinesMgr.setVerifierMachine(cfg, machineId);
  saveConfig(cfg);
  log(`👑 [VERIFICADOR OFICIAL] Asignado rol único de verificaciones a máquina ID: ${machineId}`, 'log-success');
  res.json({ ok: true, message: `Máquina ${machineId} asignada como única verificadora oficial`, verifierId: machineId });
});

// API: Configurar la Identidad Local de este Equipo
app.post('/api/nodes/set-current', (req, res) => {
  const cfg = getConfig();
  if (!cfg) return res.status(500).json({ ok: false, message: 'No se pudo leer config' });
  const { machineId } = req.body;
  if (!machineId) return res.status(400).json({ ok: false, message: 'Falta machineId' });

  machinesMgr.setLocalMachineId(cfg, machineId);
  saveConfig(cfg);
  log(`💻 [MÁQUINA LOCAL] Este equipo físico ahora opera como nodo ID: ${machineId}`, 'log-info');
  res.json({ ok: true, message: `Este equipo configurado como ${machineId}`, localId: machineId });
});

// API: Recepción de Reportes Remotos de Pesca de otros Nodos
app.post('/api/nodes/report-scan', async (req, res) => {
  const { machineId, loteriaId, loteriaNombre, sorteo, rojosPremier } = req.body;
  log(`📡 [REPORTE REMOTO DE PESCA] Recibido desde nodo ${machineId || 'remoto'} para ${loteriaNombre || loteriaId} (${sorteo}): Agotados: [${(rojosPremier || []).join(', ')}]`, 'log-info');
  res.json({ ok: true, message: 'Reporte de pesca procesado' });
});

// --- GESTIÓN DE TÚNEL CLOUDFLARE PARA ACCESO REMOTO (MÓVIL / CUALQUIER LUGAR) ---
let currentTunnelUrl = null;
let tunnelProcess = null;

function startCloudflareTunnel() {
  if (process.env.RENDER) return; // En la nube (Render) no se ejecuta cloudflared local
  const exePath = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(exePath)) return;

  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch (e) {}
  }

  log('🌐 [TÚNEL REMOTO] Conectando con red segura de Cloudflare...', 'log-info');
  try {
    tunnelProcess = spawn(exePath, ['tunnel', '--url', 'http://127.0.0.1:4500'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;
    const handleOutput = (data) => {
      const text = data.toString();
      const match = text.match(urlRegex);
      if (match && match[0]) {
        currentTunnelUrl = match[0];
        try {
          fs.writeFileSync(path.join(__dirname, 'tunnel_url.txt'), currentTunnelUrl, 'utf8');
        } catch (e) {}
        // Reportar enlace de túnel a la nube (Render) para que esté visible en todo momento
        if (!process.env.RENDER) {
          try {
            const https = require('https');
            const cfg = getConfig();
            const localId = (cfg && cfg.general && cfg.general.maquinaLocalId) || 'maquina_1';
            const payload = JSON.stringify({
              machineId: localId,
              tunnelUrl: currentTunnelUrl,
              nombre: localId === 'maquina_1' ? 'Nodo Taquilla Dedicado (Producción)' : 'Taquilla Local (Hector)'
            });
            const rReq = https.request({
              hostname: 'suite-animalitos.onrender.com',
              port: 443,
              path: '/api/machines/report-tunnel',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              },
              timeout: 5000
            }, () => {});
            rReq.on('error', () => {});
            rReq.write(payload);
            rReq.end();
          } catch (e) {}
        }
        log(`🌐 [TÚNEL REMOTO ACTIVO] Enlace público seguro: ${currentTunnelUrl}`, 'log-success');
      }
    };

    tunnelProcess.stderr.on('data', handleOutput);
    tunnelProcess.stdout.on('data', handleOutput);

    tunnelProcess.on('exit', (code) => {
      log(`🌐 [TÚNEL REMOTO] Desconectado (código ${code}). Reintentando en 15s...`, 'log-warn');
      currentTunnelUrl = null;
      setTimeout(() => {
        if (!process.env.RENDER) startCloudflareTunnel();
      }, 15000);
    });
  } catch (err) {
    log(`⚠️ Error iniciando Cloudflare Tunnel: ${err.message}`, 'log-warn');
  }
}

app.get('/api/tunnel/info', (req, res) => {
  res.json({
    ok: true,
    active: !!currentTunnelUrl,
    url: currentTunnelUrl
  });
});

app.post('/api/tunnel/restart', (req, res) => {
  startCloudflareTunnel();
  res.json({ ok: true, message: 'Reiniciando túnel seguro...' });
});

// Helper de sincronización instantánea hacia Render
function syncToCloudImmediate(resetAll = false) {
  if (process.env.RENDER || process.env.IS_RENDER) return;
  try {
    const historyMgr = require('./history_manager');
    const cupoMem = require('./cupo_cero_memory');
    const cfg = getConfig();
    // Enviar siempre todo el historial persistente para garantizar sincronización 100% libre de desfases de zona horaria (UTC vs Local)
    const records = historyMgr.getHistory();
    const memory = cupoMem.loadMemory();
    const localId = (cfg && cfg.general && cfg.general.maquinaLocalId) || 'maquina_2';

    const payload = JSON.stringify({
      records,
      memory,
      resetAll,
      machineId: localId,
      tunnelUrl: currentTunnelUrl,
      machineName: 'Nodo Taquilla (Hector Local)'
    });

    const https = require('https');
    const syncReq = https.request({
      hostname: 'suite-animalitos.onrender.com',
      port: 443,
      path: '/api/sync/receive-history',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // La configuración ya no viaja de vuelta en esta respuesta: Render la empuja
        // directamente al nodo cuando se guarda en la Web (/api/config/push-from-cloud).
        if (res.statusCode !== 200) {
          console.warn(`[SYNC NUBE] HTTP ${res.statusCode}: ${res.statusMessage} - ${data.slice(0, 100)}`);
        }
      });
    });
    syncReq.on('error', () => {});
    syncReq.on('timeout', () => syncReq.destroy());
    syncReq.write(payload);
    syncReq.end();

    // Guardar también en Supabase para persistencia perpetua
    try {
      const cloudStore = require('./cloud_store');
      cloudStore.saveMasterHistory(records);
    } catch (e) {}
  } catch (e) {
    console.error(`[SYNC NUBE ERROR] ${e.message}`);
  }
}

// --- API: INSTALADOR REMOTO Y REPORTE DE TÚNELES DE NODOS ---
app.get('/api/installer/bootstrap.ps1', (req, res) => {
  const scriptPath = path.join(__dirname, 'scripts', 'bootstrap_node_installer.ps1');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    fs.createReadStream(scriptPath).pipe(res);
  } else {
    res.status(404).send('# Instalador no encontrado');
  }
});

app.get('/api/installer/download-bat', (req, res) => {
  const batPath = path.join(__dirname, 'INSTALAR_NODO_AUTONOMO.bat');
  if (fs.existsSync(batPath)) {
    res.setHeader('Content-Type', 'application/x-bat');
    res.setHeader('Content-Disposition', 'attachment; filename="INSTALAR_NODO_AUTONOMO.bat"');
    fs.createReadStream(batPath).pipe(res);
  } else {
    res.status(404).send('Archivo no encontrado');
  }
});

// API: Actualización Remota 1-Click desde GitHub
app.post('/api/system/update', (req, res) => {
  log('🔄 [ACTUALIZACIÓN SOLICITADA] Descargando última versión oficial desde GitHub...', 'log-warn');
  const batPath = path.join(__dirname, 'ACTUALIZAR_DESDE_GITHUB.bat');
  if (!fs.existsSync(batPath)) {
    return res.status(404).json({ ok: false, message: 'Script actualizador no encontrado' });
  }
  try {
    const child = spawn('cmd.exe', ['/c', batPath], { cwd: __dirname, detached: true, stdio: 'ignore' });
    child.unref();
    res.json({ ok: true, message: 'Actualización iniciada. La Suite se descargará y actualizará en segundos.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: `Error al iniciar actualizador: ${err.message}` });
  }
});

app.post('/api/machines/report-tunnel', async (req, res) => {
  const { machineId, tunnelUrl, nombre } = req.body;
  if (!machineId || !tunnelUrl) {
    return res.status(400).json({ ok: false, message: 'Faltan machineId o tunnelUrl' });
  }
  const cfg = await getConfigFresh();
  if (cfg && cfg.general) {
    if (!Array.isArray(cfg.general.maquinas)) cfg.general.maquinas = [];
    let m = cfg.general.maquinas.find(x => x.id === machineId);
    if (!m) {
      m = {
        id: machineId,
        nombre: nombre || 'Nodo Remoto (Producción)',
        activa: true,
        prioridad: 1,
        esEncargadaVerificaciones: false,
        tipoPlataforma: 'PREMIER_PLUS_20',
        usuarioPremier: 'TCOP101',
        clavePremier: '123',
        executablePath: 'C:\\Program Files (x86)\\Premier Pluss 2.0\\PremierPlussPC20.exe',
        keepOpen: true,
        ipOUrl: tunnelUrl,
        notas: 'Registrado automáticamente vía túnel Cloudflare'
      };
      cfg.general.maquinas.push(m);
    } else {
      m.ipOUrl = tunnelUrl;
      m.activa = true;
      m.notas = `Túnel en vivo: ${new Date().toLocaleTimeString()}`;
    }
    saveConfig(cfg);
    log(`🌐 [NODO CONECTADO VÍA TÚNEL] ${m.nombre} conectado en: ${tunnelUrl}`, 'log-success');
  }
  res.json({ ok: true, message: 'Túnel registrado con éxito' });
});

let lastFxSyncTime = 0;

// API: Estado y Logs
app.get('/api/status', async (req, res) => {
  const historyMgr = require('./history_manager');
  const cfg = getConfig() || {};
  const isVerifier = machinesMgr.isLocalMachineVerifier(cfg);

  // Sincronizar automáticamente resultados oficiales de Visual-FX en segundo plano
  // REGLA ESTRICTA: Sólo la máquina designada como verificadora oficial consulta Visual-FX
  if (isVerifier && (Date.now() - lastFxSyncTime > 30000)) {
    lastFxSyncTime = Date.now();
    historyMgr.syncResultsWithVisualFx().then(syncRes => {
      if (syncRes && syncRes.updatedCount > 0) {
        syncToCloudImmediate(false);
      }
    }).catch(() => {});
  }

  let persistentHistory = historyMgr.getHistory();
  if (persistentHistory.length === 0 && (IS_CLOUD || process.env.RENDER)) {
    try {
      const cloudStore = require('./cloud_store');
      const cloudHist = await cloudStore.getMasterHistory();
      if (cloudHist && Array.isArray(cloudHist.records) && cloudHist.records.length > 0) {
        fs.writeFileSync(historyMgr.DB_PATH, JSON.stringify(cloudHist.records, null, 2), 'utf8');
        historyMgr.rewriteCSV(cloudHist.records);
        persistentHistory = cloudHist.records;
      }
    } catch (e) {}
  }

  const logsToSend = [...logsQueue];
  logsQueue = []; // Vaciar buffer para polling
  res.json({
    ok: true,
    history: persistentHistory.length > 0 ? persistentHistory : executionHistory,
    logs: logsToSend,
    nodeInfo: {
      maquinaLocalId: (cfg.general && cfg.general.maquinaLocalId) || 'maquina_2',
      maquinaEncargadaVerificacionesId: (cfg.general && cfg.general.maquinaEncargadaVerificacionesId) || 'maquina_1',
      esVerificadora: isVerifier
    }
  });
});

// API: Consulta Histórica Filtrada
app.get('/api/history', (req, res) => {
  const historyMgr = require('./history_manager');
  const { loteria, fecha } = req.query;
  const records = historyMgr.getHistory({ loteria, fecha });
  res.json({ ok: true, count: records.length, records });
});

// API: Descargar Reporte Histórico en Excel CSV
app.get('/api/history/export-csv', (req, res) => {
  const historyMgr = require('./history_manager');
  if (fs.existsSync(historyMgr.CSV_PATH)) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reportes_agotados_premier.csv"');
    fs.createReadStream(historyMgr.CSV_PATH).pipe(res);
  } else {
    res.status(404).send('Aún no existen reportes históricos generados.');
  }
});

// --- API: MEMORIA DE CUPO CERO PREMIER (Persistencia y Arrastre de Agotados) ---
app.get('/api/memory/status', (req, res) => {
  const cupoMem = require('./cupo_cero_memory');
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
  const summary = cupoMem.getMemorySummary(fecha);
  res.json({ ok: true, fecha, summary });
});

app.post('/api/memory/clear', (req, res) => {
  const cupoMem = require('./cupo_cero_memory');
  cupoMem.saveMemory({ items: [] });
  log('🧹 [MEMORIA CUPO CERO] Memoria de persistencia reiniciada por el usuario.', 'log-warn');
  res.json({ ok: true, message: 'Memoria de cupo cero reseteada con éxito' });
});

app.post('/api/memory/release-animal', async (req, res) => {
  const { loteriaId, numero, reincorporarTriple7 } = req.body;
  if (!loteriaId || !numero) {
    return res.status(400).json({ ok: false, message: 'Falta loteriaId o número' });
  }

  const cupoMem = require('./cupo_cero_memory');
  const todayStr = new Date().toISOString().slice(0, 10);
  const memory = cupoMem.loadMemory();
  const norm = String(numero).padStart(2, '0');
  let encontrado = false;
  let sorteosLiberados = [];

  memory.items.forEach(item => {
    if (item.loteriaId === loteriaId && item.numero === norm && item.estado === 'ACTIVO') {
      item.estado = 'LIBERADO_MANUAL';
      item.sorteosRestantes = 0;
      sorteosLiberados = item.sorteosPrebloqueados || [];
      encontrado = true;
    }
  });

  if (encontrado) {
    cupoMem.saveMemory(memory);
    log(`🔓 [MEMORIA CUPO CERO] Número ${norm} liberado manualmente para ${loteriaId}.`, 'log-info');

    if (reincorporarTriple7 && sorteosLiberados.length > 0) {
      const cfg = getConfig();
      const t7 = require('./triple7_robot');
      const lot = (cfg.loterias || []).find(l => l.id === loteriaId);
      const lotNombre = lot ? lot.nombre : loteriaId;

      for (const sHora of sorteosLiberados) {
        try {
          await t7.reincorporarAnimalitos(cfg, lotNombre, sHora);
          log(`🔓 [TRIPLE 7 LIBERACIÓN MANUAL] Reincorporado ${lotNombre} (${sHora})`, 'log-success');
        } catch (e) {}
      }
    }

    res.json({ ok: true, message: `Número ${norm} liberado de la persistencia`, sorteosLiberados });
  } else {
    res.json({ ok: false, message: `El número ${norm} no estaba activo en memoria para hoy` });
  }
});

// --- API: SINCRONIZACIÓN EN TIEMPO REAL NUBE (LOCAL <-> RENDER) ---
app.post('/api/sync/receive-history', async (req, res) => {
  try {
    const { records, memory, resetAll, machineId, tunnelUrl, machineName } = req.body;
    const historyMgr = require('./history_manager');
    const cupoMem = require('./cupo_cero_memory');

    if (resetAll && Array.isArray(records)) {
      const cleanRecords = records.filter(r => !r.t7Status || !r.t7Status.includes('Playwright no está'));
      fs.writeFileSync(historyMgr.DB_PATH, JSON.stringify(cleanRecords, null, 2), 'utf8');
      historyMgr.rewriteCSV(cleanRecords);
    } else if (Array.isArray(records)) {
      let currentDb = [];
      try {
        if (fs.existsSync(historyMgr.DB_PATH)) {
          currentDb = JSON.parse(fs.readFileSync(historyMgr.DB_PATH, 'utf8'));
        }
      } catch (e) { currentDb = []; }

      // Eliminar registros fantasmas generados accidentalmente en Render por Playwright ausente
      currentDb = currentDb.filter(r => !r.t7Status || !r.t7Status.includes('Playwright no está'));

      for (const rec of records) {
        if (rec.t7Status && rec.t7Status.includes('Playwright no está')) continue;
        const recSorteo = rec.sorteo || rec.horaSorteo;
        const idx = currentDb.findIndex(existing => {
          const exSorteo = existing.sorteo || existing.horaSorteo;
          return existing.id === rec.id || (existing.fecha === rec.fecha && existing.loteria === rec.loteria && exSorteo === recSorteo);
        });
        if (idx >= 0) {
          currentDb[idx] = rec;
        } else {
          currentDb.push(rec);
        }
      }

      currentDb.sort((a, b) => (new Date(a.timestamp || 0).getTime()) - (new Date(b.timestamp || 0).getTime()));
      fs.writeFileSync(historyMgr.DB_PATH, JSON.stringify(currentDb, null, 2), 'utf8');
      historyMgr.rewriteCSV(currentDb);
    }

    if (memory) {
      cupoMem.saveMemory(memory);
    }

    if (machineId && tunnelUrl) {
      const cfg = await getConfigFresh();
      if (cfg && cfg.general) {
        if (!Array.isArray(cfg.general.maquinas)) cfg.general.maquinas = [];
        let m = cfg.general.maquinas.find(x => x.id === machineId);
        let mustSave = false;
        if (m) {
          // Solo re-guardar si cambió el túnel o la última conexión registrada tiene más de 5 min
          const lastSeen = m.ultimaConexion ? new Date(m.ultimaConexion).getTime() : 0;
          mustSave = m.ipOUrl !== tunnelUrl || m.activa === false || (Date.now() - lastSeen) > 5 * 60 * 1000;
          m.ipOUrl = tunnelUrl;
          m.activa = true;
          m.ultimaConexion = new Date().toISOString();
        } else {
          mustSave = true;
          cfg.general.maquinas.push({
            id: machineId,
            nombre: machineName || 'Nodo Taquilla Dedicado (Producción)',
            activa: true,
            prioridad: 1,
            esEncargadaVerificaciones: false,
            tipoPlataforma: 'PREMIER_PLUS_20',
            usuarioPremier: 'TCOP101',
            clavePremier: '123',
            executablePath: 'C:\\Program Files (x86)\\Premier Pluss 2.0\\PremierPlussPC20.exe',
            keepOpen: true,
            ipOUrl: tunnelUrl,
            notas: 'Auto-registrado vía túnel Cloudflare',
            ultimaConexion: new Date().toISOString()
          });
        }
        if (mustSave) saveConfig(cfg);
      }
    }

    log(`☁️ [SYNC NUBE] Recibidos y sincronizados ${Array.isArray(records) ? records.length : 0} registros desde el nodo local.`, 'log-success');
    // Nota: el respaldo del historial en Supabase lo hace el nodo local en syncToCloudImmediate().

    res.json({ ok: true, count: Array.isArray(records) ? records.length : 0 });
  } catch (err) {
    log(`⚠️ Error en sync nube: ${err.message}`, 'log-danger');
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Endpoint para forzar sincronización hacia Render desde el nodo local
app.post('/api/sync/push-now', (req, res) => {
  const resetAll = req.body && req.body.resetAll === true;
  syncToCloudImmediate(resetAll);
  res.json({ ok: true, message: 'Sincronización manual forzada a Render en ejecución' });
});

// API: Consulta de Animales Más Atrasados (Predictivo Visual-FX)
app.get('/api/predictive/delayed', (req, res) => {
  const predictive = require('./predictive_service');
  const loteriaId = req.query.loteriaId || 'la_granjita';
  const limit = parseInt(req.query.limit, 10) || 5;
  const delayed = predictive.getMostDelayedNumbers(loteriaId, limit);
  res.json({ ok: true, loteriaId, count: delayed.length, delayed });
});

// API: Estadísticas de Trofeos (Golpes de Banca Evitados)
app.get('/api/trophies/stats', (req, res) => {
  const historyMgr = require('./history_manager');
  const stats = historyMgr.getTrophyStats();
  res.json({ ok: true, stats });
});

// API: Obtener Registros de Auditoría y Trofeos
app.get('/api/trophies/records', (req, res) => {
  const historyMgr = require('./history_manager');
  const { soloTrofeos, loteria, fecha } = req.query;
  const records = historyMgr.getHistory({
    soloTrofeos: soloTrofeos === 'true',
    loteria,
    fecha
  });
  res.json({ ok: true, count: records.length, records });
});

// API: Verificar Número Ganador de un Sorteo (Confirmar Trofeo)
app.post('/api/trophies/verify', async (req, res) => {
  const historyMgr = require('./history_manager');
  const { recordId, winnerNumber, winnerName } = req.body;
  if (!recordId || winnerNumber === undefined || winnerNumber === '') {
    return res.status(400).json({ ok: false, message: 'Falta recordId o número ganador' });
  }

  const result = historyMgr.verifyRecordWinner(recordId, winnerNumber, winnerName);
  if (result.ok && result.bloqueoAcertado) {
    log(`🏆 [TROFEO CONFIRMADO] ${result.mensaje}`, 'log-success');
  } else if (result.ok) {
    log(`[SORTEO VERIFICADO] Número ganador ${winnerNumber} registrado (No estaba bloqueado).`, 'log-info');
  }

  // Auto-liberar de la memoria y reincorporar sorteos futuros en Triple 7 si estaban pre-bloqueados
  try {
    const cupoMem = require('./cupo_cero_memory');
    const rec = result.record || {};
    const normWinner = String(winnerNumber).padStart(2, '0');
    const liberados = cupoMem.verificarYAutoLiberarPorGanador(rec.loteria, normWinner, winnerName, rec.sorteo, rec.fecha);

    if (liberados && liberados.length > 0) {
      const cfg = getConfig();
      const t7 = require('./triple7_robot');
      for (const item of liberados) {
        const sorteosALiberar = item.sorteosFuturosPendientes || [];
        if (sorteosALiberar.length > 0) {
          log(`🏆🎉 [AUTO-LIBERACIÓN POR TROFEO] ¡El animal ${item.numero} (${item.nombre}) salió premiado! Liberando en Triple 7 los sorteos siguientes: [${sorteosALiberar.join(', ')}]`, 'log-success');
          if (cfg.general.triple7.enabled) {
            for (const sHora of sorteosALiberar) {
              try {
                await t7.reincorporarAnimalitos(cfg, item.loteriaNombre || rec.loteria, sHora);
                log(`🔓 [TRIPLE 7 DESBLOQUEO] Reincorporado exitosamente ${item.loteriaNombre || rec.loteria} (${sHora})`, 'log-success');
              } catch (eReinc) {
                log(`Aviso al reincorporar ${sHora} en Triple 7: ${eReinc.message}`, 'log-warn');
              }
            }
          }
        }
      }
    }
  } catch (eAutoLib) {
    log(`Aviso en auto-liberación de memoria: ${eAutoLib.message}`, 'log-warn');
  }

  res.json(result);
});

// API: Sincronizar Resultados con Visual-FX y Scrapers en Vivo
app.post('/api/trophies/sync', async (req, res) => {
  const historyMgr = require('./history_manager');
  const syncRes = await historyMgr.syncResultsWithVisualFx();
  log(`[SINCRONIZACIÓN] ${syncRes.message}`, syncRes.trophiesCount > 0 ? 'log-success' : 'log-info');
  if (syncRes.updatedCount > 0) syncToCloudImmediate(false);
  res.json(syncRes);
});

// API: Buscar y Actualizar Resultado Específico ("Por verificar") en Vivo
app.post('/api/trophies/lookup-single-result', async (req, res) => {
  const { recordId } = req.body;
  if (!recordId) return res.status(400).json({ ok: false, message: 'Falta recordId' });
  const historyMgr = require('./history_manager');
  const result = await historyMgr.lookupAndUpdateRecord(recordId);
  if (result.ok && result.found) {
    log(`🎯 [RESULTADO EN VIVO ACTUALIZADO] N° ${result.winnerNumber} (${result.winnerName}) verificado para sorteo ${recordId} [${result.source || 'Scraper'}].`, result.bloqueoAcertado ? 'log-success' : 'log-info');
    syncToCloudImmediate(false);
  }
  res.json(result);
});

// API: Simular Golpe Evitado (Para demostración y pruebas inmediatas de UI)
app.post('/api/trophies/simulate', (req, res) => {
  const historyMgr = require('./history_manager');
  const records = historyMgr.getHistory();
  if (records.length === 0) {
    return res.status(400).json({ ok: false, message: 'No hay registros de sondeo aún. Realiza un sondeo primero.' });
  }
  const targetRec = records[records.length - 1];
  let luckyNumber = '17';
  if (targetRec.rojos && targetRec.rojos.length > 0) {
    luckyNumber = targetRec.rojos[0];
  }
  const result = historyMgr.verifyRecordWinner(targetRec.id, luckyNumber);
  log(`🏆 [SIMULACIÓN DE TROFEO] ¡Golpe evitado confirmado para el número ${luckyNumber}! Tarjeta resaltada con franja verde.`, 'log-success');
  syncToCloudImmediate(false);
  res.json(result);
});

// API: Disparar Chequeo de Prueba / Sondeo Inmediato (Puente Nube -> Local)
async function handleExecuteSondeoNow(req, res) {
  const cfg = getConfig() || {};
  const targetId = req.body && req.body.loteriaId;
  const modoHibrido = req.body && req.body.modoHibrido === true;
  const predictive = require('./predictive_service');

  let loteria;
  if (!targetId || targetId === 'AUTO') {
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();
    let bestLot = null;
    let minDiff = 99999;

    for (const l of (cfg.loterias || []).filter(x => x.activo !== false)) {
      const prox = predictive.calcularProximoSorteo(l.horarios);
      if (prox) {
        const [h, m] = prox.split(':').map(Number);
        const drawMin = h * 60 + m;
        const diff = drawMin - curMinutes;
        if (diff >= 0 && diff < minDiff) {
          minDiff = diff;
          bestLot = l;
        }
      }
    }
    loteria = bestLot || (cfg.loterias && cfg.loterias.find(l => l.activo)) || (cfg.loterias && cfg.loterias[0]) || { id: 'GUACHARO ACTIVO', nombre: 'GUACHARO ACTIVO' };
  } else {
    loteria = (cfg.loterias && cfg.loterias.find(l => l.id === targetId)) || (cfg.loterias && cfg.loterias.find(l => l.activo)) || (cfg.loterias && cfg.loterias[0]) || { id: targetId, nombre: targetId };
  }

  let horaSorteo = (req.body && req.body.horaSorteo) || predictive.calcularProximoSorteo(loteria.horarios) || '10:00';

  // Si estamos en la nube (Render / Linux), despachar la orden a la taquilla física en Windows vía Supabase
  if (process.platform !== 'win32') {
    log(`☁️ [CLOUD BRIDGE] Orden de sondeo recibida en la nube para ${loteria.nombre}. Despachando a la taquilla local vía Supabase...`, 'log-warn');
    try {
      const cloudStore = require('./cloud_store');
      const cmd = await cloudStore.dispatchCommand('TRIGGER_SONDEO', {
        loteriaId: loteria.id,
        loteriaNombre: loteria.nombre,
        horaSorteo,
        modoHibrido
      });

      if (!cmd) {
        return res.status(500).json({ ok: false, message: 'Falla al conectar con la cola en la nube Supabase.' });
      }

      // Esperar hasta 36s si la taquilla física responde sincrónicamente
      const completed = await cloudStore.waitForCommandCompletion(cmd.id, 36000);
      if (completed && completed.status === 'COMPLETED' && completed.result) {
        log(`✅ [CLOUD BRIDGE] Sondeo completado por la taquilla física para ${loteria.nombre}.`, 'log-success');
        return res.json(completed.result);
      } else if (completed && completed.status === 'FAILED') {
        return res.status(500).json({ ok: false, message: completed.result?.message || 'Fallo en ejecución en taquilla local.' });
      } else {
        // La taquilla sigue ejecutando
        return res.json({
          ok: true,
          queued: true,
          commandId: cmd.id,
          message: `Orden despachada a la taquilla física (${loteria.nombre}). Los resultados se reflejarán en vivo al terminar.`
        });
      }
    } catch (bridgeErr) {
      log(`Falla en puente de comandos: ${bridgeErr.message}`, 'log-danger');
      return res.status(500).json({ ok: false, message: bridgeErr.message });
    }
  }

  return handleExecuteSondeoNowInternal(req, res, loteria, horaSorteo, modoHibrido);
}

// Ejecución local interna en Windows con Premier Pluss
async function handleExecuteSondeoNowInternal(req, res, loteriaParam = null, horaSorteoParam = '', modoHibridoParam = false) {
  const cfg = getConfig() || {};
  const predictive = require('./predictive_service');

  let loteria = loteriaParam;
  if (!loteria) {
    const targetId = req.body && req.body.loteriaId;
    if (!targetId || targetId === 'AUTO') {
      loteria = (cfg.loterias && cfg.loterias.find(l => l.activo)) || (cfg.loterias && cfg.loterias[0]) || { id: 'GUACHARO ACTIVO', nombre: 'GUACHARO ACTIVO' };
    } else {
      loteria = (cfg.loterias && cfg.loterias.find(l => l.id === targetId)) || { id: targetId, nombre: targetId };
    }
  }

  const modoHibrido = modoHibridoParam || (req.body && req.body.modoHibrido === true);
  let horaSorteo = horaSorteoParam || (req.body && req.body.horaSorteo) || predictive.calcularProximoSorteo(loteria.horarios) || '10:00';

  if (modoHibrido) {
    log(`🎯 [MODO HÍBRIDO ASISTIDO] Iniciando sondeo para selección actual en PremierPluss (${loteria.nombre})...`, 'log-warn');
  } else {
    log(`⚡ [EJECUTAR SONDEO AHORA] Iniciando ejecución manual en PremierPluss para ${loteria.nombre} (${horaSorteo})...`, 'log-warn');
  }

  try {
    const machinesMgr = require('./machines_manager');
    const result = await machinesMgr.ejecutarPescaEnCascada(cfg, loteria.id, log, horaSorteo, false, modoHibrido);

    if (!result.sorteo || !/\d{1,2}:\d{2}/.test(result.sorteo)) {
      result.sorteo = horaSorteo;
    }
    
    // Consolidar lista de bloqueos (1. Premier + 2. Números Fijos + 3. Visual-FX + 4. Sistema Aleatorio + 5. Memoria Cupo 0)
    const predictive = require('./predictive_service');
    const consolidated = predictive.buildConsolidatedBlockList(cfg, loteria.id, result);

    const descFijos = (consolidated.fijosSeleccionados || []).map(f => `${f.numero} ${f.nombre}`).join(', ');
    const descPredictivos = (consolidated.predictivosSeleccionados || []).map(p => `${p.numero} ${p.nombre} (${p.sorteosAtraso}s)`).join(', ');
    const descAleatorios = (consolidated.aleatoriosSeleccionados || []).map(a => `${a.numero} ${a.nombre}`).join(', ');
    const descMemoria = (consolidated.memoriaSeleccionados || []).map(m => `${m.numero} ${m.nombre} (${m.sorteosRestantes}s)`).join(', ');

    log(`🎯 [ESTRATEGIA 5-VÍAS] 🔴 Premier Cupo 0: [${consolidated.rojosPremier.join(', ') || 'Ninguno'}] | 📌 Fijos: [${descFijos || 'Ninguno'}] | 🔮 Visual-FX: [${descPredictivos || 'Ninguno'}] | 🎲 Aleatorios: [${descAleatorios || 'Ninguno'}] | 🧠 Memoria Persistente: [${descMemoria || 'Ninguna'}] -> Total Bloqueo: ${consolidated.totalNumerosABloquear}`, 'log-info');

    // Registrar en historial persistente (JSON DB + Excel CSV)
    const historyMgr = require('./history_manager');
    const persistentRecord = historyMgr.recordScan({
      loteria: loteria.nombre,
      sorteo: result.sorteo || 'Próximo Sorteo',
      montoSondeo: loteria.montoSondeo || 3000,
      totalAnimalesAnalizados: result.totalAnimalesAnalizados || 38,
      rojos: consolidated.listaFinalNumeros,
      rojosPremier: consolidated.rojosPremier,
      numFijos: consolidated.numFijos,
      fijosSeleccionados: consolidated.fijosSeleccionados,
      predictivosVisualFx: consolidated.predictivosSeleccionados,
      aleatoriosSistema: consolidated.aleatoriosSeleccionados,
      memoriaCupoCero: consolidated.memoriaSeleccionados,
      numMemoriaCupoCero: consolidated.numMemoria,
      t7Status: cfg.general.triple7.enabled ? 'Procesando Triple 7' : 'Desactivado',
      t7Blocked: false
    });

    const record = persistentRecord || {
      horaSorteo: result.sorteo || 'Próximo Sorteo',
      loteria: loteria.nombre,
      rojos: consolidated.listaFinalNumeros,
      rojosPremier: consolidated.rojosPremier,
      numFijos: consolidated.numFijos,
      fijosSeleccionados: consolidated.fijosSeleccionados,
      predictivosVisualFx: consolidated.predictivosSeleccionados,
      aleatoriosSistema: consolidated.aleatoriosSeleccionados,
      memoriaCupoCero: consolidated.memoriaSeleccionados,
      numMemoriaCupoCero: consolidated.numMemoria,
      t7Status: cfg.general.triple7.enabled ? 'Procesando Triple 7' : 'Desactivado',
      t7Blocked: false,
      timestamp: new Date().toISOString()
    };
    
    executionHistory.push(record);
    if (executionHistory.length > 50) executionHistory.shift();

    // Si Triple 7 está habilitado y hay números para bloquear en el sorteo actual
    const drawTargetT7 = (result.sorteo && /\d{1,2}:\d{2}/.test(result.sorteo)) ? result.sorteo : horaSorteo;
    if (cfg.general.triple7.enabled && consolidated.listaFinalNumeros.length > 0) {
      log(`Enviando ${consolidated.listaFinalNumeros.length} números a Triple 7 para sorteo actual ${drawTargetT7}...`, 'log-info');
      try {
        delete require.cache[require.resolve('./triple7_robot')];
        const t7 = require('./triple7_robot');
        const t7Res = await t7.bloquearNumeros(cfg, loteria.nombre, drawTargetT7, consolidated.listaFinalNumeros);
        record.t7Blocked = t7Res.ok;
        record.t7Status = t7Res.ok ? `Bloqueados (${t7Res.bloqueadosExitosos.length})` : `Error: ${t7Res.message}`;
        if (persistentRecord && persistentRecord.id) {
          historyMgr.updateT7Status(persistentRecord.id, record.t7Status, record.t7Blocked);
        }
      } catch (t7Err) {
        record.t7Status = `Error T7: ${t7Err.message}`;
        if (persistentRecord && persistentRecord.id) {
          historyMgr.updateT7Status(persistentRecord.id, record.t7Status, record.t7Blocked);
        }
        log(`Error en Triple 7: ${t7Err.message}`, 'log-danger');
      }
    } else {
      record.t7Status = cfg.general.triple7.enabled ? 'Sin números para bloquear' : 'Desactivado';
      if (persistentRecord && persistentRecord.id) {
        historyMgr.updateT7Status(persistentRecord.id, record.t7Status, record.t7Blocked);
      }
    }

    // GESTIÓN DE MEMORIA PREMIER CUPO 0: Pre-bloqueo inmediato de sorteos siguientes
    let siguientesSorteos = [];
    if (loteria.memoriaCupoCero && loteria.memoriaCupoCero.activo !== false && (consolidated.rojosPremier || []).length > 0) {
      try {
        const cupoMem = require('./cupo_cero_memory');
        const todayStr = new Date().toISOString().slice(0, 10);
        const persistencia = Math.min(Math.max(parseInt(loteria.memoriaCupoCero.sorteosPersistencia, 10) || 3, 1), 5);
        siguientesSorteos = cupoMem.obtenerSiguientesSorteos(loteria.horarios || [], result.sorteo, persistencia);

        if (siguientesSorteos.length > 0) {
          log(`🧠 [MEMORIA PREMIER CUPO 0] Persistencia (${persistencia} sorteos). Pre-bloqueando [${consolidated.rojosPremier.join(', ')}] para los siguientes sorteos: ${siguientesSorteos.join(', ')}...`, 'log-info');
          cupoMem.registrarAgotadosPremier(loteria.id, loteria.nombre, result.sorteo, todayStr, consolidated.rojosPremier, persistencia, siguientesSorteos);

          if (cfg.general.triple7.enabled) {
            const t7 = require('./triple7_robot');
            for (const sFuturo of siguientesSorteos) {
              try {
                log(`🧠 [PRE-BLOQUEO TRIPLE 7] Sorteo ${sFuturo}: Enviando [${consolidated.rojosPremier.join(', ')}]...`, 'log-info');
                const t7FuturoRes = await t7.bloquearNumeros(cfg, loteria.nombre, sFuturo, consolidated.rojosPremier);
                log(`🧠 [PRE-BLOQUEO TRIPLE 7] Sorteo ${sFuturo}: ${t7FuturoRes.ok ? 'Bloqueado con éxito' : t7FuturoRes.message}`, t7FuturoRes.ok ? 'log-success' : 'log-warn');
              } catch (eFuturo) {
                log(`Aviso al pre-bloquear ${sFuturo} en Triple 7: ${eFuturo.message}`, 'log-danger');
              }
            }
          }
        }
      } catch (errMem) {
        log(`Aviso en pre-bloqueo de memoria: ${errMem.message}`, 'log-warn');
      }
    }

    // Notificar Telegram si está habilitado
    if (cfg.general.telegram.enabled && cfg.general.telegram.botToken && cfg.general.telegram.chatId) {
      const fijosText = consolidated.fijosSeleccionados.length > 0 ? `\n📌 *Números Fijos:* ${descFijos}` : '';
      const predText = consolidated.predictivosSeleccionados.length > 0 ? `\n🔮 *Visual-FX Atrasados:* ${descPredictivos}` : '';
      const aleatText = consolidated.aleatoriosSeleccionados.length > 0 ? `\n🎲 *Sistema Aleatorio:* ${descAleatorios}` : '';
      const memText = siguientesSorteos.length > 0 ? `\n🧠 *Pre-bloqueo Siguientes Sorteos:* ${siguientesSorteos.join(', ')}` : '';
      enviarTelegram(cfg, `🦜 *${loteria.nombre} - Sorteo ${record.horaSorteo}*\n\n❌ *Premier Agotados (Cupo 0):* ${consolidated.rojosPremier.join(', ') || 'Ninguno'}${fijosText}${predText}${aleatText}${memText}\n🛡️ *Bloqueo Total:* ${consolidated.listaFinalNumeros.join(', ') || 'Ninguno'}\n🛡️ *Triple 7:* ${record.t7Status}`);
    }

    // Sincronización instantánea con la nube (Render) para que la web tome los bloqueos en tiempo real
    syncToCloudImmediate(false);

    res.json({ ok: true, message: `Sondeo de ${loteria.nombre} (${record.horaSorteo}) ejecutado con éxito`, result, consolidated, siguientesSorteosPrebloqueados: siguientesSorteos });
  } catch (err) {
    log(`Falla en ejecución de sondeo: ${err.message}`, 'log-danger');
    res.status(500).json({ ok: false, message: err.message });
  }
}

app.post('/api/trigger-test', handleExecuteSondeoNow);
app.post('/api/sondeo/trigger-now', handleExecuteSondeoNow);

// API: Consultar estado de comando remoto (Cloud Bridge)
app.get('/api/sondeo/command-status/:id', async (req, res) => {
  try {
    const cloudStore = require('./cloud_store');
    const cmd = await cloudStore.getLatestCommand();
    if (cmd && cmd.id === req.params.id) {
      return res.json({ ok: true, status: cmd.status, result: cmd.result });
    }
    res.json({ ok: true, status: 'NOT_FOUND' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// API: Obtener Estado y Sorteos Activos en Triple 7
app.get('/api/triple7/status', async (req, res) => {
  const cfg = getConfig();
  try {
    delete require.cache[require.resolve('./triple7_robot')];
    const t7 = require('./triple7_robot');
    const estado = await t7.obtenerEstadoBloqueos(cfg);

    if (estado && estado.ok && Array.isArray(estado.draws) && cfg && Array.isArray(cfg.loterias)) {
      function normStr(str) {
        return (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/guacharito/g, 'guacharo').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      const activeLotNames = cfg.loterias
        .filter(l => l.activo !== false)
        .map(l => normStr(l.nombre));

      if (activeLotNames.length > 0) {
        estado.totalPlataforma = estado.totalPlataforma || estado.draws.length;
        estado.draws = estado.draws.filter(d => activeLotNames.includes(normStr(d.loteria)));
        estado.totalGestionados = estado.draws.length;
      }
    }
    res.json(estado);
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// API: Bloqueo Manual en Triple 7
app.post('/api/triple7/bloquear', async (req, res) => {
  const cfg = getConfig();
  const { loteria, sorteo, numeros } = req.body;
  if (!loteria || !sorteo || !numeros || !Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ ok: false, message: 'Faltan parámetros requeridos: loteria, sorteo, numeros (array)' });
  }
  log(`[TRIPLE 7 MANUAL] Solicitud de bloqueo para ${loteria} (${sorteo}): [${numeros.join(', ')}]...`, 'log-info');
  try {
    const t7 = require('./triple7_robot');
    const result = await t7.bloquearNumeros(cfg, loteria, sorteo, numeros);
    if (result.ok) {
      log(`✅ [TRIPLE 7 MANUAL] ${result.message}`, 'log-success');
    } else {
      log(`⚠️ [TRIPLE 7 MANUAL] ${result.message}`, 'log-warn');
    }
    res.json(result);
  } catch (err) {
    log(`❌ [TRIPLE 7 ERROR] ${err.message}`, 'log-danger');
    res.status(500).json({ ok: false, message: err.message });
  }
});

// API: Bloquear Estrategia Completa Ahora (Fijos + Aleatorios + Visual-FX + Memoria) para el próximo sorteo en Triple 7
app.post('/api/triple7/bloquear-estrategia-ahora', async (req, res) => {
  const cfg = getConfig();
  const { loteriaId, horaSorteo } = req.body;
  const predictive = require('./predictive_service');
  const historyMgr = require('./history_manager');

  let loteria = (cfg.loterias || []).find(l => l.id === loteriaId || l.nombre === loteriaId);
  if (!loteria) {
    loteria = (cfg.loterias || []).find(l => l.activo) || (cfg.loterias || [])[0];
  }
  if (!loteria) {
    return res.status(400).json({ ok: false, message: 'No se encontró la lotería indicada' });
  }

  const targetHour = horaSorteo || predictive.calcularProximoSorteo(loteria.horarios) || '14:00';
  const consolidated = predictive.buildConsolidatedBlockList(cfg, loteria.id, { rojos: [] });
  const numeros = consolidated.listaFinalNumeros || [];

  if (numeros.length === 0) {
    return res.json({ ok: true, message: `No hay números configurados para bloquear en ${loteria.nombre} (${targetHour})`, total: 0 });
  }

  log(`[TRIPLE 7 DISPARO MANUAL] Bloqueando ${numeros.length} números (${loteria.nombre} ${targetHour}): [${numeros.join(', ')}]...`, 'log-info');
  try {
    delete require.cache[require.resolve('./triple7_robot')];
    const t7 = require('./triple7_robot');
    const result = await t7.bloquearNumeros(cfg, loteria.nombre, targetHour, numeros);

    const t7Status = result.ok ? `Bloqueados (${result.bloqueadosExitosos.length}) en Triple 7` : `Error: ${result.message}`;
    historyMgr.recordScan({
      loteria: loteria.nombre,
      sorteo: targetHour,
      montoSondeo: loteria.montoSondeo || 3000,
      totalAnimalesAnalizados: loteria.totalAnimales || 38,
      rojos: numeros,
      rojosPremier: [],
      numFijos: consolidated.numFijos,
      fijosSeleccionados: consolidated.fijosSeleccionados,
      predictivosVisualFx: consolidated.predictivosSeleccionados,
      aleatoriosSistema: consolidated.aleatoriosSeleccionados,
      memoriaCupoCero: consolidated.memoriaSeleccionados,
      numMemoriaCupoCero: consolidated.numMemoria,
      t7Status,
      t7Blocked: result.ok
    });

    syncToCloudImmediate(false);
    res.json(result);
  } catch (err) {
    log(`❌ [TRIPLE 7 ERROR] ${err.message}`, 'log-danger');
    res.status(500).json({ ok: false, message: err.message });
  }
});

// API: Reincorporar (Desbloquear) Manualmente en Triple 7
app.post('/api/triple7/reincorporar', async (req, res) => {
  const cfg = getConfig();
  const { loteria, sorteo } = req.body;
  if (!loteria || !sorteo) {
    return res.status(400).json({ ok: false, message: 'Faltan parámetros requeridos: loteria, sorteo' });
  }
  log(`[TRIPLE 7 REINCORPORAR] Solicitud para ${loteria} (${sorteo})...`, 'log-info');
  try {
    const t7 = require('./triple7_robot');
    const result = await t7.reincorporarAnimalitos(cfg, loteria, sorteo);
    if (result.ok) {
      log(`✅ [TRIPLE 7 REINCORPORAR] ${result.message}`, 'log-success');
    } else {
      log(`⚠️ [TRIPLE 7 REINCORPORAR] ${result.message}`, 'log-warn');
    }
    res.json(result);
  } catch (err) {
    log(`❌ [TRIPLE 7 ERROR] ${err.message}`, 'log-danger');
    res.status(500).json({ ok: false, message: err.message });
  }
});

// API: Reincorporar (Limpiar) TODOS los sorteos bloqueados en Triple 7
app.post('/api/triple7/unblock-all', async (req, res) => {
  const cfg = getConfig();
  log(`[TRIPLE 7 LIMPIEZA TOTAL] Iniciando reincorporación de todos los sorteos...`, 'log-warn');
  try {
    const t7 = require('./triple7_robot');
    const result = await t7.limpiarTodosLosBloqueos(cfg);
    log(`✅ [TRIPLE 7 LIMPIEZA TOTAL] Completado. ${result.totalReincorporados} sorteos reincorporados a 0 bloqueos.`, 'log-success');
    res.json(result);
  } catch (err) {
    log(`❌ [TRIPLE 7 LIMPIEZA ERROR] ${err.message}`, 'log-danger');
    res.status(500).json({ ok: false, message: err.message });
  }
});

// API: Estado de Control y Seguridad en Tiempo Real (Sincronizado Nube <-> Local)
app.get('/api/control-status', async (req, res) => {
  if (IS_CLOUD || process.platform !== 'win32') {
    try {
      const cloudStore = require('./cloud_store');
      const cloudStatus = await cloudStore.getAutomationStatus();
      if (cloudStatus && cloudStatus.status) {
        return res.json({ ok: true, ...cloudStatus.status, isCloud: true });
      }
    } catch (e) {}
    return res.json({ ok: true, status: 'IDLE', requestedAction: 'NONE', isRunning: false, colaPendientes: 0, isCloud: true });
  }
  const robot = require('./premier_robot');
  const status = robot.getEstadoControl();
  res.json({ ok: true, ...status });
});

// API: Pausar Automatización
app.post('/api/pause', async (req, res) => {
  if (IS_CLOUD || process.platform !== 'win32') {
    try {
      const cloudStore = require('./cloud_store');
      await cloudStore.dispatchCommand('PAUSE', req.body || {});
      log('⏸️ [CLOUD BRIDGE] Orden de PAUSA despachada a la taquilla local vía Supabase.', 'log-warn');
      return res.json({ ok: true, message: 'Orden de pausa enviada a la taquilla física' });
    } catch (e) {
      return res.status(500).json({ ok: false, message: e.message });
    }
  }
  const robot = require('./premier_robot');
  robot.pausarSondeo();
  log('⏸️ [CONTROL] Automatización pausada por el usuario.', 'log-warn');
  res.json({ ok: true, message: 'Automatización pausada' });
});

// API: Continuar / Reanudar Automatización
app.post('/api/resume', async (req, res) => {
  if (IS_CLOUD || process.platform !== 'win32') {
    try {
      const cloudStore = require('./cloud_store');
      await cloudStore.dispatchCommand('RESUME', req.body || {});
      log('▶️ [CLOUD BRIDGE] Orden de REANUDAR despachada a la taquilla local vía Supabase.', 'log-info');
      return res.json({ ok: true, message: 'Orden de reanudación enviada a la taquilla física' });
    } catch (e) {
      return res.status(500).json({ ok: false, message: e.message });
    }
  }
  const robot = require('./premier_robot');
  robot.reanudarSondeo();
  log('▶️ [CONTROL] Reanudando automatización...', 'log-info');
  res.json({ ok: true, message: 'Automatización reanudada' });
});

// API: Detener por Completo (Emergency Stop / Kill Switch)
app.post('/api/stop', async (req, res) => {
  if (IS_CLOUD || process.platform !== 'win32') {
    try {
      const cloudStore = require('./cloud_store');
      await cloudStore.dispatchCommand('STOP', req.body || {});
      log('🛑 [CLOUD BRIDGE] Orden de DETENCIÓN TOTAL despachada a la taquilla local vía Supabase.', 'log-danger');
      return res.json({ ok: true, message: 'Orden de detención enviada a la taquilla física' });
    } catch (e) {
      return res.status(500).json({ ok: false, message: e.message });
    }
  }
  const robot = require('./premier_robot');
  robot.detenerSondeo();
  log('🛑 [CONTROL] ¡Detención total ejecutada! Proceso cancelado.', 'log-danger');
  res.json({ ok: true, message: 'Automatización detenida por completo' });
});

// API: Reiniciar Proceso
app.post('/api/restart', async (req, res) => {
  if (IS_CLOUD || process.platform !== 'win32') {
    try {
      const cloudStore = require('./cloud_store');
      await cloudStore.dispatchCommand('RESTART', req.body || {});
      log('🔄 [CLOUD BRIDGE] Orden de REINICIO despachada a la taquilla local vía Supabase.', 'log-warn');
      return res.json({ ok: true, message: 'Orden de reinicio enviada a la taquilla física' });
    } catch (e) {
      return res.status(500).json({ ok: false, message: e.message });
    }
  }
  const robot = require('./premier_robot');
  log('🔄 [CONTROL] Reiniciando proceso de sondeo...', 'log-warn');
  robot.detenerSondeo();

  // Breve espera para que el proceso anterior muera limpiamente
  setTimeout(async () => {
    const cfg = getConfig();
    const targetId = req.body && req.body.loteriaId;
    let loteria = cfg.loterias.find(l => l.id === targetId) || cfg.loterias.find(l => l.activo) || cfg.loterias[0];
    
    log(`Iniciando nuevo ciclo de sondeo para ${loteria.nombre}...`, 'log-info');
    try {
      const predictive = require('./predictive_service');
      const horaSorteo = predictive.calcularProximoSorteo(loteria.horarios) || '';
      robot.ejecutarSondeoPremier(cfg, loteria.id, horaSorteo);
    } catch (e) {
      log(`Error reiniciando: ${e.message}`, 'log-danger');
    }
  }, 1000);

  res.json({ ok: true, message: 'Proceso reiniciado desde cero' });
});

// API: Reinicio Limpio del Proceso Node.js (Servidor Local)
app.post('/api/system/restart-clean', (req, res) => {
  log('🔄 [SISTEMA] Reinicio limpio de Node.js solicitado. Liberando proceso...', 'log-warn');
  res.json({ ok: true, message: 'Proceso Node.js finalizando para reinicio limpio.' });
  setTimeout(() => {
    process.exit(0);
  }, 400);
});

// API: Enviar Test a Telegram
app.post('/api/test-telegram', (req, res) => {
  const cfg = getConfig();
  if (!cfg.general.telegram.botToken || !cfg.general.telegram.chatId) {
    return res.status(400).json({ ok: false, message: 'Falta Token o Chat ID de Telegram' });
  }

  enviarTelegram(cfg, '🚀 *Pronosticador de Animalitos*\nConexión de prueba exitosa con la Suite.', (ok, err) => {
    if (ok) res.json({ ok: true, message: 'Enviado con éxito' });
    else res.status(500).json({ ok: false, message: err });
  });
});

// Enviar mensaje Telegram
function enviarTelegram(cfg, texto, cb) {
  const token = cfg.general.telegram.botToken;
  const chatId = cfg.general.telegram.chatId;
  const postData = JSON.stringify({
    chat_id: chatId,
    text: texto,
    parse_mode: 'Markdown'
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.ok) {
          log('Notificación enviada a Telegram con éxito.', 'log-success');
          if (cb) cb(true);
        } else {
          log(`Falla de Telegram API: ${parsed.description}`, 'log-danger');
          if (cb) cb(false, parsed.description);
        }
      } catch (e) {
        if (cb) cb(false, e.message);
      }
    });
  });

  req.on('error', (e) => {
    log(`Error conectando a Telegram: ${e.message}`, 'log-danger');
    if (cb) cb(false, e.message);
  });

  req.write(postData);
  req.end();
}

function esUltimoSorteoDelDia(cfg, currentTotalMinutes) {
  if (cfg.general && cfg.general.premierPluss && cfg.general.premierPluss.cerrarAlFinalizarDia === false) {
    return false;
  }
  let maxDrawMinutes = 0;
  for (const l of (cfg.loterias || [])) {
    if (!l.activo) continue;
    for (const h of (l.horarios || [])) {
      const match = h.match(/(\d{1,2}):(\d{2})/);
      if (!match) continue;
      let hh = parseInt(match[1], 10);
      const mm = parseInt(match[2], 10);
      if (h.toUpperCase().includes('PM') && hh < 12) hh += 12;
      if (h.toUpperCase().includes('AM') && hh === 12) hh = 0;
      const mins = hh * 60 + mm;
      if (mins > maxDrawMinutes) {
        maxDrawMinutes = mins;
      }
    }
  }
  return maxDrawMinutes > 0 && currentTotalMinutes >= (maxDrawMinutes - 35);
}

// Registro de tareas ejecutadas y revisiones de resultados realizadas
const tareasEjecutadas = new Set();
const revisionesRealizadas = new Set();

setInterval(async () => {
  // CRÍTICO: Si estamos en la nube (Render), NO ejecutar tareas de escaneo ni bloqueos.
  // Render corre en Linux sin GUI/Playwright y su reloj es UTC (+4h respecto a Venezuela).
  // Solo la máquina local (Windows) ejecuta Premier Pluss y Triple 7.
  if (process.env.RENDER || process.env.IS_RENDER) return;

  const cfg = getConfig();
  if (!cfg || !cfg.general.autoStartScheduler) return;

  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = now.toISOString().slice(0, 10);

  // Sincronización continua y automática con la nube (Render) desde el nodo local
  syncToCloudImmediate(false);

  for (const lot of cfg.loterias) {
    if (!lot.activo) continue;

    for (const hStr of (lot.horarios || [])) {
      const [h, m] = hStr.split(':').map(Number);
      const drawMinutes = h * 60 + m;

      // =========================================================================
      // 1. DISPARO DE BLOQUEO DE NÚMEROS FIJOS (100% Independiente)
      // =========================================================================
      if (lot.bloqueoFijos !== false && (lot.numerosFijos || []).length > 0) {
        const fijosMinutesBefore = lot.minutosAntesFijos || 50;
        const targetFijosMinutes = drawMinutes - fijosMinutesBefore;
        const diffFijos = currentTotalMinutes - targetFijosMinutes;
        const keyFijos = `${todayStr}_${lot.id}_${hStr}_fijos`;

        if (diffFijos >= 0 && currentTotalMinutes < drawMinutes && !tareasEjecutadas.has(keyFijos)) {
          tareasEjecutadas.add(keyFijos);
          log(`📌 [ALARMA NÚMEROS FIJOS] Activando bloqueo de fijos (${fijosMinutesBefore}m antes) para ${lot.nombre} (${hStr})...`, 'log-info');

          try {
            const predictive = require('./predictive_service');
            const historyMgr = require('./history_manager');
            delete require.cache[require.resolve('./triple7_robot')];
            const t7 = require('./triple7_robot');

            const fijosParaBloquear = predictive.getFixedBlockNumbers(cfg, lot.id);
            const numerosParaBloquear = fijosParaBloquear.map(f => f.numero);

            let t7Status = !cfg.general.triple7.enabled 
              ? 'Desactivado' 
              : (numerosParaBloquear.length === 0 ? 'Sin fijos configurados' : 'Procesando Triple 7');
            let t7Blocked = false;

            if (cfg.general.triple7.enabled && numerosParaBloquear.length > 0) {
              log(`[AUTO-BLOQUEO TRIPLE 7] Enviando ${numerosParaBloquear.length} números fijos a Triple 7 para ${lot.nombre} (${hStr})...`, 'log-info');
              try {
                const t7Res = await t7.bloquearNumeros(cfg, lot.nombre, hStr, numerosParaBloquear);
                t7Blocked = t7Res.ok;
                t7Status = t7Res.ok ? `Bloqueados (${t7Res.bloqueadosExitosos.length}) en Triple 7` : `Error T7: ${t7Res.message}`;
              } catch (t7Err) {
                t7Status = `Error T7: ${t7Err.message}`;
                log(`Error en auto-bloqueo Triple 7 (Fijos): ${t7Err.message}`, 'log-danger');
              }
            }

            const rec = historyMgr.recordScan({
              loteria: lot.nombre,
              sorteo: hStr,
              montoSondeo: lot.montoSondeo || 3000,
              totalAnimalesAnalizados: lot.totalAnimales || 38,
              rojos: numerosParaBloquear,
              numFijos: numerosParaBloquear,
              fijosSeleccionados: fijosParaBloquear,
              t7Status,
              t7Blocked
            });

            syncToCloudImmediate(false);

            const descFijos = fijosParaBloquear.map(f => `${f.numero} ${f.nombre}`).join(', ');
            log(`✅ [NÚMEROS FIJOS BLOQUEADOS] ${lot.nombre} (${hStr}): [${descFijos}] -> Triple 7: ${t7Status}`, 'log-success');

            if (cfg.general.telegram.enabled && cfg.general.telegram.botToken && cfg.general.telegram.chatId) {
              enviarTelegram(cfg, `📌 *BLOQUEO NÚMEROS FIJOS*\n*${lot.nombre} - Sorteo ${hStr} (${fijosMinutesBefore}m antes)*\nFijos: ${descFijos}\nTriple 7: ${t7Status}`);
            }
          } catch (e) {
            log(`Error en bloqueo independiente de números fijos: ${e.message}`, 'log-danger');
          }
        }
      }

      // =========================================================================
      // 2. DISPARO DE BLOQUEO ALEATORIO DEL SISTEMA (100% Independiente)
      // =========================================================================
      if (lot.bloqueoAleatorioSistema !== false && (lot.cantidadAleatoriosABloquear || 0) > 0) {
        const aleatMinutesBefore = lot.minutosAntesAleatorios || 45;
        const targetAleatMinutes = drawMinutes - aleatMinutesBefore;
        const diffAleat = currentTotalMinutes - targetAleatMinutes;
        const keyAleat = `${todayStr}_${lot.id}_${hStr}_aleat`;

        if (diffAleat >= 0 && currentTotalMinutes < drawMinutes && !tareasEjecutadas.has(keyAleat)) {
          tareasEjecutadas.add(keyAleat);
          log(`🎲 [ALARMA SISTEMA ALEATORIO] Activando cobertura aleatoria (${aleatMinutesBefore}m antes) para ${lot.nombre} (${hStr})...`, 'log-info');

          try {
            const historyMgr = require('./history_manager');
            const predictive = require('./predictive_service');
            delete require.cache[require.resolve('./triple7_robot')];
            const t7 = require('./triple7_robot');

            // Obtener números ya bloqueados en este sorteo hoy para no repetir
            const existingHistory = historyMgr.getHistory({ fecha: todayStr });
            const existingRec = existingHistory.find(r => 
              (r.loteria || '').toLowerCase().includes(lot.nombre.toLowerCase().slice(0, 5)) &&
              (r.sorteo === hStr || r.horaSorteo === hStr)
            );
            const yaBloqueados = existingRec ? (existingRec.rojos || []) : [];

            const aleatorios = predictive.getRandomSystemBlockNumbers(lot.id, lot.cantidadAleatoriosABloquear, yaBloqueados);
            const numerosParaBloquear = aleatorios.map(a => a.numero);

            let t7Status = !cfg.general.triple7.enabled 
              ? 'Desactivado' 
              : (numerosParaBloquear.length === 0 ? 'Sin aleatorios a bloquear' : 'Procesando Triple 7');
            let t7Blocked = false;

            if (cfg.general.triple7.enabled && numerosParaBloquear.length > 0) {
              log(`[AUTO-BLOQUEO TRIPLE 7] Enviando ${numerosParaBloquear.length} números aleatorios a Triple 7 para ${lot.nombre} (${hStr})...`, 'log-info');
              try {
                const t7Res = await t7.bloquearNumeros(cfg, lot.nombre, hStr, numerosParaBloquear);
                t7Blocked = t7Res.ok;
                t7Status = t7Res.ok ? `Bloqueados (${t7Res.bloqueadosExitosos.length}) en Triple 7` : `Error T7: ${t7Res.message}`;
              } catch (t7Err) {
                t7Status = `Error T7: ${t7Err.message}`;
                log(`Error en auto-bloqueo Triple 7 (Aleatorios): ${t7Err.message}`, 'log-danger');
              }
            }

            const rec = historyMgr.recordScan({
              loteria: lot.nombre,
              sorteo: hStr,
              montoSondeo: lot.montoSondeo || 3000,
              totalAnimalesAnalizados: lot.totalAnimales || 38,
              rojos: numerosParaBloquear,
              numAleatorios: numerosParaBloquear,
              aleatoriosSistema: aleatorios,
              t7Status,
              t7Blocked
            });

            syncToCloudImmediate(false);

            const descAleatorios = aleatorios.map(a => `${a.numero} ${a.nombre}`).join(', ');
            log(`✅ [SISTEMA ALEATORIO BLOQUEADO] ${lot.nombre} (${hStr}): [${descAleatorios}] -> Triple 7: ${t7Status}`, 'log-success');

            if (cfg.general.telegram.enabled && cfg.general.telegram.botToken && cfg.general.telegram.chatId) {
              enviarTelegram(cfg, `🎲 *BLOQUEO COBERTURA ALEATORIA*\n*${lot.nombre} - Sorteo ${hStr} (${aleatMinutesBefore}m antes)*\nNúmeros seleccionados: ${descAleatorios}\nTriple 7: ${t7Status}`);
            }
          } catch (e) {
            log(`Error en cobertura aleatoria independiente: ${e.message}`, 'log-danger');
          }
        }
      }

      // =========================================================================
      // 3. DISPARO DE BLOQUEO PREDICTIVO VISUAL-FX (100% Independiente)
      // =========================================================================
      if (lot.bloqueoPredictivosAtrasados !== false && (lot.cantidadPredictivosABloquear || 0) > 0) {
        const vfxMinutesBefore = lot.minutosAntesVisualFx || 40;
        const targetVfxMinutes = drawMinutes - vfxMinutesBefore;
        const diffVfx = currentTotalMinutes - targetVfxMinutes;
        const keyVfx = `${todayStr}_${lot.id}_${hStr}_visualfx`;

        if (diffVfx >= 0 && currentTotalMinutes < drawMinutes && !tareasEjecutadas.has(keyVfx)) {
          tareasEjecutadas.add(keyVfx);
          log(`🔮 [ALARMA VISUAL-FX] Activando bloqueo de ${lot.cantidadPredictivosABloquear} atrasados (${vfxMinutesBefore}m antes) para ${lot.nombre} (${hStr})...`, 'log-info');

          try {
            const predictive = require('./predictive_service');
            const historyMgr = require('./history_manager');
            delete require.cache[require.resolve('./triple7_robot')];
            const t7 = require('./triple7_robot');

            const atrasados = predictive.getMostDelayedNumbers(lot.id, lot.cantidadPredictivosABloquear);
            const numerosParaBloquear = atrasados.map(a => a.numero);

            let t7Status = !cfg.general.triple7.enabled 
              ? 'Desactivado' 
              : (numerosParaBloquear.length === 0 ? 'Sin atrasados detectados' : 'Procesando Triple 7');
            let t7Blocked = false;

            if (cfg.general.triple7.enabled && numerosParaBloquear.length > 0) {
              log(`[AUTO-BLOQUEO TRIPLE 7] Enviando ${numerosParaBloquear.length} números atrasados (Visual-FX) a Triple 7 para ${lot.nombre} (${hStr})...`, 'log-info');
              try {
                const t7Res = await t7.bloquearNumeros(cfg, lot.nombre, hStr, numerosParaBloquear);
                t7Blocked = t7Res.ok;
                t7Status = t7Res.ok ? `Bloqueados (${t7Res.bloqueadosExitosos.length}) en Triple 7` : `Error T7: ${t7Res.message}`;
              } catch (t7Err) {
                t7Status = `Error T7: ${t7Err.message}`;
                log(`Error en auto-bloqueo Triple 7 (Visual-FX): ${t7Err.message}`, 'log-danger');
              }
            }

            const rec = historyMgr.recordScan({
              loteria: lot.nombre,
              sorteo: hStr,
              montoSondeo: lot.montoSondeo || 3000,
              totalAnimalesAnalizados: lot.totalAnimales || 38,
              rojos: numerosParaBloquear,
              predictivosVisualFx: atrasados,
              numPredictivos: numerosParaBloquear,
              t7Status,
              t7Blocked
            });

            syncToCloudImmediate(false);

            const descAtrasados = atrasados.map(a => `${a.numero} ${a.nombre} (${a.sorteosAtraso}s)`).join(', ');
            log(`✅ [VISUAL-FX BLOQUEADO] ${lot.nombre} (${hStr}): [${descAtrasados}] -> Triple 7: ${t7Status}`, 'log-success');

            if (cfg.general.telegram.enabled && cfg.general.telegram.botToken && cfg.general.telegram.chatId) {
              enviarTelegram(cfg, `🔮 *BLOQUEO PREDICTIVO VISUAL-FX*\n*${lot.nombre} - Sorteo ${hStr} (${vfxMinutesBefore}m antes)*\nAnimales atrasados: ${descAtrasados}\nTriple 7: ${t7Status}`);
            }
          } catch (e) {
            log(`Error en bloqueo independiente Visual-FX: ${e.message}`, 'log-danger');
          }
        }
      }

      // =========================================================================
      // 4. DISPARO DE SONDEO Y BLOQUEO EN PREMIER PLUSS (Hasta 5 Sondeos por Sorteo)
      // =========================================================================
      if (lot.bloqueoPremierAgotados !== false) {
        // Verificar si este sorteo específico está habilitado para sondeo según decisión del usuario
        const sorteosPermitidosSondeo = Array.isArray(lot.sorteosSondeoActivos) 
          ? lot.sorteosSondeoActivos 
          : (lot.horarios || []);
        if (!sorteosPermitidosSondeo.includes(hStr)) {
          // Sorteo excluido de sondeo por el usuario según estadísticas
          continue;
        }

        let sondeosActivos = [];
        if (Array.isArray(lot.sondeosMultiples) && lot.sondeosMultiples.length > 0) {
          sondeosActivos = lot.sondeosMultiples
            .filter(s => s && s.activo !== false && parseInt(s.minutosAntes, 10) > 0)
            .sort((a, b) => parseInt(b.minutosAntes, 10) - parseInt(a.minutosAntes, 10));
        }

        if (sondeosActivos.length === 0) {
          const minDef = parseInt(lot.minutosAntesPremier || lot.minutosAntes || 35, 10);
          sondeosActivos = [ { id: 1, activo: true, minutosAntes: minDef } ];
        }

        for (const sondeoCfg of sondeosActivos) {
          const premierMinutesBefore = parseInt(sondeoCfg.minutosAntes, 10);
          const targetPremMinutes = drawMinutes - premierMinutesBefore;
          const diffPrem = currentTotalMinutes - targetPremMinutes;
          const sNum = sondeoCfg.id || (sondeosActivos.indexOf(sondeoCfg) + 1);
          const keyPrem = `${todayStr}_${lot.id}_${hStr}_premier_s${sNum}_${premierMinutesBefore}m`;

          if (diffPrem >= 0 && currentTotalMinutes < drawMinutes && !tareasEjecutadas.has(keyPrem)) {
            tareasEjecutadas.add(keyPrem);
            log(`🔴 [ALARMA PREMIER PLUSS: SONDEO ${sNum}/${sondeosActivos.length}] Activando sondeo (${premierMinutesBefore}m antes) para ${lot.nombre} (Sorteo ${hStr})...`, 'log-warn');

            try {
              const machinesMgr = require('./machines_manager');
              const historyMgr = require('./history_manager');
              const predictive = require('./predictive_service');
              delete require.cache[require.resolve('./triple7_robot')];
              const t7 = require('./triple7_robot');

              const esUltimo = esUltimoSorteoDelDia(cfg, currentTotalMinutes);
              const result = await machinesMgr.ejecutarPescaEnCascada(cfg, lot.id, log, hStr, esUltimo);

              // Consolidar lista completa de las 5 vías de protección:
              // 1. Premier Cupo 0 + 2. Fijos + 3. Visual-FX Atrasados + 4. Cobertura Aleatoria + 5. Memoria Persistente
              const consolidated = predictive.buildConsolidatedBlockList(cfg, lot.id, result);
              const targetDrawTime = (result && result.sorteo && /\d{1,2}:\d{2}/.test(result.sorteo)) ? result.sorteo : hStr;

              const numerosParaTriple7 = consolidated.listaFinalNumeros || [];
              let t7Status = !cfg.general.triple7.enabled 
                ? 'Desactivado' 
                : (numerosParaTriple7.length === 0 ? 'Sin números para bloquear' : 'Procesando Triple 7');
              let t7Blocked = false;

              // Bloqueo total consolidado en Triple 7 para el sorteo objetivo
              if (cfg.general.triple7.enabled && numerosParaTriple7.length > 0) {
                log(`[AUTO-BLOQUEO TRIPLE 7 (SONDEO ${sNum})] Enviando ${numerosParaTriple7.length} números consolidados a Triple 7 para ${lot.nombre} (${targetDrawTime}): [${numerosParaTriple7.join(', ')}]...`, 'log-info');
                try {
                  const t7Res = await t7.bloquearNumeros(cfg, lot.nombre, targetDrawTime, numerosParaTriple7);
                  t7Blocked = t7Res.ok;
                  t7Status = t7Res.ok ? `Bloqueados (${t7Res.bloqueadosExitosos.length}) en Triple 7` : `Error T7: ${t7Res.message}`;
                } catch (t7Err) {
                  t7Status = `Error T7: ${t7Err.message}`;
                  log(`Error en auto-bloqueo Triple 7 (Premier Sondeo ${sNum}): ${t7Err.message}`, 'log-danger');
                }
              }

              // GESTIÓN DE MEMORIA PREMIER CUPO 0: Pre-bloqueo inmediato para los siguientes N sorteos
              let siguientesSorteos = [];
              const rojosPremier = consolidated.rojosPremier || [];
              if (lot.memoriaCupoCero && lot.memoriaCupoCero.activo !== false && rojosPremier.length > 0) {
                try {
                  const cupoMem = require('./cupo_cero_memory');
                  const persistencia = Math.min(Math.max(parseInt(lot.memoriaCupoCero.sorteosPersistencia, 10) || 3, 1), 5);
                  siguientesSorteos = cupoMem.obtenerSiguientesSorteos(lot.horarios || [], result.sorteo || hStr, persistencia);

                  if (siguientesSorteos.length > 0) {
                    log(`🧠 [MEMORIA PREMIER CUPO 0] Persistencia activa (${persistencia} sorteos). Pre-bloqueando [${rojosPremier.join(', ')}] para los siguientes sorteos: ${siguientesSorteos.join(', ')}...`, 'log-info');
                    cupoMem.registrarAgotadosPremier(lot.id, lot.nombre, result.sorteo || hStr, todayStr, rojosPremier, persistencia, siguientesSorteos);

                    if (cfg.general.triple7.enabled) {
                      for (const sFuturo of siguientesSorteos) {
                        try {
                          log(`🧠 [PRE-BLOQUEO TRIPLE 7] Bloqueando ${lot.nombre} (${sFuturo}): [${rojosPremier.join(', ')}]...`, 'log-info');
                          const t7FuturoRes = await t7.bloquearNumeros(cfg, lot.nombre, sFuturo, rojosPremier);
                          log(`🧠 [PRE-BLOQUEO TRIPLE 7] Sorteo ${sFuturo}: ${t7FuturoRes.ok ? 'Bloqueado con éxito' : t7FuturoRes.message}`, t7FuturoRes.ok ? 'log-success' : 'log-warn');
                        } catch (eFuturo) {
                          log(`Aviso al pre-bloquear ${sFuturo} en Triple 7: ${eFuturo.message}`, 'log-danger');
                        }
                      }
                    }
                  }
                } catch (errMem) {
                  log(`Aviso en pre-bloqueo de memoria: ${errMem.message}`, 'log-warn');
                }
              }

              const rec = historyMgr.recordScan({
                loteria: lot.nombre,
                sorteo: targetDrawTime,
                montoSondeo: lot.montoSondeo || 3000,
                totalAnimalesAnalizados: result.totalAnimalesAnalizados || lot.totalAnimales || 38,
                rojos: consolidated.listaFinalNumeros,
                rojosPremier: consolidated.rojosPremier,
                numFijos: consolidated.numFijos,
                fijosSeleccionados: consolidated.fijosSeleccionados,
                predictivosVisualFx: consolidated.predictivosSeleccionados,
                aleatoriosSistema: consolidated.aleatoriosSeleccionados,
                memoriaCupoCero: consolidated.memoriaSeleccionados,
                numMemoriaCupoCero: consolidated.numMemoria,
                t7Status,
                t7Blocked
              });

              syncToCloudImmediate(false);

              log(`✅ [PREMIER PLUSS SONDEO ${sNum}/${sondeosActivos.length} COMPLETADO] ${lot.nombre} (${hStr} a -${premierMinutesBefore}m): Total bloqueados: ${consolidated.totalNumerosABloquear} (Premier: [${rojosPremier.join(', ') || 'Ninguno'}]) -> Triple 7: ${t7Status}`, 'log-success');

              if (cfg.general.telegram.enabled && cfg.general.telegram.botToken && cfg.general.telegram.chatId) {
                const memMsg = siguientesSorteos.length > 0 ? `\n🧠 *Pre-bloqueo Siguientes Sorteos:* ${siguientesSorteos.join(', ')}` : '';
                enviarTelegram(cfg, `🔴 *SONDEO PREMIER PLUSS REALIZADO (Sondeo ${sNum}/${sondeosActivos.length})*\n*${lot.nombre} - Sorteo ${hStr} (${premierMinutesBefore}m antes)*\n❌ Agotados (Cupo 0): ${rojosPremier.join(', ') || 'Ninguno'}${memMsg}\nTriple 7: ${t7Status}`);
              }
            } catch (e) {
              log(`Error en sondeo independiente Premier Pluss (Sondeo ${sNum}): ${e.message}`, 'log-danger');
            }
          }
        }
      }

      // =========================================================================
      // 5. DESCUENTO DE SORTEO EN MEMORIA DE PERSISTENCIA CUPO 0
      // =========================================================================
      const diffMinutes = currentTotalMinutes - drawMinutes;
      const keyDescuentoMemoria = `${todayStr}_${lot.id}_${hStr}_descuento_memoria`;
      if (diffMinutes >= 1 && !tareasEjecutadas.has(keyDescuentoMemoria)) {
        tareasEjecutadas.add(keyDescuentoMemoria);
        try {
          const cupoMem = require('./cupo_cero_memory');
          const { cambios, expirados } = cupoMem.descontarSorteo(lot.id, hStr, todayStr);
          if (expirados && expirados.length > 0) {
            log(`🧠 [MEMORIA CUPO CERO] Cumplieron sus sorteos de persistencia: ${expirados.map(e => `${e.numero} ${e.nombre}`).join(', ')}`, 'log-info');
          }
        } catch (eDesc) {}
      }

      // =========================================================================
      // 6. REGLA ESTRICTA DE REVISIÓN DE RESULTADOS EN VISUAL-FX:
      // - Intento 1: A los 5 minutos después del sorteo (+5 min)
      // - Intento 2: A los 10 minutos después del sorteo (+10 min, si el 1 no lo consiguió)
      // - Si no lo consigue tras el 2do intento, PARA por completo (máx 2 intentos por sorteo horario)
      // =========================================================================
      const keyIntento1 = `${todayStr}_${lot.id}_${hStr}_intento1`;
      const keyIntento2 = `${todayStr}_${lot.id}_${hStr}_intento2`;
      const keyResuelto = `${todayStr}_${lot.id}_${hStr}_resuelto`;
      const keyParado = `${todayStr}_${lot.id}_${hStr}_parado`;

      // Helper para manejar auto-liberación en Triple 7 cuando un número sale premiado
      async function procesarAutoLiberacionGanador(loteriaId, loteriaNombre, sorteo, ganadorNum, ganadorNom) {
        try {
          const cupoMem = require('./cupo_cero_memory');
          const liberados = cupoMem.verificarYAutoLiberarPorGanador(loteriaId, ganadorNum, ganadorNom, sorteo, todayStr);
          if (liberados && liberados.length > 0) {
            const t7 = require('./triple7_robot');
            for (const item of liberados) {
              const sorteosALiberar = item.sorteosFuturosPendientes || [];
              if (sorteosALiberar.length > 0) {
                log(`🏆🎉 [AUTO-LIBERACIÓN POR TROFEO] ¡El animal ${item.numero} (${item.nombre}) salió ganador en ${sorteo}! Liberando en Triple 7 los sorteos siguientes: [${sorteosALiberar.join(', ')}]`, 'log-success');
                if (cfg.general.triple7.enabled) {
                  for (const sHora of sorteosALiberar) {
                    try {
                      await t7.reincorporarAnimalitos(cfg, loteriaNombre, sHora);
                      log(`🔓 [TRIPLE 7 DESBLOQUEO AUTOMÁTICO] Reincorporado exitosamente ${loteriaNombre} (${sHora})`, 'log-success');
                    } catch (eReinc) {
                      log(`Aviso al reincorporar ${sHora} en Triple 7: ${eReinc.message}`, 'log-warn');
                    }
                  }
                }
                if (cfg.general.telegram.enabled) {
                  enviarTelegram(cfg, `🏆🎉 *¡AUTO-LIBERACIÓN POR GANADOR!*\n*${loteriaNombre} - Sorteo ${sorteo}*\nEl animal *${item.numero} (${item.nombre})* salió premiado. Se liberó inmediatamente en memoria y se reincorporó en Triple 7 para los sorteos siguientes: [${sorteosALiberar.join(', ')}].`);
                }
              }
            }
          }
        } catch (eAuto) {
          log(`Aviso procesando auto-liberación: ${eAuto.message}`, 'log-warn');
        }
      }

      const isVerifierNode = machinesMgr.isLocalMachineVerifier(cfg);
      const keyNoVerifierLog = `${todayStr}_${lot.id}_${hStr}_noverifier`;

      if (!isVerifierNode) {
        if (diffMinutes >= 5 && !revisionesRealizadas.has(keyNoVerifierLog)) {
          revisionesRealizadas.add(keyNoVerifierLog);
          const vMachine = machinesMgr.getVerificationMachine(cfg);
          const vNombre = vMachine ? vMachine.nombre : (cfg.general.maquinaEncargadaVerificacionesId || 'Máquina 1');
          log(`ℹ️ [MODO SÓLO PESCA] Este nodo (${cfg.general.maquinaLocalId || 'Máquina 2'}) no realiza consultas a Visual-FX. Verificaciones delegadas exclusivamente a: ${vNombre}.`, 'log-info');
        }
      } else {
        // INTENTO 1 (+5 MINUTOS TRAS EL SORTEO: ventana entre +5 y +9 minutos)
        if (diffMinutes >= 5 && diffMinutes < 10 && !revisionesRealizadas.has(keyIntento1) && !revisionesRealizadas.has(keyResuelto)) {
          revisionesRealizadas.add(keyIntento1);
          log(`🔍 [REVISIÓN RESULTADOS] Intento 1 (+5 min) para ${lot.nombre} (Sorteo ${hStr}). Consultando y sincronizando con Visual-FX...`, 'log-info');
          
          try {
            const predictive = require('./predictive_service');
            // Consultar y sincronizar dinámicamente con Visual-FX (1000Resultados / TuAzar) 5 minutos después del sorteo
            await predictive.syncVisualFxDraws(lot.id);

            const historyMgr = require('./history_manager');
            const syncRes = historyMgr.syncScheduledDrawResult(lot.id, hStr, todayStr, 1);
            if (syncRes.found) {
              revisionesRealizadas.add(keyResuelto);
              log(`✅ [RESULTADO CONFIRMADO] ${lot.nombre} (${hStr}): Animal ganador ${syncRes.winnerNumber} (${syncRes.winnerName}). ${syncRes.trophiesWon > 0 ? '🏆 ¡TROFEO OBTENIDO! Golpe de banca evitado.' : 'No estaba en la lista de bloqueos.'}`, syncRes.trophiesWon > 0 ? 'log-success' : 'log-info');
              
              // Auto-liberar sorteos futuros si estaba en memoria
              await procesarAutoLiberacionGanador(lot.id, lot.nombre, hStr, syncRes.winnerNumber, syncRes.winnerName);

              // Actualizar modelo predictivo de atrasados dinámicamente con el nuevo resultado
              const updatedAtrasados = predictive.getMostDelayedNumbers(lot.id, 5);
              const atrasadosStr = updatedAtrasados.map(d => `${d.numero} (${d.nombre}: ${d.diasAtraso}d)`).join(', ');
              log(`🔮 [MODELO PREDICTIVO ACTUALIZADO] ${lot.nombre} tras sorteo ${hStr}: Top atrasados ahora son: ${atrasadosStr}`, 'log-info');

              syncToCloudImmediate(false);

              if (syncRes.trophiesWon > 0 && cfg.general.telegram.enabled) {
                enviarTelegram(cfg, `🏆 *¡GOLPE DE BANCA EVITADO!*\n*${lot.nombre} - Sorteo ${hStr}*\nSalió el animal *${syncRes.winnerNumber} (${syncRes.winnerName})* y estaba bloqueado. ¡Trofeo obtenido en el 1er intento (+5 min)!`);
              }
            } else {
              log(`⏳ [RESULTADO PENDIENTE] Intento 1 (+5 min) para ${lot.nombre} (${hStr}): Aún no publicado en Visual-FX. Se reintentará al minuto +10.`, 'log-warn');
            }
          } catch (err) {
            log(`Aviso al consultar resultado intento 1: ${err.message}`, 'log-warn');
          }
        }

        // INTENTO 2 (+10 MINUTOS TRAS EL SORTEO - SÓLO SI EL INTENTO 1 NO LO CONSIGUIÓ)
        if (diffMinutes >= 10 && diffMinutes < 60 && !revisionesRealizadas.has(keyIntento2) && !revisionesRealizadas.has(keyResuelto) && !revisionesRealizadas.has(keyParado)) {
          revisionesRealizadas.add(keyIntento2);
          log(`🔍 [REVISIÓN RESULTADOS] Intento 2 y FINAL (+10 min) para ${lot.nombre} (Sorteo ${hStr}). Consultando y sincronizando con Visual-FX...`, 'log-info');
          
          try {
            const predictive = require('./predictive_service');
            // Reintentar sincronización activa con Visual-FX
            await predictive.syncVisualFxDraws(lot.id);

            const historyMgr = require('./history_manager');
            const syncRes = historyMgr.syncScheduledDrawResult(lot.id, hStr, todayStr, 2);
            if (syncRes.found) {
              revisionesRealizadas.add(keyResuelto);
              log(`✅ [RESULTADO CONFIRMADO] ${lot.nombre} (${hStr}): Animal ganador ${syncRes.winnerNumber} (${syncRes.winnerName}). ${syncRes.trophiesWon > 0 ? '🏆 ¡TROFEO OBTENIDO! Golpe de banca evitado.' : 'No estaba en la lista de bloqueos.'}`, syncRes.trophiesWon > 0 ? 'log-success' : 'log-info');
              
              // Auto-liberar sorteos futuros si estaba en memoria
              await procesarAutoLiberacionGanador(lot.id, lot.nombre, hStr, syncRes.winnerNumber, syncRes.winnerName);

              // Actualizar modelo predictivo de atrasados dinámicamente con el nuevo resultado
              const updatedAtrasados = predictive.getMostDelayedNumbers(lot.id, 5);
              const atrasadosStr = updatedAtrasados.map(d => `${d.numero} (${d.nombre}: ${d.diasAtraso}d)`).join(', ');
              log(`🔮 [MODELO PREDICTIVO ACTUALIZADO] ${lot.nombre} tras sorteo ${hStr}: Top atrasados ahora son: ${atrasadosStr}`, 'log-info');

              syncToCloudImmediate(false);

              if (syncRes.trophiesWon > 0 && cfg.general.telegram.enabled) {
                enviarTelegram(cfg, `🏆 *¡GOLPE DE BANCA EVITADO!*\n*${lot.nombre} - Sorteo ${hStr}*\nSalió el animal *${syncRes.winnerNumber} (${syncRes.winnerName})* y estaba bloqueado. ¡Trofeo obtenido en el 2do intento (+10 min)!`);
              }
            } else {
              revisionesRealizadas.add(keyParado);
              log(`🛑 [DETENIENDO CONSULTAS] Intento 2 (+10 min) para ${lot.nombre} (${hStr}): No publicado en Visual-FX. Se detienen las consultas para este sorteo (máximo 2 intentos alcanzado).`, 'log-warn');
            }
          } catch (err) {
            log(`Aviso al consultar resultado intento 2: ${err.message}`, 'log-warn');
          }
        }
      }
    }
  }
}, 30000);

// Sincronización continua de fondo Nodo Local -> Render (cada 45 segundos)
if (!process.env.RENDER && !process.env.IS_RENDER) {
  setInterval(() => {
    try {
      syncToCloudImmediate(false);
    } catch (e) {}
  }, 45000);
}

// Worker de recepción de órdenes remotas desde la Web (Render) vía Supabase
let isProcessingCloudCommand = false;
function startCloudCommandWorker() {
  if (process.platform !== 'win32') return; // Solo la máquina física con Windows ejecuta

  const cloudStore = require('./cloud_store');
  const robot = require('./premier_robot');

  // Broadcast periódico del estado de automatización local a Supabase (cada 2.5s)
  setInterval(() => {
    try {
      const ctrl = robot.getEstadoControl();
      cloudStore.saveAutomationStatus(ctrl).catch(() => {});
    } catch (e) {}
  }, 2500);

  setInterval(async () => {
    if (isProcessingCloudCommand) return;
    try {
      const cmd = await cloudStore.getLatestCommand();
      if (cmd && cmd.status === 'PENDING') {
        const age = Date.now() - new Date(cmd.createdAt).getTime();
        if (age > 120000) {
          await cloudStore.updateCommand(cmd.id, 'EXPIRED', { message: 'Comando expirado por tiempo' });
          return;
        }

        isProcessingCloudCommand = true;
        log(`📥 [CLOUD BRIDGE] Orden recibida desde la Web: ${cmd.command}`, 'log-warn');
        await cloudStore.updateCommand(cmd.id, 'PROCESSING');

        if (cmd.command === 'PAUSE') {
          robot.pausarSondeo();
          await cloudStore.updateCommand(cmd.id, 'COMPLETED', { ok: true, message: 'Automatización pausada' });
          log(`⏸️ [CLOUD BRIDGE] Comando PAUSA ejecutado con éxito`, 'log-warn');
        } else if (cmd.command === 'RESUME') {
          robot.reanudarSondeo();
          await cloudStore.updateCommand(cmd.id, 'COMPLETED', { ok: true, message: 'Automatización reanudada' });
          log(`▶️ [CLOUD BRIDGE] Comando REANUDAR ejecutado con éxito`, 'log-info');
        } else if (cmd.command === 'STOP') {
          robot.detenerSondeo();
          await cloudStore.updateCommand(cmd.id, 'COMPLETED', { ok: true, message: 'Automatización detenida' });
          log(`🛑 [CLOUD BRIDGE] Comando DETENCIÓN ejecutado con éxito`, 'log-danger');
        } else if (cmd.command === 'RESTART') {
          robot.detenerSondeo();
          setTimeout(async () => {
            const cfg = getConfig();
            const targetId = cmd.payload && cmd.payload.loteriaId;
            let loteria = (cfg && cfg.loterias && cfg.loterias.find(l => l.id === targetId)) || (cfg && cfg.loterias && cfg.loterias.find(l => l.activo)) || (cfg && cfg.loterias && cfg.loterias[0]);
            try {
              const predictive = require('./predictive_service');
              const horaSorteo = predictive.calcularProximoSorteo(loteria.horarios) || '';
              robot.ejecutarSondeoPremier(cfg, loteria.id, horaSorteo);
            } catch (e) {}
          }, 1000);
          await cloudStore.updateCommand(cmd.id, 'COMPLETED', { ok: true, message: 'Proceso reiniciado' });
          log(`🔄 [CLOUD BRIDGE] Comando REINICIO ejecutado con éxito`, 'log-warn');
        } else if (cmd.command === 'TRIGGER_SONDEO') {
          let sendResult = null;
          const fakeReq = { body: cmd.payload || {} };
          const fakeRes = {
            json: (data) => { sendResult = data; },
            status: (code) => ({ json: (data) => { sendResult = { ...data, statusCode: code }; } })
          };

          await handleExecuteSondeoNowInternal(fakeReq, fakeRes);
          const ok = sendResult && sendResult.ok !== false && !sendResult.error;
          await cloudStore.updateCommand(cmd.id, ok ? 'COMPLETED' : 'FAILED', sendResult);
          log(`📤 [CLOUD BRIDGE] Orden ${cmd.id} reportada a la nube como: ${ok ? 'COMPLETADA CON ÉXITO' : 'FALLIDA'}`, ok ? 'log-success' : 'log-danger');
        } else {
          await cloudStore.updateCommand(cmd.id, 'COMPLETED', { ok: true, message: 'Comando finalizado' });
        }
      }
    } catch (err) {
      console.warn(`[CLOUD BRIDGE ERROR] ${err.message}`);
    } finally {
      isProcessingCloudCommand = false;
    }
  }, 1800);
}

app.listen(PORT, () => {
  log(`🚀 Servidor de la Suite activo en http://localhost:${PORT}`, 'log-success');
  startCloudflareTunnel();
  startCloudCommandWorker();
});
