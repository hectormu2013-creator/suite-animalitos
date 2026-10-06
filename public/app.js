// Estado local de la aplicación
let currentConfig = null;
let statusInterval = null;
let currentTrophyFilter = 'all';
let cachedTrophyRecords = [];
let cachedTrophyStats = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initClock();
  loadConfig();
  initTrophyModule();
  loadTrophies();
  initTriple7Module();
  initMemoryManager();
  startStatusPolling();
  bindActionButtons();
  initTunnelManager();
});

// Navegación de Pestañas
function initTabs() {
  const tabs = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      if (targetId === 'tab-trofeos') {
        loadTrophies();
      }
      if (targetId === 'tab-triple7') {
        loadTriple7Draws();
      }
    });
  });

  const gotoTrophiesBtn = document.getElementById('btn-goto-trophies');
  if (gotoTrophiesBtn) {
    gotoTrophiesBtn.addEventListener('click', () => {
      const trophyTabBtn = document.getElementById('btn-tab-trofeos');
      if (trophyTabBtn) trophyTabBtn.click();
    });
  }
}

// Reloj y Cuenta Regresiva
function initClock() {
  const clockEl = document.getElementById('clock-display');
  setInterval(() => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-VE', { hour12: true });
    updateCountdown();
  }, 1000);
}

// Cargar Configuración del Servidor
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    currentConfig = data;
    populateUIWithConfig(data);
    appendLog('[CONFIG] Parámetros cargados correctamente desde el servidor.', 'log-info');
  } catch (err) {
    appendLog(`[ERROR] No se pudo cargar configuración: ${err.message}`, 'log-danger');
  }
}

// Llenar campos de la interfaz
function populateUIWithConfig(config) {
  if (!config) return;

  // Credenciales Premier
  document.getElementById('cfg-premier-user').value = config.general.premierPluss.user || '';
  document.getElementById('cfg-premier-pass').value = config.general.premierPluss.password || '';
  document.getElementById('cfg-premier-path').value = config.general.premierPluss.executablePath || '';
  document.getElementById('cfg-premier-keepopen').checked = config.general.premierPluss.keepOpen !== false;

  // Credenciales Triple 7
  document.getElementById('cfg-t7-url').value = config.general.triple7.url || '';
  document.getElementById('cfg-t7-user').value = config.general.triple7.user || '';
  document.getElementById('cfg-t7-pass').value = config.general.triple7.password || '';
  document.getElementById('cfg-t7-enabled').checked = config.general.triple7.enabled !== false;

  // Telegram
  document.getElementById('cfg-tele-token').value = config.general.telegram.botToken || '';
  document.getElementById('cfg-tele-chat').value = config.general.telegram.chatId || '';
  document.getElementById('cfg-tele-enabled').checked = !!config.general.telegram.enabled;

  // Mantenimiento de Taquilla
  if (config.general.mantenimientoVentas) {
    document.getElementById('cfg-mantenimiento-maxtickets').value = config.general.mantenimientoVentas.maxTicketsDia || 2;
    document.getElementById('cfg-mantenimiento-monto').value = config.general.mantenimientoVentas.montoPorTicketBs || 10;
    document.getElementById('cfg-mantenimiento-activo').checked = config.general.mantenimientoVentas.activo !== false;
  }

  // Despertador Matutino / Tarea de Windows
  const horaAct = (config.general && config.general.horaActivacionDiaria) || '07:00';
  const actActiva = (config.general && config.general.activacionDiariaActiva !== false);
  const horaEl = document.getElementById('cfg-hora-activacion');
  if (horaEl) horaEl.value = horaAct;
  const actEl = document.getElementById('cfg-activacion-activa');
  if (actEl) actEl.checked = actActiva;
  const headerWake = document.getElementById('header-wake-time');
  if (headerWake) headerWake.textContent = actActiva ? formatTime12h(horaAct) : 'Desactivado';
  loadScheduleStatus();

  // Métricas
  const guacharo = config.loterias.find(l => l.id === 'guacharo_activo') || config.loterias[0];
  if (guacharo) {
    document.getElementById('metric-monto').textContent = `${Number(guacharo.montoSondeo).toLocaleString('es-VE')} Bs`;
    document.getElementById('guacharo-status-badge').textContent = `${guacharo.totalAnimales} Animales • ${guacharo.minutosAntes}m anticipación`;
  }

  // Renderizar Loterías
  renderLotteries(config.loterias);

  // Sincronizar selector de prueba/sondeo con las loterías activas
  const selectTest = document.getElementById('select-test-lottery');
  if (selectTest && Array.isArray(config.loterias)) {
    const curVal = selectTest.value;
    selectTest.innerHTML = '';
    config.loterias.forEach(lot => {
      const opt = document.createElement('option');
      opt.value = lot.id;
      const icon = lot.nombre.includes('MILLONARIO') ? '🦅' : lot.nombre.includes('GUACHARO') ? '🦜' : lot.nombre.includes('GRANJITA') ? '🐸' : '🎰';
      opt.textContent = `${icon} ${lot.nombre} (${lot.totalAnimales || 38})`;
      selectTest.appendChild(opt);
    });
    if (curVal && Array.from(selectTest.options).some(o => o.value === curVal)) {
      selectTest.value = curVal;
    }
  }

  // Renderizar Red de Máquinas de Pesca & Verificación
  renderMachinesManagement(config);
}

// Helper para icono de lotería
function getLotteryIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('lotto') || n.includes('activo')) return '🦁';
  if (n.includes('gran') || n.includes('ruleta')) return '🎡';
  if (n.includes('guacharo') || n.includes('gua')) return '🦜';
  if (n.includes('selva') || n.includes('plus')) return '🌴';
  if (n.includes('chance') || n.includes('animal')) return '🎲';
  if (n.includes('maracay')) return '🐯';
  return '🎯';
}

