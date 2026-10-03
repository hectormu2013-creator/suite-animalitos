const path = require('path');
const fs = require('fs');

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require(path.join(__dirname, '..', '..', 'triple7_automation', 'node_modules', 'playwright'));
}
const { chromium } = playwright;

(async () => {
  console.log('=== INSPECCIONANDO DETALLE TÉCNICO DE lista_sor_ag.php ===');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('popup', async popup => { await popup.close().catch(() => {}); });
  page.on('dialog', async d => { console.log('Dialog:', d.message()); await d.accept().catch(() => {}); });

  try {
    await page.goto('https://ny7.undo.it/index.php', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="usuario"]', 'AREYES');
    await page.fill('input[name="password"]', '220126');
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('Login exitoso. Navegando a lista_sor_ag.php...');
    await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const fullHtml = await page.content();
    fs.writeFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), fullHtml, 'utf8');
    console.log('HTML completo guardado en lista_sor_ag_full.html');

    // Extraer detalle de las primeras 3 filas
    const rowsDetail = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 4);
      return rows.map(r => ({
        text: r.innerText.trim().replace(/\n+/g, ' | '),
        html: r.innerHTML
      }));
    });

    console.log('=== FILAS DE LA TABLA ===');
    rowsDetail.forEach((r, idx) => {
      console.log(`\n--- FILA ${idx + 1} ---`);
      console.log('Texto:', r.text);
      console.log('HTML:', r.html);
    });

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
