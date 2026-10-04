const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONTROL_PATH = path.join(__dirname, 'automation_control.json');
let activeChildProcess = null;
const sondeoQueue = [];
let isProcessingQueue = false;

function setControlAction(action) {
  try {
    let data = {};
    if (fs.existsSync(CONTROL_PATH)) {
      data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf8'));
    }
    data.requestedAction = action;
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(CONTROL_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[CONTROL ERROR] Error actualizando control file: ${err.message}`);
    return false;
  }
}

function getEstadoControl() {
  try {
    if (fs.existsSync(CONTROL_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf8'));
      data.isRunning = !!activeChildProcess || isProcessingQueue;
      data.colaPendientes = sondeoQueue.length;
      return data;
    }
  } catch (e) {}
  return { status: 'IDLE', requestedAction: 'NONE', isRunning: !!activeChildProcess || isProcessingQueue, colaPendientes: sondeoQueue.length };
}

function pausarSondeo() {
  console.log('[ROBOT PREMIER] Solicitando PAUSA...');
  return setControlAction('PAUSE');
}

function reanudarSondeo() {
  console.log('[ROBOT PREMIER] Solicitando REANUDAR...');
  return setControlAction('RESUME');
}

function detenerSondeo() {
  console.log('[ROBOT PREMIER] Solicitando DETENCIÓN TOTAL...');
  setControlAction('STOP');

  // Cancelar tareas que estén esperando en la cola
  while (sondeoQueue.length > 0) {
    const item = sondeoQueue.shift();
    item.resolve({
      sorteo: 'Cancelado por detención total',
      rojos: [],
      naranjas: [],
      cancelado: true
    });
  }

  if (activeChildProcess && activeChildProcess.pid) {
    const pid = activeChildProcess.pid;
    console.log(`[ROBOT PREMIER] Terminando proceso PowerShell árbol PID: ${pid}`);
    try {
      exec(`taskkill /F /T /PID ${pid}`, (err) => {
        if (err) console.warn(`[ROBOT PREMIER] taskkill aviso: ${err.message}`);
      });
    } catch (e) {}
    activeChildProcess = null;
  }

  // Actualizar estado en archivo a STOPPED
  try {
    const data = getEstadoControl();
    data.status = 'STOPPED';
    data.requestedAction = 'NONE';
    data.details = 'Detenido por el usuario';
    data.isRunning = false;
    fs.writeFileSync(CONTROL_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}

  return true;
}

/**
 * Ejecutor interno individual de un sondeo
 */
function ejecutarSondeoInternal(config, loteriaId, horaSorteo = '', cerrarAlFinalizar = false) {
  return new Promise((resolve, reject) => {
    let loteria = config.loterias.find(l => l.id === loteriaId);
    if (!loteria) {
      loteria = config.loterias.find(l => l.activo) || config.loterias[0];
    }
    const montoSondeo = loteria ? loteria.montoSondeo : 3000;

    console.log(`[ROBOT PREMIER] Iniciando sondeo para ${loteria.nombre} (${horaSorteo || 'Próximo Sorteo'}) con monto ${montoSondeo} Bs...`);

    const psScript = path.join(__dirname, 'scripts', 'sondeo_completo.ps1');
    if (!fs.existsSync(psScript)) {
      return reject(new Error(`No se encontró el script de automatización: ${psScript}`));
    }

    // Inicializar estado de control
    try {
      fs.writeFileSync(CONTROL_PATH, JSON.stringify({
        status: 'RUNNING',
        requestedAction: 'NONE',
        details: `Iniciando sondeo para ${loteria.nombre} (${horaSorteo || 'Próximo'})`,
        loteria: loteria.nombre,
        horaSorteo: horaSorteo || '',
        currentAnimal: '',
        progress: 'Iniciando',
        pid: null,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (e) {}

    const horaParam = horaSorteo ? ` -HoraSorteo "${horaSorteo}"` : '';
    const cerrarParam = cerrarAlFinalizar ? ' -CerrarAlFinalizar' : '';
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${psScript}" -Loteria "${loteria.nombre}" -MontoSondeo ${montoSondeo}${horaParam}${cerrarParam}`;

    const child = exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      activeChildProcess = null;

      if (error) {
        console.error(`[ROBOT PREMIER FIN/ERROR] ${error.message}`);
        // Verificar si se alcanzó a generar el JSON o si fue cancelado
        try {
          if (stdout && stdout.includes('JSON_OUTPUT_START') && stdout.includes('JSON_OUTPUT_END')) {
            const jsonText = stdout.split('JSON_OUTPUT_START')[1].split('JSON_OUTPUT_END')[0].trim();
            const parsed = JSON.parse(jsonText);
            return resolve(parsed);
          }
        } catch (e) {}

        if (error.code === 99 || (stdout && stdout.includes('[CONTROL] Detencion'))) {
          return resolve({
            sorteo: horaSorteo || 'Cancelado por usuario',
            rojos: [],
            naranjas: [],
            cancelado: true,
            rawOutput: stdout
          });
        }
        return reject(new Error(`${error.message} - ${stderr || stdout}`));
      }

      console.log(`[ROBOT PREMIER OUTPUT COMPLETO]`);

      try {
        if (stdout.includes('JSON_OUTPUT_START') && stdout.includes('JSON_OUTPUT_END')) {
          const jsonText = stdout.split('JSON_OUTPUT_START')[1].split('JSON_OUTPUT_END')[0].trim();
          const parsed = JSON.parse(jsonText);
          return resolve(parsed);
        }

        const jsonMatch = stdout.match(/\{[\s\S]*"rojos"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return resolve(parsed);
        }
      } catch (parseErr) {
        console.warn(`[ROBOT PREMIER] Advertencia al parsear JSON: ${parseErr.message}`);
      }

      resolve({
        sorteo: horaSorteo || 'Próximo Sorteo',
        rojos: [],
        naranjas: [],
        rawOutput: stdout
      });
    });

    activeChildProcess = child;
  });
}

