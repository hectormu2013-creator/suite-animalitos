@echo off
title Actualizador Automatico - Suite Animalitos
cd /d "%~dp0"

echo ======================================================================
echo    ACTUALIZADOR PROFESIONAL - SUITE ANIMALITOS
echo ======================================================================
echo.
echo Comprobando y descargando las ultimas mejoras oficiales desde GitHub...

:: Si existe git, forzar sincronizacion exacta con origin/main
where git >nul 2>&1
if %errorLevel% equ 0 (
    if exist ".git" (
        git fetch origin main
        git reset --hard origin/main
        goto FIN
    )
)

:: Si no hay git, descargar zip oficial directamente
echo Descargando paquete mas reciente via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://github.com/hectormu2013-creator/suite-animalitos/archive/refs/heads/main.zip'; $z=\"$env:TEMP\suite_upd.zip\"; $t=\"$env:TEMP\suite_upd_dir\"; Invoke-WebRequest -Uri $u -OutFile $z; Expand-Archive -Path $z -DestinationPath $t -Force; Get-ChildItem -Path (Join-Path $t 'suite-animalitos-main') | ForEach-Object { if ($_.Name -ne 'config.json') { Copy-Item -Path $_.FullName -Destination '.' -Recurse -Force } }; Remove-Item $z -Force; Remove-Item $t -Recurse -Force; Write-Host ' -> [OK] Archivos actualizados con exito.' -ForegroundColor Green"

:FIN
echo.
echo Ajustando identidad automatica del equipo local y tarea programada...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c='config.json'; $isHector = $PWD.Path.ToLower().Contains('users\hector\.gemini'); if (Test-Path $c) { $j=Get-Content $c -Raw | ConvertFrom-Json; if ($j.general) { $j.general.maquinaLocalId = if ($isHector) { 'maquina_1' } else { 'maquina_2' }; $j | ConvertTo-Json -Depth 10 | Set-Content $c -Encoding UTF8 } }; if ($isHector) { & '.\update_task_time.ps1' -Hora '07:00' -Activo 'false' | Out-Null } else { & '.\update_task_time.ps1' -Hora '07:00' -Activo 'true' | Out-Null }"
echo Limpiando procesos residuales y cerrando ventanas de tunel previas...
taskkill /F /IM cloudflared.exe >nul 2>&1
echo ======================================================================
echo   ¡Suite actualizada correctamente a la ultima version!
echo ======================================================================
echo.
timeout /t 3
exit /b
