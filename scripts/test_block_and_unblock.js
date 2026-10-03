const path = require('path');
let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  playwright = require(path.join(__dirname, '..', '..', 'triple7_automation', 'node_modules', 'playwright'));
}
const { chromium } = playwright;

(async () => {
  console.log('=== TEST DE BLOQUEO Y REINCORPORACIÓN EN TRIPLE 7 ===');
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

    // Let's find CENTENA PLUS 08:15 PM (last row)
    const targetInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      for (const r of rows) {
        const text = r.innerText.trim();
        if (text.includes('CENTENA PLUS') && text.includes('08:15 PM')) {
          const select = r.querySelector('select');
          const opt = select.querySelector('option[value="1"]'); // first option
          return {
            selectId: select.id,
            url: opt ? opt.getAttribute('data-url') : null,
            optVal: opt ? opt.value : null,
            optText: opt ? opt.innerText.trim() : null
          };
        }
      }
      return null;
    });

    console.log('Target found:', targetInfo);
    if (!targetInfo || !targetInfo.url) {
      console.log('No se encontró el sorteo objetivo.');
      return;
    }

    // Ejecutar el bloqueo seleccionando la opción en el select (para que dispare el evento exacto del sistema)
    console.log(`Seleccionando opción en ${targetInfo.selectId}...`);
    await page.selectOption(`#${targetInfo.selectId}`, targetInfo.optVal);
    await page.waitForTimeout(3000);

    // Recargar y verificar el estado
    await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const afterBlock = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      for (const r of rows) {
        const text = r.innerText.trim();
        if (text.includes('CENTENA PLUS') && text.includes('08:15 PM')) {
          const tds = Array.from(r.querySelectorAll('td'));
          return {
            loteria: tds[0].innerText.trim(),
            sorteo: tds[1].innerText.trim(),
            td3_html: tds[3] ? tds[3].innerHTML : '',
            td3_text: tds[3] ? tds[3].innerText.trim() : ''
          };
        }
      }
      return null;
    });

    console.log('\n--- ESTADO DESPUÉS DEL BLOQUEO ---');
    console.log(JSON.stringify(afterBlock, null, 2));

    await page.screenshot({ path: path.join(__dirname, '..', 'triple7_after_block_test.png') });
    console.log('Screenshot guardado en triple7_after_block_test.png');

    // Ahora verificar si hay un botón/link de reincorporación
    if (afterBlock && afterBlock.td3_html) {
      console.log('Detectado contenido de reincorporación. Probando desbloqueo...');
      // Buscar si hay link o botón con onclick o clase
      const unblockClicked = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        for (const r of rows) {
          const text = r.innerText.trim();
          if (text.includes('CENTENA PLUS') && text.includes('08:15 PM')) {
            const tds = Array.from(r.querySelectorAll('td'));
            const unblockBtn = tds[3].querySelector('a, button, input[type="button"], span[onclick]');
            if (unblockBtn) {
              unblockBtn.click();
              return { clicked: true, html: unblockBtn.outerHTML };
            }
          }
        }
        return { clicked: false };
      });

      console.log('Resultado clic en reincorporar:', unblockClicked);
      await page.waitForTimeout(3000);

      // Si se abrió modal o alerta, o petición ajax
      await page.goto('https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const afterUnblock = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        for (const r of rows) {
          const text = r.innerText.trim();
          if (text.includes('CENTENA PLUS') && text.includes('08:15 PM')) {
            const tds = Array.from(r.querySelectorAll('td'));
            return {
              td3_html: tds[3] ? tds[3].innerHTML : '',
              td3_text: tds[3] ? tds[3].innerText.trim() : ''
            };
          }
        }
        return null;
      });
      console.log('\n--- ESTADO DESPUÉS DE REINCORPORAR ---');
      console.log(JSON.stringify(afterUnblock, null, 2));
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
