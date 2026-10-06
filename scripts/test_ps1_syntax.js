const cp = require('child_process');

try {
  const out = cp.execSync('powershell -ExecutionPolicy Bypass -Command "[PremierFullProbe]"', {
    cwd: __dirname + '/..',
    encoding: 'utf8'
  });
  console.log('Result:', out);
} catch (e) {
  // It won't have the type until script runs
}

['./scripts/sondeo_completo.ps1', './scripts/probar_paso_a_paso.ps1'].forEach(file => {
  try {
    const out = cp.execSync(`powershell -ExecutionPolicy Bypass -Command "$errs = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$errs); if ($errs) { $errs } else { 'NO SYNTAX ERRORS' }"`, {
      cwd: __dirname + '/..',
      encoding: 'utf8'
    });
    console.log(file, ':', out.trim().split('\n').pop());
  } catch (e) {
    console.log(file, 'ERROR:', e.message);
  }
});
