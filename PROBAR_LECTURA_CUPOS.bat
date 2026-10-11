@echo off
title MODULO DE PRUEBA: LECTURA DE CUPOS EN TAQUILLA
cd /d "%~dp0"

:: Auto-elevacion a Administrador si no tiene privilegios elevados (UIPI)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ELEVACION] Solicitando permisos de Administrador para interactuar con Premier Pluss...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo           MODULO AISLADO DE PRUEBA: DETECCION DE CUPOS CERO
echo ======================================================================
echo 1. Asegurate de tener abierta la ventana de Premier Pluss.
echo 2. La taquilla debe tener en pantalla la tabla con jugadas/agotados.
echo 3. Este script NO toca nada del codigo de produccion ni envia tickets.
echo 4. Enfocara la taquilla, tomara la lectura y mostrara los resultados.
echo ======================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\probar_lectura_cupos.ps1"

echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
