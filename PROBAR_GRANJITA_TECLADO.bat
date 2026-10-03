@echo off
title Prueba Entrada Teclado - La Granjita - Premier Pluss
cd /d "%~dp0"

:: Auto-elevacion a Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_teclado_granjita.ps1"
echo.
pause
