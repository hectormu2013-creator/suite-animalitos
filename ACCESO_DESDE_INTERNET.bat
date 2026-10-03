@echo off
title ACCESO DESDE INTERNET Y CELULAR - SUITE TAQUILLA
color 0b
cls
echo ==============================================================================
echo                SUITE AUTOMATIZADA - ACCESO REMOTO SEGURO
echo ==============================================================================
echo.
echo Conectando con el tunel seguro...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = Split-Path -Parent $MyInvocation.MyCommand.Path; " ^
  "$urlFile = Join-Path $dir 'tunnel_url.txt'; " ^
  "if (Test-Path $urlFile) { " ^
  "    $url = (Get-Content $urlFile -Raw).Trim(); " ^
  "    Write-Host '========================================================' -ForegroundColor Green; " ^
  "    Write-Host '  TU ENLACE PARA ABRIR DESDE TU CELULAR O LAPTOP ES:    ' -ForegroundColor Green; " ^
  "    Write-Host \"  $url\" -ForegroundColor White; " ^
  "    Write-Host '========================================================' -ForegroundColor Green; " ^
  "    Add-Type -AssemblyName System.Windows.Forms; " ^
  "    [System.Windows.Forms.Clipboard]::SetText($url); " ^
  "    Write-Host '=> [OK] El enlace ha sido copiado a tu portapapeles.' -ForegroundColor Cyan; " ^
  "    Write-Host '   Pegalo en WhatsApp o envialo a tu telefono para entrar.' -ForegroundColor Gray; " ^
  "    Start-Process $url; " ^
  "} else { " ^
  "    Write-Host 'Aun no se genera el enlace o el servidor se esta iniciando.' -ForegroundColor Yellow; " ^
  "    Write-Host 'Abre la suite en http://localhost:4500 para verificar el estado.' -ForegroundColor Gray; " ^
  "}"

echo.
echo Presiona cualquier tecla para salir...
pause >nul
