const path = require('path');
const fs = require('fs');

async function unblockAllTriple7() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    playwright = require(path.join(__dirname, '..', '..', 'triple7_automation', 'node_modules', 'playwright'));
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const t7Config = config.general.triple7;
    const loginUrl = t7Config.loginUrl || 'https://ny7.undo.it/index.php';
    const targetUrl = t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';
    const user = t7Config.user || 'AREYES';
    const pass = t7Config.password || '220126';

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('dialog', async d => await d.accept().catch(() => {}));

    console.log(`[TRIPLE 7] Autenticando como ${user}...`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.fill('input[name="usuario"], input[name="user"], #usuario', user);
    await page.fill('input[name="password"], input[name="clave"], #password, #clave', pass);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(3000);

    console.log(`[TRIPLE 7] Cargando lista de sorteos: ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Encontrar todos los sorteos con botón de reincorporar
    const blockedDraws = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const tds = Array.from(rows[i].querySelectorAll('td'));
        if (tds.length < 4) continue;
        const btn = tds[3].querySelector('input[value="REINCORPORAR ANIMALITOS"]');
        if (btn) {
          const onclickAttr = btn.getAttribute('onclick') || '';
          const idsolMatch = (onclickAttr || tds[2].innerHTML).match(/(?:detalle_ticket|idsol=)\(?(\d+)/);
          const idsol = idsolMatch ? idsolMatch[1] : '';
          items.push({
            loteria: tds[0].innerText.trim(),
            sorteo: tds[1].innerText.trim(),
            idsol
          });
        }
      }
      return items;
    });

    console.log(`[TRIPLE 7] Sorteos actualmente bloqueados encontrados: ${blockedDraws.length}`);
    for (const b of blockedDraws) {
      console.log(` -> ${b.loteria} (${b.sorteo}) [idsol: ${b.idsol}]`);
    }

    if (blockedDraws.length === 0) {
      console.log('[TRIPLE 7] No hay sorteos bloqueados actualmente.');
      await browser.close();
      return { ok: true, unblocked: 0 };
    }

    // Desbloquear cada uno
    const unblockedResults = [];
    for (const item of blockedDraws) {
      if (!item.idsol) continue;
      console.log(`[TRIPLE 7 DESBLOQUEANDO] ${item.loteria} (${item.sorteo}) idsol: ${item.idsol}...`);
      try {
        const resp = await page.request.post('https://ny7.undo.it/Venta_Animalitos/reiniciar_animalitos.php', {
          form: {
            nticket: item.idsol,
            jtipo: '0',
            modulo: '2'
          }
        });
        const respText = await resp.text();
        console.log(`[TRIPLE 7 RESPUESTA] HTTP ${resp.status()} | ${respText.trim().slice(0, 80)}`);
        unblockedResults.push({ ...item, status: resp.status() });
      } catch (errReq) {
        console.error(`[TRIPLE 7 ERROR DESBLOQUEO] ${item.loteria}: ${errReq.message}`);
      }
    }

    // Recargar para verificar
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    const remainingBlocked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      let count = 0;
      for (let i = 1; i < rows.length; i++) {
        const tds = Array.from(rows[i].querySelectorAll('td'));
        if (tds.length >= 4 && tds[3].querySelector('input[value="REINCORPORAR ANIMALITOS"]')) {
          count++;
        }
      }
      return count;
    });

    console.log(`[TRIPLE 7 VERIFICACIÓN] Sorteos bloqueados restantes tras reincorporar: ${remainingBlocked}`);
    
    // Captura de evidencia del estado limpio
    const cleanScreenshot = path.join(__dirname, '..', 'data', 'triple7_limpio_todos_desbloqueados.png');
    await page.screenshot({ path: cleanScreenshot });
    console.log(`[TRIPLE 7 CAPTURA] Guardada en: ${cleanScreenshot}`);

    await browser.close();
    return { ok: remainingBlocked === 0, unblocked: unblockedResults.length, remaining: remainingBlocked };

  } catch (err) {
    await browser.close().catch(() => {});
    console.error(`[TRIPLE 7 ERROR FATAL] ${err.message}`);
    return { ok: false, error: err.message };
  }
}

if (require.main === module) {
  unblockAllTriple7().then(res => {
    console.log('Resultado final:', JSON.stringify(res, null, 2));
    process.exit(res.ok ? 0 : 1);
  });
}

module.exports = { unblockAllTriple7 };
