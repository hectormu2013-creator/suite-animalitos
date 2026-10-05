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
echo    BANCO DE PRUEBAS PASO A PASO - PREMIER PLUSS 2.0 (OCR NATIVO)
echo ======================================================================
echo.
echo   --- PRUEBAS DE SELECCION Y MARCADOR DE SORTEO (OCR) ---
echo   [1] Probar Seleccion de Loteria y Casilla de Sorteo (Paso 2 OCR)
echo.
echo   --- SONDEO COMPLETO POR LOTERIA (INYECCION + ROJOS + LIMPIEZA) ---
echo   [2] Sondear La Granjita           (38 animales)
echo   [3] Sondear Guacharo Activo       (77 animales)
echo   [4] Sondear Lotto Activo          (38 animales)
echo   [5] Sondear Guacharito Millonario (101 animales)
echo   [6] Sondear Selva Plus            (38 animales)
echo.
echo   --- INTEGRACION TRIPLE 7 ---
echo   [B] CICLO COMPLETO: Sondeo Premier + Bloqueo en Triple 7 (Auto u Hibrido)
echo   [T] Probar Conexion y Ver Sorteos Activos en Triple 7 (Prueba Web Directa)
echo   [0] MODO HIBRIDO: Sondear seleccion actual en pantalla (Solo Premier)
echo.
echo   --- PASOS INDIVIDUALES DE DIAGNOSTICO ---
echo   [P1] Enfocar Taquilla y Descartar Error
echo   [P3] Probar Inyeccion Rapida de 3 Animales de Prueba (00, 0, 1)
echo   [P4] Limpieza de Pantalla con Tecla N (0 jugadas)
echo   [P5] Probar Clic en Boton [Imprimir] (Validacion Cupos en Pantalla)
echo.
echo   [9] Salir
echo.
echo ======================================================================
set /p opt="Selecciona una opcion (1-6, B, T, 0, P1, P3, P4, P5, 9): "

if /i "%opt%"=="B" (
    call "%~dp0EJECUTAR_HIBRIDO_CON_BLOQUEO.bat"
    goto MENU
)

if /i "%opt%"=="T" (
    cls
    node "%~dp0scripts\test_conexion_triple7.js"
    pause
    goto MENU
)

if "%opt%"=="0" (
    cls
    echo ======================================================================
    echo   MODO HIBRIDO: SONDEO DE SELECCION ACTUAL EN PANTALLA
    echo ======================================================================
    echo.
    echo   Instrucciones:
    echo     1. En Premier Pluss, selecciona la loteria y marca el sorteo deseado.
    echo     2. Selecciona la loteria correspondiente para iniciar la inyeccion.
    echo.
    echo   [1] La Granjita
    echo   [2] Guacharo Activo
    echo   [3] Lotto Activo
    echo   [4] Guacharito Millonario
    echo   [5] Selva Plus
    echo   [6] Auto-detectar desde pantalla
    echo.
    set /p hibOpt="Opcion (1-6) [Defecto 6]: "
    if "%hibOpt%"=="1" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -ModoHibrido -Loteria "LA GRANJITA"
    ) else if "%hibOpt%"=="2" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -ModoHibrido -Loteria "GUACHARO ACTIVO"
    ) else if "%hibOpt%"=="3" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -ModoHibrido -Loteria "LOTTO ACTIVO"
    ) else if "%hibOpt%"=="4" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -ModoHibrido -Loteria "GUACHARITO MILLONARIO"
    ) else if "%hibOpt%"=="5" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -ModoHibrido -Loteria "SELVA PLUS"
    ) else (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -ModoHibrido -Loteria "AUTO"
    )
    pause
    goto MENU
)

if "%opt%"=="1" (
    cls
    echo ======================================================================
    echo   PROBAR SELECCION DE LOTERIA Y MARCADOR DE SORTEO (OCR)
    echo ======================================================================
    echo.
    echo   Selecciona la loteria a probar:
    echo     [1] La Granjita
    echo     [2] Guacharo Activo
    echo     [3] Lotto Activo
    echo     [4] Guacharito Millonario
    echo     [5] Selva Plus
    echo.
    set /p lotOpt="Opcion (1-5) [Defecto 1]: "
    if "%lotOpt%"=="2" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "GUACHARO ACTIVO"
    ) else if "%lotOpt%"=="3" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "LOTTO ACTIVO"
    ) else if "%lotOpt%"=="4" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "GUACHARITO MILLONARIO"
    ) else if "%lotOpt%"=="5" (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "SELVA PLUS"
    ) else (
        powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 2 -Loteria "LA GRANJITA"
    )
    pause
    goto MENU
)

if "%opt%"=="2" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LA GRANJITA"
    pause
    goto MENU
)
if "%opt%"=="3" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARO ACTIVO"
    pause
    goto MENU
)
if "%opt%"=="4" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LOTTO ACTIVO"
    pause
    goto MENU
)
if "%opt%"=="5" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARITO MILLONARIO"
    pause
    goto MENU
)
if "%opt%"=="6" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "SELVA PLUS"
    pause
    goto MENU
)

if /i "%opt%"=="P1" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 1
    pause
    goto MENU
)
if /i "%opt%"=="P3" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 3
    pause
    goto MENU
)
if /i "%opt%"=="P4" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 4
    pause
    goto MENU
)
if /i "%opt%"=="P5" (
    powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\probar_paso_a_paso.ps1" -Paso 5
    pause
    goto MENU
)

if "%opt%"=="9" exit /b
goto MENU