// Renderizar lista de loterías
function renderLotteries(lotteries) {
  const container = document.getElementById('lotteries-container');
  if (!container) return;
  container.innerHTML = '';

  const subnavMenu = document.getElementById('lottery-subnav-menu');
  if (subnavMenu) {
    subnavMenu.innerHTML = '';
  }

  const countBadge = document.getElementById('lottery-subnav-count');
  if (countBadge) {
    countBadge.textContent = `${(lotteries || []).length} Lotería${(lotteries || []).length === 1 ? '' : 's'}`;
  }

  lotteries.forEach((lot, index) => {
    const card = document.createElement('div');
    card.className = 'lottery-item-card';
    card.id = `lottery-card-${index}`;
    card.innerHTML = `
      <div class="lottery-item-header">
        <div class="lottery-item-title">
          <span>${lot.nombre}</span>
          <span class="tag ${lot.activo ? 'tag-emerald' : 'tag-orange'}">${lot.activo ? 'ACTIVO' : 'PAUSADO'}</span>
        </div>
        <label class="checkbox-label">
          <input type="checkbox" class="lottery-active-toggle" data-index="${index}" ${lot.activo ? 'checked' : ''}>
          <span>Habilitar</span>
        </label>
      </div>

      <div class="grid-2-cols">
        <div class="form-group">
          <label>Monto de Sondeo Premier (Bs)</label>
          <input type="number" class="form-input lot-input-monto" data-index="${index}" value="${lot.montoSondeo}">
        </div>
        <div class="form-group">
          <label>Total Animales</label>
          <input type="number" class="form-input lot-input-animales" data-index="${index}" value="${lot.totalAnimales}">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:12px;">
        <label>Horarios de Sorteos (Separados por coma o espacio)</label>
        <input type="text" class="form-input lot-input-horarios" data-index="${index}" value="${(lot.horarios || []).join(', ')}" placeholder="08:00, 09:00, 10:00...">
      </div>

      <!-- Estrategias de Bloqueo y Tiempos Independientes en Triple 7 -->
      <div class="blocking-rules-box" style="background:rgba(255,255,255,0.02); border:1px solid rgba(56,189,248,0.25); border-radius:12px; padding:16px; margin-top:14px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:8px;">
          <h4 style="font-size:13px; color:#38bdf8; display:flex; align-items:center; gap:8px; margin:0;">
            <span>🛡️</span> Estrategias y Tiempos de Bloqueo Independientes
          </h4>
          <span style="font-size:11px; color:var(--text-muted);">Cada origen se ejecuta con sus propios minutos de anticipación</span>
        </div>

        <!-- 1. Detección Premier Pluss (Cupo 0 / Agotados - Hasta 5 Sondeos Independientes) -->
        <div style="background:rgba(239,68,68,0.04); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:14px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; border-bottom:1px solid rgba(239,68,68,0.15); padding-bottom:10px; margin-bottom:10px;">
            <label class="checkbox-label" style="font-weight:700;">
              <input type="checkbox" class="lot-input-bloqueo-premier" data-index="${index}" ${lot.bloqueoPremierAgotados !== false ? 'checked' : ''}>
              <span style="color:#f87171; font-size:13px;">🔴 Bloquear Agotados Premier (Cupo Cero / Taquilla)</span>
            </label>
            <span class="badge" style="background:rgba(239,68,68,0.15); color:#fca5a5; font-size:11px; font-weight:700;">
              ⚡ Hasta 5 Sondeos por Sorteo
            </span>
          </div>

          <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
            Indica hasta 5 tiempos previos por sorteo para consultar Premier y bloquear en Triple 7 (ej. 50m antes, 40m antes, etc.):
          </div>

          <div class="multi-sondeo-grid">
            ${[1, 2, 3, 4, 5].map(sId => {
              const sList = (Array.isArray(lot.sondeosMultiples) && lot.sondeosMultiples.length > 0)
                ? lot.sondeosMultiples
                : [
                    { id: 1, activo: true, minutosAntes: lot.minutosAntesPremier || 50 },
                    { id: 2, activo: true, minutosAntes: 40 },
                    { id: 3, activo: true, minutosAntes: 30 },
                    { id: 4, activo: false, minutosAntes: 20 },
                    { id: 5, activo: false, minutosAntes: 10 }
                  ];
              const sItem = sList.find(s => s.id === sId) || { id: sId, activo: (sId <= 2), minutosAntes: (60 - sId * 10) };
              return `
                <div class="multi-sondeo-item ${sItem.activo ? 'active-sondeo' : ''}">
                  <div class="multi-sondeo-header">
                    <span>Sondeo ${sId}</span>
                    <input type="checkbox" class="lot-sondeo-chk lot-sondeo-chk-${sId}" data-lot-index="${index}" data-sondeo-id="${sId}" ${sItem.activo ? 'checked' : ''} onchange="this.closest('.multi-sondeo-item').classList.toggle('active-sondeo', this.checked)">
                  </div>
                  <div class="multi-sondeo-input-wrap">
                    <input type="number" class="lot-sondeo-min lot-sondeo-min-${sId}" data-lot-index="${index}" data-sondeo-id="${sId}" value="${sItem.minutosAntes || 30}" min="1" max="120">
                    <span>m antes</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. Modelo Predictivo Visual-FX (Atrasados) -->
        <div style="background:rgba(16,185,129,0.04); border:1px solid rgba(16,185,129,0.2); border-radius:8px; padding:12px; margin-bottom:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <label class="checkbox-label" style="font-weight:600;">
              <input type="checkbox" class="lot-input-bloqueo-predictivo" data-index="${index}" ${lot.bloqueoPredictivosAtrasados !== false ? 'checked' : ''}>
              <span style="color:#34d399;">🔮 Bloquear Atrasados (Modelo Predictivo Visual-FX)</span>
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:12px; color:var(--text-muted); font-weight:600;">⏱️ Ejecutar:</label>
              <input type="number" class="form-input lot-input-minutos-visualfx" data-index="${index}" value="${lot.minutosAntesVisualFx || 35}" style="width:70px; padding:5px 8px; font-size:13px; text-align:center; background:#1e293b; color:#fff;" min="1" max="120">
              <span style="font-size:12px; color:var(--text-muted);">minutos antes</span>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Cantidad de Atrasados a Bloquear:</label>
            <select class="form-input lot-input-cantidad-predictivos" data-index="${index}" style="width:auto; padding:5px 12px; font-size:13px; background:#1e293b; color:#fff;">
              <option value="0" ${lot.cantidadPredictivosABloquear === 0 ? 'selected' : ''}>0 (Ninguno)</option>
              <option value="1" ${lot.cantidadPredictivosABloquear === 1 ? 'selected' : ''}>1 Animal más atrasado</option>
              <option value="2" ${lot.cantidadPredictivosABloquear === 2 || lot.cantidadPredictivosABloquear === undefined ? 'selected' : ''}>2 Animales más atrasados</option>
              <option value="3" ${lot.cantidadPredictivosABloquear === 3 ? 'selected' : ''}>3 Animales más atrasados</option>
              <option value="4" ${lot.cantidadPredictivosABloquear === 4 ? 'selected' : ''}>4 Animales más atrasados</option>
              <option value="5" ${lot.cantidadPredictivosABloquear === 5 ? 'selected' : ''}>5 Animales más atrasados (Máximo)</option>
            </select>
            <div id="preview-delayed-${lot.id}" style="font-size:11px; color:#34d399; font-family:var(--font-mono); background:rgba(16,185,129,0.1); padding:4px 8px; border-radius:6px; border:1px solid rgba(16,185,129,0.25);">
              ⏳ Calculando demora en Visual-FX...
            </div>
          </div>
        </div>

        <!-- 3. Cobertura Aleatoria del Sistema Autónomo -->
        <div style="background:rgba(245,158,11,0.04); border:1px solid rgba(245,158,11,0.2); border-radius:8px; padding:12px; margin-bottom:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <label class="checkbox-label" style="font-weight:600;">
              <input type="checkbox" class="lot-input-bloqueo-aleatorio" data-index="${index}" ${lot.bloqueoAleatorioSistema !== false ? 'checked' : ''}>
              <span style="color:#fbbf24;">🎲 Bloquear Números Aleatorios (Cobertura del Sistema Autónomo)</span>
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:12px; color:var(--text-muted); font-weight:600;">⏱️ Ejecutar:</label>
              <input type="number" class="form-input lot-input-minutos-aleatorios" data-index="${index}" value="${lot.minutosAntesAleatorios || 20}" style="width:70px; padding:5px 8px; font-size:13px; text-align:center; background:#1e293b; color:#fff;" min="1" max="120">
              <span style="font-size:12px; color:var(--text-muted);">minutos antes</span>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Cantidad de Aleatorios:</label>
            <select class="form-input lot-input-cantidad-aleatorios" data-index="${index}" style="width:auto; padding:5px 12px; font-size:13px; background:#1e293b; color:#fff;">
              <option value="0" ${lot.cantidadAleatoriosABloquear === 0 ? 'selected' : ''}>0 (Ninguno)</option>
              <option value="1" ${lot.cantidadAleatoriosABloquear === 1 ? 'selected' : ''}>1 Número aleatorio</option>
              <option value="2" ${lot.cantidadAleatoriosABloquear === 2 || lot.cantidadAleatoriosABloquear === undefined ? 'selected' : ''}>2 Números aleatorios</option>
              <option value="3" ${lot.cantidadAleatoriosABloquear === 3 ? 'selected' : ''}>3 Números aleatorios (Máximo)</option>
            </select>
          </div>
        </div>

        <!-- 4. Números Fijos Permanentes (Máximo 3, Mínimo 0) -->
        <div style="background:rgba(99,102,241,0.04); border:1px solid rgba(99,102,241,0.2); border-radius:8px; padding:12px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <label class="checkbox-label" style="font-weight:600;">
              <input type="checkbox" class="lot-input-bloqueo-fijo" data-index="${index}" ${lot.bloqueoFijos !== false ? 'checked' : ''}>
              <span style="color:#a5b4fc;">📌 Bloquear Números Fijos (Siempre Bloqueados en cada Sorteo)</span>
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:12px; color:var(--text-muted); font-weight:600;">⏱️ Ejecutar:</label>
              <input type="number" class="form-input lot-input-minutos-fijos" data-index="${index}" value="${lot.minutosAntesFijos || 35}" style="width:70px; padding:5px 8px; font-size:13px; text-align:center; background:#1e293b; color:#fff;" min="1" max="120">
              <span style="font-size:12px; color:var(--text-muted);">minutos antes</span>
            </div>
          </div>

          <div style="margin-top:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Números (Máx 3):</label>
            <input type="text" class="form-input lot-input-numeros-fijos" data-index="${index}" placeholder="Ej: 04, 12, 28" value="${(lot.numerosFijos || []).join(', ')}" style="width:160px; padding:5px 10px; font-size:13px; background:#1e293b; color:#fff; text-align:center; font-family:var(--font-mono);">
            <span style="font-size:11px; color:#818cf8; font-weight:700;" id="fijos-count-preview-${index}">(${(lot.numerosFijos || []).length}/3)</span>
          </div>
        </div>

        <!-- 5. Memoria de Cupo Cero Premier (Arrastre Preventivo de Agotados) -->
        <div style="background:rgba(236,72,153,0.04); border:1px solid rgba(236,72,153,0.25); border-radius:8px; padding:12px; margin-top:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <label class="checkbox-label" style="font-weight:600;">
              <input type="checkbox" class="lot-input-memoria-cupo" data-index="${index}" ${lot.memoriaCupoCero && lot.memoriaCupoCero.activo !== false ? 'checked' : ''}>
              <span style="color:#f472b6;">🧠 Memoria de Cupo Cero Premier (Arrastre Preventivo a Sorteos Siguientes)</span>
            </label>
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Persistencia:</label>
              <select class="form-input lot-input-persistencia-memoria" data-index="${index}" style="width:auto; padding:5px 10px; font-size:13px; background:#1e293b; color:#fff;">
                <option value="1" ${(lot.memoriaCupoCero ? lot.memoriaCupoCero.sorteosPersistencia : 3) === 1 ? 'selected' : ''}>1 sorteo siguiente</option>
                <option value="2" ${(lot.memoriaCupoCero ? lot.memoriaCupoCero.sorteosPersistencia : 3) === 2 ? 'selected' : ''}>2 sorteos siguientes</option>
                <option value="3" ${(lot.memoriaCupoCero ? lot.memoriaCupoCero.sorteosPersistencia : 3) === 3 || !lot.memoriaCupoCero ? 'selected' : ''}>3 sorteos siguientes</option>
                <option value="4" ${(lot.memoriaCupoCero ? lot.memoriaCupoCero.sorteosPersistencia : 3) === 4 ? 'selected' : ''}>4 sorteos siguientes</option>
                <option value="5" ${(lot.memoriaCupoCero ? lot.memoriaCupoCero.sorteosPersistencia : 3) === 5 ? 'selected' : ''}>5 sorteos siguientes (Máximo)</option>
              </select>
            </div>
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:8px; line-height:1.4;">
            💡 Al pescar un número con cupo 0 en PremierPluss, se bloqueará de inmediato para los siguientes <b>N sorteos seleccionados</b> en Triple 7. Se descuenta al pasar cada sorteo y <b>se auto-libera para todos los sorteos restantes si sale premiado</b> 🏆.
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);

    if (subnavMenu) {
      const navBtn = document.createElement('button');
      navBtn.type = 'button';
      navBtn.className = `lottery-subnav-item ${index === 0 ? 'active' : ''}`;
      navBtn.setAttribute('data-target', `lottery-card-${index}`);
      const icon = getLotteryIcon(lot.nombre);
      navBtn.innerHTML = `
        <span class="subnav-item-icon">${icon}</span>
        <span class="subnav-item-name">${lot.nombre}</span>
        <span class="subnav-item-badge ${lot.activo ? 'badge-on' : 'badge-off'}">${lot.activo ? 'ACTIVO' : 'OFF'}</span>
      `;
      navBtn.addEventListener('click', () => {
        document.querySelectorAll('.lottery-subnav-item').forEach(b => b.classList.remove('active'));
        navBtn.classList.add('active');
        const targetEl = document.getElementById(`lottery-card-${index}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          targetEl.classList.add('highlight-target');
          setTimeout(() => targetEl.classList.remove('highlight-target'), 1500);
        }
      });
      subnavMenu.appendChild(navBtn);
    }

    const toggle = card.querySelector('.lottery-active-toggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        if (subnavMenu) {
          const badge = subnavMenu.querySelectorAll('.lottery-subnav-item')[index]?.querySelector('.subnav-item-badge');
          if (badge) {
            badge.className = `subnav-item-badge ${e.target.checked ? 'badge-on' : 'badge-off'}`;
            badge.textContent = e.target.checked ? 'ACTIVO' : 'OFF';
          }
        }
      });
    }

    // Cargar estadísticas en vivo de atrasos para esta lotería
    actualizarPreviewAtrasadosLoteria(lot.id);
  });
}

function actualizarPreviewAtrasadosLoteria(loteriaId) {
  fetch(`/api/predictive/delayed?loteriaId=${loteriaId}&limit=5`)
    .then(res => res.json())
    .then(data => {
      const previewEl = document.getElementById(`preview-delayed-${loteriaId}`);
      if (previewEl && data.delayed && data.delayed.length > 0) {
        const itemsStr = data.delayed.map(d => `${d.numero} (${d.nombre}: ${d.diasAtraso !== undefined ? d.diasAtraso + 'd' : d.sorteosAtraso + 's'})`).join(', ');
        previewEl.innerHTML = `🔮 <b>Top Atrasados Visual-FX:</b> ${itemsStr}`;
      }
    })
    .catch(() => {});
}

function actualizarTodosLosAtrasados() {
  if (!currentConfig || !Array.isArray(currentConfig.loterias)) return;
  currentConfig.loterias.forEach(lot => {
    actualizarPreviewAtrasadosLoteria(lot.id);
  });
}

// ========================================================
// RED DE MÁQUINAS PARA PESCA Y VERIFICACIÓN (MULTI-NODOS)
// ========================================================

const PLATAFORMAS_SISTEMA = [
  { id: 'PREMIER_PLUS_20', nombre: 'Premier Pluss 2.0 (PC Windows / Activo)', activo: true },
  { id: 'PREMIER_VIEJO', nombre: 'Premier Clásico / Viejo (Próximamente)', activo: false },
  { id: 'MAPLAY', nombre: 'Plataforma Maplay (Próximamente)', activo: false }
];

function renderMachinesManagement(config) {
  if (!config || !config.general) return;

  const maquinas = config.general.maquinas || [];
  const localId = config.general.maquinaLocalId || 'maquina_2';
  const verifierId = config.general.maquinaEncargadaVerificacionesId || 'maquina_1';

  // 1. Selector de máquina local
  const localSelect = document.getElementById('cfg-maquina-local-select');
  if (localSelect) {
    localSelect.innerHTML = maquinas.map(m => `
      <option value="${m.id}" ${m.id === localId ? 'selected' : ''}>
        ${m.nombre} (${m.usuarioPremier || 'Sin usuario'}) ${m.id === localId ? '★ [ESTE EQUIPO]' : ''}
      </option>
    `).join('');
  }

  // 2. Selector de máquina verificadora (Regla: sólo 1)
  const verifierSelect = document.getElementById('cfg-maquina-verificadora-select');
  if (verifierSelect) {
    verifierSelect.innerHTML = maquinas.map(m => `
      <option value="${m.id}" ${m.id === verifierId ? 'selected' : ''}>
        👑 ${m.nombre} (${m.usuarioPremier || 'Sin usuario'})
      </option>
    `).join('');
  }

  // 3. Contenedor de tarjetas de cada máquina
  const container = document.getElementById('machines-list-container');
  if (!container) return;

  container.innerHTML = '';

  maquinas.forEach((m, idx) => {
    const isVerifier = (m.id === verifierId) || !!m.esEncargadaVerificaciones;
    const isLocal = (m.id === localId);

    const card = document.createElement('div');
    card.className = `machine-node-card ${isVerifier ? 'is-verifier' : ''} ${isLocal ? 'is-local' : ''}`;
    card.setAttribute('data-machine-id', m.id);

    const platformOptions = PLATAFORMAS_SISTEMA.map(p => `
      <option value="${p.id}" ${m.tipoPlataforma === p.id ? 'selected' : ''}>
        ${p.nombre}
      </option>
    `).join('');

    card.innerHTML = `
      <div class="machine-node-header">
        <div class="machine-node-title">
          <span class="machine-priority-badge">Prioridad ${m.prioridad || idx + 1}</span>
          <span style="font-weight: 700; color: #fff;">${m.nombre || `Máquina ${idx + 1}`}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${isVerifier ? '<span class="machine-badge-verifier">👑 Verificadora Oficial (Visual-FX)</span>' : '<span class="machine-badge-pesca">🎣 Sólo Pesca (Cupo 0)</span>'}
          ${isLocal ? '<span class="machine-badge-local">💻 Este Equipo Físico</span>' : ''}
        </div>
      </div>

      <div class="machine-inputs-grid">
        <div class="form-group" style="margin:0;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted);">Nombre / Etiqueta:</label>
          <input type="text" class="form-input machine-input-nombre" value="${m.nombre || ''}" placeholder="Ej: Máquina 1 (Principal)">
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted);">Plataforma de Pesca:</label>
          <select class="form-input machine-select-plataforma">
            ${platformOptions}
          </select>
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted);">Usuario de Taquilla:</label>
          <input type="text" class="form-input machine-input-user" value="${m.usuarioPremier || ''}" placeholder="Ej: TCOP101">
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted);">Contraseña de Taquilla:</label>
          <input type="password" class="form-input machine-input-pass" value="${m.clavePremier || ''}" placeholder="••••••">
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted);">Prioridad de Elección:</label>
          <input type="number" min="1" max="99" class="form-input machine-input-prioridad" value="${m.prioridad || idx + 1}">
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted);">Ruta Ejecutable:</label>
          <input type="text" class="form-input machine-input-path" value="${m.executablePath || 'C:\\Program Files (x86)\\Premier Pluss 2.0\\PremierPlussPC20.exe'}" placeholder="C:\\...">
        </div>

        <div class="form-group" style="margin:0; grid-column: span 2;">
          <label style="font-size:12px; font-weight:700; color:#38bdf8; display:flex; align-items:center; justify-content:space-between;">
            <span>🌐 Enlace de Acceso Remoto (Túnel Cloudflare / IP):</span>
            ${m.ipOUrl && m.ipOUrl.startsWith('http') ? `<a href="${m.ipOUrl}" target="_blank" style="color:#4ade80; text-decoration:none; font-size:11px; background:rgba(74,222,128,0.15); padding:2px 8px; border-radius:4px; border:1px solid rgba(74,222,128,0.4); font-weight:700;">🔗 Abrir Consola Remota ↗</a>` : '<span style="color:#94a3b8; font-size:11px;">(Esperando conexión de nodo...)</span>'}
          </label>
          <input type="text" class="form-input machine-input-url" value="${m.ipOUrl || ''}" placeholder="Ej: https://xxxx.trycloudflare.com o http://192.168.1.100:4500" style="font-family:monospace; font-size:12px; color:#38bdf8;">
        </div>
      </div>

      <div class="machine-actions-bar">
        <div>
          <label class="checkbox-label" style="font-size: 13px; font-weight: 600;">
            <input type="checkbox" class="machine-toggle-activa" ${m.activa !== false ? 'checked' : ''}>
            <span>Habilitada para pesca activa</span>
          </label>
        </div>

        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${!isVerifier ? `
            <button class="btn btn-secondary btn-sm btn-assign-verifier" data-id="${m.id}" style="border-color:#f59e0b; color:#fbbf24;">
              <span>👑 Asignar como Verificadora</span>
            </button>
          ` : ''}

          ${!isLocal ? `
            <button class="btn btn-secondary btn-sm btn-assign-local" data-id="${m.id}" style="border-color:#38bdf8; color:#38bdf8;">
              <span>💻 Operar en Este Equipo</span>
            </button>
          ` : ''}

          ${maquinas.length > 1 ? `
            <button class="btn btn-secondary btn-sm btn-delete-machine" data-id="${m.id}" style="border-color:#f43f5e; color:#f43f5e;">
              <span>🗑️ Eliminar</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // Vincular eventos de botones internos de tarjetas
  container.querySelectorAll('.btn-assign-verifier').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      setVerifierMachineUI(id);
    });
  });

  container.querySelectorAll('.btn-assign-local').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      setLocalMachineUI(id);
    });
  });

  container.querySelectorAll('.btn-delete-machine').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      deleteMachineUI(id);
    });
  });
}

function setVerifierMachineUI(targetId) {
  if (!currentConfig || !currentConfig.general) return;
  currentConfig.general.maquinaEncargadaVerificacionesId = targetId;

  if (Array.isArray(currentConfig.general.maquinas)) {
    currentConfig.general.maquinas.forEach(m => {
      m.esEncargadaVerificaciones = (m.id === targetId);
    });
  }

  renderMachinesManagement(currentConfig);
  const target = (currentConfig.general.maquinas || []).find(m => m.id === targetId);
  showToast(`👑 ${target ? target.nombre : targetId} asignada como única verificadora oficial`);
  appendLog(`[VERIFICADOR OFICIAL] Rol exclusivo asignado a: ${target ? target.nombre : targetId}`, 'log-info');
}

function setLocalMachineUI(machineId) {
  if (!currentConfig || !currentConfig.general) return;
  currentConfig.general.maquinaLocalId = machineId;

  const target = (currentConfig.general.maquinas || []).find(m => m.id === machineId);
  if (target) {
    if (!currentConfig.general.premierPluss) currentConfig.general.premierPluss = {};
    currentConfig.general.premierPluss.user = target.usuarioPremier;
    currentConfig.general.premierPluss.password = target.clavePremier;
    currentConfig.general.premierPluss.executablePath = target.executablePath;

    const userEl = document.getElementById('cfg-premier-user');
    const passEl = document.getElementById('cfg-premier-pass');
    const pathEl = document.getElementById('cfg-premier-path');
    if (userEl) userEl.value = target.usuarioPremier || '';
    if (passEl) passEl.value = target.clavePremier || '';
    if (pathEl) pathEl.value = target.executablePath || '';
  }

  renderMachinesManagement(currentConfig);
  showToast(`💻 Este equipo configurado para operar como: ${target ? target.nombre : machineId}`);
  appendLog(`[MÁQUINA LOCAL] Identidad actualizada a: ${target ? target.nombre : machineId}`, 'log-info');
}

function deleteMachineUI(machineId) {
  if (!currentConfig || !currentConfig.general || !Array.isArray(currentConfig.general.maquinas)) return;
  if (currentConfig.general.maquinas.length <= 1) {
    alert('Debe existir al menos 1 máquina en la red.');
    return;
  }

  const target = currentConfig.general.maquinas.find(m => m.id === machineId);
  const name = target ? target.nombre : machineId;
  if (!confirm(`¿Estás seguro de eliminar la "${name}" de la red de pesca?`)) return;

  currentConfig.general.maquinas = currentConfig.general.maquinas.filter(m => m.id !== machineId);

  // Si eliminó la verificadora, transferir a la primera opción
  if (currentConfig.general.maquinaEncargadaVerificacionesId === machineId) {
    currentConfig.general.maquinaEncargadaVerificacionesId = currentConfig.general.maquinas[0].id;
    currentConfig.general.maquinas[0].esEncargadaVerificaciones = true;
  }

  // Si eliminó la local, reasignar a la primera
  if (currentConfig.general.maquinaLocalId === machineId) {
    currentConfig.general.maquinaLocalId = currentConfig.general.maquinas[0].id;
  }

  renderMachinesManagement(currentConfig);
  showToast(`🗑️ ${name} eliminada de la red`);
  appendLog(`[MULTI-MÁQUINAS] Eliminada ${name}. Restantes: ${currentConfig.general.maquinas.length}`, 'log-warn');
}

function addNewMachineUI() {
  if (!currentConfig || !currentConfig.general) return;
  if (!Array.isArray(currentConfig.general.maquinas)) currentConfig.general.maquinas = [];

  const count = currentConfig.general.maquinas.length;
  const newNum = count + 1;
  const newId = `maquina_${Date.now()}`;
  const defaultPath = 'C:\\Program Files (x86)\\Premier Pluss 2.0\\PremierPlussPC20.exe';

  const newMachine = {
    id: newId,
    nombre: `Máquina ${newNum} (Opción ${newNum})`,
    activa: true,
    prioridad: newNum,
    esEncargadaVerificaciones: false,
    tipoPlataforma: 'PREMIER_PLUS_20',
    usuarioPremier: `TCOP10${newNum}`,
    clavePremier: '123',
    executablePath: defaultPath,
    keepOpen: true,
    ipOUrl: 'http://127.0.0.1:4500',
    notas: `Taquilla adicional ${newNum}`
  };

  currentConfig.general.maquinas.push(newMachine);
  renderMachinesManagement(currentConfig);
  showToast(`➕ Nueva ${newMachine.nombre} agregada. Recuerda guardar.`);
  appendLog(`[MULTI-MÁQUINAS] Agregada nueva ${newMachine.nombre}`, 'log-info');

  // Hacer scroll suave hacia la nueva tarjeta
  const container = document.getElementById('machines-list-container');
  if (container && container.lastElementChild) {
    container.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function addNewLotteryUI() {
  if (!currentConfig || !Array.isArray(currentConfig.loterias)) return;

  const count = currentConfig.loterias.length + 1;
  const newLottery = {
    id: `loteria_${Date.now()}`,
    nombre: `Nueva Lotería ${count}`,
    activo: true,
    montoSondeo: 3000,
    totalAnimales: 38,
    horarios: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    minutosAntes: 30,
    minutosAntesPremier: 30,
    minutosAntesVisualFx: 35,
    minutosAntesAleatorios: 20,
    minutosAntesFijos: 35,
    bloqueoPremierAgotados: true,
    bloqueoPredictivosAtrasados: true,
    cantidadPredictivosABloquear: 2,
    bloqueoAleatorioSistema: true,
    cantidadAleatoriosABloquear: 2,
    bloqueoFijos: true,
    numerosFijos: [],
    sondeosMultiples: [
      { id: 1, activo: true, minutosAntes: 50 },
      { id: 2, activo: true, minutosAntes: 40 },
      { id: 3, activo: true, minutosAntes: 30 },
      { id: 4, activo: false, minutosAntes: 20 },
      { id: 5, activo: false, minutosAntes: 10 }
    ],
    memoriaCupoCero: {
      activo: true,
      sorteosPersistencia: 3
    }
  };

  currentConfig.loterias.push(newLottery);
  renderLotteries(currentConfig.loterias);
  showToast(`➕ ${newLottery.nombre} agregada. Recuerda guardar.`);
  appendLog(`[LOTERIAS] Creada nueva ruleta/lotería: ${newLottery.nombre}`, 'log-info');

  setTimeout(() => {
    const lastIndex = currentConfig.loterias.length - 1;
    const targetEl = document.getElementById(`lottery-card-${lastIndex}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      targetEl.classList.add('highlight-target');
      setTimeout(() => targetEl.classList.remove('highlight-target'), 1500);
    }
  }, 100);
}

