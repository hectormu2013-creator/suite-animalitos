// scraper_service.js - Extractor Autónomo y Búsqueda en Vivo de Resultados Oficiales
// Funciona de forma 100% nativa en Localhost y en la Nube (Render) vía HTTPS hacia TuAzar y 1000Resultados

const https = require('https');
const fs = require('fs');
const path = require('path');

// Diccionario de animales oficial
let animalDict = {};
try {
  const dictRaw = fs.readFileSync(path.join(__dirname, 'scripts', 'animal_dictionary.json'), 'utf8');
  animalDict = JSON.parse(dictRaw);
} catch (e) {}

function getAnimalName(num) {
  const norm = String(num).padStart(2, '0');
  const rawNum = String(parseInt(num, 10));
  return animalDict[norm] || animalDict[rawNum] || `Animal ${norm}`;
}

/**
 * Fetch HTTPS nativo con timeout y User-Agent de navegador
 */
function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8'
        },
        timeout: timeoutMs
      }, (res) => {
        let html = '';
        res.on('data', chunk => html += chunk);
        res.on('end', () => resolve({ status: res.statusCode, html }));
      });
      req.on('error', (err) => resolve({ status: 500, html: '', error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 408, html: '', error: 'Timeout' });
      });
    } catch (e) {
      resolve({ status: 500, html: '', error: e.message });
    }
  });
}

/**
 * Convertir cadenas de tiempo a minutos del día
 * Soporta "08:00 AM", "8:00 AM", "08:00", "13:00", "01:00 PM"
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = String(timeStr).trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Normalizar ID de lotería para búsqueda
 */
function normalizeLoteria(str) {
  const clean = (str || '').toLowerCase().trim();
  if (clean.includes('millonario') || clean.includes('guacharito')) return 'guacharito-millonario';
  if (clean.includes('guacharo')) return 'guacharo-activo';
  if (clean.includes('granjita')) return 'la-granjita';
  if (clean.includes('lotto')) return 'lotto-activo';
  if (clean.includes('selva')) return 'selva-plus';
  if (clean.includes('ruleta')) return 'ruleta-activa';
  return clean.replace(/_/g, '-');
}

/**
 * Scraper TuAzar Animalitos
 */
async function scrapeTuAzarAnimalitos() {
  try {
    const { status, html } = await fetchUrl('https://tuazar.com/loteria/animalitos/resultados/');
    if (status !== 200 || !html) return {};

    const gameMap = {};
    const sections = html.split('<h2 class="lotResTit');

    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i];
      const titleMatch = sec.match(/class="[^"]*">\s*([A-Z0-9\s]+)\s*<\/h2>/i) || sec.match(/>\s*([A-Z0-9\s]+)\s*<\/h2>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const normKey = normalizeLoteria(title);

      const boxRegex = /<div class="col-xs-6 col-sm-3">([\s\S]*?)<\/div>\s*<\/div>/gi;
      let match;
      const draws = [];

      while ((match = boxRegex.exec(sec)) !== null) {
        const content = match[1];
        const timeM = content.match(/<div class="horario">\s*<span[^>]*>([^<]+)<\/span>/i);
        const nameM = content.match(/<span>\s*([0-9]+)\s*<i[^>]*>[^<]*<\/i>\s*(?:<br[^>]*>)?\s*([^<]+)<\/span>/i);
        const isPending = /en espera/i.test(content) || !nameM;

        let time = timeM ? timeM[1].trim() : null;
        if (time) {
          const parts = time.split(':');
          if (parts[0].length === 1) time = `0${time}`;
        }

        let numStr = (!isPending && nameM) ? nameM[1].trim() : null;
        let animalName = (!isPending && nameM) ? nameM[2].trim() : null;

        if (numStr) {
          numStr = String(numStr).padStart(2, '0');
          if (!animalName || animalName.length < 2) animalName = getAnimalName(numStr);
        }

        draws.push({
          time,
          isPending,
          number: numStr,
          name: animalName
        });
      }

      if (!gameMap[normKey]) gameMap[normKey] = [];
      gameMap[normKey] = gameMap[normKey].concat(draws);
    }

    return gameMap;
  } catch (err) {
    return {};
  }
}

/**
 * Scraper 1000Resultados
 */
