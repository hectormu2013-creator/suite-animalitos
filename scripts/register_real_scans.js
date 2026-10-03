const fs = require('fs');
const path = require('path');
const historyMgr = require('../history_manager');

console.log('=== REGISTRANDO BLOQUEOS REALES EN HISTORIAL Y MURO DE TROFEOS ===');

// 1. LOTTO ACTIVO 06:00 PM
historyMgr.recordScan({
  loteria: 'LOTTO ACTIVO',
  sorteo: '06:00 PM',
  montoSondeo: 3000,
  totalAnimalesAnalizados: 38,
  rojos: ['09', '21', '12', '33'],
  rojosPremier: [],
  numFijos: [],
  fijosSeleccionados: [],
  predictivosVisualFx: [
    { numero: '09', nombre: 'ÁGUILA', sorteosAtraso: 204 },
    { numero: '21', nombre: 'GALLO', sorteosAtraso: 128 }
  ],
  aleatoriosSistema: [
    { numero: '12', nombre: 'Caballo' },
    { numero: '33', nombre: 'Pescado' }
  ],
  t7Status: 'Bloqueados (4) en Triple 7 [idsol: 178374]',
  t7Blocked: true
});

// 2. LOTTO ACTIVO 07:00 PM
historyMgr.recordScan({
  loteria: 'LOTTO ACTIVO',
  sorteo: '07:00 PM',
  montoSondeo: 3000,
  totalAnimalesAnalizados: 38,
  rojos: ['09', '21', '12', '33'],
  rojosPremier: [],
  numFijos: [],
  fijosSeleccionados: [],
  predictivosVisualFx: [
    { numero: '09', nombre: 'ÁGUILA', sorteosAtraso: 204 },
    { numero: '21', nombre: 'GALLO', sorteosAtraso: 128 }
  ],
  aleatoriosSistema: [
    { numero: '12', nombre: 'Caballo' },
    { numero: '33', nombre: 'Pescado' }
  ],
  t7Status: 'Bloqueados (4) en Triple 7 [idsol: 178375]',
  t7Blocked: true
});

// 3. LA GRANJITA 07:00 PM
historyMgr.recordScan({
  loteria: 'LA GRANJITA',
  sorteo: '07:00 PM',
  montoSondeo: 3000,
  totalAnimalesAnalizados: 38,
  rojos: ['11', '14', '33', '35'],
  rojosPremier: [],
  numFijos: [],
  fijosSeleccionados: [],
  predictivosVisualFx: [
    { numero: '11', nombre: 'GATO', sorteosAtraso: 183 },
    { numero: '14', nombre: 'Paloma', sorteosAtraso: 109 }
  ],
  aleatoriosSistema: [
    { numero: '33', nombre: 'Pescado' },
    { numero: '35', nombre: 'Jirafa' }
  ],
  t7Status: 'Bloqueados (4) en Triple 7 [idsol: 178387]',
  t7Blocked: true
});

// 4. GUACHARO ACTIVO 07:00 PM
historyMgr.recordScan({
  loteria: 'GUACHARO ACTIVO',
  sorteo: '07:00 PM',
  montoSondeo: 3000,
  totalAnimalesAnalizados: 77,
  rojos: ['04', '12', '28', '41', '43', '16', '24'],
  rojosPremier: [],
  numFijos: ['04', '12', '28'],
  fijosSeleccionados: [
    { numero: '04', nombre: 'Alacran' },
    { numero: '12', nombre: 'Caballo' },
    { numero: '28', nombre: 'Zamuro' }
  ],
  predictivosVisualFx: [
    { numero: '41', nombre: 'Canguro', sorteosAtraso: 432 },
    { numero: '43', nombre: 'Mariposa', sorteosAtraso: 432 }
  ],
  aleatoriosSistema: [
    { numero: '16', nombre: 'Oso' },
    { numero: '24', nombre: 'Iguana' }
  ],
  t7Status: 'Bloqueados (7) en Triple 7 [idsol: 178434]',
  t7Blocked: true
});

console.log('4 registros de auditoría creados exitosamente.');