// Botones de acción
function bindActionButtons() {
  // Sondeo Híbrido (Selección Actual en Premier Pluss)
  const btnHybrid = document.getElementById('btn-run-hybrid-test');
  if (btnHybrid) {
    btnHybrid.addEventListener('click', async () => {
      const lotSelect = document.getElementById('select-test-lottery');
      const loteriaId = lotSelect ? lotSelect.value : 'guacharo_activo';
      const lotLabel = lotSelect ? lotSelect.options[lotSelect.selectedIndex].text : loteriaId;

      appendLog(`[ACCION] 🎯 Iniciando Sondeo Híbrido (usando selección actual en Premier Pluss para ${lotLabel})...`, 'log-warn');
      updateControlUIState('RUNNING', { details: `Modo Híbrido: ${lotLabel}`, progress: 'Inyectando...' });

      try {
        const res = await fetch('/api/trigger-test', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loteriaId, modoHibrido: true })
        });
        const data = await res.json();
        if (data.ok) {
          appendLog(`[EXITO] Sondeo Híbrido finalizado: ${data.message || 'Cupos procesados'}`, 'log-success');
          showToast('Sondeo Híbrido completado');
        } else {
          appendLog(`[ERROR] ${data.message}`, 'log-danger');
        }
      } catch (err) {
        appendLog(`[ERROR] Falla al comunicar en Sondeo Híbrido: ${err.message}`, 'log-danger');
      }
    });
  }

  // Ejecutar Sondeo Ahora (Botón principal y Botón Superior en Header)
  async function triggerSondeoNow() {
    const lotSelect = document.getElementById('select-test-lottery');
    const loteriaId = lotSelect ? lotSelect.value : 'AUTO';
    const lotLabel = lotSelect ? lotSelect.options[lotSelect.selectedIndex].text : 'Próximo Sorteo';

    appendLog(`[ACCION] ⚡ Disparando Sondeo Inmediato en Premier Pluss para ${lotLabel}...`, 'log-warn');
    updateControlUIState('RUNNING', { details: `Sondeo Inmediato: ${lotLabel}`, progress: 'Conectando con taquilla...' });
    showToast(`⚡ Iniciando Sondeo de ${lotLabel}...`);
    
    try {
      let res = await fetch('/api/sondeo/trigger-now', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loteriaId })
      });
      if (!res.ok && res.status === 404) {
        res = await fetch('/api/trigger-test', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loteriaId })
        });
      }
      const data = await res.json();
      if (data.ok) {
        if (data.queued && data.commandId) {
          appendLog(`[PUENTE NUBE] ☁️ Orden enviada a la taquilla física local en Windows (${data.commandId}). Esperando sondeo de ${lotLabel}...`, 'log-warn');
          showToast(`⚡ Conectando con taquilla física para ${lotLabel}...`);

          // Polling para esperar que la taquilla local termine
          let attempts = 0;
          const pollTimer = setInterval(async () => {
            attempts++;
            if (attempts > 25) {
              clearInterval(pollTimer);
              appendLog(`[AVISO] ⏳ La taquilla local continúa procesando el sondeo en segundo plano.`, 'log-warn');
              return;
            }
            try {
              const statusRes = await fetch(`/api/sondeo/command-status/${data.commandId}`);
              const statusData = await statusRes.json();
              if (statusData.ok && statusData.status === 'COMPLETED') {
                clearInterval(pollTimer);
                appendLog(`[EXITO] ✅ Sondeo completado por la taquilla física local para ${lotLabel}.`, 'log-success');
                showToast(`✅ Sondeo completado para ${lotLabel}`);
                if (typeof fetchDashboardData === 'function') fetchDashboardData();
                if (typeof fetchTrophies === 'function') fetchTrophies();
                if (typeof loadTriple7Draws === 'function') loadTriple7Draws();
              } else if (statusData.ok && statusData.status === 'FAILED') {
                clearInterval(pollTimer);
                appendLog(`[ERROR] ❌ La taquilla física reportó fallo: ${statusData.result?.message || 'Error en taquilla'}`, 'log-danger');
                showToast('Fallo en taquilla física', 'error');
              }
            } catch (e) {}
          }, 2000);
        } else {
          appendLog(`[EXITO] ✅ ${data.message}`, 'log-success');
          showToast('Sondeo y Bloqueo completados');
          if (typeof fetchDashboardData === 'function') fetchDashboardData();
          if (typeof fetchTrophies === 'function') fetchTrophies();
          if (typeof loadTriple7Draws === 'function') loadTriple7Draws();
        }
      } else {
        appendLog(`[ERROR] ❌ ${data.message}`, 'log-danger');
        showToast(`Error: ${data.message}`, 'error');
      }
    } catch (err) {
      appendLog(`[ERROR] ❌ Falla de comunicación: ${err.message}`, 'log-danger');
      showToast(`Falla de conexión: ${err.message}`, 'error');
    }
  }

  const btnManual = document.getElementById('btn-run-manual-test');
  if (btnManual) {
    btnManual.addEventListener('click', triggerSondeoNow);
  }

  const btnHeaderSondeo = document.getElementById('btn-header-sondeo-now');
  if (btnHeaderSondeo) {
    btnHeaderSondeo.addEventListener('click', triggerSondeoNow);
  }

  // Botón Pausar (F7)
  document.getElementById('btn-pause-automation').addEventListener('click', async () => {
    appendLog('[CONTROL] Solicitando pausar la automatización...', 'log-warn');
    try {
      const res = await fetch('/api/pause', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('Automatización pausada');
        updateControlUIState('PAUSED', { details: 'Pausado por usuario' });
      }
    } catch (err) {
      appendLog(`[ERROR] Falla al pausar: ${err.message}`, 'log-danger');
    }
  });

  // Botón Continuar (F7)
  document.getElementById('btn-resume-automation').addEventListener('click', async () => {
    appendLog('[CONTROL] Reanudando automatización...', 'log-info');
    try {
      const res = await fetch('/api/resume', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('Automatización reanudada');
        updateControlUIState('RUNNING', { details: 'Reanudando...' });
      }
    } catch (err) {
      appendLog(`[ERROR] Falla al reanudar: ${err.message}`, 'log-danger');
    }
  });

  // Botón Detener por Completo (ESC o F8)
  document.getElementById('btn-stop-automation').addEventListener('click', async () => {
    if (!confirm('¿Deseas DETENER POR COMPLETO la automatización de forma inmediata?')) return;
    appendLog('[CONTROL] Solicitando DETENCIÓN TOTAL INMEDIATA...', 'log-danger');
    try {
      const res = await fetch('/api/stop', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('Automatización detenida por completo');
        updateControlUIState('STOPPED', { details: 'Detenido por el usuario' });
      }
    } catch (err) {
      appendLog(`[ERROR] Falla al detener: ${err.message}`, 'log-danger');
    }
  });

  // Botón Reiniciar Proceso
  document.getElementById('btn-restart-automation').addEventListener('click', async () => {
    const lotSelect = document.getElementById('select-test-lottery');
    const loteriaId = lotSelect ? lotSelect.value : 'guacharo_activo';
    if (!confirm('¿Deseas cancelar cualquier proceso activo y REINICIAR el sondeo desde cero?')) return;
    appendLog('[CONTROL] Reiniciando proceso desde cero...', 'log-warn');
    updateControlUIState('RUNNING', { details: 'Reiniciando desde cero...', progress: 'Preparando' });
    try {
      const res = await fetch('/api/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loteriaId })
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Proceso reiniciado exitosamente');
      }
    } catch (err) {
      appendLog(`[ERROR] Falla al reiniciar: ${err.message}`, 'log-danger');
    }
  });

  // Botón Guardar Loterías (cabecera y lateral)
  const btnSaveLotteries = document.getElementById('btn-save-lotteries');
  if (btnSaveLotteries) {
    btnSaveLotteries.addEventListener('click', saveLotteriesConfig);
  }
  const btnSaveLotteriesSide = document.getElementById('btn-save-lotteries-side');
  if (btnSaveLotteriesSide) {
    btnSaveLotteriesSide.addEventListener('click', saveLotteriesConfig);
  }

  // Botón Agregar Lotería (cabecera y lateral)
  const btnAddLottery = document.getElementById('btn-add-lottery');
  if (btnAddLottery) {
    btnAddLottery.addEventListener('click', addNewLotteryUI);
  }
  const btnAddLotterySide = document.getElementById('btn-add-lottery-side');
  if (btnAddLotterySide) {
    btnAddLotterySide.addEventListener('click', addNewLotteryUI);
  }

  // Botón Guardar Credenciales
  const btnSaveCreds = document.getElementById('btn-save-credentials');
  if (btnSaveCreds) {
    btnSaveCreds.addEventListener('click', saveCredentialsConfig);
  }

  // Red Multi-Máquinas: Botón Agregar Otra Máquina
  const btnAddMachine = document.getElementById('btn-add-machine');
  if (btnAddMachine) {
    btnAddMachine.addEventListener('click', addNewMachineUI);
  }

  // Botón Actualizar Nodo desde GitHub
  const btnUpdateWeb = document.getElementById('btn-update-from-web');
  if (btnUpdateWeb) {
    btnUpdateWeb.addEventListener('click', async () => {
      if (!confirm('¿Deseas descargar e instalar la última versión oficial desde GitHub en este nodo?')) return;
      btnUpdateWeb.disabled = true;
      btnUpdateWeb.innerHTML = '<span>⏳ Actualizando...</span>';
      try {
        const res = await fetch('/api/system/update', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          alert('🚀 ' + (data.message || 'Actualización iniciada con éxito.'));
        } else {
          alert('Aviso: ' + (data.message || 'No se pudo iniciar la actualización.'));
        }
      } catch (e) {
        alert('Error conectando con el servicio de actualización: ' + e.message);
      } finally {
        setTimeout(() => {
          btnUpdateWeb.disabled = false;
          btnUpdateWeb.innerHTML = '<span>🔄 Actualizar Nodo desde GitHub</span>';
        }, 5000);
      }
    });
  }

  // Red Multi-Máquinas: Selector de identidad local
  const selectLocalMachine = document.getElementById('cfg-maquina-local-select');
  if (selectLocalMachine) {
    selectLocalMachine.addEventListener('change', (e) => {
      setLocalMachineUI(e.target.value);
    });
  }

  // Red Multi-Máquinas: Selector de verificador oficial
  const selectVerifierMachine = document.getElementById('cfg-maquina-verificadora-select');
  if (selectVerifierMachine) {
    selectVerifierMachine.addEventListener('change', (e) => {
      setVerifierMachineUI(e.target.value);
    });
  }

  // Botón Sincronizar Tarea Programada de Windows
  const btnSyncSched = document.getElementById('btn-sync-schedule');
  if (btnSyncSched) {
    btnSyncSched.addEventListener('click', async () => {
      const horaInput = document.getElementById('cfg-hora-activacion');
      const actInput = document.getElementById('cfg-activacion-activa');
      const hora = horaInput ? horaInput.value.trim() : '07:00';
      const activo = actInput ? actInput.checked : true;

      btnSyncSched.disabled = true;
      btnSyncSched.innerHTML = '<span>⏳ Sincronizando...</span>';

      try {
        const res = await fetch('/api/schedule/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hora, activo })
        });
        const data = await res.json();
        btnSyncSched.disabled = false;
        btnSyncSched.innerHTML = '<span>🔄 Sincronizar con Windows</span>';

        if (data.ok) {
          showToast(`✅ ${data.message}`);
          appendLog(`[TAREA WINDOWS] ${data.message}`, 'log-success');
          await loadScheduleStatus();
        } else {
          showToast(`Error: ${data.message}`);
          appendLog(`[ERROR TAREA] ${data.message}`, 'log-danger');
        }
      } catch (err) {
        btnSyncSched.disabled = false;
        btnSyncSched.innerHTML = '<span>🔄 Sincronizar con Windows</span>';
        showToast(`Error: ${err.message}`);
      }
    });
  }

  // Header Wake Badge Clic (Ir a Configuración)
  const headerWakeBadge = document.getElementById('header-wake-badge');
  if (headerWakeBadge) {
    headerWakeBadge.addEventListener('click', () => {
      const credTabBtn = document.getElementById('btn-tab-credenciales');
      if (credTabBtn) credTabBtn.click();
      const horaInput = document.getElementById('cfg-hora-activacion');
      if (horaInput) {
        horaInput.focus();
        horaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Header Tunnel Badge Clic (Copiar Enlace para Celular / Internet)
  const headerTunnelBadge = document.getElementById('header-tunnel-badge');
  if (headerTunnelBadge) {
    headerTunnelBadge.addEventListener('click', async () => {
      if (currentTunnelUrl) {
        try {
          await navigator.clipboard.writeText(currentTunnelUrl);
          showToast(`¡Enlace copiado! Puedes abrirlo en tu teléfono móvil.`);
        } catch (e) {
          prompt('Copia este enlace para acceder desde tu celular:', currentTunnelUrl);
        }
      } else {
        showToast('El túnel aún se está sincronizando. Espere unos segundos...');
      }
    });
  }
}

// Gestión del Túnel Remoto para Acceso Móvil / Internet
let currentTunnelUrl = null;
function initTunnelManager() {
  const label = document.getElementById('header-tunnel-label');
  const badge = document.getElementById('header-tunnel-badge');

  async function checkTunnel() {
    try {
      const res = await fetch('/api/tunnel/info');
      const data = await res.json();
      if (data.ok && data.active && data.url) {
        currentTunnelUrl = data.url;
        if (label) {
          label.textContent = 'En Línea 📲 (Copiar)';
          label.style.background = '#10b981';
        }
        if (badge) {
          badge.title = `Enlace Activo: ${data.url}\nHaz clic para copiar y abrir en tu teléfono celular.`;
        }
      } else {
        if (label) {
          label.textContent = 'Conectando...';
          label.style.background = '#9333ea';
        }
      }
    } catch (e) {}
  }

  checkTunnel();
  setInterval(checkTunnel, 8000);
}

// Formato legible 12 Horas (ej: "07:00" -> "07:00 AM")
function formatTime12h(timeStr) {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Consultar estado en vivo de la Tarea Programada de Windows
async function loadScheduleStatus() {
  try {
    const res = await fetch('/api/schedule/info');
    const data = await res.json();
    if (data.ok && data.task) {
      const badge = document.getElementById('schedule-next-run-badge');
      const tag = document.getElementById('tag-task-status');
      const headerWake = document.getElementById('header-wake-time');
      
      if (badge) {
        if (data.task.exists) {
          badge.innerHTML = `📅 <b>Próxima ejecución en Windows:</b> ${data.task.nextRun || 'A las ' + data.hora}`;
        } else {
          badge.innerHTML = `⚠️ Tarea no registrada en Windows. Pulsa "Sincronizar".`;
        }
      }

      if (tag) {
        if (!data.activo) {
          tag.textContent = 'Tarea de Windows: Pausada';
          tag.className = 'tag tag-orange';
        } else if (data.task.exists) {
          tag.textContent = `Tarea de Windows: ${data.task.state || 'Lista'}`;
          tag.className = 'tag tag-emerald';
        } else {
          tag.textContent = 'Tarea de Windows: No creada';
          tag.className = 'tag tag-red';
        }
      }

      if (headerWake) {
        headerWake.textContent = data.activo ? formatTime12h(data.hora) : 'Desactivado';
      }
    }
  } catch (e) {}
}

// Guardar Loterías
async function saveLotteriesConfig() {
  if (!currentConfig) return;

  const lotElements = document.querySelectorAll('.lottery-item-card');
  lotElements.forEach((el, index) => {
    const lot = currentConfig.loterias[index];
    if (lot) {
      lot.activo = el.querySelector('.lottery-active-toggle').checked;
      
      // Sondeos Múltiples Escalonados (Hasta 5)
      const sondeosList = [];
      for (let sId = 1; sId <= 5; sId++) {
        const chk = el.querySelector(`.lot-sondeo-chk-${sId}`);
        const minInput = el.querySelector(`.lot-sondeo-min-${sId}`);
        sondeosList.push({
          id: sId,
          activo: chk ? chk.checked : false,
          minutosAntes: minInput ? (parseInt(minInput.value, 10) || (sId === 1 ? 50 : 40)) : 30
        });
      }
      lot.sondeosMultiples = sondeosList;
      const primerActivo = sondeosList.find(s => s.activo);
      lot.minutosAntesPremier = primerActivo ? primerActivo.minutosAntes : (lot.minutosAntesPremier || 30);
      lot.minutosAntes = lot.minutosAntesPremier;

      const minVfxInput = el.querySelector('.lot-input-minutos-visualfx');
      lot.minutosAntesVisualFx = minVfxInput ? (parseInt(minVfxInput.value, 10) || 35) : (lot.minutosAntesVisualFx || 35);

      const minAleatInput = el.querySelector('.lot-input-minutos-aleatorios');
      lot.minutosAntesAleatorios = minAleatInput ? (parseInt(minAleatInput.value, 10) || 20) : (lot.minutosAntesAleatorios || 20);

      const minFijosInput = el.querySelector('.lot-input-minutos-fijos');
      lot.minutosAntesFijos = minFijosInput ? (parseInt(minFijosInput.value, 10) || 35) : (lot.minutosAntesFijos || 35);

      lot.montoSondeo = parseFloat(el.querySelector('.lot-input-monto').value) || 3000;
      lot.totalAnimales = parseInt(el.querySelector('.lot-input-animales').value, 10) || 77;
      
      const premierToggle = el.querySelector('.lot-input-bloqueo-premier');
      if (premierToggle) lot.bloqueoPremierAgotados = premierToggle.checked;

      const predToggle = el.querySelector('.lot-input-bloqueo-predictivo');
      if (predToggle) lot.bloqueoPredictivosAtrasados = predToggle.checked;

      const cantSelect = el.querySelector('.lot-input-cantidad-predictivos');
      if (cantSelect) lot.cantidadPredictivosABloquear = parseInt(cantSelect.value, 10) || 0;

      const aleatToggle = el.querySelector('.lot-input-bloqueo-aleatorio');
      if (aleatToggle) lot.bloqueoAleatorioSistema = aleatToggle.checked;

      const aleatSelect = el.querySelector('.lot-input-cantidad-aleatorios');
      if (aleatSelect) lot.cantidadAleatoriosABloquear = Math.min(parseInt(aleatSelect.value, 10) || 0, 3);

      const fijoToggle = el.querySelector('.lot-input-bloqueo-fijo');
      if (fijoToggle) lot.bloqueoFijos = fijoToggle.checked;

      const fijosInput = el.querySelector('.lot-input-numeros-fijos');
      if (fijosInput) {
        const rawFijos = fijosInput.value.split(/[,;\s]+/).map(n => n.trim()).filter(Boolean);
        const normFijos = Array.from(new Set(rawFijos.slice(0, 3).map(n => n.padStart(2, '0'))));
        lot.numerosFijos = normFijos;
      }

      // Memoria de Cupo Cero Premier
      if (!lot.memoriaCupoCero) lot.memoriaCupoCero = {};
      const memToggle = el.querySelector('.lot-input-memoria-cupo');
      if (memToggle) lot.memoriaCupoCero.activo = memToggle.checked;
      const persistSelect = el.querySelector('.lot-input-persistencia-memoria');
      if (persistSelect) lot.memoriaCupoCero.sorteosPersistencia = Math.min(Math.max(parseInt(persistSelect.value, 10) || 3, 1), 5);

      const rawHorarios = el.querySelector('.lot-input-horarios').value;
      lot.horarios = rawHorarios.split(/[,;\s]+/).map(h => h.trim()).filter(Boolean);
    }
  });

  await persistConfig();
}

// Guardar Credenciales
async function saveCredentialsConfig() {
  if (!currentConfig) return;

  // 1. Sincronizar Red Multi-Máquinas desde las tarjetas en pantalla
  const machineCards = document.querySelectorAll('.machine-node-card');
  if (machineCards.length > 0 && currentConfig.general.maquinas) {
    machineCards.forEach(card => {
      const mId = card.getAttribute('data-machine-id');
      const machine = currentConfig.general.maquinas.find(m => m.id === mId);
      if (machine) {
        const nameInput = card.querySelector('.machine-input-nombre');
        const platSelect = card.querySelector('.machine-select-plataforma');
        const userInput = card.querySelector('.machine-input-user');
        const passInput = card.querySelector('.machine-input-pass');
        const prioInput = card.querySelector('.machine-input-prioridad');
        const pathInput = card.querySelector('.machine-input-path');
        const actToggle = card.querySelector('.machine-toggle-activa');

        if (nameInput) machine.nombre = nameInput.value.trim();
        if (platSelect) machine.tipoPlataforma = platSelect.value;
        if (userInput) machine.usuarioPremier = userInput.value.trim();
        if (passInput) machine.clavePremier = passInput.value.trim();
        if (prioInput) machine.prioridad = parseInt(prioInput.value, 10) || 1;
        if (pathInput) machine.executablePath = pathInput.value.trim();
        const urlInput = card.querySelector('.machine-input-url');
        if (urlInput) machine.ipOUrl = urlInput.value.trim();
        if (actToggle) machine.activa = actToggle.checked;
      }
    });

    const localSelect = document.getElementById('cfg-maquina-local-select');
    if (localSelect) currentConfig.general.maquinaLocalId = localSelect.value;

    const verifSelect = document.getElementById('cfg-maquina-verificadora-select');
    if (verifSelect) {
      currentConfig.general.maquinaEncargadaVerificacionesId = verifSelect.value;
      currentConfig.general.maquinas.forEach(m => {
        m.esEncargadaVerificaciones = (m.id === verifSelect.value);
      });
    }

    // Sincronizar credenciales de la máquina local con la configuración de premierPluss
    const localMachine = currentConfig.general.maquinas.find(m => m.id === currentConfig.general.maquinaLocalId);
    if (localMachine) {
      currentConfig.general.premierPluss.user = localMachine.usuarioPremier;
      currentConfig.general.premierPluss.password = localMachine.clavePremier;
      if (localMachine.executablePath) currentConfig.general.premierPluss.executablePath = localMachine.executablePath;
    }
  }

  // 2. Credenciales Legacy Premier (Sincronizadas con máquina local o campos directos)
  const pUserEl = document.getElementById('cfg-premier-user');
  const pPassEl = document.getElementById('cfg-premier-pass');
  const pPathEl = document.getElementById('cfg-premier-path');
  const pKeepEl = document.getElementById('cfg-premier-keepopen');
  if (pUserEl && pUserEl.value.trim()) currentConfig.general.premierPluss.user = pUserEl.value.trim();
  if (pPassEl && pPassEl.value.trim()) currentConfig.general.premierPluss.password = pPassEl.value.trim();
  if (pPathEl && pPathEl.value.trim()) currentConfig.general.premierPluss.executablePath = pPathEl.value.trim();
  if (pKeepEl) currentConfig.general.premierPluss.keepOpen = pKeepEl.checked;

  currentConfig.general.triple7.url = document.getElementById('cfg-t7-url').value.trim();
  currentConfig.general.triple7.user = document.getElementById('cfg-t7-user').value.trim();
  currentConfig.general.triple7.password = document.getElementById('cfg-t7-pass').value.trim();
  currentConfig.general.triple7.enabled = document.getElementById('cfg-t7-enabled').checked;

  currentConfig.general.telegram.botToken = document.getElementById('cfg-tele-token').value.trim();
  currentConfig.general.telegram.chatId = document.getElementById('cfg-tele-chat').value.trim();
  currentConfig.general.telegram.enabled = document.getElementById('cfg-tele-enabled').checked;

  if (!currentConfig.general.mantenimientoVentas) currentConfig.general.mantenimientoVentas = {};
  currentConfig.general.mantenimientoVentas.maxTicketsDia = parseInt(document.getElementById('cfg-mantenimiento-maxtickets').value, 10) || 2;
  currentConfig.general.mantenimientoVentas.montoPorTicketBs = parseFloat(document.getElementById('cfg-mantenimiento-monto').value) || 10;
  currentConfig.general.mantenimientoVentas.activo = document.getElementById('cfg-mantenimiento-activo').checked;

  const horaInput = document.getElementById('cfg-hora-activacion');
  if (horaInput) currentConfig.general.horaActivacionDiaria = horaInput.value.trim() || '07:00';
  const actInput = document.getElementById('cfg-activacion-activa');
  if (actInput) currentConfig.general.activacionDiariaActiva = actInput.checked;

  await persistConfig();
}

// Enviar persistencia al backend
async function persistConfig() {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentConfig)
    });
    const result = await res.json();
    if (result.ok) {
      showToast('Configuración guardada exitosamente');
      appendLog('[CONFIG] Parámetros guardados y actualizados en memoria.', 'log-success');
      populateUIWithConfig(currentConfig);
    }
  } catch (err) {
    appendLog(`[ERROR] No se pudo guardar: ${err.message}`, 'log-danger');
  }
}

