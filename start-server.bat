@echo off
cd /d "%~dp0"
title English platform server
start "" http://localhost:3000
npm start
pause