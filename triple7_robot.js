const path = require('path');
const fs = require('fs');

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  try {
    playwright = require(path.join(__dirname, '..', 'triple7_automation', 'node_modules', 'playwright'));
  } catch (e2) {
    console.error('Playwright no encontrado en node_modules');
  }
}

/**
 * Normaliza nombres para comparación flexible (elimina tildes, mayúsculas, espacios extra)
 */
function normalizarTexto(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/guacharito/g, 'guacharo')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza horas de sorteo: "18:00" -> "06:00 PM", "6:00 PM" -> "06:00 PM"
 */
function normalizarHoraSorteo(horaStr) {
  if (!horaStr) return '';
  const s = horaStr.trim().toUpperCase();

  // Si ya tiene AM o PM
  const match12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match12 && match12[3]) {
    const hh = match12[1].padStart(2, '0');
    return `${hh}:${match12[2]} ${match12[3]}`;
  }

  // Formato 24h ej "18:00"
  const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let h = parseInt(match24[1], 10);
    const m = match24[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  }

  return s;
}

/**
 * Inicia sesión en Triple 7 y retorna la instancia de page autenticada
 */
async function iniciarSesionTriple7(config, browser) {
  const t7Config = config.general.triple7;
  const loginUrl = t7Config.loginUrl || 'https://ny7.undo.it/index.php';
  const user = t7Config.user || 'AREYES';
  const pass = t7Config.password || '220126';

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('popup', async p => await p.close().catch(() => {}));
  page.on('dialog', async d => await d.accept().catch(() => {}));

  console.log(`[TRIPLE 7] Autenticando en ${loginUrl} como ${user}...`);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.fill('input[name="usuario"], input[name="user"], #usuario', user);
  await page.fill('input[name="password"], input[name="clave"], #password, #clave', pass);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForTimeout(3000);

  return { context, page };
}

let t7Queue = Promise.resolve();

function enqueueT7Operation(fn) {
  const op = () => fn();
  const next = t7Queue.then(op, op);
  t7Queue = next.catch(() => {});
  return next;
}

/**
 * Bloquea una lista de números en la plataforma Triple 7 para un sorteo específico
 * @param {Object} config - Objeto de configuración general
 * @param {string} loteriaNombre - Nombre o ID de la lotería (ej. "LA GRANJITA", "LOTTO ACTIVO")
 * @param {string} sorteoHora - Hora del sorteo (ej. "06:00 PM" o "18:00")
 * @param {Array<string>} numerosParaBloquear - Lista de números (ej. ["00", "04", "12", "28"])
 */