// Actualizar estado visual de los controles de automatización
function updateControlUIState(status, info = {}) {
  const pill = document.getElementById('bot-control-pill');
  const progressLabel = document.getElementById('automation-progress-label');
  const btnRun = document.getElementById('btn-run-manual-test');
  const btnPause = document.getElementById('btn-pause-automation');
  const btnResume = document.getElementById('btn-resume-automation');
  const btnStop = document.getElementById('btn-stop-automation');
  const btnRestart = document.getElementById('btn-restart-automation');

  if (!pill) return;
  pill.className = 'status-pill';

  if (status === 'RUNNING') {
    pill.classList.add('status-running');
    pill.innerHTML = '🟢 EN EJECUCIÓN';
    progressLabel.textContent = info.progress ? `${info.details || 'Inyectando'} [${info.progress}]` : (info.details || 'En ejecución');
    btnRun.disabled = true;
    btnPause.style.display = 'inline-flex';
    btnPause.disabled = false;
    btnResume.style.display = 'none';
    btnStop.disabled = false;
    btnRestart.disabled = false;
  } else if (status === 'PAUSED') {
    pill.classList.add('status-paused');
    pill.innerHTML = '⏸️ PAUSADO';
    progressLabel.textContent = `Pausado: ${info.details || 'Presiona Continuar o F7'}`;
    btnRun.disabled = true;
    btnPause.style.display = 'none';
    btnResume.style.display = 'inline-flex';
    btnResume.disabled = false;
    btnStop.disabled = false;
    btnRestart.disabled = false;
  } else if (status === 'STOPPED') {
    pill.classList.add('status-stopped');
    pill.innerHTML = '🛑 DETENIDO';
    progressLabel.textContent = `Detenido: ${info.details || 'Por el usuario'}`;
    btnRun.disabled = false;
    btnPause.style.display = 'inline-flex';
    btnPause.disabled = true;
    btnResume.style.display = 'none';
    btnStop.disabled = true;
    btnRestart.disabled = false;
  } else {
    // IDLE
    pill.classList.add('status-idle');
    pill.innerHTML = '⚪ EN REPOSO';
    progressLabel.textContent = 'Listo para iniciar';
    btnRun.disabled = false;
    btnPause.style.display = 'inline-flex';
    btnPause.disabled = true;
    btnResume.style.display = 'none';
    btnStop.disabled = true;
    btnRestart.disabled = false;
  }
}

