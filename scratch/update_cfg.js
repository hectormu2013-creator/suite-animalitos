const fs = require('fs');
const cloudStore = require('../cloud_store');

async function update() {
  const cfgPath = 'config.json';
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  for (const lot of cfg.loterias) {
    lot.sorteosSondeoActivos = [...(lot.horarios || [])];
  }
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('config.json guardado en disco con sorteosSondeoActivos.');

  const res = await cloudStore.saveMasterConfig(cfg);
  console.log('Sincronizado con Supabase Cloud:', res);
}

update().catch(console.error);
