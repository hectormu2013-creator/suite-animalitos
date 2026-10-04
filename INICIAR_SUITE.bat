@echo off
title "Suite Pronosticador & Gestion de Riesgo"
cd /d "%~dp0"

:: Auto-elevacion a Administrador (necesario para interactuar con Premier Pluss 2.0)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ======================================================================
    echo Solicitando permisos de Administrador para interactuar con la taquilla...
    echo ======================================================================
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo    SUITE PRONOSTICADOR Y CONTROL DE RIESGO (ANIMALITOS)
echo ======================================================================
echo Modo Administrador: ACTIVO

:: Si el puerto 4500 esta ocupado por un proceso previo, cerrarlo para garantizar arranque limpio en Administrador
netstat -ano | findstr ":4500 " | findstr "LISTENING" >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] Liberando puerto 4500 para arranque con permisos de Administrador...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4500 " ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

echo Iniciando servidor local en puerto 4500...
start "" "http://localhost:4500"
node server.js
pause