async function scrape1000Resultados(gameSlug) {
  if (!gameSlug) return [];
  try {
    const slugMap = {
      'guacharo-activo': 'guacharoactivo',
      'lotto-activo': 'lottoactivo',
      'la-granjita': 'granjita',
      'guacharito-millonario': 'guacharitomillonario',
      'selva-plus': 'selvaplus',
      'ruleta-activa': 'ruletaactiva'
    };
    const s = slugMap[gameSlug] || gameSlug.replace(/[^a-z0-9]/g, '');
    const { status, html } = await fetchUrl(`https://1000resultados.com/resultados/${s}`);
    if (status !== 200 || !html) return [];

    const articleRegex = /<article[\s\S]*?<\/article>/gi;
    const articles = html.match(articleRegex) || [];
    const draws = [];

    for (const art of articles) {
      const timeMatch = art.match(/leading-none">(\d{1,2}:\d{2})<\/span>\s*<span[^>]*>([AP]M)<\/span>/i);
      let time = timeMatch ? `${timeMatch[1]} ${timeMatch[2].toUpperCase()}` : null;
      if (!time) continue;
      if (time.indexOf(':') === 1) time = '0' + time;

      const isPending = /en\s+espera/i.test(art);
      let number = null, name = null;

      if (!isPending) {
        const b64NumMatch = art.match(/data-b64-number="([^"]+)"/i);
        const b64NameMatch = art.match(/data-b64-name="([^"]+)"/i);
        if (b64NumMatch) {
          try { number = Buffer.from(b64NumMatch[1], 'base64').toString('utf8').trim(); } catch(e){}
        }
        if (b64NameMatch) {
          try { name = Buffer.from(b64NameMatch[1], 'base64').toString('utf8').trim(); } catch(e){}
        }
        if (number) {
          number = String(number).padStart(2, '0');
          if (!name) name = getAnimalName(number);
        }
      }

      draws.push({ time, isPending, number, name });
    }

    return draws;
  } catch (err) {
    return [];
  }
}

/**
 * Buscar resultado oficial para una lotería y hora de sorteo específica
 * @param {string} loteriaNameOrId - Lotería
 * @param {string} targetDrawTime - "10:00 AM", "10:00", etc.
 * @param {string} targetDate - "YYYY-MM-DD"
 */
async function lookupDrawResult(loteriaNameOrId, targetDrawTime, targetDate) {
  const normKey = normalizeLoteria(loteriaNameOrId);
  const targetMinutes = parseTimeToMinutes(targetDrawTime);

  // 1. Si existe archivo de Visual-FX en disco (nodo local), consultar primero
  const fxResultsPath = path.join('C:', 'Users', 'Hector', 'Fenix_2026_1', 'PROYECTO_VISUAL_FX', 'data', 'lottery_results.json');
  if (fs.existsSync(fxResultsPath)) {
    try {
      const fxData = JSON.parse(fs.readFileSync(fxResultsPath, 'utf8'));
      const dateKey = targetDate || new Date().toISOString().slice(0, 10);
      if (fxData[dateKey] && fxData[dateKey][normKey] && Array.isArray(fxData[dateKey][normKey].draws)) {
        const candidate = fxData[dateKey][normKey].draws.find(d => {
          if (d.isPending || !d.number) return false;
          const dMins = parseTimeToMinutes(d.time);
          return dMins !== null && targetMinutes !== null && Math.abs(dMins - targetMinutes) <= 25;
        });
        if (candidate && candidate.number) {
          return {
            found: true,
            number: String(candidate.number).padStart(2, '0'),
            name: candidate.name || getAnimalName(candidate.number),
            drawTime: candidate.time,
            source: 'Visual-FX Local Cache'
          };
        }
      }
    } catch (e) {}
  }

  // 2. Scraping en vivo desde TuAzar
  try {
    const tuAzarData = await scrapeTuAzarAnimalitos();
    const tuAzarDraws = tuAzarData[normKey] || [];
    if (tuAzarDraws.length > 0) {
      const match = tuAzarDraws.find(d => {
        const dMins = parseTimeToMinutes(d.time);
        return dMins !== null && targetMinutes !== null && Math.abs(dMins - targetMinutes) <= 25;
      });

      if (match) {
        if (!match.isPending && match.number) {
          return {
            found: true,
            number: String(match.number).padStart(2, '0'),
            name: match.name || getAnimalName(match.number),
            drawTime: match.time,
            source: 'TuAzar Oficial'
          };
        } else {
          return {
            found: false,
            pending: true,
            drawTime: match.time,
            message: `El sorteo de ${targetDrawTime} figura "En Espera" en TuAzar.`
          };
        }
      }
    }
  } catch (e) {}

  // 3. Scraping en vivo desde 1000Resultados (fallback robusto)
  try {
    const res1000Draws = await scrape1000Resultados(normKey);
    if (res1000Draws.length > 0) {
      const match = res1000Draws.find(d => {
        const dMins = parseTimeToMinutes(d.time);
        return dMins !== null && targetMinutes !== null && Math.abs(dMins - targetMinutes) <= 25;
      });

      if (match) {
        if (!match.isPending && match.number) {
          return {
            found: true,
            number: String(match.number).padStart(2, '0'),
            name: match.name || getAnimalName(match.number),
            drawTime: match.time,
            source: '1000Resultados'
          };
        } else {
          return {
            found: false,
            pending: true,
            drawTime: match.time,
            message: `El sorteo de ${targetDrawTime} figura "En Espera" en 1000Resultados.`
          };
        }
      }
    }
  } catch (e) {}

  return {
    found: false,
    pending: true,
    message: `Aún no se ha publicado el resultado para ${loteriaNameOrId} (${targetDrawTime}). Intente de nuevo en unos minutos.`
  };
}

module.exports = {
  lookupDrawResult,
  scrapeTuAzarAnimalitos,
  scrape1000Resultados,
  parseTimeToMinutes,
  normalizeLoteria,
  getAnimalName
};
