@echo off
cd /d "%~dp0backend"
start "" node scripts/login_linkedin.js
