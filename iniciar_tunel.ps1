# Inicia el túnel de Cloudflare hacia la Suite (http://localhost:4500)
$ErrorActionPreference = 'SilentlyContinue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

Write-Host "Iniciando tunel seguro de Cloudflare..." -ForegroundColor Cyan

# Eliminar log previo
if (Test-Path "$dir\tunnel_url.txt") { Remove-Item "$dir\tunnel_url.txt" -Force }

$proc = Start-Process -FilePath "$dir\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:4500" -RedirectStandardError "$dir\tunnel.log" -PassThru -WindowStyle Hidden

Write-Host "Conectando con la red global de Cloudflare..." -ForegroundColor Yellow
$foundUrl = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path "$dir\tunnel.log") {
        $lines = Get-Content "$dir\tunnel.log" -Tail 30
        foreach ($line in $lines) {
            if ($line -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
                $foundUrl = $matches[0]
                break
            }
        }
    }
    if ($foundUrl) { break }
}

if ($foundUrl) {
    Set-Content -Path "$dir\tunnel_url.txt" -Value $foundUrl
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  TU ENLACE PARA ACCEDER DESDE INTERNET O TU CELULAR ES:   " -ForegroundColor Green
    Write-Host "  $foundUrl" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Guarda este enlace en tu telefono para entrar desde cualquier lugar." -ForegroundColor Cyan
    Write-Host "La computadora de la tienda debe permanecer encendida." -ForegroundColor Gray
} else {
    Write-Host "No se pudo obtener la URL del tunel. Revisa tunnel.log" -ForegroundColor Red
}
