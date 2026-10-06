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

    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store`;
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
    const nowIso = new Date().toISOString();
    const payload = {
      key: 'suite_history',
      data: records,
      updated_at: nowIso
    };

    const url = `${SUPABASE_URL}/rest/v1/visual_fx_store`;
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

module.exports = {
  getMasterConfig,
  saveMasterConfig,
  getMasterHistory,
  saveMasterHistory
};
