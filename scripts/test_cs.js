const fs = require('fs');
const cp = require('child_process');

const lines = fs.readFileSync('scripts/sondeo_completo.ps1', 'utf8').split('\n');
const code = lines.slice(31, 293).join('\n');
fs.writeFileSync('temp_probe.cs', code);

try {
  const out = cp.execSync('powershell -Command Add-Type -Path temp_probe.cs', { encoding: 'utf8' });
  console.log('Compilation SUCCESS:', out);
} catch (e) {
  console.log('Compilation FAILED:');
  console.log('STDOUT:', e.stdout);
  console.log('STDERR:', e.stderr);
}

if (fs.existsSync('temp_probe.cs')) fs.unlinkSync('temp_probe.cs');