/**
 * Procesar la cola FIFO de sondeos de manera secuencial (1 a la vez para no colisionar con la taquilla)
 */
async function procesarColaSondeos() {
  if (isProcessingQueue) return;
  if (sondeoQueue.length === 0) return;

  isProcessingQueue = true;
  const currentTask = sondeoQueue.shift();

  try {
    const result = await ejecutarSondeoInternal(currentTask.config, currentTask.loteriaId, currentTask.horaSorteo, currentTask.cerrarAlFinalizar);
    currentTask.resolve(result);
  } catch (err) {
    currentTask.reject(err);
  } finally {
    isProcessingQueue = false;
    if (sondeoQueue.length > 0) {
      console.log(`[ROBOT PREMIER COLA] Siguiente sondeo en espera (${sondeoQueue.length} pendiente(s)). Iniciando en 1s...`);
      setTimeout(procesarColaSondeos, 1000);
    }
  }
}

/**
 * Encolar o ejecutar sondeo en Premier Pluss 2.0
 */
function ejecutarSondeoPremier(config, loteriaId, horaSorteo = '', cerrarAlFinalizar = false) {
  return new Promise((resolve, reject) => {
    sondeoQueue.push({ config, loteriaId, horaSorteo, cerrarAlFinalizar, resolve, reject });
    if (isProcessingQueue) {
      console.log(`[ROBOT PREMIER COLA] Hay un sondeo en curso en la taquilla. ${loteriaId} (${horaSorteo || 'Próximo'}) queda en cola de espera (Posición #${sondeoQueue.length}).`);
    }
    procesarColaSondeos();
  });
}

module.exports = {
  ejecutarSondeoPremier,
  pausarSondeo,
  reanudarSondeo,
  detenerSondeo,
  getEstadoControl
};
