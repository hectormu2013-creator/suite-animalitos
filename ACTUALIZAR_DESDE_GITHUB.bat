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
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $u='https://github.com/hectormu2013-creator/suite-animalitos/archive/refs/heads/main.zip'; $z=\"$env:TEMP\suite_upd.zip\"; $t=\"$env:TEMP\suite_upd_dir\"; if(Test-Path $t){Remove-Item $t -Recurse -Force}; Invoke-WebRequest -Uri $u -OutFile $z; Expand-Archive -Path $z -DestinationPath $t -Force; $src=Join-Path $t 'suite-animalitos-main'; Get-ChildItem -Path $src | ForEach-Object { if ($_.Name -ne 'config.json') { Copy-Item -Path $_.FullName -Destination '.' -Recurse -Force } }; if(Test-Path config.json){ try { $loc=Get-Content config.json -Raw | ConvertFrom-Json; $newCfg=Get-Content (Join-Path $src 'config.json') -Raw | ConvertFrom-Json; if(-not $loc.general.triple7 -or -not $loc.general.triple7.user -or -not $loc.general.triple7.enabled){ $loc.general.triple7=$newCfg.general.triple7; $loc | ConvertTo-Json -Depth 10 | Set-Content config.json -Encoding UTF8; Write-Host ' -> [OK] Credenciales Triple 7 habilitadas en este equipo.' -ForegroundColor Cyan } } catch {} }; Remove-Item $z -Force; Remove-Item $t -Recurse -Force; Write-Host ' -> [OK] Archivos actualizados con exito.' -ForegroundColor Green"

:FIN
echo.
echo ======================================================================
echo   ¡Suite actualizada correctamente a la ultima version!
echo ======================================================================
echo.
timeout /t 3
exit /b
