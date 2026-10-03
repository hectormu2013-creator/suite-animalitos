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

  try {
    await page.goto('https://ny7.undo.it/index.php', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="usuario"]', 'AREYES');
    await page.fill('input[name="password"]', '220126');
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForTimeout(3000);

    await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const rows = await page.evaluate(() => {
      const trs = Array.from(document.querySelectorAll('table tr'));
      return trs.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length < 3) return null;
        return {
          loteria: tds[0].innerText.trim(),
          sorteo: tds[1].innerText.trim(),
          resultadoHtml: tds[2].innerHTML.substring(0, 100),
          reincorporarHtml: tds[3] ? tds[3].innerHTML.trim() : ''
        };
      }).filter(Boolean);
    });

    console.log(`Current active rows in Triple 7 (${rows.length}):`);
    rows.forEach((r, idx) => {
      console.log(`[${idx}] ${r.loteria} - ${r.sorteo} | Reincorporar: "${r.reincorporarHtml}"`);
    });

  } catch (e) {
    console.error(e.message);
  } finally {
    await browser.close();
  }
})();
