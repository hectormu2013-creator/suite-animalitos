const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONTROL_PATH = path.join(__dirname, 'automation_control.json');
let activeChildProcess = null;

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
      data.isRunning = !!activeChildProcess;
      return data;
    }
  } catch (e) {}
  return { status: 'IDLE', requestedAction: 'NONE', isRunning: !!activeChildProcess };
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
 * Robot de extracción y sondeo en Premier Pluss 2.0
 */
async function ejecutarSondeoPremier(config, loteriaId) {
  return new Promise((resolve, reject) => {
    // Si ya hay un proceso corriendo, advertir o detener el previo
    if (activeChildProcess) {
      detenerSondeo();
    }

    let loteria = config.loterias.find(l => l.id === loteriaId);
    if (!loteria) {
      loteria = config.loterias.find(l => l.activo) || config.loterias[0];
    }
    const montoSondeo = loteria ? loteria.montoSondeo : 3000;

    console.log(`[ROBOT PREMIER] Iniciando sondeo para ${loteria.nombre} con monto ${montoSondeo} Bs...`);

    const psScript = path.join(__dirname, 'scripts', 'sondeo_completo.ps1');
    if (!fs.existsSync(psScript)) {
      return reject(new Error(`No se encontró el script de automatización: ${psScript}`));
    }

    // Inicializar estado de control
    try {
      fs.writeFileSync(CONTROL_PATH, JSON.stringify({
        status: 'RUNNING',
        requestedAction: 'NONE',
        details: `Iniciando sondeo para ${loteria.nombre}`,
        loteria: loteria.nombre,
        currentAnimal: '',
        progress: 'Iniciando',
        pid: null,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (e) {}

    const command = `powershell.exe -ExecutionPolicy Bypass -File "${psScript}" -Loteria "${loteria.nombre}" -MontoSondeo ${montoSondeo}`;

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
            sorteo: 'Cancelado por usuario',
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
        sorteo: 'Próximo Sorteo',
        rojos: [],
        naranjas: [],
        rawOutput: stdout
      });
    });

    activeChildProcess = child;
  });
}

module.exports = {
  ejecutarSondeoPremier,
  pausarSondeo,
  reanudarSondeo,
  detenerSondeo,
  getEstadoControl
};
