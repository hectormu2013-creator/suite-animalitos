const t7 = require('../triple7_robot');
const cfg = require('../config.json');

async function main() {
  console.log('========================================================');
  console.log('   LIMPIEZA TOTAL DE BLOQUEOS EN TRIPLE 7 (TODAS LAS HORAS)');
  console.log('========================================================');
  
  const res = await t7.limpiarTodosLosBloqueos(cfg);
  console.log(`\nSorteos con bloqueos detectados: ${res.totalEncontrados || 0}`);
  console.log(`Sorteos reincorporados (limpiados a 0): ${res.totalReincorporados || 0}`);
  if (res.detalles && res.detalles.length > 0) {
    res.detalles.forEach(d => {
      console.log(` -> ${d.loteria} (${d.sorteo}): ${d.ok ? 'LIMPIO ✅' : 'ERROR: ' + d.error}`);
    });
  } else {
    console.log(' -> La plataforma Triple 7 ya se encuentra 100% libre de bloqueos.');
  }

  // Verificación final en vivo
  console.log('\n--- VERIFICACIÓN FINAL EN VIVO ---');
  const estadoFinal = await t7.obtenerEstadoBloqueos(cfg);
  const restantes = (estadoFinal.draws || []).filter(d => d.bloqueado);
  console.log(`Total sorteos gestionados: ${estadoFinal.totalGestionados}`);
  console.log(`Total sorteos bloqueados activos restantes: ${restantes.length}`);
  if (restantes.length > 0) {
    console.log('Aún quedan con bloqueos:', restantes.map(r => `${r.loteria} ${r.sorteo}: [${r.animalesBloqueados.join(', ')}]`));
  } else {
    console.log('🎉 ¡PERFECTO! TODOS los sorteos de TODAS las loterías en TODAS sus horas están 100% LIMPIOS.');
  }
}

main().catch(err => {
  console.error('Error durante limpieza total:', err);
  process.exit(1);
});
