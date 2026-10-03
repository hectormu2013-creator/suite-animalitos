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
echo   [1] Guacharo Activo  (77 animales)
echo   [2] Lotto Activo     (38 animales)
echo   [3] La Granjita      (38 animales)
echo   [4] Sondeo en Cadena (Las 3 loterias consecutivas)
echo   [5] Salir
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
set /p opt="Selecciona una opcion (1-5) [Por defecto: 1]: "

if "%opt%"=="" set opt=1
if "%opt%"=="1" goto GUACHARO
if "%opt%"=="2" goto LOTTO
if "%opt%"=="3" goto GRANJITA
if "%opt%"=="4" goto TODAS
if "%opt%"=="5" exit /b
goto MENU

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

:GRANJITA
echo.
echo Iniciando sondeo de La Granjita (38 animales en BS)...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LA GRANJITA"
goto POST_CHECK

:TODAS
echo.
echo [1/3] Sondeando Guacharo Activo...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "GUACHARO ACTIVO"
if %errorlevel% neq 0 goto POST_CHECK
timeout /t 3 >nul
echo.
echo [2/3] Sondeando Lotto Activo...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LOTTO ACTIVO"
if %errorlevel% neq 0 goto POST_CHECK
timeout /t 3 >nul
echo.
echo [3/3] Sondeando La Granjita...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\sondeo_completo.ps1" -Loteria "LA GRANJITA"
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
