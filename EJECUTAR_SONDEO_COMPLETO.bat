@echo off
title Sondeo de Agotados - Premier Pluss
cd /d "%~dp0"

:: Auto-elevacion a Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:MENU
cls
echo ========================================================
echo    SUITE DE SONDEO Y DETECCION DE AGOTADOS - PREMIER
echo ========================================================
echo.
echo   [B] CICLO COMPLETO: Sondeo Premier + Bloqueo en Triple 7 (Auto u Hibrido)
echo   [T] Probar Conexion y Ver Sorteos Activos en Triple 7 (Prueba Web Directa)
echo   [0] MODO HIBRIDO: Sondear seleccion actual en pantalla (Solo Premier)
echo.
echo   --- SONDEO AUTOMATICO POR LOTERIA (SOLO PREMIER) ---
echo   [1] La Granjita           (38 animales)
echo   [2] Guacharo Activo       (77 animales)
echo   [3] Lotto Activo          (38 animales)
echo   [4] Guacharito Millonario (101 animales)
echo   [5] Selva Plus            (38 animales)
echo   [6] Sondeo en Cadena      (Loterias consecutivas)
echo   [9] Salir
echo.
echo   --------------------------------------------------------
echo   ESCUDO Y CONTROLES OPERATIVOS ACTIVOS:
echo    * Moneda: Se fija SIEMPRE en BS automaticamente.
echo    * [ESC] o [F8]: DETENCION INMEDIATA de emergencia.
echo    * [F7]: PAUSAR o CONTINUAR el sondeo en cualquier momento.
echo    * Escudo de Foco: Si sales de Premier, el bot se pausa
echo      para no escribir en el chat ni en otras ventanas.
echo   --------------------------------------------------------
echo.
set /p opt="Selecciona una opcion (B, T, 0-6, 9) [Por defecto: B]: "

if "%opt%"=="" set opt=B
if /i "%opt%"=="B" goto HIBRIDO_BLOQUEO
if /i "%opt%"=="T" (
    cls
    node "%~dp0scripts\test_conexion_triple7.js"
    pause
    goto MENU
)
if "%opt%"=="0" goto HIBRIDO
if "%opt%"=="1" goto GRANJITA
if "%opt%"=="2" goto GUACHARO
if "%opt%"=="3" goto LOTTO
if "%opt%"=="4" goto GUACHARITO_MILLONARIO
if "%opt%"=="5" goto SELVA_PLUS
if "%opt%"=="6" goto TODAS
if "%opt%"=="9" exit /b
goto MENU

:HIBRIDO_BLOQUEO
call "%~dp0EJECUTAR_HIBRIDO_CON_BLOQUEO.bat"
goto MENU

:HIBRIDO
cls
echo.
echo ========================================================
echo   MODO HIBRIDO: SONDEO DE SELECCION ACTUAL
echo ========================================================
echo   1. Asegurate de tener seleccionada la loteria y marcada
echo      la casilla del sorteo en Premier Pluss.
echo.
echo   Elige la loteria a procesar:
echo     [1] La Granjita
echo     [2] Guacharo Activo
echo     [3] Lotto Activo
echo     [4] Guacharito Millonario
echo     [5] Selva Plus
echo     [6] Auto-detectar de la pantalla
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
goto POST_CHECK

:GRANJITA
echo.
echo Iniciando sondeo de La Granjita (38 animales en BS)...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LA GRANJITA"
goto POST_CHECK

:GUACHARO
echo.
echo Iniciando sondeo de Guacharo Activo (77 animales en BS)...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARO ACTIVO"
goto POST_CHECK

:LOTTO
echo.
echo Iniciando sondeo de Lotto Activo (38 animales en BS)...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LOTTO ACTIVO"
goto POST_CHECK

:GUACHARITO_MILLONARIO
echo.
echo Iniciando sondeo de Guacharito Millonario (101 animales en BS)...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARITO MILLONARIO"
goto POST_CHECK

:SELVA_PLUS
echo.
echo Iniciando sondeo de Selva Plus (38 animales en BS)...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "SELVA PLUS"
goto POST_CHECK

:TODAS
echo.
echo [1/4] Sondeando La Granjita...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LA GRANJITA"
timeout /t 3 >nul
echo.
echo [2/4] Sondeando Guacharo Activo...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARO ACTIVO"
timeout /t 3 >nul
echo.
echo [3/4] Sondeando Lotto Activo...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LOTTO ACTIVO"
timeout /t 3 >nul
echo.
echo [4/4] Sondeando Guacharito Millonario...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARITO MILLONARIO"
goto POST_CHECK

:POST_CHECK
if %errorlevel% equ 99 (
    echo.
    echo ========================================================
    echo   [AVISO] Proceso detenido de emergencia por el usuario.
    echo ========================================================
) else if %errorlevel% neq 0 (
    echo.
    echo ========================================================
    echo   [AVISO] El proceso finalizo con codigo: %errorlevel%
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo   Sondeo finalizado con exito.
    echo ========================================================
)
echo.
pause
goto MENU
