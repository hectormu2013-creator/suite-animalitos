@echo off
chcp 65001 > nul
echo =================================================================
echo   SUITE ANIMALITOS - SINCRONIZAR Y DESPLEGAR A ONRENDER
echo =================================================================
echo.

node scripts/deploy_render.js %*

echo.
pause
