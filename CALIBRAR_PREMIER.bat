@echo off
title Calibrador Premier Pluss 2.0
cd /d "%~dp0"

:: Auto-elevacion a Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador para calibrar la ventana...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo    CALIBRADOR DE VENTANA Y CONTROLES - PREMIER PLUSS 2.0
echo ======================================================================
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\calibrador_premier.ps1"
echo.
pause
