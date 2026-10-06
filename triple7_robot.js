const path = require('path');
const fs = require('fs');
const https = require('https');
const querystring = require('querystring');

let playwright = null;
try {
  playwright = require('playwright');
} catch (e) {
  try {
    playwright = require(path.join(__dirname, '..', 'triple7_automation', 'node_modules', 'playwright'));
  } catch (e2) {}
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

// =========================================================================
// MOTOR HTTP NATIVO (Alta velocidad ~200ms, Cero dependencias de navegador)
// =========================================================================

let cachedSessionCookie = null;
let lastLoginTime = 0;
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutos

function httpRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(options.headers || {})
        },
        timeout: options.timeout || 30000
      };

      const req = https.request(reqOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body
        }));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout (${options.timeout || 30000}ms) consultando ${url}`));
      });
      req.on('error', reject);

      if (postData) {
        req.write(postData);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Autentica en Triple 7 via POST y retorna la cookie de sesión PHPSESSID
 */
async function httpLoginTriple7(config, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSessionCookie && (now - lastLoginTime < SESSION_TTL_MS)) {
    return cachedSessionCookie;
  }

  const t7Config = (config && config.general && config.general.triple7) || {};
  const loginUrl = t7Config.loginUrl || 'https://ny7.undo.it/index.php';
  const user = t7Config.user || 'AREYES';
  const pass = t7Config.password || '220126';

  const postData = querystring.stringify({ usuario: user, password: pass });

  const res = await httpRequest(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);

  const rawCookies = res.headers['set-cookie'] || [];
  const sessionCookie = rawCookies.map(c => c.split(';')[0]).join('; ');

  if (!sessionCookie && !cachedSessionCookie) {
    throw new Error('No se recibió cookie de sesión de Triple 7');
  }

  cachedSessionCookie = sessionCookie || cachedSessionCookie;
  lastLoginTime = now;
  return cachedSessionCookie;
}

/**
 * Consulta la cadena aquistring oficial de Triple 7 que lista todos los sorteos
 * e idani realmente bloqueados en la base de datos de la plataforma.
 * Devuelve un Map: idsol -> Array de idani bloqueados.
 */
async function fetchTriple7BlockedMap(config, cookie) {
  const blockedMap = new Map();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const checkUrl = `https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php?idsol=0&idani=0&fecha=${today}`;
    const res = await httpRequest(checkUrl, {
      headers: {
        'Cookie': cookie,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php'
      }
    });

    const body = res.body || '';
    const matches = body.match(/\*(\d+)(-[0-9-]+)?/g) || [];
    for (const block of matches) {
      const clean = block.replace(/\*/g, '');
      const parts = clean.split('-');
      const idsol = parts[0];
      if (idsol && idsol !== '0') {
        const animals = parts.slice(1).filter(a => a && a !== '0');
        blockedMap.set(idsol, animals);
      }
    }
  } catch (e) {
    console.warn('[TRIPLE 7] Aviso al consultar aquistring:', e.message);
  }
  return blockedMap;
}

/**
 * Parsea el HTML de lista_sor_ag.php extrayendo filas de sorteos, opciones y botones.
 * Utiliza blockedMap para confirmar exactamente qué sorteos están bloqueados sin falsos positivos.
 */
function parseDrawsFromHtml(html, blockedMap = new Map()) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const result = [];

  for (let i = 0; i < rows.length; i++) {
    const rowHtml = rows[i];
    // Extraer celdas <td>
    const tds = rowHtml.match(/<td[\s\S]*?<\/td>/gi) || [];
    if (tds.length < 2) continue;

    const loteria = tds[0].replace(/<[^>]+>/g, '').trim();
    const sorteo = tds[1].replace(/<[^>]+>/g, '').trim();

    // Ignorar encabezados o filas resumen
    if (!loteria || !sorteo || loteria === 'Loteria' || loteria.includes('LOTERIA') || loteria.includes('Total')) {
      continue;
    }

    // Extraer select y sus opciones
    const selectMatch = rowHtml.match(/<select[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/i);
    const selectId = selectMatch ? selectMatch[1] : '';
    const selectContent = selectMatch ? selectMatch[2] : (tds[2] || '');

    const idsolMatch = selectContent.match(/idsol=(\d+)/i) || rowHtml.match(/idsol=(\d+)/i);
    const idsol = idsolMatch ? idsolMatch[1] : '';

    // Extraer opciones individuales
    const options = [];
    const optMatches = selectContent.match(/<option[\s\S]*?<\/option>/gi) || [];
    for (const optHtml of optMatches) {
      const valMatch = optHtml.match(/value=["']([^"']+)["']/i);
      const urlMatch = optHtml.match(/data-url=["']([^"']+)["']/i);
      const nombreMatch = optHtml.match(/data-nombre=["']([^"']+)["']/i);
      const textMatch = optHtml.replace(/<[^>]+>/g, '').trim();

      if (valMatch && valMatch[1] !== '7777') {
        options.push({
          value: valMatch[1],
          text: textMatch,
          nombre: nombreMatch ? nombreMatch[1] : textMatch,
          url: urlMatch ? urlMatch[1] : ''
        });
      }
    }

    // Comprobación ESTRICTA de botón físico en columna 4 (evitando falsos positivos de scripts)
    const col4 = tds[3] || '';
    const hasUnblockBtnInCol4 = /input[^>]+value=["']REINCORPORAR/i.test(col4) ||
                                /detalle_ticket\s*\(/i.test(col4);

    // Un sorteo está bloqueado si su idsol está en el registro oficial de Triple 7 (aquistring)
    // O si físicamente se renderizó el botón en la cuarta columna
    const isActuallyBlocked = (idsol && blockedMap.has(idsol)) || hasUnblockBtnInCol4;
    const blockedAnimalsRaw = (idsol && blockedMap.get(idsol)) || [];

    // Resolver nombres legibles de animales bloqueados
    const blockedNames = [];
    if (blockedAnimalsRaw.length > 0) {
      for (const aId of blockedAnimalsRaw) {
        const opt = options.find(o => o.value === aId || o.nombre === aId);
        if (opt) {
          blockedNames.push(opt.text || opt.nombre);
        } else {
          blockedNames.push(aId);
        }
      }
    }

    result.push({
      loteria,
      sorteo,
      idsol,
      selectId,
      options,
      bloqueado: isActuallyBlocked,
      animalesBloqueados: blockedNames.length > 0 ? blockedNames : blockedAnimalsRaw
    });
  }

  return result;
}

/**
 * Consulta el estado actual de los sorteos y bloqueos en Triple 7 via HTTP
 */
async function _obtenerEstadoBloqueosHttp(config) {
  const t7Config = (config && config.general && config.general.triple7) || {};
  const targetUrl = t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';

  let cookie = await httpLoginTriple7(config);
  let res = await httpRequest(targetUrl, { headers: { 'Cookie': cookie } });

  // Si nos redirigió al login, re-autenticar y reintentar
  if (res.status === 302 || res.body.includes('action="/index.php"')) {
    cookie = await httpLoginTriple7(config, true);
    res = await httpRequest(targetUrl, { headers: { 'Cookie': cookie } });
  }

  // Consultar en paralelo la base de datos de bloqueos reales (aquistring)
  const blockedMap = await fetchTriple7BlockedMap(config, cookie);

  const draws = parseDrawsFromHtml(res.body, blockedMap);

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
    totalGestionados: drawsFiltrados.length,
    totalBloqueadosActivos: drawsFiltrados.filter(d => d.bloqueado).length
  };
}

/**
 * Bloquea una lista de números en Triple 7 vía peticiones HTTP GET directas a lista_sor_ag.php
 */
async function _bloquearNumerosHttp(config, loteriaNombre, sorteoHora, numerosParaBloquear) {
  if (!numerosParaBloquear || numerosParaBloquear.length === 0) {
    return { ok: true, message: 'No hay números para bloquear' };
  }

  const t7Config = (config && config.general && config.general.triple7) || {};
  const targetUrl = t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';
  const horaBuscada = normalizarHoraSorteo(sorteoHora);
  const loteriaBuscada = normalizarTexto(loteriaNombre);

  let cookie = await httpLoginTriple7(config);
  let listRes = await httpRequest(targetUrl, { headers: { 'Cookie': cookie } });
  if (listRes.status === 302 || listRes.body.includes('action="/index.php"')) {
    cookie = await httpLoginTriple7(config, true);
    listRes = await httpRequest(targetUrl, { headers: { 'Cookie': cookie } });
  }

  const draws = parseDrawsFromHtml(listRes.body);

  // Localizar la fila correspondiente
  const targetDraw = draws.find(d => {
    const rowLot = normalizarTexto(d.loteria);
    const rowTime = normalizarHoraSorteo(d.sorteo);
    const matchLot = rowLot.includes(loteriaBuscada) || loteriaBuscada.includes(rowLot);
    const matchTime = rowTime === horaBuscada || rowTime.replace(/^0/, '') === horaBuscada.replace(/^0/, '');
    return matchLot && matchTime;
  });

  if (!targetDraw) {
    return {
      ok: false,
      message: `No se encontró el sorteo ${loteriaNombre} a las ${horaBuscada} en Triple 7.`
    };
  }

  let animalDict = {};
  try {
    animalDict = require('./scripts/animal_dictionary.json');
  } catch (e) {
    animalDict = {};
  }

  const bloqueadosExitosos = [];
  const fallidos = [];

  const ajaxHeaders = {
    'Cookie': cookie,
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php',
    'Accept': 'application/json, text/javascript, */*; q=0.01'
  };

  for (const numStr of numerosParaBloquear) {
    const numRaw = numStr.toString().trim();
    const numInt = parseInt(numRaw, 10);
    const pad2 = numRaw.padStart(2, '0');
    const animalOficial = animalDict[numRaw] || animalDict[pad2] || animalDict[numInt.toString()] || '';
    const cleanOficial = normalizarTexto(animalOficial);

    let matchedOpt = null;
    const isGranjaMillonaria = normalizarTexto(targetDraw.loteria).includes('granja millonaria');

    if (isGranjaMillonaria) {
      matchedOpt = targetDraw.options.find(o => o.value === numInt.toString() || o.nombre === numInt.toString());
    } else {
      const expectedVal = numRaw === '00' ? '1' : numRaw === '0' ? '2' : (numInt + 2).toString();
      matchedOpt = targetDraw.options.find(o => o.value === expectedVal);
    }

    if (!matchedOpt && cleanOficial) {
      matchedOpt = targetDraw.options.find(o => {
        const cText = normalizarTexto(o.text);
        return cText === cleanOficial || cText.startsWith(cleanOficial) || cleanOficial.startsWith(cText);
      });
    }

    if (!matchedOpt) {
      matchedOpt = targetDraw.options.find(o => o.nombre === numRaw || o.nombre === numInt.toString() || o.text === numRaw);
    }

    if (!matchedOpt || !matchedOpt.url) {
      fallidos.push(numRaw);
      continue;
    }

    // Ejecutar petición GET AJAX idéntica al navegador para registrar el bloqueo
    const blockUrl = `https://ny7.undo.it/Venta_Animalitos/${matchedOpt.url}`;
    try {
      const blockRes = await httpRequest(blockUrl, { headers: ajaxHeaders });
      // Validar confirmación de backend: Triple 7 responde con aquistring que incluye el idsol
      const isConfirmed = blockRes.status === 200 && (
        (blockRes.body && blockRes.body.includes(`*${targetDraw.idsol}`)) ||
        (blockRes.body && blockRes.body.includes(targetDraw.idsol))
      );

      if (isConfirmed) {
        bloqueadosExitosos.push({ numero: numRaw, animal: matchedOpt.text });
      } else {
        fallidos.push(numRaw);
      }
    } catch (eBlock) {
      fallidos.push(numRaw);
    }
  }

  return {
    ok: bloqueadosExitosos.length > 0,
    bloqueadosExitosos,
    fallidos,
    message: bloqueadosExitosos.length > 0
      ? `Bloqueados exitosamente ${bloqueadosExitosos.length} números en ${targetDraw.loteria} (${targetDraw.sorteo}): [${bloqueadosExitosos.map(b => b.numero).join(', ')}]`
      : `No se pudieron bloquear los números en Triple 7 (fallidos: [${fallidos.join(', ')}]).`
  };
}

