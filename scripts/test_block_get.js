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
  page.on('dialog', async d => {
    console.log('Dialog:', d.message());
    await d.accept().catch(() => {});
  });

  try {
    console.log('Logging in...');
    await page.goto('https://ny7.undo.it/index.php', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="usuario"]', 'AREYES');
    await page.fill('input[name="password"]', '220126');
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('Navigating to lista_sor_ag.php...');
    await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Let's test the GET request for Lotto Activo RD INT 05:30 PM (idsol=178407, idani=1 Ballena)
    console.log('Testing GET request for blocking...');
    const blockUrl = 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php?idsol=178407&idani=1&fecha=2026-10-02';
    const res = await page.request.get(blockUrl);
    console.log('Block GET status:', res.status());
    const resText = await res.text();
    console.log('Block GET response (first 300 chars):', resText.substring(0, 300));

    // Reload page to see what changed in row 8 (or for idsol 178407)
    await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const rowContent = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      for (const r of rows) {
        if (r.innerHTML.includes('178407')) {
          return {
            text: r.innerText.trim().replace(/\n+/g, ' | '),
            html: r.innerHTML
          };
        }
      }
      return null;
    });

    console.log('Row content after block request:');
    console.log(JSON.stringify(rowContent, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