async function _bloquearNumeros(config, loteriaNombre, sorteoHora, numerosParaBloquear) {
  if (!numerosParaBloquear || numerosParaBloquear.length === 0) {
    return { ok: true, message: 'No hay números para bloquear' };
  }

  if (!playwright) {
    return { ok: false, message: 'Playwright no está instalado o no disponible' };
  }

  const t7Config = config.general.triple7;
  const targetUrl = t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';
  const horaBuscada = normalizarHoraSorteo(sorteoHora);
  const loteriaBuscada = normalizarTexto(loteriaNombre);

  console.log(`[TRIPLE 7] Iniciando bloqueo de ${numerosParaBloquear.length} números: [${numerosParaBloquear.join(', ')}] para ${loteriaNombre} (${horaBuscada})...`);

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const { page } = await iniciarSesionTriple7(config, browser);

    console.log(`[TRIPLE 7] Navegando a módulo de bloqueo: ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Inspeccionar filas para localizar la fila de la lotería y sorteo
    const targetRow = await page.evaluate(({ loteriaBuscada, horaBuscada }) => {
      function clean(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/guacharito/g, 'guacharo').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      function normTime(s) {
        const m = (s || '').trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
        if (m && m[3]) return `${m[1].padStart(2, '0')}:${m[2]} ${m[3]}`;
        return (s || '').trim().toUpperCase();
      }

      const rows = Array.from(document.querySelectorAll('table tr'));
      for (let i = 1; i < rows.length; i++) {
        const tds = Array.from(rows[i].querySelectorAll('td'));
        if (tds.length < 3) continue;

        const rowLot = clean(tds[0].innerText);
        const rowTime = normTime(tds[1].innerText);

        // Coincidencia de lotería (contiene o empieza por) y coincidencia de hora
        const matchLot = rowLot.includes(loteriaBuscada) || loteriaBuscada.includes(rowLot);
        const matchTime = rowTime === horaBuscada || rowTime.replace(/^0/, '') === horaBuscada.replace(/^0/, '');

        if (matchLot && matchTime) {
          const select = tds[2].querySelector('select');
          if (!select) continue;

          // Extraer opciones
          const options = Array.from(select.querySelectorAll('option')).map(opt => ({
            value: opt.value,
            text: opt.innerText.trim(),
            nombre: opt.getAttribute('data-nombre'),
            url: opt.getAttribute('data-url')
          }));

          const idsolMatch = select.innerHTML.match(/idsol=(\d+)/);
          const idsol = idsolMatch ? idsolMatch[1] : '';

          return {
            rowIndex: i,
            loteria: tds[0].innerText.trim(),
            sorteo: tds[1].innerText.trim(),
            selectId: select.id,
            idsol,
            options
          };
        }
      }
      return null;
    }, { loteriaBuscada, horaBuscada });

    if (!targetRow) {
      const errMsg = `No se encontró la fila correspondiente a ${loteriaNombre} a las ${horaBuscada} en Triple 7. Verifique si el sorteo ya pasó o no está listado.`;
      console.warn(`[TRIPLE 7 AVISO] ${errMsg}`);
      await browser.close();
      return { ok: false, message: errMsg };
    }

    console.log(`[TRIPLE 7] Fila encontrada: ${targetRow.loteria} - ${targetRow.sorteo} (idsol: ${targetRow.idsol}, select: #${targetRow.selectId})`);

    // Cargar diccionario de animales para mapeo
    let animalDict = {};
    try {
      animalDict = require('./scripts/animal_dictionary.json');
    } catch (e) {
      animalDict = {};
    }

    const bloqueadosExitosos = [];
    const fallidos = [];

    // Mapear cada número a bloquear con su opción en el select
    for (const numStr of numerosParaBloquear) {
      const numRaw = numStr.toString().trim();
      const numInt = parseInt(numRaw, 10);
      const pad2 = numRaw.padStart(2, '0');
      const animalOficial = animalDict[numRaw] || animalDict[pad2] || animalDict[numInt.toString()] || '';
      const cleanOficial = normalizarTexto(animalOficial);

      // Algoritmo de resolución de opción:
      // 1. Por cálculo de ID si es estándar (00 -> val 1, 0 -> val 2, N -> N+2) o Granja Millonaria (N -> N)
      let matchedOpt = null;
      const isGranjaMillonaria = normalizarTexto(targetRow.loteria).includes('granja millonaria');

      if (isGranjaMillonaria) {
        matchedOpt = targetRow.options.find(o => o.value === numInt.toString() || o.nombre === numInt.toString());
      } else {
        const expectedVal = numRaw === '00' ? '1' : numRaw === '0' ? '2' : (numInt + 2).toString();
        matchedOpt = targetRow.options.find(o => o.value === expectedVal);
      }

      // 2. Si no coincide por cálculo, buscar por coincidencia de nombre de animal
      if (!matchedOpt && cleanOficial) {
        matchedOpt = targetRow.options.find(o => {
          const cText = normalizarTexto(o.text);
          return cText === cleanOficial || cText.startsWith(cleanOficial) || cleanOficial.startsWith(cText);
        });
      }

      // 3. Fallback a coincidencia por número exacto en nombre o texto
      if (!matchedOpt) {
        matchedOpt = targetRow.options.find(o => o.nombre === numRaw || o.nombre === numInt.toString() || o.text === numRaw);
      }

      if (!matchedOpt || !matchedOpt.url) {
        console.warn(`[TRIPLE 7 AVISO] No se pudo resolver la opción para el animal ${numRaw} (${animalOficial})`);
        fallidos.push(numRaw);
        continue;
      }

      // Ejecutar la petición GET de bloqueo directamente en la sesión autenticada
      const blockUrl = `https://ny7.undo.it/Venta_Animalitos/${matchedOpt.url}`;
      console.log(`[TRIPLE 7 BLOQUEANDO] Número ${numRaw} (${matchedOpt.text}) -> ${blockUrl}`);

      try {
        const resp = await page.request.get(blockUrl);
        const respText = await resp.text();
        console.log(`[TRIPLE 7 RESPUESTA] Número ${numRaw}: HTTP ${resp.status()} | ${respText.trim().slice(0, 80)}`);
        bloqueadosExitosos.push({
          numero: numRaw,
          animal: matchedOpt.text,
          value: matchedOpt.value
        });
      } catch (errReq) {
        console.error(`[TRIPLE 7 ERROR] Falla en petición para ${numRaw}: ${errReq.message}`);
        fallidos.push(numRaw);
      }
    }

    // Recargar página para verificar el estado de los bloqueos
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Comprobar si el botón "REINCORPORAR ANIMALITOS" apareció en la fila
    const verification = await page.evaluate(({ rowIndex }) => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      if (rowIndex < rows.length) {
        const tds = Array.from(rows[rowIndex].querySelectorAll('td'));
        const btn = tds[3] ? tds[3].querySelector('input[value="REINCORPORAR ANIMALITOS"]') : null;
        return {
          tieneBotonReincorporar: !!btn,
          td3Html: tds[3] ? tds[3].innerHTML.trim() : ''
        };
      }
      return { tieneBotonReincorporar: false, td3Html: '' };
    }, { rowIndex: targetRow.rowIndex });

    // Guardar evidencia visual (screenshot)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotName = `triple7_bloqueo_${targetRow.idsol}_${timestamp}.png`;
    const screenshotPath = path.join(__dirname, 'data', screenshotName);
    
    // Asegurar directorio data
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath });
    console.log(`[TRIPLE 7 CAPTURA] Evidencia guardada en: ${screenshotPath}`);

    await browser.close();

    const ok = bloqueadosExitosos.length > 0;
    return {
      ok,
      bloqueados: bloqueadosExitosos,
      fallidos,
      loteria: targetRow.loteria,
      sorteo: targetRow.sorteo,
      idsol: targetRow.idsol,
      reincorporarDisponible: verification.tieneBotonReincorporar,
      screenshot: screenshotPath,
      message: ok
        ? `Bloqueados ${bloqueadosExitosos.length} números con éxito en Triple 7 (${bloqueadosExitosos.map(b => `${b.numero} ${b.animal}`).join(', ')})`
        : `No se pudo bloquear ningún número en Triple 7`
    };

  } catch (err) {
    await browser.close().catch(() => {});
    console.error(`[TRIPLE 7 ERROR CRÍTICO] ${err.message}`);
    return { ok: false, message: `Error en Triple 7: ${err.message}` };
  }
}

