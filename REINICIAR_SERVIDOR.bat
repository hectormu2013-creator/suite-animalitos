@echo off
title Reiniciar Suite Animalitos
cd /d "%~dp0"
echo ======================================================================
echo           REINICIANDO SERVIDOR LOCAL SUITE ANIMALITOS
echo ======================================================================
echo Cerrando instancias anteriores de node.exe...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul
echo Iniciando Suite con codigo actualizado y permisos de Administrador...
powershell -Command "Start-Process '%~dp0INICIAR_SUITE.bat' -Verb RunAs"
echo ======================================================================
echo Listo. Puedes cerrar esta ventana.
timeout /t 3
exit
