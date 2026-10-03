const path = require('path');
const playwright = require(path.join(__dirname, '..', '..', 'triple7_automation', 'node_modules', 'playwright'));
const { chromium } = playwright;

(async () => {
  console.log('Iniciando navegador Playwright para inspeccionar Triple 7...');
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (e) {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  page.on('popup', async popup => {
    console.log('Popup detectado:', popup.url());
    await popup.close().catch(() => {});
  });

  try {
    console.log('Navegando a https://777.my.to/index.php...');
    await page.goto('https://777.my.to/index.php', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(__dirname, '..', 'login_page_preview.png') });
    console.log('Screenshot guardado en login_page_preview.png, URL:', page.url());

    // Llenar login
    await page.fill('input[name="usuario"]', 'AREYES');
    await page.waitForTimeout(500);
    await page.fill('input[name="password"]', '220126');
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]:has-text("Ingresar")');
    await page.waitForTimeout(4000);

    console.log('URL post-login:', page.url());

    // Buscar enlace o botón ANIMALITOS
    const animalitosLink = page.locator('a:has-text("ANIMALITOS"), button:has-text("ANIMALITOS"), :text("ANIMALITOS")').first();
    console.log('Haciendo clic en ANIMALITOS...');
    await animalitosLink.click();
    await page.waitForTimeout(3000);

    console.log('URL tras clic en ANIMALITOS:', page.url());

    // Extraer todos los submenús y enlaces visibles
    const menuItems = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, select, input[type="button"], input[type="submit"]'));
      return elements.map(el => ({
        tag: el.tagName,
        text: el.innerText ? el.innerText.trim() : (el.value || ''),
        href: el.href || '',
        name: el.name || '',
        id: el.id || ''
      })).filter(x => x.text.length > 0 || x.name || x.id);
    });

    console.log('=== ELEMENTOS ENCONTRADOS EN ANIMALITOS ===');
    console.log(JSON.stringify(menuItems, null, 2));

    await page.screenshot({ path: path.join(__dirname, '..', 'triple7_animalitos_menu.png'), fullPage: true });
    console.log('Screenshot guardado en triple7_animalitos_menu.png');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