/**
 * Reincorpora (desbloquea) animales de un sorteo en Triple 7 via HTTP
 */
async function _reincorporarAnimalitosHttp(config, loteriaNombre, sorteoHora) {
  const t7Config = (config && config.general && config.general.triple7) || {};
  const targetUrl = t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php';
  const horaBuscada = normalizarHoraSorteo(sorteoHora);
  const loteriaBuscada = normalizarTexto(loteriaNombre);

  let cookie = await httpLoginTriple7(config);
  let listRes = await httpRequest(targetUrl, { headers: { 'Cookie': cookie } });
  if (listRes.status === 302 || listRes.body.includes('action="/index.php"')) {
    cookie = await httpLoginTriple7(config, true);
    listRes = await httpRequest(targetUrl, { headers: { 'Cookie': cookie } });
  }

  const draws = parseDrawsFromHtml(listRes.body);
  const targetDraw = draws.find(d => {
    const rowLot = normalizarTexto(d.loteria);
    const rowTime = normalizarHoraSorteo(d.sorteo);
    return (rowLot.includes(loteriaBuscada) || loteriaBuscada.includes(rowLot)) &&
           (rowTime === horaBuscada || rowTime.replace(/^0/, '') === horaBuscada.replace(/^0/, ''));
  });

  if (!targetDraw) {
    return { ok: false, message: `No se encontró sorteo ${loteriaNombre} (${horaBuscada}) en Triple 7.` };
  }

  if (!targetDraw.idsol) {
    return { ok: false, message: `No se pudo obtener el ID del sorteo (idsol) para ${loteriaNombre} (${horaBuscada}).` };
  }

  // Llamar al endpoint oficial reiniciar_animalitos.php
  const postData = querystring.stringify({
    nticket: targetDraw.idsol,
    jtipo: '0',
    modulo: '2'
  });

  await httpRequest('https://ny7.undo.it/Venta_Animalitos/reiniciar_animalitos.php', {
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);

  return {
    ok: true,
    message: `Animalitos reincorporados exitosamente para ${targetDraw.loteria} (${targetDraw.sorteo}).`
  };
}

// =========================================================================
// COLA DE OPERACIONES Y FALLBACK (Playwright opcional si disponible)
// =========================================================================

let t7Queue = Promise.resolve();

function enqueueT7Operation(fn) {
  const op = () => fn();
  const next = t7Queue.then(op, op);
  t7Queue = next.catch(() => {});
  return next;
}

async function obtenerEstadoBloqueos(config) {
  return enqueueT7Operation(async () => {
    try {
      // 1. Motor HTTP Nativo Ultrarrápido (Funciona en Render y Windows sin dependencias)
      return await _obtenerEstadoBloqueosHttp(config);
    } catch (httpErr) {
      console.warn(`[TRIPLE 7 HTTP AVISO] Falló motor HTTP: ${httpErr.message}.`);
      if (playwright) {
        return await _obtenerEstadoBloqueosPlaywright(config);
      }
      return { ok: false, message: `Error en Triple 7: ${httpErr.message}` };
    }
  });
}

async function bloquearNumeros(config, loteriaNombre, sorteoHora, numerosParaBloquear) {
  return enqueueT7Operation(async () => {
    try {
      return await _bloquearNumerosHttp(config, loteriaNombre, sorteoHora, numerosParaBloquear);
    } catch (httpErr) {
      console.warn(`[TRIPLE 7 HTTP AVISO] Falló bloqueo HTTP: ${httpErr.message}.`);
      if (playwright) {
        return await _bloquearNumerosPlaywright(config, loteriaNombre, sorteoHora, numerosParaBloquear);
      }
      return { ok: false, message: `Error bloqueando en Triple 7: ${httpErr.message}` };
    }
  });
}

async function reincorporarAnimalitos(config, loteriaNombre, sorteoHora) {
  return enqueueT7Operation(async () => {
    try {
      return await _reincorporarAnimalitosHttp(config, loteriaNombre, sorteoHora);
    } catch (httpErr) {
      console.warn(`[TRIPLE 7 HTTP AVISO] Falló reincorporación HTTP: ${httpErr.message}.`);
      if (playwright) {
        return await _reincorporarAnimalitosPlaywright(config, loteriaNombre, sorteoHora);
      }
      return { ok: false, message: `Error reincorporando en Triple 7: ${httpErr.message}` };
    }
  });
}

// Fallback Playwright (si instalado)
async function _obtenerEstadoBloqueosPlaywright(config) {
  if (!playwright) return { ok: false, message: 'Playwright no disponible' };
  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const t7Config = config.general.triple7;
    await page.goto(t7Config.loginUrl || 'https://ny7.undo.it/index.php', { timeout: 30000 });
    await page.fill('input[name="usuario"]', t7Config.user || 'AREYES');
    await page.fill('input[name="password"]', t7Config.password || '220126');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await page.goto(t7Config.url || 'https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php', { timeout: 30000 });
    const content = await page.content();
    await browser.close();
    const draws = parseDrawsFromHtml(content);
    return { ok: true, draws, totalPlataforma: draws.length, totalGestionados: draws.length };
  } catch (err) {
    await browser.close().catch(() => {});
    return { ok: false, message: err.message };
  }
}

async function _bloquearNumerosPlaywright(config, loteriaNombre, sorteoHora, numerosParaBloquear) {
  if (!playwright) return { ok: false, message: 'Playwright no disponible' };
  return { ok: false, message: 'Fallback Playwright no requerido' };
}

async function _reincorporarAnimalitosPlaywright(config, loteriaNombre, sorteoHora) {
  if (!playwright) return { ok: false, message: 'Playwright no disponible' };
  return { ok: false, message: 'Fallback Playwright no requerido' };
}

module.exports = {
  bloquearNumeros,
  reincorporarAnimalitos,
  obtenerEstadoBloqueos,
  normalizarHoraSorteo,
  normalizarTexto
};
