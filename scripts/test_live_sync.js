const { syncGame } = require('C:/Users/Hector/Fenix_2026_1/PROYECTO_VISUAL_FX/lottery_engine.js');
const { getColdNumbers } = require('C:/Users/Hector/Fenix_2026_1/PROYECTO_VISUAL_FX/lottery_stats.js');

async function testSync() {
  console.log('--- SYNCING LIVE DRAWS FROM VISUAL-FX SCRAPERS ---');
  for (const g of ['guacharo-activo', 'lotto-activo', 'la-granjita', 'guacharito-millonario']) {
    try {
      await syncGame(g);
      console.log(`Synced ${g}`);
    } catch (e) {
      console.error(`Error syncing ${g}:`, e.message);
    }
  }

  console.log('\n--- TOP 5 COLD NUMBERS (MENOS SALIDOS 30 DÍAS / POR REVENTAR) ---');
  for (const g of ['guacharo-activo', 'lotto-activo', 'la-granjita', 'guacharito-millonario']) {
    const cold = getColdNumbers(g, 5);
    console.log(`\n[${g.toUpperCase()}]:`);
    cold.forEach((item, idx) => {
      console.log(`  #${idx + 1}: ${item.number} (${item.name}) -> Salidas: ${item.occurrences}, Días sin salir: ${item.daysOverdue}d`);
    });
  }
}

testSync();
