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
  console.log('=== EXPLORACIÓN TRIPLE 7: MÓDULO DE BLOQUEO ===');
  console.log('Target URL: https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php');

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (err) {
    console.error('Error al iniciar navegador:', err.message);
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('popup', async popup => {
    console.log(`🌐 Popup detectado: ${popup.url()}`);
    await popup.close().catch(() => {});
  });

  page.on('dialog', async dialog => {
    console.log(`💬 Diálogo alert/confirm detectado: ${dialog.message()}`);
    await dialog.accept().catch(() => {});
  });

  try {
    const targetUrl = 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';
    console.log(`Navegando directamente a ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    let currentUrl = page.url();
    console.log(`URL actual: ${currentUrl}`);

    // Si redirige a login o hay formulario de login
    const hasLoginForm = await page.locator('input[name="usuario"], input[name="user"], input[type="password"]').count() > 0;
    if (hasLoginForm || currentUrl.includes('login') || currentUrl.includes('index.php')) {
      console.log('Formulario de login detectado. Procediendo a autenticar...');
      const userField = page.locator('input[name="usuario"], input[name="user"], #usuario, input[type="text"]').first();
      const passField = page.locator('input[name="clave"], input[name="password"], input[name="pass"], #clave, #password, input[type="password"]').first();
      const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Ingresar")').first();

      await userField.fill('AREYES');
      await passField.fill('220126');
      await page.waitForTimeout(500);
      await submitBtn.click();
      await page.waitForTimeout(4000);

      console.log(`URL tras login: ${page.url()}`);

      // Si tras login no estamos en targetUrl, navegar a targetUrl
      if (!page.url().includes('lista_sor_ag.php')) {
        console.log(`Navegando nuevamente a ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(3000);
      }
    }

    console.log(`=== PÁGINA CARGADA: ${page.url()} ===`);
    const pageTitle = await page.title();
    console.log(`Título de la página: "${pageTitle}"`);

    // Tomar captura de pantalla
    const screenshotPath = path.join(__dirname, '..', 'triple7_lista_sor_ag.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot guardado en ${screenshotPath}`);

    // Extraer estructura de la página
    const pageAnalysis = await page.evaluate(() => {
      // 1. Formularios y selects
      const forms = Array.from(document.querySelectorAll('form')).map(f => ({
        id: f.id,
        name: f.name,
        action: f.action,
        method: f.method
      }));

      // 2. Selects (posibles filtros de lotería, sorteo, etc.)
      const selects = Array.from(document.querySelectorAll('select')).map(s => ({
        id: s.id,
        name: s.name,
        options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim(), selected: o.selected }))
      }));

      // 3. Botones y enlaces principales
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, .btn')).map(b => ({
        tag: b.tagName,
        id: b.id,
        name: b.name,
        value: b.value || '',
        text: b.innerText ? b.innerText.trim() : ''
      }));

      // 4. Tablas
      const tables = Array.from(document.querySelectorAll('table')).map((t, idx) => {
        const headers = Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim());
        const rowCount = t.querySelectorAll('tr').length;
        const sampleRows = Array.from(t.querySelectorAll('tr')).slice(0, 5).map(tr => 
          Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim().substring(0, 50))
        );
        return {
          tableIndex: idx,
          id: t.id,
          className: t.className,
          headers,
          rowCount,
          sampleRows
        };
      });

      // 5. Inputs de texto/checkbox/radio
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        id: i.id,
        name: i.name,
        value: i.value,
        checked: i.checked
      })).filter(i => i.type !== 'hidden');

      return {
        forms,
        selects,
        buttons,
        tables,
        inputs: inputs.slice(0, 30),
        bodyTextSnippet: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('--- ANÁLISIS DE LA PÁGINA ---');
    console.log(JSON.stringify(pageAnalysis, null, 2));

    const outputPath = path.join(__dirname, '..', 'triple7_lista_sor_ag_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(pageAnalysis, null, 2), 'utf8');
    console.log(`Detalle guardado en ${outputPath}`);

  } catch (err) {
    console.error(`Error durante exploración: ${err.message}`);
  } finally {
    await browser.close();
    console.log('Exploración finalizada.');
  }
})();