/**
 * Reincorpora (desbloquea) todos los animales bloqueados en un sorteo específico de Triple 7
 * @param {Object} config - Configuración
 * @param {string} loteriaNombre - Nombre o ID de la lotería
 * @param {string} sorteoHora - Hora del sorteo
 */
async function _reincorporarAnimalitos(config, loteriaNombre, sorteoHora) {
  if (!playwright) {
    return { ok: false, message: 'Playwright no disponible' };
  }

  const t7Config = config.general.triple7;
  const targetUrl = t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';
  const horaBuscada = normalizarHoraSorteo(sorteoHora);
  const loteriaBuscada = normalizarTexto(loteriaNombre);

  console.log(`[TRIPLE 7 REINCORPORACIÓN] Solicitando desbloqueo para ${loteriaNombre} (${horaBuscada})...`);

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const { page } = await iniciarSesionTriple7(config, browser);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Buscar botón de reincorporación en la fila correspondiente
    const unblockInfo = await page.evaluate(({ loteriaBuscada, horaBuscada }) => {
      function clean(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/guacharito/g, 'guacharo').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      function normTime(s) {
        const m = (s || '').trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
        if (m && m[3]) return `${m[1].padStart(2, '0')}:${m[2]} ${m[3]}`;
        return (s || '').trim().toUpperCase();
      }

      const rows = Array.from(document.querySelectorAll('table tr'));
      for (let i = 1; i < rows.length; i++) {
        const tds = Array.from(rows[i].querySelectorAll('td'));
        if (tds.length < 4) continue;

        const rowLot = clean(tds[0].innerText);
        const rowTime = normTime(tds[1].innerText);

        const matchLot = rowLot.includes(loteriaBuscada) || loteriaBuscada.includes(rowLot);
        const matchTime = rowTime === horaBuscada || rowTime.replace(/^0/, '') === horaBuscada.replace(/^0/, '');

        if (matchLot && matchTime) {
          const btn = tds[3].querySelector('input[value="REINCORPORAR ANIMALITOS"]');
          const onclickAttr = btn ? btn.getAttribute('onclick') : '';
          const idsolMatch = (onclickAttr || tds[2].innerHTML).match(/(?:detalle_ticket|idsol=)\(?(\d+)/);
          const idsol = idsolMatch ? idsolMatch[1] : '';

          return {
            encontrado: true,
            tieneBoton: !!btn,
            idsol,
            loteria: tds[0].innerText.trim(),
            sorteo: tds[1].innerText.trim()
          };
        }
      }
      return { encontrado: false };
    }, { loteriaBuscada, horaBuscada });

    if (!unblockInfo.encontrado) {
      await browser.close();
      return { ok: false, message: `No se encontró el sorteo ${loteriaNombre} (${horaBuscada}) en Triple 7.` };
    }

    if (!unblockInfo.tieneBoton) {
      await browser.close();
      return { ok: true, message: `No hay animales bloqueados en ${loteriaNombre} (${horaBuscada}).` };
    }

    // Ejecutar la reincorporación llamando al endpoint reiniciar_animalitos.php
    console.log(`[TRIPLE 7 REINCORPORANDO] idsol: ${unblockInfo.idsol}...`);
    const resp = await page.request.post('https://ny7.undo.it/Venta_Animalitos/reiniciar_animalitos.php', {
      form: {
        nticket: unblockInfo.idsol,
        jtipo: '0',
        modulo: '2'
      }
    });

    const respText = await resp.text();
    console.log(`[TRIPLE 7 REINCORPORACIÓN RESPUESTA] HTTP ${resp.status()} | ${respText.trim().slice(0, 100)}`);

    // Recargar y verificar que el botón desapareció
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    const checkAgain = await page.evaluate(({ loteriaBuscada, horaBuscada }) => {
      function clean(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/guacharito/g, 'guacharo').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      function normTime(s) {
        const m = (s || '').trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
        if (m && m[3]) return `${m[1].padStart(2, '0')}:${m[2]} ${m[3]}`;
        return (s || '').trim().toUpperCase();
      }

      const rows = Array.from(document.querySelectorAll('table tr'));
      for (let i = 1; i < rows.length; i++) {
        const tds = Array.from(rows[i].querySelectorAll('td'));
        if (tds.length < 4) continue;
        if (clean(tds[0].innerText).includes(loteriaBuscada) && normTime(tds[1].innerText) === horaBuscada) {
          return !!tds[3].querySelector('input[value="REINCORPORAR ANIMALITOS"]');
        }
      }
      return false;
    }, { loteriaBuscada, horaBuscada });

    await browser.close();

    if (!checkAgain) {
      return { ok: true, message: `Animalitos reincorporados exitosamente para ${unblockInfo.loteria} (${unblockInfo.sorteo}).` };
    } else {
      return { ok: false, message: `El botón de reincorporar aún persiste tras la solicitud.` };
    }

  } catch (err) {
    await browser.close().catch(() => {});
    return { ok: false, message: `Error en reincorporación: ${err.message}` };
  }
}

