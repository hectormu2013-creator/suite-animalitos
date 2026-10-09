@echo off
title Actualizador Dedicado - Suite Animalitos (Maquina 1)
cd /d "%~dp0"

echo ======================================================================
echo    ACTUALIZADOR EXCLUSIVO - MAQUINA 1 (RAMA MAQUINA_1)
echo ======================================================================
echo.

:: 1. Si existe git, forzar actualizacion limpia de la rama maquina_1
where git >nul 2>&1
if %errorLevel% equ 0 (
    if exist ".git" (
        echo [1/2] Sincronizando repositorio Git...
        git fetch origin maquina_1
        git checkout -f maquina_1
        git reset --hard origin/maquina_1
        if %errorLevel% equ 0 goto FIN
    )
)

:: 2. Si no hay git o fallo, usar script powershell robusto
echo [2/2] Descargando e instalando paquete oficial de Maquina 1...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $u='https://github.com/hectormu2013-creator/suite-animalitos/archive/refs/heads/maquina_1.zip'; $z=Join-Path $env:TEMP 'suite_upd_m1.zip'; $t=Join-Path $env:TEMP 'suite_upd_dir_m1'; if(Test-Path $t){Remove-Item $t -Recurse -Force}; Write-Host ' -> Descargando archivo ZIP...' -ForegroundColor Cyan; Invoke-WebRequest -Uri $u -OutFile $z; Write-Host ' -> Extrayendo archivos...' -ForegroundColor Cyan; Expand-Archive -Path $z -DestinationPath $t -Force; $src=Join-Path $t 'suite-animalitos-maquina_1'; Get-ChildItem -Path $src | ForEach-Object { if ($_.Name -ne 'config.json') { Copy-Item -Path $_.FullName -Destination '.' -Recurse -Force } }; Remove-Item $z -Force; Remove-Item $t -Recurse -Force; Write-Host ' -> [OK] Archivos de Maquina 1 actualizados con exito.' -ForegroundColor Green"

:FIN
echo.
echo ======================================================================
echo   ¡MAQUINA 1 ACTUALIZADA CON EXITO AL 100%!
echo ======================================================================
echo.
pause
exit /b
