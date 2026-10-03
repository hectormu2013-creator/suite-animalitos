const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'lista_sor_ag_full.html'), 'utf8');
const calls = html.match(/detalle_ticket\s*\([^)]*\)/gi) || [];

console.log('Total calls/definitions of detalle_ticket:', calls.length);
calls.forEach(c => console.log('Match:', c));