// Polling de estado, logs y control en tiempo real
function startStatusPolling() {
  statusInterval = setInterval(async () => {
    try {
      // 1. Estado de Ejecución y Control
      const ctrlRes = await fetch('/api/control-status');
      const ctrlData = await ctrlRes.json();
      if (ctrlData && ctrlData.ok) {
        updateControlUIState(ctrlData.status, ctrlData);
      }

      // 2. Historial y Logs
      const res = await fetch('/api/status');
      const data = await res.json();

      if (data.history && data.history.length > 0) {
        renderHistoryTable(data.history);
      }

      if (data.logs && data.logs.length > 0) {
        data.logs.forEach(l => appendLog(l.msg, l.level));
      }

      // 3. Sincronizar contadores y tarjetas de trofeos periódicamente
      if (!window._lastTrophyPoll || Date.now() - window._lastTrophyPoll > 3500) {
        window._lastTrophyPoll = Date.now();
        loadTrophies();
      }

      // 4. Sincronizar números atrasados con Visual-FX periódicamente (cada 5 minutos)
      if (!window._lastDelayedPoll || Date.now() - window._lastDelayedPoll > 300000) {
        window._lastDelayedPoll = Date.now();
        actualizarTodosLosAtrasados();
      }
    } catch (e) {}
  }, 1500);
}

// Formatear fecha para el historial (ej: "2026-10-03" -> "03/10/2026")
function formatHistoryDate(dateStr) {
  if (!dateStr) return '--/--/----';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {}
  return dateStr;
}

// Ordenar registros de forma descendente estricta (más recientes arriba)
function sortRecordsDescending(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    if (timeA && timeB && timeA !== timeB) return timeB - timeA;
    const strA = `${a.fecha || ''} ${a.horaSorteo || a.sorteo || ''}`;
    const strB = `${b.fecha || ''} ${b.horaSorteo || b.sorteo || ''}`;
    return strB.localeCompare(strA);
  });
}

