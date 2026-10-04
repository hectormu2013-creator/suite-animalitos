@echo off
title Actualizador Automatico - Suite Animalitos
cd /d "%~dp0"

echo ======================================================================
echo    ACTUALIZADOR PROFESIONAL - SUITE ANIMALITOS
echo ======================================================================
echo.
echo Comprobando y descargando las ultimas mejoras oficiales desde GitHub...

:: Si existe git, usar git pull
where git >nul 2>&1
if %errorLevel% equ 0 (
    if exist ".git" (
        git pull origin main
        goto FIN
    )
)

:: Si no hay git, descargar zip oficial directamente
echo Descargando paquete mas reciente via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://github.com/hectormu2013-creator/suite-animalitos/archive/refs/heads/main.zip'; $z=\"$env:TEMP\suite_upd.zip\"; $t=\"$env:TEMP\suite_upd_dir\"; Invoke-WebRequest -Uri $u -OutFile $z; Expand-Archive -Path $z -DestinationPath $t -Force; Get-ChildItem -Path (Join-Path $t 'suite-animalitos-main') | ForEach-Object { if ($_.Name -ne 'config.json') { Copy-Item -Path $_.FullName -Destination '.' -Recurse -Force } }; Remove-Item $z -Force; Remove-Item $t -Recurse -Force; Write-Host ' -> [OK] Archivos actualizados con exito.' -ForegroundColor Green"

:FIN
echo.
echo ======================================================================
echo   ¡Suite actualizada correctamente a la ultima version!
echo ======================================================================
echo.
timeout /t 3
exit /b
