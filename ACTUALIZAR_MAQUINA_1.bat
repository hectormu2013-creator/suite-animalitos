@echo off
title Actualizador Dedicado - Suite Animalitos (Maquina 1)
cd /d "%~dp0"

echo ======================================================================
echo    ACTUALIZADOR OFICIAL - SUITE ANIMALITOS (MAQUINA 1)
echo ======================================================================
echo.

:: 1. Si existe git, actualizar rama
where git >nul 2>&1
if %errorLevel% equ 0 (
    if exist ".git" (
        echo [1/2] Sincronizando repositorio Git...
        git fetch origin
        git checkout -f main 2>nul || git checkout -f maquina_1 2>nul
        git pull origin main 2>nul || git reset --hard origin/main 2>nul
        if %errorLevel% equ 0 goto FIN
    )
)

:: 2. Descarga directa oficial via PowerShell (main.zip con soporte de Tecla I)
echo [2/2] Descargando e instalando paquete oficial mas reciente...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $u='https://github.com/hectormu2013-creator/suite-animalitos/archive/refs/heads/main.zip'; $z=Join-Path $env:TEMP 'suite_upd_m1.zip'; $t=Join-Path $env:TEMP 'suite_upd_dir_m1'; if(Test-Path $t){Remove-Item $t -Recurse -Force}; Write-Host ' -> Descargando archivo ZIP oficial (main)...' -ForegroundColor Cyan; Invoke-WebRequest -Uri $u -OutFile $z; Write-Host ' -> Extrayendo archivos...' -ForegroundColor Cyan; Expand-Archive -Path $z -DestinationPath $t -Force; $src=Join-Path $t 'suite-animalitos-main'; Get-ChildItem -Path $src | ForEach-Object { if ($_.Name -ne 'config.json') { Copy-Item -Path $_.FullName -Destination '.' -Recurse -Force } }; Remove-Item $z -Force; Remove-Item $t -Recurse -Force; Write-Host ' -> [OK] Archivos actualizados con exito.' -ForegroundColor Green"

:FIN
echo.
echo ======================================================================
echo   ¡MAQUINA 1 ACTUALIZADA CON EXITO AL 100%!
echo ======================================================================
echo.
timeout /t 5
exit /b