// Renderizar tabla de historial
function renderHistoryTable(history) {
  const tbody = document.getElementById('history-table-body');
  document.getElementById('total-checked-badge').textContent = `${history.length} sorteos revisados`;
  
  tbody.innerHTML = '';
  const sorted = sortRecordsDescending(history);
  sorted.forEach(item => {
    const tr = document.createElement('tr');
    
    // Verificación de Ganador y Aciertos
    const hasWinner = item.ganador && item.ganador.verificado && item.ganador.numero;
    const winNum = hasWinner ? String(item.ganador.numero).padStart(2, '0') : null;
    const winInt = hasWinner ? parseInt(item.ganador.numero, 10) : null;
    const isHit = hasWinner && item.ganador.bloqueoAcertado === true;

    if (isHit) {
      tr.classList.add('row-trophy-hit');
    }

    // Helper para verificar si un número coincide con el ganador
    const isWinnerNumber = (n) => {
      if (!hasWinner) return false;
      const clean = String(typeof n === 'object' ? n.numero : n).padStart(2, '0');
      return clean === winNum || parseInt(clean, 10) === winInt;
    };

    // 1. Agotados Premier (Cupo 0)
    const premierItems = item.rojosPremier || item.rojos || [];
    let redTags = '<span style="color:var(--text-dim)">Ninguno</span>';
    if (premierItems.length > 0) {
      redTags = premierItems.map(num => {
        if (isWinnerNumber(num)) {
          return `<span class="tag tag-trophy-acierto" title="¡GOLPE DE BANCA EVITADO! Este número agotado en Premier salió premiado.">🏆 ${num}</span>`;
        }
        return `<span class="tag tag-red">${num}</span>`;
      }).join(' ');
    }
    
    // 2. Cobertura de Riesgo (Fijos + Predictivos + Aleatorios)
    const fijosList = item.numFijos || (item.fijosSeleccionados || []).map(f => typeof f === 'object' ? f.numero : f);
    const fijosTags = fijosList.map(n => {
      if (isWinnerNumber(n)) {
        return `<span class="tag tag-trophy-acierto" title="¡GOLPE DE BANCA EVITADO! Número Fijo salió premiado.">🏆 📌 ${n}</span>`;
      }
      return `<span class="tag" style="background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4);" title="Número Fijo">📌 ${n}</span>`;
    });

    const predList = item.numPredictivos || (item.predictivosVisualFx || []).map(p => typeof p === 'object' ? p.numero : p);
    const predTags = predList.map(p => {
      if (isWinnerNumber(p)) {
        return `<span class="tag tag-trophy-acierto" title="¡GOLPE DE BANCA EVITADO! Número Atrasado de Visual-FX salió premiado.">🏆 🔮 ${p}</span>`;
      }
      return `<span class="tag" style="background:rgba(168,85,247,0.2); color:#d8b4fe; border:1px solid rgba(168,85,247,0.4);" title="Atrasado Visual-FX">🔮 ${p}</span>`;
    });

    const aleatList = item.numAleatorios || (item.aleatoriosSistema || []).map(a => typeof a === 'object' ? a.numero : a);
    const aleatTags = aleatList.map(a => {
      if (isWinnerNumber(a)) {
        return `<span class="tag tag-trophy-acierto" title="¡GOLPE DE BANCA EVITADO! Número Aleatorio de Cobertura salió premiado.">🏆 🎲 ${a}</span>`;
      }
      return `<span class="tag" style="background:rgba(6,182,212,0.2); color:#67e8f9; border:1px solid rgba(6,182,212,0.4);" title="Aleatorio del Sistema">🎲 ${a}</span>`;
    });

    const memoriaList = item.numMemoriaCupoCero || (item.memoriaCupoCero || []).map(m => typeof m === 'object' ? m.numero : m);
    const memoriaTags = memoriaList.map(m => {
      if (isWinnerNumber(m)) {
        return `<span class="tag tag-trophy-acierto" title="¡GOLPE DE BANCA EVITADO! Número de Memoria de Cupo Cero Premier salió premiado.">🏆 🧠 ${m}</span>`;
      }
      return `<span class="tag tag-memoria" title="Memoria Cupo Cero Premier (Arrastre Preventivo)">🧠 ${m}</span>`;
    });
    
    const allCoverage = [...fijosTags, ...predTags, ...aleatTags, ...memoriaTags];
    const coverageHtml = allCoverage.length > 0 
      ? allCoverage.join(' ') 
      : '<span style="color:var(--text-dim); font-size:11px;">Solo Cupo 0</span>';

    // 3. Estado Triple 7
    const statusTriple7 = item.t7Blocked 
      ? `<span class="tag tag-emerald">Bloqueados (${item.rojos ? item.rojos.length : 0})</span>` 
      : `<span class="tag tag-blue">${item.t7Status || 'Pendiente'}</span>`;

    // 4. Fecha
    const fechaFormatted = formatHistoryDate(item.fecha || (item.timestamp && item.timestamp.split('T')[0]));

    // 5. Celda de Resultado Oficial
    let resultadoHtml = '';
    let resultadoTdClass = '';

    if (hasWinner) {
      if (isHit) {
        resultadoTdClass = 'class="result-cell-trophy"';
        const primerMetodo = (item.ganador && item.ganador.metodosAcierto && item.ganador.metodosAcierto[0]) ? item.ganador.metodosAcierto[0].tag : (item.ganador.origenTexto || (item.ganador.origenAcierto === 'PREMIER' ? '🔴 Premier' : '🛡️ Bloqueado'));
        resultadoHtml = `<span class="tag tag-winner-trophy" title="¡GOLPE DE BANCA EVITADO! Bloqueado por: ${item.ganador.origenTexto || primerMetodo}">🏆 ${item.ganador.numero} - ${item.ganador.nombre} <small style="font-weight:800; opacity:0.95; margin-left:3px; background:rgba(0,0,0,0.25); padding:1px 4px; border-radius:3px;">[${primerMetodo}]</small></span>`;
      } else {
        resultadoHtml = `<span class="tag tag-winner-normal" title="Resultado oficial">${item.ganador.numero} - ${item.ganador.nombre}</span>`;
      }
    } else {
      resultadoHtml = `<button type="button" class="btn-verify-badge" data-id="${item.id}" title="Haga clic para buscar y verificar el resultado oficial de este sorteo en vivo">⏳ Por verificar <span style="font-size:10px;">🔍</span></button>`;
    }

    tr.innerHTML = `
      <td style="font-family:var(--font-mono); color:var(--text-muted); font-size:12px;"><strong>${fechaFormatted}</strong></td>
      <td><strong>${item.horaSorteo || item.sorteo}</strong></td>
      <td>${item.loteria}</td>
      <td>${redTags}</td>
      <td>${coverageHtml}</td>
      <td>${statusTriple7}</td>
      <td ${resultadoTdClass}>${resultadoHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // Vincular clics de búsqueda directa en vivo a los badges "Por verificar"
  tbody.querySelectorAll('.btn-verify-badge').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const recId = btn.getAttribute('data-id');
      if (recId) triggerSingleDrawLookup(recId, btn);
    });
  });
}

// Actualizar cuenta regresiva
function updateCountdown() {
  if (!currentConfig) return;
  const guacharo = currentConfig.loterias.find(l => l.activo);
  if (!guacharo || !guacharo.horarios || guacharo.horarios.length === 0) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Encontrar el siguiente sorteo
  let nextDraw = null;
  let nextCheckMinutes = null;

  for (const hStr of guacharo.horarios) {
    const [h, m] = hStr.split(':').map(Number);
    const drawMinutes = h * 60 + m;
    const maxAnticipation = Math.max(
      guacharo.minutosAntesPremier || guacharo.minutosAntes || 30,
      guacharo.bloqueoPredictivosAtrasados !== false ? (guacharo.minutosAntesVisualFx || 35) : 0,
      guacharo.bloqueoAleatorioSistema !== false ? (guacharo.minutosAntesAleatorios || 20) : 0
    );
    const checkMinutes = drawMinutes - maxAnticipation;

    if (checkMinutes > currentMinutes) {
      nextDraw = hStr;
      nextCheckMinutes = checkMinutes;
      break;
    }
  }

  const nextTimeEl = document.getElementById('next-draw-time');
  const nextCountEl = document.getElementById('next-draw-countdown');

  if (nextDraw) {
    const diff = nextCheckMinutes - currentMinutes;
    const hoursLeft = Math.floor(diff / 60);
    const minsLeft = diff % 60;
    nextTimeEl.textContent = `Sorteo ${nextDraw}`;
    nextCountEl.textContent = `Chequeo en ${hoursLeft > 0 ? `${hoursLeft}h ` : ''}${minsLeft}m (a las ${formatMinutesToTime(nextCheckMinutes)})`;
  } else {
    nextTimeEl.textContent = 'Jornada Finalizada';
    nextCountEl.textContent = 'Próximos sorteos mañana';
  }
}

function formatMinutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

// Log Console Helper
function appendLog(msg, level = 'log-info') {
  const box = document.getElementById('console-logs');
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  const time = new Date().toLocaleTimeString();
  entry.textContent = `[${time}] ${msg}`;
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
}

// Toast Notifier
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==========================================================================
// MURO DE TROFEOS & AUDITORÍA DE BLOQUEOS (LÓGICA CLIENTE)
// ==========================================================================

// Inicializar botones y listeners del Muro de Trofeos
function initTrophyModule() {
  const btnSync = document.getElementById('btn-sync-results');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      btnSync.innerHTML = '<span class="btn-icon">⏳</span><span>Sincronizando...</span>';
      appendLog('[RESULTADOS] Sincronizando con base de sorteos oficiales de Visual-FX...', 'log-warn');
      try {
        const res = await fetch('/api/trophies/sync', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          showToast(data.message || 'Resultados sincronizados');
          appendLog(`[EXITO] ${data.message}`, data.trophiesCount > 0 ? 'log-success' : 'log-info');
          await loadTrophies();
        } else {
          showToast(`Aviso: ${data.message}`);
        }
      } catch (err) {
        appendLog(`[ERROR] Falla al sincronizar resultados: ${err.message}`, 'log-danger');
      } finally {
        btnSync.disabled = false;
        btnSync.innerHTML = '<span class="btn-icon">🔄</span><span>Sincronizar Resultados (Visual-FX)</span>';
      }
    });
  }

  const btnSim = document.getElementById('btn-simulate-trophy');
  if (btnSim) {
    btnSim.addEventListener('click', async () => {
      appendLog('[SIMULACIÓN] Disparando simulación de golpe evitado para probar resalte visual...', 'log-warn');
      try {
        const res = await fetch('/api/trophies/simulate', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          showToast('🏆 ¡Golpe evitado confirmado! Tarjeta resaltada con franja verde');
          appendLog(`[TROFEO CONFIRMADO] ${data.mensaje}`, 'log-success');
          await loadTrophies();
        } else {
          showToast(data.message);
        }
      } catch (err) {
        appendLog(`[ERROR] Falla al simular: ${err.message}`, 'log-danger');
      }
    });
  }

  // Filtros de Auditoría
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTrophyFilter = btn.getAttribute('data-filter') || 'all';
      renderTrophyCards(cachedTrophyRecords, currentTrophyFilter);
    });
  });
}

// Cargar estadísticas y registros de Trofeos
async function loadTrophies() {
  try {
    const [statsRes, recsRes] = await Promise.all([
      fetch('/api/trophies/stats'),
      fetch('/api/trophies/records')
    ]);

    const statsData = await statsRes.json();
    const recsData = await recsRes.json();

    if (statsData.ok && statsData.stats) {
      cachedTrophyStats = statsData.stats;
      updateTrophyCounterUI(statsData.stats);
    }

    if (recsData.ok && recsData.records) {
      cachedTrophyRecords = recsData.records;
      updateFilterCounts(recsData.records);
      renderTrophyCards(recsData.records, currentTrophyFilter);
    }
  } catch (err) {
    console.error('Error cargando trofeos:', err);
  }
}

// Actualizar contadores y badges visuales
function updateTrophyCounterUI(stats) {
  // Badge en la barra lateral
  const sideBadge = document.getElementById('sidebar-trophy-counter');
  if (sideBadge) sideBadge.textContent = stats.totalTrofeos || 0;

  // Banner en dashboard
  const dashSummary = document.getElementById('dash-trophy-summary-text');
  if (dashSummary) {
    const salvadoFmt = Number(stats.capitalEstimadoSalvado || 0).toLocaleString('es-VE');
    dashSummary.textContent = `${stats.totalTrofeos || 0} Golpes Evitados (${stats.trofeosPremier || 0} Premier, ${stats.trofeosFijo || 0} Fijos, ${stats.trofeosPredictivo || 0} Visual-FX, ${stats.trofeosAleatorio || 0} Sistema) • Estimado: ${salvadoFmt} Bs protegidos`;
  }

  // Tarjetas principales en Muro de Trofeos
  const totalCountEl = document.getElementById('trophy-total-count');
  if (totalCountEl) totalCountEl.textContent = stats.totalTrofeos || 0;

  const rateEl = document.getElementById('trophy-efficacy-rate');
  if (rateEl) rateEl.textContent = `Eficacia Protectora: ${stats.tasaEficacia || '0.0'}% (${stats.totalVerificados || 0} sorteos verificados)`;

  const premierCountEl = document.getElementById('trophy-premier-count');
  if (premierCountEl) premierCountEl.textContent = stats.trofeosPremier || 0;

  const fixedCountEl = document.getElementById('trophy-fixed-count');
  if (fixedCountEl) fixedCountEl.textContent = stats.trofeosFijo || 0;

  const predCountEl = document.getElementById('trophy-predictive-count');
  if (predCountEl) predCountEl.textContent = stats.trofeosPredictivo || 0;

  const randCountEl = document.getElementById('trophy-random-count');
  if (randCountEl) randCountEl.textContent = stats.trofeosAleatorio || 0;

  const savedAmtEl = document.getElementById('trophy-saved-amount');
  if (savedAmtEl) {
    savedAmtEl.textContent = `${Number(stats.capitalEstimadoSalvado || 0).toLocaleString('es-VE')} Bs`;
  }
}

// Actualizar conteo de los botones de filtro
function updateFilterCounts(records) {
  const allCount = records.length;
  const trophyCount = records.filter(r => r.ganador && r.ganador.bloqueoAcertado === true).length;
  const pendingCount = records.filter(r => !r.ganador || !r.ganador.verificado).length;

  const elAll = document.getElementById('count-all-sorteos');
  if (elAll) elAll.textContent = allCount;

  const elTrophy = document.getElementById('count-trophies-only');
  if (elTrophy) elTrophy.textContent = trophyCount;

  const elPending = document.getElementById('count-pending-only');
  if (elPending) elPending.textContent = pendingCount;
}

// Renderizar tarjetas de auditoría de bloqueos y trofeos
function renderTrophyCards(records, filter = 'all') {
  const container = document.getElementById('trophy-cards-container');
  if (!container) return;

  let filtered = sortRecordsDescending(records);

  if (filter === 'trophies') {
    filtered = filtered.filter(r => r.ganador && r.ganador.bloqueoAcertado === true);
  } else if (filter === 'pending') {
    filtered = filtered.filter(r => !r.ganador || !r.ganador.verificado);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-trophies-state">
        <span style="font-size:42px;">🏆</span>
        <h4 style="font-size:16px; margin: 10px 0 6px; color:#fff;">No hay registros para este filtro</h4>
        <p style="font-size:13px; color:var(--text-muted);">
          ${filter === 'trophies' ? 'Aún no se ha verificado un sorteo premiado con números bloqueados. ¡Pulsa "Simular Golpe Evitado" o verifica un sorteo!' : 'Todos los sorteos están al día.'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  filtered.forEach(rec => {
    const isTrophy = rec.ganador && rec.ganador.bloqueoAcertado === true;
    const isVerified = rec.ganador && rec.ganador.verificado;
    const winnerNum = rec.ganador ? String(rec.ganador.numero).padStart(2, '0') : null;
    const winnerName = rec.ganador ? rec.ganador.nombre : null;

    // Ícono por lotería
    let lotteryIcon = '🎰';
    const lowerLot = (rec.loteria || '').toLowerCase();
    if (lowerLot.includes('guacharo')) lotteryIcon = '🦜';
    else if (lowerLot.includes('granjita')) lotteryIcon = '🐸';

    // Lista de bloqueados consolidados
    const bloqueos = rec.bloqueosConsolidados || [];
    const chipsHtml = bloqueos.map(b => {
      const isThisWinner = isTrophy && (b.numero === winnerNum || parseInt(b.numero, 10) === parseInt(winnerNum, 10));
      let chipClass = 'number-chip';
      let originLabel = '';

      if (b.origen === 'PREMIER') {
        chipClass += ' chip-premier';
        originLabel = '🔴 Premier';
      } else if (b.origen === 'FIJO') {
        chipClass += ' chip-fijo';
        originLabel = '📌 Fijo';
      } else if (b.origen === 'PREDICTIVO') {
        chipClass += ' chip-predictive';
        originLabel = `🔮 ${b.detalle || 'Atrasado'}`;
      } else if (b.origen === 'ALEATORIO') {
        chipClass += ' chip-aleatorio';
        originLabel = '🎲 Sistema';
      } else if (b.origen === 'MEMORIA_CUPO_0') {
        chipClass += ' chip-memoria';
        originLabel = '🧠 Memoria';
      } else {
        chipClass += ' chip-both';
        originLabel = '🔥 Múltiple';
      }

      if (isThisWinner) {
        chipClass += ' chip-trophy-winner';
        return `
          <span class="${chipClass}" title="¡Este número salió premiado y estaba bloqueado!">
            👑 <b>${b.numero} ${b.nombre}</b> <small style="background:#10b981; color:#0f172a; padding:1px 5px; border-radius:4px; font-weight:800;">¡BLOQUEADO!</small>
          </span>
        `;
      }

      return `
        <span class="${chipClass}" title="${b.origenTexto || ''}: ${b.detalle || ''}">
          ${b.numero} ${b.nombre} <small>(${originLabel})</small>
        </span>
      `;
    }).join('');

    // Ribbon banner de victoria si es trofeo
    let ribbonHtml = '';
    const winNorm = winnerNum ? String(winnerNum).padStart(2, '0') : null;
    const winVal = winnerNum ? parseInt(winnerNum, 10) : null;

    const isBlockedPremier = isTrophy && (rec.rojosPremier || []).some(n => String(n).padStart(2, '0') === winNorm || parseInt(n, 10) === winVal);
    const isBlockedFijo = isTrophy && (rec.numFijos || (rec.fijosSeleccionados || []).map(f => typeof f === 'object' ? f.numero : f)).some(n => String(n).padStart(2, '0') === winNorm || parseInt(n, 10) === winVal);
    const isBlockedPredictivo = isTrophy && (rec.numPredictivos || (rec.predictivosVisualFx || []).map(p => typeof p === 'object' ? p.numero : p)).some(n => String(n).padStart(2, '0') === winNorm || parseInt(n, 10) === winVal);
    const isBlockedAleatorio = isTrophy && (rec.numAleatorios || (rec.aleatoriosSistema || []).map(a => typeof a === 'object' ? a.numero : a)).some(n => String(n).padStart(2, '0') === winNorm || parseInt(n, 10) === winVal);
    const isBlockedMemoria = isTrophy && (rec.numMemoriaCupoCero || (rec.memoriaCupoCero || []).map(m => typeof m === 'object' ? m.numero : m)).some(n => String(n).padStart(2, '0') === winNorm || parseInt(n, 10) === winVal);

    let metodosExitosos = [];
    if (isBlockedPremier) metodosExitosos.push({ tag: '🔴 Premier Cupo 0', desc: 'Agotado en Taquilla Premier', color: '#f43f5e', bg: 'rgba(244,63,94,0.18)', border: '#f43f5e' });
    if (isBlockedFijo) metodosExitosos.push({ tag: '📌 Número Fijo', desc: 'Bloqueo Fijo Permanente', color: '#818cf8', bg: 'rgba(99,102,241,0.18)', border: '#818cf8' });
    if (isBlockedPredictivo) metodosExitosos.push({ tag: '🔮 Visual-FX Atrasados', desc: 'Modelo Predictivo', color: '#c084fc', bg: 'rgba(192,132,252,0.18)', border: '#c084fc' });
    if (isBlockedAleatorio) metodosExitosos.push({ tag: '🎲 Sistema Autónomo', desc: 'Cobertura Aleatoria', color: '#38bdf8', bg: 'rgba(56,189,248,0.18)', border: '#38bdf8' });
    if (isBlockedMemoria) metodosExitosos.push({ tag: '🧠 Memoria Cupo 0', desc: 'Arrastre Preventivo', color: '#f472b6', bg: 'rgba(244,114,182,0.18)', border: '#f472b6' });

    if (metodosExitosos.length === 0 && rec.ganador && Array.isArray(rec.ganador.metodosAcierto) && rec.ganador.metodosAcierto.length > 0) {
      metodosExitosos = rec.ganador.metodosAcierto.map(m => {
        let color = '#10b981', bg = 'rgba(16,185,129,0.18)', border = '#10b981';
        if (m.id === 'PREMIER') { color = '#f43f5e'; bg = 'rgba(244,63,94,0.18)'; border = '#f43f5e'; }
        else if (m.id === 'FIJO') { color = '#818cf8'; bg = 'rgba(99,102,241,0.18)'; border = '#818cf8'; }
        else if (m.id === 'PREDICTIVO') { color = '#c084fc'; bg = 'rgba(192,132,252,0.18)'; border = '#c084fc'; }
        else if (m.id === 'ALEATORIO') { color = '#38bdf8'; bg = 'rgba(56,189,248,0.18)'; border = '#38bdf8'; }
        else if (m.id === 'MEMORIA_CUPO_0') { color = '#f472b6'; bg = 'rgba(244,114,182,0.18)'; border = '#f472b6'; }
        return { tag: m.tag || m.nombre, desc: m.nombre, color, bg, border };
      });
    }

    if (isTrophy && metodosExitosos.length === 0) {
      if (rec.ganador && rec.ganador.origenAcierto === 'PREMIER') {
        metodosExitosos.push({ tag: '🔴 Premier Cupo 0', desc: 'Agotado en Taquilla Premier', color: '#f43f5e', bg: 'rgba(244,63,94,0.18)', border: '#f43f5e' });
      } else if (rec.ganador && rec.ganador.origenAcierto === 'ALEATORIO') {
        metodosExitosos.push({ tag: '🎲 Sistema Autónomo', desc: 'Cobertura Aleatoria', color: '#38bdf8', bg: 'rgba(56,189,248,0.18)', border: '#38bdf8' });
      } else if (rec.ganador && rec.ganador.origenAcierto === 'PREDICTIVO') {
        metodosExitosos.push({ tag: '🔮 Visual-FX Atrasados', desc: 'Modelo Predictivo', color: '#c084fc', bg: 'rgba(192,132,252,0.18)', border: '#c084fc' });
      } else if (rec.ganador && rec.ganador.origenAcierto === 'FIJO') {
        metodosExitosos.push({ tag: '📌 Número Fijo', desc: 'Bloqueo Fijo Permanente', color: '#818cf8', bg: 'rgba(99,102,241,0.18)', border: '#818cf8' });
      } else {
        metodosExitosos.push({ tag: '🛡️ Bloqueo Blindado', desc: 'Protección de Riesgo', color: '#10b981', bg: 'rgba(16,185,129,0.18)', border: '#10b981' });
      }
    }

    if (isTrophy) {
      ribbonHtml = `
        <div class="trophy-ribbon-banner">
          <div class="ribbon-left">
            <span class="ribbon-icon">🏆</span>
            <div class="ribbon-text">
              <strong>¡GOLPE DE BANCA EVITADO! SALIÓ EL N° ${winnerNum} (${winnerName ? winnerName.toUpperCase() : 'ANIMAL'})</strong>
              <div style="margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span style="font-size:12px; color:#cbd5e1; font-weight:600;">🎯 Método(s) que logró el bloqueo:</span>
                ${metodosExitosos.map(m => `<span style="background:${m.bg}; color:${m.color}; border:1px solid ${m.border}; padding:2px 8px; border-radius:4px; font-weight:800; font-size:11px; display:inline-flex; align-items:center; gap:3px;">${m.tag}</span>`).join(' ')}
              </div>
            </div>
          </div>
          <span class="ribbon-shield-pill">🛡️ SALVADO</span>
        </div>
      `;
    }

    // Badge de estado en header
    let statusBadgeHtml = '';
    if (isTrophy) {
      statusBadgeHtml = `<span class="card-status-badge badge-trophy-hit">🏆 ¡GOLPE EVITADO!</span>`;
    } else if (isVerified) {
      statusBadgeHtml = `<span class="card-status-badge badge-draw-verified">✓ Sorteo Verificado</span>`;
    } else {
      statusBadgeHtml = `<span class="card-status-badge badge-draw-pending">⏳ Pendiente de Sorteo</span>`;
    }

    // Sección de Resultado / Verificación
    let resultSectionHtml = '';
    if (isVerified) {
      const winnerWasBlocked = isTrophy;
      resultSectionHtml = `
        <div class="draw-result-box ${winnerWasBlocked ? 'winner-trophy-highlight-box' : ''}">
          <div class="draw-winner-display">
            <div class="winner-num-badge ${winnerWasBlocked ? 'winner-was-blocked' : ''}">
              ${winnerNum}
            </div>
            <div class="winner-info-text">
              <strong>${winnerName || 'Animal Oficial'}</strong>
              ${winnerWasBlocked ? `
                <div style="margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span style="font-size:12px; color:#34d399; font-weight:700;">🌟 ¡Estaba Bloqueado! Método:</span>
                  ${metodosExitosos.map(m => `<span style="background:${m.bg}; color:${m.color}; border:1px solid ${m.border}; padding:2px 7px; border-radius:4px; font-weight:700; font-size:11px;">${m.tag}</span>`).join(' ')}
                </div>
              ` : `
                <span style="color:var(--text-muted); font-size:12px;">⚪ Número premiado no estaba en lista de bloqueos</span>
              `}
            </div>
          </div>
          <button class="btn btn-sm btn-secondary btn-edit-winner" data-id="${rec.id}" style="padding:4px 10px; font-size:11px;">
            Modificar
          </button>
        </div>
      `;
    } else {
      resultSectionHtml = `
        <div class="draw-result-box">
          <div class="quick-verify-form">
            <span style="font-size:12px; color:var(--text-muted); font-weight:600;">Resultado Oficial:</span>
            <input type="text" class="quick-verify-input" id="input-winner-${rec.id}" placeholder="N° opcional" maxlength="3">
            <button class="btn btn-sm btn-primary btn-submit-verify" data-id="${rec.id}" title="Haga clic para buscar y verificar automáticamente el resultado oficial, o escriba el número manual">
              🔍 Buscar / Verificar
            </button>
          </div>
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = `trophy-audit-card ${isTrophy ? 'card-trophy-hit' : ''}`;
    card.innerHTML = `
      ${ribbonHtml}
      
      <div class="card-header-inner">
        <div class="card-title-group">
          <span class="card-lottery-icon">${lotteryIcon}</span>
          <div>
            <div class="card-lottery-name">${rec.loteria}</div>
            <div class="card-draw-time">
              <span>Sorteo: <b>${rec.sorteo || rec.horaSorteo || 'Actual'}</b></span>
              <span>•</span>
              <span>${rec.fecha} ${rec.hora}</span>
            </div>
          </div>
        </div>
        ${statusBadgeHtml}
      </div>

      <div class="card-body-inner">
        <!-- Números Bloqueados con Origen (4 Vías) -->
        <div class="blocked-origin-section">
          <div class="blocked-section-title">
            <span>🛡️ Bloqueos Aplicados (${bloqueos.length || (rec.rojos ? rec.rojos.length : 0)} números):</span>
            <span style="font-size:11px; font-weight:normal; color:#38bdf8;">
              ${(rec.rojosPremier || []).length} Premier • ${(rec.numFijos || []).length} Fijos • ${(rec.numPredictivos || []).length} Visual-FX • ${(rec.numAleatorios || []).length} Sistema
            </span>
          </div>
          <div class="chips-container">
            ${chipsHtml || '<span style="color:var(--text-dim); font-size:12px;">Ningún número bloqueado para este sorteo</span>'}
          </div>
        </div>

        <!-- Resultado y Verificación -->
        ${resultSectionHtml}
      </div>

      <div class="card-footer-inner">
        <span>Monto Sondeo: <b>${Number(rec.montoSondeo || 3000).toLocaleString('es-VE')} Bs</b></span>
        <span>Triple 7: <b>${rec.t7Status || 'Pendiente'}</b></span>
      </div>
    `;

    container.appendChild(card);
  });

  // Bind acciones de verificación manual
  bindCardVerifyActions();
}

