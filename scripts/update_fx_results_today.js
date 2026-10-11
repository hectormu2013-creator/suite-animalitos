const fs = require('fs');
const path = require('path');
const scraper = require('../scraper_service');

const fxPath = 'C:\\Users\\Hector\\Fenix_2026_1\\PROYECTO_VISUAL_FX\\data\\lottery_results.json';

async function updateFxResultsToday() {
  if (!fs.existsSync(fxPath)) {
    console.log('Visual-FX file not found, skipping');
    return;
  }

  const fxData = JSON.parse(fs.readFileSync(fxPath, 'utf8') || '{}');
  const today = '2026-10-11';
  if (!fxData[today]) fxData[today] = {};

  const lotteries = [
    { slug: 'guacharo-activo', name: 'GUACHARO ACTIVO', shortName: 'Guacharo' },
    { slug: 'la-granjita', name: 'LA GRANJITA', shortName: 'Granjita' },
    { slug: 'lotto-activo', name: 'LOTTO ACTIVO', shortName: 'Lotto' },
    { slug: 'guacharito-millonario', name: 'GUACHARITO MILLONARIO', shortName: 'Guacharito' },
    { slug: 'selva-plus', name: 'SELVA PLUS', shortName: 'Selva Plus' }
  ];

  for (const lot of lotteries) {
    const draws = await scraper.scrape1000Resultados(lot.slug);
    if (draws && draws.length > 0) {
      fxData[today][lot.slug] = {
        gameId: lot.slug,
        id: lot.slug,
        name: lot.name,
        shortName: lot.shortName,
        type: 'animalitos',
        lastUpdated: new Date().toISOString(),
        draws: draws
      };
      console.log(`Updated Visual-FX for ${lot.name}: ${draws.length} draws`);
    }
  }

  fs.writeFileSync(fxPath, JSON.stringify(fxData, null, 2), 'utf8');
  console.log('Visual-FX lottery_results.json saved for today!');
}

updateFxResultsToday().catch(console.error);
