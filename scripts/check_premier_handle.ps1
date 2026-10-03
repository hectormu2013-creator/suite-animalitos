$scriptPath = Join-Path $PSScriptRoot "sondeo_completo.ps1"
Write-Output "Testing PremierPluss detection..."
$procs = Get-Process PremierPlussPC20 -ErrorAction SilentlyContinue
Write-Output "Premier processes found: $($procs.Count)"
foreach ($p in $procs) {
    Write-Output "PID: $($p.Id), Name: $($p.ProcessName), MainWindowTitle: '$($p.MainWindowTitle)', MainWindowHandle: $($p.MainWindowHandle)"
}