// Bind de verificación manual dentro de cada tarjeta
// Actualizar estado general e historial de sorteos
async function refreshStatusAndHistory() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.history && data.history.length > 0) {
      renderHistoryTable(data.history);
    }
  } catch (e) {}
}

// Búsqueda y actualización en vivo de un sorteo individual ("Por verificar")
async function triggerSingleDrawLookup(recordId, buttonEl) {
  const originalText = buttonEl ? buttonEl.innerHTML : '';
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.innerHTML = '<span style="display:inline-flex; align-items:center; gap:4px;">⏳ Buscando...</span>';
  }

  showToast('🔍 Consultando resultado oficial en vivo...');
  appendLog(`[SCRAPER] Consultando resultado oficial en tiempo real para ID ${recordId}...`, 'log-info');

  try {
    const res = await fetch('/api/trophies/lookup-single-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId })
    });
    const data = await res.json();

    if (data.ok && data.found) {
      if (data.isHit) {
        showToast(`🏆 ¡GOLPE EVITADO! Salió el ${data.winner.numero} (${data.winner.nombre})`);
        appendLog(`[TROFEO] ¡GOLPE DE BANCA EVITADO! Salió el ${data.winner.numero} (${data.winner.nombre}) que ESTABA BLOQUEADO.`, 'log-success');
      } else {
        showToast(`✅ Verificado: Salió ${data.winner.numero} (${data.winner.nombre})`);
        appendLog(`[VERIFICADO] Resultado oficial obtenido: ${data.winner.numero} - ${data.winner.nombre}`, 'log-info');
      }

      await Promise.all([refreshStatusAndHistory(), loadTrophies()]);
    } else {
      showToast(data.message || 'El resultado aún no ha sido publicado en los portales oficiales.');
      appendLog(`[AVISO] ${data.message || 'Resultado no publicado aún'}`, 'log-warn');
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalText || '⏳ Por verificar 🔍';
      }
    }
  } catch (err) {
    showToast(`Error de conexión: ${err.message}`);
    appendLog(`[ERROR] Error al consultar resultado en vivo: ${err.message}`, 'log-danger');
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalText || '⏳ Reintentar 🔍';
    }
  }
}

// Bind de verificación manual dentro de cada tarjeta
function bindCardVerifyActions() {
  // Botones de enviar ganador o buscar en vivo
  document.querySelectorAll('.btn-submit-verify').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recId = btn.getAttribute('data-id');
      const inputEl = document.getElementById(`input-winner-${recId}`);
      const winnerNum = inputEl ? inputEl.value.trim() : '';

      // Si no se especificó un número manual, invocar la búsqueda y auto-verificación en vivo
      if (!winnerNum) {
        triggerSingleDrawLookup(recId, btn);
        return;
      }

      btn.disabled = true;
      btn.textContent = '...';
      try {
        const res = await fetch('/api/trophies/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: recId, winnerNumber: winnerNum })
        });
        const data = await res.json();
        if (data.ok) {
          if (data.bloqueoAcertado) {
            showToast('🏆 ¡GOLPE DE BANCA EVITADO! Número bloqueado premiado');
            appendLog(`[TROFEO CONFIRMADO] ${data.mensaje}`, 'log-success');
          } else {
            showToast('Sorteo verificado (no estaba bloqueado)');
            appendLog(`[VERIFICADO] Número ${winnerNum} verificado`, 'log-info');
          }
          await Promise.all([refreshStatusAndHistory(), loadTrophies()]);
        } else {
          showToast(`Error: ${data.message}`);
          btn.disabled = false;
          btn.textContent = '🔍 Buscar / Verificar';
        }
      } catch (err) {
        showToast(`Error: ${err.message}`);
        btn.disabled = false;
        btn.textContent = '🔍 Buscar / Verificar';
      }
    });
  });

  // Botón para editar ganador ya verificado
  document.querySelectorAll('.btn-edit-winner').forEach(btn => {
    btn.addEventListener('click', () => {
      const recId = btn.getAttribute('data-id');
      const rec = cachedTrophyRecords.find(r => r.id === recId);
      if (rec) {
        rec.ganador = null;
        renderTrophyCards(cachedTrophyRecords, currentTrophyFilter);
      }
    });
  });
}

// ==========================================
// MÓDULO TRIPLE 7 (NY7 VENTA ANIMALITOS)
// ==========================================

let cachedT7Draws = [];

function initTriple7Module() {
  const btnRefresh = document.getElementById('btn-refresh-triple7');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadTriple7Draws(true));
  }

  const btnBlockManual = document.getElementById('btn-t7-manual-block');
  if (btnBlockManual) {
    btnBlockManual.addEventListener('click', handleTriple7ManualBlock);
  }

  // Chips de sugerencia rápida
  document.querySelectorAll('.chip-suggest').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-val');
      const input = document.getElementById('t7-manual-numeros');
      if (input) {
        let current = input.value.split(',').map(s => s.trim()).filter(Boolean);
        if (!current.includes(val)) {
          current.push(val);
          input.value = current.join(', ');
        }
      }
    });
  });

  // Clic en métrica de Dashboard para ir a Triple 7
  const metricT7 = document.getElementById('metric-card-t7');
  if (metricT7) {
    metricT7.addEventListener('click', () => {
      const tabBtn = document.getElementById('btn-tab-triple7');
      if (tabBtn) tabBtn.click();
    });
  }

  // Sincronizar selectores de lotería y sorteo
  const lotSelect = document.getElementById('t7-manual-loteria');
  if (lotSelect) {
    lotSelect.addEventListener('change', updateTriple7SorteoOptions);
  }

  // Filtro dinámico de la tabla de loterías gestionadas
  const filterSelect = document.getElementById('t7-filter-loteria');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      applyTriple7FiltersAndRender();
    });
  }

  // Ordenamiento dinámico por hora de sorteo, bloqueados o lotería
  const sortSelect = document.getElementById('t7-sort-order');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      applyTriple7FiltersAndRender();
    });
  }
}

