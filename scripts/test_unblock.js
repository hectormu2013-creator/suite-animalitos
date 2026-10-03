const path = require('path');
let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require(path.join(__dirname, '..', '..', 'triple7_automation', 'node_modules', 'playwright'));
}
const { chromium } = playwright;

(async () => {
  console.log('=== TEST DE REINCORPORAR EN TRIPLE 7 ===');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('popup', async p => await p.close().catch(() => {}));
  page.on('dialog', async d => {
    console.log('[DIALOG]', d.message());
    await d.accept().catch(() => {});
  });

  try {
    await page.goto('https://ny7.undo.it/index.php', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="usuario"]', 'AREYES');
    await page.fill('input[name="password"]', '220126');
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('Haciendo clic en el botón de REINCORPORAR ANIMALITOS...');
    // Clic directo al input
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('input[value="REINCORPORAR ANIMALITOS"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log('Botón clickeado:', clicked);
    await page.waitForTimeout(3000);

    // Recargar para verificar
    await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const check = await page.evaluate(() => {
      const btn = document.querySelector('input[value="REINCORPORAR ANIMALITOS"]');
      return {
        aunExisteBoton: !!btn
      };
    });

    console.log('Estado final:', check);
    await page.screenshot({ path: path.join(__dirname, '..', 'triple7_after_unblock_test.png') });
    console.log('Captura guardada en triple7_after_unblock_test.png');

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
