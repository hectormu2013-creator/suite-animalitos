@echo off
chcp 65001 > nul
echo =================================================================
echo   SUITE ANIMALITOS - DESPLEGANDO A CONTABO VPS (EX-RENDER)
echo =================================================================
echo.

node scripts/deploy_contabo.js %*

echo.
pause
