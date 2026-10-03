$p = Get-Process -Name "PremierPlussPC20" -ErrorAction SilentlyContinue
if ($p) {
    Write-Output "PID: $($p.Id)"
    Write-Output "MainWindowHandle: $($p.MainWindowHandle)"
    Write-Output "MainWindowTitle: $($p.MainWindowTitle)"
} else {
    Write-Output "PremierPlussPC20 no esta corriendo"
}
