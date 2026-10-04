@echo off
title Banco de Pruebas Paso a Paso - Premier Pluss
cd /d "%~dp0"

:: Auto-elevacion a Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:MENU
cls
echo ======================================================================
echo    BANCO DE PRUEBAS PASO A PASO - PREMIER PLUSS 2.0
echo ======================================================================
echo.
echo   [1] PASO 1: Enfocar Taquilla y Descartar Error (Click 'Continuar')
echo   [2] PASO 2: Probar Seleccion y Marcado de Sorteo (F2 + Loteria + Casilla Q)
echo   [3] PASO 3: Probar Inyeccion Rapida de 3 Animales (00, 0, 1)
echo   [4] PASO 4: Limpieza de Pantalla con Tecla N (0 jugadas)
echo.
echo   --- PRUEBAS COMPLETAS INDIVIDUALES ---
echo   [5] Sondeo Completo: Guacharo Activo       (77 animales)
echo   [6] Sondeo Completo: Guacharito Millonario (101 animales)
echo   [7] Sondeo Completo: La Granjita           (38 animales)
echo   [8] Sondeo Completo: Lotto Activo          (38 animales)
echo   [9] Salir
echo.
echo ======================================================================
set /p opt="Selecciona una opcion (1-9): "

if "%opt%"=="1" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 1
    pause
    goto MENU
)
if "%opt%"=="2" (
    cls
    echo Selecciona la loteria a probar:
    echo   [1] Guacharo Activo
    echo   [2] Guacharito Millonario
    echo   [3] La Granjita
    echo   [4] Lotto Activo
    set /p lotOpt="Opcion (1-4) [Defecto 1]: "
    if "%lotOpt%"=="2" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "GUACHARITO MILLONARIO"
    ) else if "%lotOpt%"=="3" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "LA GRANJITA"
    ) else if "%lotOpt%"=="4" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "LOTTO ACTIVO"
    ) else (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "GUACHARO ACTIVO"
    )
    pause
    goto MENU
)
if "%opt%"=="3" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 3
    pause
    goto MENU
)
if "%opt%"=="4" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 4
    pause
    goto MENU
)
if "%opt%"=="5" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARO ACTIVO"
    pause
    goto MENU
)
if "%opt%"=="6" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARITO MILLONARIO"
    pause
    goto MENU
)
if "%opt%"=="7" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LA GRANJITA"
    pause
    goto MENU
)
if "%opt%"=="8" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LOTTO ACTIVO"
    pause
    goto MENU
)
if "%opt%"=="9" exit /b
goto MENU
