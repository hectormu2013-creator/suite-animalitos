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

:: Verificar si el servidor ya esta corriendo en el puerto 4500
netstat -ano | findstr ":4500 " | findstr "LISTENING" >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] El servidor de la suite ya se encuentra activo en el puerto 4500.
    start "" "http://localhost:4500"
    exit /b
)

echo Iniciando servidor local en puerto 4500...
start "" "http://localhost:4500"
node server.js
pause
