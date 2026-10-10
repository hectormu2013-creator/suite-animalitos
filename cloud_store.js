// cloud_store.js - Persistencia y Sincronización Maestra en la Nube (Supabase)
// Garantiza que la versión WEB sea la instancia principal y que los cambios nunca se reinicien.

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jloeyrjnxtucscfzolik.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsb2V5cmpueHR1Y3NjZnpvbGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTQ1NzIsImV4cCI6MjA4NDA3MDU3Mn0.0tw6xqmeEda0DF7-UiWI8YRoUeVQjd0FM4jQiG3VqsI';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates'
};

const TIMEOUT_MS = 6000;

/**
 * Helper con timeout para fetch nativo
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Obtener la configuración maestra desde Supabase (suite_config)
 */
async function getMasterConfig() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?key=eq.suite_config&select=data,updated_at`;
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        return {
          config: rows[0].data,
          updatedAt: rows[0].updated_at
        };
      }
    }
  } catch (e) {
    // Falla de red o offline - fallback silencioso
  }
  return null;
}

/**
 * Guardar la configuración maestra en Supabase (suite_config)
 */
async function saveMasterConfig(cfg) {
  if (!cfg) return false;
  try {
    const nowIso = new Date().toISOString();
    const payload = {
      key: 'suite_config',
      data: cfg,
      updated_at: nowIso
    };

    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?on_conflict=key`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload)
    });

    return res.ok || res.status === 201;
  } catch (e) {
    console.warn(`[CLOUD_STORE] Error guardando config en Supabase: ${e.message}`);
    return false;
  }
}

/**
 * Obtener el historial maestro desde Supabase (suite_history)
 */
async function getMasterHistory() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?key=eq.suite_history&select=data,updated_at`;
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0].data)) {
        return {
          records: rows[0].data,
          updatedAt: rows[0].updated_at
        };
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Guardar el historial maestro en Supabase (suite_history)
 */
async function saveMasterHistory(records) {
  if (!Array.isArray(records)) return false;
  try {
    let merged = [...records];
    try {
      const existing = await getMasterHistory();
      if (existing && Array.isArray(existing.records) && existing.records.length > 0) {
        const map = new Map();
        for (const r of existing.records) {
          if (r && r.id) map.set(r.id, r);
        }
        for (const r of records) {
          if (!r || !r.id) continue;
          if (!map.has(r.id)) {
            map.set(r.id, r);
          } else {
            const ex = map.get(r.id);
            if (r.ganador && r.ganador.verificado) {
              map.set(r.id, r);
            } else if (!ex.ganador || !ex.ganador.verificado) {
              map.set(r.id, r);
            }
          }
        }
        merged = Array.from(map.values()).sort((a, b) => (new Date(a.timestamp || 0).getTime()) - (new Date(b.timestamp || 0).getTime()));
      }
    } catch (eMerge) {}

    const nowIso = new Date().toISOString();
    const payload = {
      key: 'suite_history',
      data: merged,
      updated_at: nowIso
    };

    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?on_conflict=key`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload)
    });

    return res.ok || res.status === 201;
  } catch (e) {
    console.warn(`[CLOUD_STORE] Error guardando historial en Supabase: ${e.message}`);
    return false;
  }
}

/**
 * Obtener la memoria maestra de cupo cero desde Supabase (suite_memory)
 */
async function getMasterMemory() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?key=eq.suite_memory&select=data,updated_at`;
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        return {
          memory: rows[0].data,
          updatedAt: rows[0].updated_at
        };
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Guardar la memoria maestra de cupo cero en Supabase (suite_memory)
 */
async function saveMasterMemory(memoryObj) {
  if (!memoryObj) return false;
  try {
    const nowIso = new Date().toISOString();
    const payload = {
      key: 'suite_memory',
      data: memoryObj,
      updated_at: nowIso
    };

    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?on_conflict=key`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload)
    });

    return res.ok || res.status === 201;
  } catch (e) {
    console.warn(`[CLOUD_STORE] Error guardando memoria en Supabase: ${e.message}`);
    return false;
  }
}

/**
 * Guardar el estado en tiempo real de la automatización en Supabase (suite_automation_status)
 */
async function saveAutomationStatus(statusObj) {
  if (!statusObj) return false;
  try {
    const nowIso = new Date().toISOString();
    const payload = {
      key: 'suite_automation_status',
      data: {
        ...statusObj,
        syncedAt: nowIso
      },
      updated_at: nowIso
    };

    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?on_conflict=key`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload)
    });

    return res.ok || res.status === 201;
  } catch (e) {
    return false;
  }
}

/**
 * Obtener el estado en tiempo real de la automatización desde Supabase
 */
async function getAutomationStatus() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?key=eq.suite_automation_status&select=data,updated_at`;
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        return {
          status: rows[0].data,
          updatedAt: rows[0].updated_at
        };
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Enviar un comando remoto desde la Web (Render) a la PC Local (Windows)
 */
async function dispatchCommand(commandName, payload = {}, targetMachineId = null) {
  const id = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const commandObj = {
    id,
    command: commandName,
    payload,
    targetMachineId: targetMachineId || (payload && payload.targetMachineId) || null,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    result: null
  };

  try {
    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?on_conflict=key`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        key: 'suite_command_queue',
        data: commandObj,
        updated_at: new Date().toISOString()
      })
    });
    if (res.ok || res.status === 201) {
      return commandObj;
    }
    return commandObj;
  } catch (e) {
    console.warn(`[CLOUD_STORE] Error despachando comando en Supabase: ${e.message}`);
    return null;
  }
}

/**
 * Obtener el último comando de la cola en Supabase
 */
async function getLatestCommand() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?key=eq.suite_command_queue&select=data,updated_at`;
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        return rows[0].data;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Actualizar el estado y resultado de un comando en Supabase
 */
async function updateCommand(commandId, status, result = null) {
  try {
    const nowIso = new Date().toISOString();
    const commandObj = {
      id: commandId,
      status,
      result,
      updatedAt: nowIso
    };

    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store?on_conflict=key`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        key: 'suite_command_queue',
        data: commandObj,
        updated_at: nowIso
      })
    });
    return res.ok || res.status === 201;
  } catch (e) {
    console.warn(`[CLOUD_STORE] Error actualizando comando en Supabase: ${e.message}`);
    return false;
  }
}

/**
 * Esperar la finalización de un comando (polling en Supabase hasta timeoutMs)
 */
async function waitForCommandCompletion(commandId, timeoutMs = 38000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 1000));
    const cmd = await getLatestCommand();
    if (cmd && cmd.id === commandId) {
      if (cmd.status === 'COMPLETED' || cmd.status === 'FAILED' || cmd.status === 'EXPIRED') {
        return cmd;
      }
    }
  }
  return null;
}

module.exports = {
  getMasterConfig,
  saveMasterConfig,
  getMasterHistory,
  saveMasterHistory,
  getMasterMemory,
  saveMasterMemory,
  saveAutomationStatus,
  getAutomationStatus,
  dispatchCommand,
  getLatestCommand,
  updateCommand,
  waitForCommandCompletion
};
