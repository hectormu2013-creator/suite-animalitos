@echo off
title "Ajustes de Modo Taquilla (Sin Bloqueo ni Suspension)"
cd /d "%~dp0"

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

powershell -ExecutionPolicy Bypass -File "%~dp0apply_kiosk_power_tweaks.ps1"
echo.
pause
