@echo off
title LinkedIn Login - Neural Hunter
echo =======================================================
echo   Iniciando sessao do LinkedIn no Google Chrome
echo   Apos fazeres login, fecha a janela do navegador.
echo =======================================================
cd /d "%~dp0backend"
node scripts/login_linkedin.js
pause
