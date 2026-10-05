@echo off
title Sondeo Premier Pluss + Bloqueo en Triple 7
cd /d "%~dp0"

:: Auto-elevacion a Administrador (requerido para interactuar con Premier Pluss 2.0)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:MENU
cls
echo ======================================================================
echo    CICLO INTEGRAL: SONDEO PREMIER + BLOQUEO REAL EN TRIPLE 7
echo ======================================================================
echo.
echo   Este proceso realiza el ciclo COMPLETO de seguridad:
echo     1. Sonda la taquilla de Premier Pluss (Automático por OCR o Híbrido).
echo     2. Detecta los animales en Rojo (Cupo 0 Agotados).
echo     3. Aplica la estrategia de riesgo (Fijos + Visual-FX + Memoria).
echo     4. Conecta directamente a TRIPLE 7 y APLICA EL BLOQUEO REAL.
echo.
echo   ======================================================================
echo   MODALIDAD DE SELECCION EN PREMIER PLUSS:
echo     [A] Modo 100%% AUTOMATICO (Recomendado)
echo         El bot localiza la loteria con OCR nativo, limpia sorteos previos,
echo         marca el proximo sorteo con 'Q', inyecta animales y bloquea en T7.
echo.
echo     [H] Modo HIBRIDO ASISTIDO
echo         El bot respeta la loteria y sorteo que tengas puesto
echo         en pantalla de Premier, inyecta animales y bloquea en T7.
echo   ======================================================================
echo.
set /p modoOpt="Selecciona modalidad (A o H) [Por defecto A]: "

if /i "%modoOpt%"=="" set modoOpt=A
if /i "%modoOpt%"=="H" (
    set MODO_ARG=--hibrido
    set MODO_TXT=HIBRIDO ASISTIDO (Pantalla Actual)
) else (
    set MODO_ARG=--auto
    set MODO_TXT=100%% AUTOMATICO (OCR + Teclado)
)

echo.
echo   ----------------------------------------------------------------------
echo   Loterias disponibles:
echo     [1] La Granjita           (38 animales)
echo     [2] Guacharo Activo       (77 animales)
echo     [3] Lotto Activo          (38 animales)
echo     [4] Guacharito Millonario (101 animales)
echo     [5] Selva Plus            (38 animales)
echo     [6] Salir
echo   ----------------------------------------------------------------------
set /p lotOpt="Selecciona loteria (1-6) [Por defecto 1]: "

if "%lotOpt%"=="" set lotOpt=1
if "%lotOpt%"=="6" exit /b

set LOT_ID=la_granjita
if "%lotOpt%"=="2" set LOT_ID=guacharo_activo
if "%lotOpt%"=="3" set LOT_ID=lotto_activo
if "%lotOpt%"=="4" set LOT_ID=guacharo_millonario
if "%lotOpt%"=="5" set LOT_ID=selva_plus

echo.
set /p horaSorteo="Hora del sorteo en Triple 7 (ej: 03:00 PM, 04:00 PM) [Enter = Proximo automatico]: "

echo.
echo ======================================================================
echo   EJECUTANDO: %LOT_ID% | MODO: %MODO_TXT%
echo ======================================================================
node scripts\ejecutar_hibrido_y_bloquear.js "%LOT_ID%" "%horaSorteo%" %MODO_ARG%
echo.
echo ======================================================================
echo Presiona cualquier tecla para volver al menu...
pause >nul
goto MENU
