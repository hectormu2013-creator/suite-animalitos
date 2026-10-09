const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const loteriaArg = args[0] || 'GUACHARO ACTIVO';
  const horaSorteoArg = args[1] || '';
  const rojosArg = args[2] || '';

  const configPath = path.join(__dirname, '..', 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ [BLOQUEO DIRECTO] No se encontró config.json');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const predictive = require('../predictive_service');
  const historyMgr = require('../history_manager');
  const triple7 = require('../triple7_robot');

  // Localizar lotería
  let lot = config.loterias.find(l => 
    l.id.toUpperCase() === loteriaArg.toUpperCase() || 
    l.nombre.toUpperCase() === loteriaArg.toUpperCase() ||
    l.nombre.toUpperCase().includes(loteriaArg.toUpperCase())
  );
  if (!lot) {
    lot = config.loterias.find(l => l.activo) || config.loterias[0];
  }

  const horaSorteo = horaSorteoArg || predictive.calcularProximoSorteo(lot.horarios) || '12:00';
  const rojosPremier = rojosArg ? rojosArg.split(',').map(s => s.trim()).filter(Boolean) : [];

  console.log(`\n======================================================================`);
  console.log(`🛡️  EJECUTANDO BLOQUEO DIRECTO EN TRIPLE 7 PARA ${lot.nombre}`);
  console.log(`======================================================================`);
  console.log(`📌 Sorteo destino: ${horaSorteo}`);
  console.log(`🔴 Agotados Premier detectados (Cupo 0): [${rojosPremier.join(', ') || 'Ninguno'}]`);

  // 1. Consolidar reglas de bloqueo (Premier + Fijos + Visual-FX + Memoria)
  const premierResult = {
    sorteo: horaSorteo,
    rojos: rojosPremier,
    totalAnimalesAnalizados: lot.totalAnimales || 38
  };
  const consolidated = predictive.buildConsolidatedBlockList(config, lot.id, premierResult, horaSorteo);

  console.log(`🎯 Lista consolidada para Triple 7 (Tope máx ${consolidated.maximoBloqueosConfigurado}): [${consolidated.listaFinalNumeros.join(', ')}]`);

  // 2. Ejecutar Bloqueo en Triple 7
  let t7Res = { ok: false, message: 'Triple 7 desactivado' };
  if (config.general.triple7 && config.general.triple7.enabled !== false && consolidated.listaFinalNumeros.length > 0) {
    console.log(`📡 Conectando a Triple 7 (${config.general.triple7.url || 'ny7.undo.it'})...`);
    try {
      t7Res = await triple7.bloquearNumeros(config, lot.nombre, horaSorteo, consolidated.listaFinalNumeros);
      if (t7Res.ok) {
        console.log(`✅ [TRIPLE 7 ÉXITO] ¡Números bloqueados correctamente!`);
        if (t7Res.bloqueadosExitosos && t7Res.bloqueadosExitosos.length > 0) {
          console.log(`   Animales protegidos: ${t7Res.bloqueadosExitosos.map(b => `${b.numero} (${b.animal || ''})`).join(', ')}`);
        }
      } else {
        console.warn(`⚠️ [TRIPLE 7 AVISO] ${t7Res.message || 'Sin confirmación de bloqueo'}`);
      }
    } catch (e) {
      console.error(`❌ [TRIPLE 7 ERROR] Falla al comunicar con Triple 7: ${e.message}`);
      t7Res = { ok: false, message: e.message };
    }
  } else if (!config.general.triple7 || config.general.triple7.enabled === false) {
    console.log(`ℹ️ [TRIPLE 7] Módulo desactivado en config.json.`);
  } else {
    console.log(`ℹ️ [TRIPLE 7] No hubo números para bloquear en este sorteo.`);
  }

  // 3. Registrar en Historial
  try {
    const statusText = t7Res.ok 
      ? `Bloqueados (${t7Res.bloqueadosExitosos ? t7Res.bloqueadosExitosos.length : consolidated.listaFinalNumeros.length}) en Triple 7` 
      : (t7Res.message || 'Pendiente');

    historyMgr.recordScan({
      loteria: lot.nombre,
      sorteo: horaSorteo,
      montoSondeo: lot.montoSondeo || 3000,
      totalAnimalesAnalizados: lot.totalAnimales || 38,
      rojos: consolidated.listaFinalNumeros,
      rojosPremier: consolidated.rojosPremier,
      numFijos: consolidated.numFijos,
      fijosSeleccionados: consolidated.fijosSeleccionados,
      predictivosVisualFx: consolidated.predictivosSeleccionados,
      cantidadPredictivosConfigurada: parseInt(lot.cantidadPredictivosABloquear, 10) || 0,
      aleatoriosSistema: consolidated.aleatoriosSeleccionados,
      cantidadAleatoriosConfigurada: parseInt(lot.cantidadAleatoriosABloquear, 10) || 0,
      memoriaCupoCero: consolidated.memoriaSeleccionados,
      numMemoriaCupoCero: consolidated.numMemoria,
      t7Status: statusText,
      t7Blocked: !!t7Res.ok
    });
    console.log(`📋 Registro guardado en historial (CSV y JSON).`);
  } catch (errH) {
    console.warn(`Aviso historial: ${errH.message}`);
  }

  // 4. Registrar en Memoria de Cupo Cero
  if (lot.memoriaCupoCero && lot.memoriaCupoCero.activo !== false && rojosPremier.length > 0) {
    try {
      const cupoMem = require('../cupo_cero_memory');
      const todayStr = new Date().toISOString().slice(0, 10);
      const persistencia = Math.min(Math.max(parseInt(lot.memoriaCupoCero.sorteosPersistencia, 10) || 3, 1), 5);
      const siguientesSorteos = cupoMem.obtenerSiguientesSorteos(lot.horarios || [], horaSorteo, persistencia);
      if (siguientesSorteos.length > 0) {
        cupoMem.registrarAgotadosPremier(lot.id, lot.nombre, horaSorteo, todayStr, rojosPremier, persistencia, siguientesSorteos);
        console.log(`🧠 Memoria Premier registrada para próximos sorteos: [${siguientesSorteos.join(', ')}]`);
      }
    } catch (eM) {}
  }

  console.log(`======================================================================\n`);
}

main().catch(err => {
  console.error(`Error fatal en bloqueo directo: ${err.message}`);
  process.exit(1);
});
