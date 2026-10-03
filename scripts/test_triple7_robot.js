const fs = require('fs');
const path = require('path');
const t7Robot = require('../triple7_robot');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

(async () => {
  console.log('=== TEST UNITARIO DE triple7_robot.js ===');

  console.log('1. Probando obtenerEstadoBloqueos()...');
  const estado = await t7Robot.obtenerEstadoBloqueos(config);
  console.log('Resultado obtenerEstadoBloqueos:', estado.ok, `(Total sorteos activos: ${estado.draws ? estado.draws.length : 0})`);
  if (estado.draws && estado.draws.length > 0) {
    console.log('Muestra de sorteos activos:', estado.draws.slice(0, 3));
  }

  // Sorteo de prueba para bloqueo y desbloqueo
  // Tomamos el último sorteo de la lista (por ejemplo de las 08:15 PM o 09:00 PM) para máxima seguridad
  const targetDraw = estado.draws ? estado.draws[estado.draws.length - 1] : null;
  if (!targetDraw) {
    console.log('No hay sorteos activos.');
    return;
  }

  console.log(`\n2. Probando bloquearNumeros() en ${targetDraw.loteria} - ${targetDraw.sorteo}...`);
  // Bloquear animal "00" (Ballena) o "04"
  const blockRes = await t7Robot.bloquearNumeros(config, targetDraw.loteria, targetDraw.sorteo, ['00']);
  console.log('Resultado de bloqueo:', blockRes);

  console.log(`\n3. Probando reincorporarAnimalitos() en ${targetDraw.loteria} - ${targetDraw.sorteo}...`);
  const unblockRes = await t7Robot.reincorporarAnimalitos(config, targetDraw.loteria, targetDraw.sorteo);
  console.log('Resultado de reincorporación:', unblockRes);

  console.log('\n=== TEST FINALIZADO CON ÉXITO ===');
})();
