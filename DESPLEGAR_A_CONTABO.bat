@echo off
chcp 65001 > nul
echo =================================================================
echo   SUITE ANIMALITOS - SINCRONIZAR Y DESPLEGAR A CONTABO VPS
echo =================================================================
echo.

node scripts/deploy_contabo.js %*

echo.
pause
