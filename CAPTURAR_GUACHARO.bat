@echo off
title Capturador Guacharo Activo - Premier Pluss 2.0
cd /d "%~dp0"

:: Auto-elevacion a Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo    SELECCIONANDO GUACHARO ACTIVO Y CAPTURANDO PANTALLA
echo ======================================================================
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\capturar_guacharo.ps1"
echo.
pause
