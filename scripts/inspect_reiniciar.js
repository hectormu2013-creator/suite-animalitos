const path = require('path');
let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require(path.join(__dirname, '..', '..', 'triple7_automation', 'node_modules', 'playwright'));
}
const { chromium } = playwright;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('popup', async p => await p.close().catch(() => {}));
  page.on('dialog', async d => await d.accept().catch(() => {}));

  try {
    await page.goto('https://ny7.undo.it/index.php', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="usuario"]', 'AREYES');
    await page.fill('input[name="password"]', '220126');
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(3000);

    // Let's test what reiniciar_animalitos.php returns
    const res = await page.request.get('https://ny7.undo.it/Venta_Animalitos/reiniciar_animalitos.php');
    console.log('reiniciar_animalitos GET status:', res.status());
    const text = await res.text();
    console.log('reiniciar_animalitos response preview:', text.substring(0, 500));

    const postRes = await page.request.post('https://ny7.undo.it/Venta_Animalitos/reiniciar_animalitos.php', {
      form: { nticket: 'test', jtipo: 'test', modulo: 'test' }
    });
    console.log('reiniciar_animalitos POST status:', postRes.status());
    const postText = await postRes.text();
    console.log('reiniciar_animalitos POST response:', postText.substring(0, 500));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
