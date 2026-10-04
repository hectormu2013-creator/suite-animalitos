@echo off
title Instalador de Nodo de Pesca - Suite Animalitos
cd /d "%~dp0"

:: Auto-elevacion a Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador para instalar el nodo...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo    INSTALADOR PROFESIONAL DE NODO DE PESCA - SUITE ANIMALITOS
echo ======================================================================
echo Descargando e instalando componentes autonomos...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://suite-animalitos.onrender.com/api/installer/bootstrap.ps1 | iex"

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] No se pudo descargar el instalador remoto. Intentando respaldo local...
    if exist "%~dp0scripts\bootstrap_node_installer.ps1" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap_node_installer.ps1"
    )
)

pause
