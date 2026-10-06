const fs = require('fs');

const file = 'C:/Users/Hector/Fenix_2026_1/PROYECTO_VISUAL_FX/lottery_stats.js';
let content = fs.readFileSync(file, 'utf8');

const target1 = `function saveHistoryToDisk() {
  ensureDataDir();
  try {
    fs.writeFileSync(HISTORY_FILE`;

const repl1 = `function saveHistoryToDisk() {
  ensureDataDir();
  try {
    if (!historyStore || Object.keys(historyStore).length === 0) {
      console.warn('[LotteryStats] Intento de guardar historyStore vacio abortado para proteger historial.');
      return;
    }
    fs.writeFileSync(HISTORY_FILE`;

const target2 = `function recordDrawsToHistory(gameId, dateStr, draws) {
  if (!gameId || !dateStr || !draws) return;
  if (!historyStore[gameId])`;

const repl2 = `function recordDrawsToHistory(gameId, dateStr, draws) {
  if (!gameId || !dateStr || !draws) return;
  if (!historyStore || Object.keys(historyStore).length === 0) loadHistoryFromDisk();
  if (!historyStore[gameId])`;

if (content.includes(target1) && content.includes(target2)) {
  content = content.replace(target1, repl1).replace(target2, repl2);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated FX lottery_stats.js with safeguards');
} else {
  console.log('Targets not found or already updated');
}