/**
 * Consulta el estado actual de los sorteos y bloqueos en Triple 7
 */
async function _obtenerEstadoBloqueos(config) {
  if (!playwright) return { ok: false, message: 'Playwright no disponible' };

  const t7Config = config.general.triple7;
  const targetUrl = t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    const { page } = await iniciarSesionTriple7(config, browser);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    const draws = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      const result = [];
      for (let i = 1; i < rows.length; i++) {
        const tds = Array.from(rows[i].querySelectorAll('td'));
        if (tds.length < 3) continue;

        const loteria = tds[0].innerText.trim();
        const sorteo = tds[1].innerText.trim();
        const select = tds[2].querySelector('select');
        const idsolMatch = select ? select.innerHTML.match(/idsol=(\d+)/) : null;
        const idsol = idsolMatch ? idsolMatch[1] : '';
        const hasUnblockBtn = tds[3] ? !!tds[3].querySelector('input[value="REINCORPORAR ANIMALITOS"]') : false;

        result.push({
          loteria,
          sorteo,
          idsol,
          bloqueado: hasUnblockBtn
        });
      }
      return result;
    });

    await browser.close();

    // Filtrar exclusivamente por las loterías configuradas y activas a las que se les aplican bloqueos
    const activeLotNames = (config && Array.isArray(config.loterias))
      ? config.loterias.filter(l => l.activo !== false).map(l => normalizarTexto(l.nombre))
      : [];

    const drawsFiltrados = (activeLotNames.length > 0)
      ? draws.filter(d => activeLotNames.includes(normalizarTexto(d.loteria)))
      : draws;

    return {
      ok: true,
      draws: drawsFiltrados,
      totalPlataforma: draws.length,
      totalGestionados: drawsFiltrados.length
    };
  } catch (err) {
    await browser.close().catch(() => {});
    return { ok: false, message: err.message };
  }
}

async function bloquearNumeros(config, loteriaNombre, sorteoHora, numerosParaBloquear) {
  return enqueueT7Operation(() => _bloquearNumeros(config, loteriaNombre, sorteoHora, numerosParaBloquear));
}

async function reincorporarAnimalitos(config, loteriaNombre, sorteoHora) {
  return enqueueT7Operation(() => _reincorporarAnimalitos(config, loteriaNombre, sorteoHora));
}

async function obtenerEstadoBloqueos(config) {
  return enqueueT7Operation(() => _obtenerEstadoBloqueos(config));
}

module.exports = {
  bloquearNumeros,
  reincorporarAnimalitos,
  obtenerEstadoBloqueos,
  normalizarHoraSorteo
};
