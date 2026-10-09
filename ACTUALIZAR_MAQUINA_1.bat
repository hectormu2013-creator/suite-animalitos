@echo off
title Actualizador Dedicado - Suite Animalitos (Maquina 1)
cd /d "%~dp0"

echo ======================================================================
echo    ACTUALIZADOR EXCLUSIVO - MAQUINA 1 (RAMA MAQUINA_1)
echo ======================================================================
echo.
echo Comprobando y descargando mejoras calibradas para Maquina 1...

:: Si existe git, cambiar/descargar de la rama maquina_1
where git >nul 2>&1
if %errorLevel% equ 0 (
    if exist ".git" (
        git fetch origin maquina_1
        git checkout maquina_1
        git pull origin maquina_1
        goto FIN
    )
)

:: Si no hay git, descargar zip oficial de la rama maquina_1
echo Descargando paquete oficial de Maquina 1 via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://github.com/hectormu2013-creator/suite-animalitos/archive/refs/heads/maquina_1.zip'; $z=\"$env:TEMP\suite_upd_m1.zip\"; $t=\"$env:TEMP\suite_upd_dir_m1\"; Invoke-WebRequest -Uri $u -OutFile $z; Expand-Archive -Path $z -DestinationPath $t -Force; Get-ChildItem -Path (Join-Path $t 'suite-animalitos-maquina_1') | ForEach-Object { if ($_.Name -ne 'config.json') { Copy-Item -Path $_.FullName -Destination '.' -Recurse -Force } }; Remove-Item $z -Force; Remove-Item $t -Recurse -Force; Write-Host ' -> [OK] Archivos de Maquina 1 actualizados con exito.' -ForegroundColor Green"

:FIN
echo.
echo ======================================================================
echo   ¡Maquina 1 actualizada con su paquete oficial independiente!
echo ======================================================================
echo.
pause
exit /b