function timeStringToMinutes(timeStr) {
  if (!timeStr) return 9999;
  const match = timeStr.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return 9999;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function applyTriple7FiltersAndRender() {
  if (!cachedT7Draws) return;
  const filterSelect = document.getElementById('t7-filter-loteria');
  const sortSelect = document.getElementById('t7-sort-order');
  const selectedLot = filterSelect ? filterSelect.value : 'ALL';
  const sortOrder = sortSelect ? sortSelect.value : 'TIME_ASC';

  let list = selectedLot === 'ALL'
    ? [...cachedT7Draws]
    : cachedT7Draws.filter(d => d.loteria === selectedLot);

  list.sort((a, b) => {
    const timeA = timeStringToMinutes(a.sorteo);
    const timeB = timeStringToMinutes(b.sorteo);

    if (sortOrder === 'TIME_ASC') {
      return (timeA - timeB) || a.loteria.localeCompare(b.loteria);
    } else if (sortOrder === 'TIME_DESC') {
      return (timeB - timeA) || a.loteria.localeCompare(b.loteria);
    } else if (sortOrder === 'BLOCKED_FIRST') {
      const bA = a.bloqueado ? 1 : 0;
      const bB = b.bloqueado ? 1 : 0;
      if (bB !== bA) return bB - bA;
      return (timeA - timeB) || a.loteria.localeCompare(b.loteria);
    } else if (sortOrder === 'LOTTERY_NAME') {
      const cmp = a.loteria.localeCompare(b.loteria);
      return cmp !== 0 ? cmp : (timeA - timeB);
    }
    return 0;
  });

  renderTriple7Table(list);
}

function normalizarTextoLocal(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadTriple7Draws(isManual = false) {
  const tbody = document.getElementById('t7-draws-tbody');
  const metricTotal = document.getElementById('t7-metric-total-draws');
  const metricBlocked = document.getElementById('t7-metric-blocked-draws');
  const metricUpdated = document.getElementById('t7-metric-updated-at');
  const countBadge = document.getElementById('t7-table-count-badge');
  const btnRefresh = document.getElementById('btn-refresh-triple7');

  if (btnRefresh) btnRefresh.classList.add('loading');
  if (isManual && tbody) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Consultando plataforma https://ny7.undo.it/Venta_Animalitos/lista_sor_ag.php...</td></tr>';
  }

  // Asegurar que currentConfig esté cargado para saber cuáles loterías tienen bloqueos activos
  if (!currentConfig) {
    try {
      const cfgRes = await fetch('/api/config');
      currentConfig = await cfgRes.json();
    } catch (e) {}
  }

  try {
    const res = await fetch('/api/triple7/status');
    const data = await res.json();
    if (btnRefresh) btnRefresh.classList.remove('loading');

    if (data.ok && data.draws) {
      // Filtrar estrictamente por las loterías configuradas y activas a las que les aplicamos bloqueos
      const activeLotNames = (currentConfig && Array.isArray(currentConfig.loterias))
        ? currentConfig.loterias.filter(l => l.activo !== false).map(l => normalizarTextoLocal(l.nombre))
        : ['guacharo activo', 'lotto activo', 'la granjita'];

      const drawsGestionados = data.draws.filter(d => activeLotNames.includes(normalizarTextoLocal(d.loteria)));
      cachedT7Draws = drawsGestionados;

      const total = drawsGestionados.length;
      const blocked = drawsGestionados.filter(d => d.bloqueado).length;

      if (metricTotal) metricTotal.textContent = total;
      if (metricBlocked) metricBlocked.textContent = blocked;
      if (countBadge) countBadge.textContent = `${total} sorteos gestionados`;
      if (metricUpdated) metricUpdated.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-VE')}`;

      // Actualizar selector de filtro de la tabla
      updateTriple7FilterOptions();

      // Actualizar opciones de lotería y sorteos en selector manual
      updateTriple7LotteryOptions();

      // Renderizar tabla aplicando filtro y ordenamiento seleccionado
      applyTriple7FiltersAndRender();

      if (isManual) showToast(`Sorteos de Triple 7 actualizados (${total} gestionados)`);
    } else {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:var(--rose-400);">Error consultando Triple 7: ${data.message || 'Desconocido'}</td></tr>`;
      }
    }
  } catch (err) {
    if (btnRefresh) btnRefresh.classList.remove('loading');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:var(--rose-400);">Error de conexión: ${err.message}</td></tr>`;
    }
  }
}

function updateTriple7FilterOptions() {
  const filterSelect = document.getElementById('t7-filter-loteria');
  if (!filterSelect || !cachedT7Draws) return;

  const currentVal = filterSelect.value || 'ALL';
  const uniqueLots = [...new Set(cachedT7Draws.map(d => d.loteria))];

  let html = `<option value="ALL" ${currentVal === 'ALL' ? 'selected' : ''}>Todas las Gestionadas (${cachedT7Draws.length})</option>`;
  uniqueLots.forEach(lot => {
    const countLot = cachedT7Draws.filter(d => d.loteria === lot).length;
    html += `<option value="${lot}" ${currentVal === lot ? 'selected' : ''}>${lot} (${countLot})</option>`;
  });
  filterSelect.innerHTML = html;
}

function updateTriple7LotteryOptions() {
  const lotSelect = document.getElementById('t7-manual-loteria');
  if (!lotSelect || cachedT7Draws.length === 0) return;

  const uniqueLots = [...new Set(cachedT7Draws.map(d => d.loteria))];
  const currentVal = lotSelect.value;
  lotSelect.innerHTML = uniqueLots.map(lot => `<option value="${lot}" ${lot === currentVal ? 'selected' : ''}>${lot}</option>`).join('');
  updateTriple7SorteoOptions();
}

function updateTriple7SorteoOptions() {
  const lotSelect = document.getElementById('t7-manual-loteria');
  const sortSelect = document.getElementById('t7-manual-sorteo');
  if (!lotSelect || !sortSelect || cachedT7Draws.length === 0) return;

  const selectedLot = lotSelect.value;
  const sorteosForLot = cachedT7Draws.filter(d => d.loteria === selectedLot);
  sortSelect.innerHTML = sorteosForLot.map(d => `<option value="${d.sorteo}">${d.sorteo} ${d.bloqueado ? '🔴 (Con Bloqueos)' : ''}</option>`).join('');
}

function renderTriple7Table(draws) {
  const tbody = document.getElementById('t7-draws-tbody');
  if (!tbody) return;

  if (draws.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay sorteos de loterías gestionadas activos en este momento en Triple 7.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  draws.forEach((draw) => {
    const tr = document.createElement('tr');
    tr.style.background = draw.bloqueado ? 'rgba(239, 68, 68, 0.08)' : 'transparent';
    tr.innerHTML = `
      <td><b>${draw.loteria}</b></td>
      <td><span class="badge badge-purple" style="font-size:12px;">${draw.sorteo}</span></td>
      <td><code style="font-family:monospace; color:#38bdf8;">${draw.idsol || '--'}</code></td>
      <td>
        ${draw.bloqueado
          ? '<span class="status-pill status-blocked" style="background:rgba(239,68,68,0.2); border:1px solid #ef4444; color:#f87171; padding:3px 8px; border-radius:6px; font-weight:700; font-size:12px;">🔴 Animales Bloqueados</span>'
          : '<span class="status-pill status-idle" style="background:rgba(148,163,184,0.1); border:1px solid rgba(148,163,184,0.2); color:#94a3b8; padding:3px 8px; border-radius:6px; font-size:12px;">⚪ Sin Bloqueos</span>'
        }
      </td>
      <td style="display:flex; gap:8px; align-items:center;">
        <button class="btn btn-sm btn-primary btn-table-block" data-lot="${draw.loteria}" data-sort="${draw.sorteo}" style="padding:4px 10px; font-size:11px;">
          <span>⚡ Bloquear...</span>
        </button>
        ${draw.bloqueado
          ? `<button class="btn btn-sm btn-danger btn-table-unblock" data-lot="${draw.loteria}" data-sort="${draw.sorteo}" style="padding:4px 10px; font-size:11px;">
              <span>🔓 Reincorporar</span>
             </button>`
          : `<button class="btn btn-sm btn-secondary" disabled style="opacity:0.4; padding:4px 10px; font-size:11px;">
              <span>🔓 Reincorporar</span>
             </button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind acciones en filas de la tabla
  document.querySelectorAll('.btn-table-block').forEach(btn => {
    btn.addEventListener('click', () => {
      const lot = btn.getAttribute('data-lot');
      const sort = btn.getAttribute('data-sort');
      const lotSelect = document.getElementById('t7-manual-loteria');
      const sortSelect = document.getElementById('t7-manual-sorteo');
      if (lotSelect) {
        lotSelect.value = lot;
        updateTriple7SorteoOptions();
      }
      if (sortSelect) sortSelect.value = sort;
      const numInput = document.getElementById('t7-manual-numeros');
      if (numInput) {
        numInput.focus();
        numInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast(`Configurando bloqueo para ${lot} (${sort})`);
    });
  });

  document.querySelectorAll('.btn-table-unblock').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lot = btn.getAttribute('data-lot');
      const sort = btn.getAttribute('data-sort');
      if (!confirm(`¿Confirma que desea REINCORPORAR (desbloquear) todos los animalitos en ${lot} (${sort})?`)) return;

      btn.disabled = true;
      btn.textContent = '...';
      try {
        const res = await fetch('/api/triple7/reincorporar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loteria: lot, sorteo: sort })
        });
        const data = await res.json();
        if (data.ok) {
          showToast(`✅ ${data.message}`);
          appendLog(`[TRIPLE 7] ${data.message}`, 'log-success');
          await loadTriple7Draws();
        } else {
          showToast(`Error: ${data.message}`);
        }
      } catch (err) {
        showToast(`Error: ${err.message}`);
      }
    });
  });
}

async function handleTriple7ManualBlock() {
  const lotSelect = document.getElementById('t7-manual-loteria');
  const sortSelect = document.getElementById('t7-manual-sorteo');
  const numInput = document.getElementById('t7-manual-numeros');
  const btn = document.getElementById('btn-t7-manual-block');

  if (!lotSelect || !sortSelect || !numInput) return;

  const loteria = lotSelect.value;
  const sorteo = sortSelect.value;
  const rawNums = numInput.value;
  const numeros = rawNums.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

  if (numeros.length === 0) {
    showToast('Ingresa al menos un número a bloquear');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span><span>Bloqueando...</span>';

  try {
    const res = await fetch('/api/triple7/bloquear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loteria, sorteo, numeros })
    });
    const data = await res.json();
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⚡</span><span>Bloquear en Triple 7</span>';

    if (data.ok) {
      showToast(`✅ ${data.message}`);
      appendLog(`[TRIPLE 7] ${data.message}`, 'log-success');
      await loadTriple7Draws();
    } else {
      showToast(`Error: ${data.message}`);
      appendLog(`[TRIPLE 7 ERROR] ${data.message}`, 'log-danger');
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⚡</span><span>Bloquear en Triple 7</span>';
    showToast(`Error de conexión: ${err.message}`);
  }
}

// ==========================================
// GESTOR DE MEMORIA DE CUPO CERO PREMIER
// ==========================================
function initMemoryManager() {
  const banner = document.getElementById('memory-live-banner');
  const container = document.getElementById('memory-chips-container');
  const btnClear = document.getElementById('btn-clear-memory');

  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      if (!confirm('¿Deseas reiniciar la memoria de persistencia de Cupo Cero?')) return;
      try {
        const res = await fetch('/api/memory/clear', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          showToast('Memoria de cupo cero reseteada');
          loadMemoryStatus();
        }
      } catch (e) {}
    });
  }

  async function loadMemoryStatus() {
    try {
      const res = await fetch('/api/memory/status');
      const data = await res.json();
      if (!data.ok || !data.summary) return;

      const activos = data.summary.activos || [];
      if (!banner || !container) return;

      if (activos.length === 0) {
        banner.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      banner.style.display = 'flex';
      container.innerHTML = activos.map(item => `
        <span class="chip-memoria" style="padding:6px 12px; font-size:12px; display:inline-flex; align-items:center; gap:8px;" title="Lotería: ${item.loteriaNombre} • Sorteo Origen: ${item.sorteoOrigen}">
          <span>🧠 <b>${item.numero} ${item.nombre}</b></span>
          <span style="font-size:11px; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:10px;">
            ${item.sorteosRestantes} ${item.sorteosRestantes === 1 ? 'sorteo rest.' : 'sorteos rest.'}
          </span>
          <button class="btn-release-single" data-lot="${item.loteriaId}" data-num="${item.numero}" title="Liberar de memoria y reincorporar en Triple 7" style="background:none; border:none; color:#f472b6; cursor:pointer; font-size:13px; padding:0 2px;">✖</button>
        </span>
      `).join('');

      // Bind botones de liberación individual
      container.querySelectorAll('.btn-release-single').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const loteriaId = btn.getAttribute('data-lot');
          const numero = btn.getAttribute('data-num');
          try {
            const r = await fetch('/api/memory/release-animal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ loteriaId, numero, reincorporarTriple7: true })
            });
            const d = await r.json();
            if (d.ok) {
              showToast(`Animal ${numero} liberado de memoria`);
              loadMemoryStatus();
            }
          } catch (err) {}
        });
      });
    } catch (e) {}
  }

  loadMemoryStatus();
  setInterval(loadMemoryStatus, 8000);
}

