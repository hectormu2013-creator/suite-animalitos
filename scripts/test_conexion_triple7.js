const path = require('path');
const cfg = require(path.join(__dirname, '..', 'config.json'));
const t7 = require(path.join(__dirname, '..', 'triple7_robot'));

async function main() {
  console.log('===============================================================');
  console.log('🌐 DIAGNOSTICO DE CONEXION Y ACCESO A TRIPLE 7 (ny7.undo.it)');
  console.log('===============================================================\n');

  console.log(`Usuario configurado: ${cfg.general.triple7.user}`);
  console.log(`URL de acceso:       ${cfg.general.triple7.loginUrl}`);
  console.log(`Modulo de bloqueo:   ${cfg.general.triple7.url}`);
  console.log('\n[1/3] Iniciando navegador Playwright y autenticando...');

  try {
    const estado = await t7.obtenerEstadoBloqueos(cfg);

    if (estado && estado.ok) {
      console.log('\n✅ [2/3] Autenticacion exitosa en Triple 7.');
      console.log(`✅ [3/3] Modulo de bloqueos cargado correctamente.`);
      console.log(`\n📊 Sorteos disponibles actualmente en plataforma: ${estado.draws ? estado.draws.length : 0}`);

      if (estado.draws && estado.draws.length > 0) {
        console.log('\n--- MUESTRA DE SORTEOS ACTIVOS EN TRIPLE 7 ---');
        estado.draws.slice(0, 15).forEach((d, idx) => {
          console.log(`  [${(idx + 1).toString().padStart(2, '0')}] ${d.loteria.padEnd(25)} | Sorteo: ${d.sorteo.padEnd(10)} | Bloqueados: ${d.bloqueados || 0}`);
        });
        console.log('----------------------------------------------');
      }

      console.log('\n🎉 ¡CONEXION Y ACCESO A TRIPLE 7 CONFIRMADOS AL 100%!');
    } else {
      console.warn(`\n⚠️ Aviso de Triple 7: ${estado.message || 'Respuesta incompleta'}`);
    }
  } catch (err) {
    console.error(`\n❌ Error conectando a Triple 7: ${err.message}`);
  }

  console.log('\n===============================================================');
}

main();
