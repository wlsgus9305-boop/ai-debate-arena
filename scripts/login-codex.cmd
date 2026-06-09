@echo off
setlocal
title AI Debate Arena - Codex Login
set "ROOT=%~dp0.."
cd /d "%ROOT%"
where codex.cmd >nul 2>nul
if errorlevel 1 (
  set "CODEX_CMD=%APPDATA%\npm\codex.cmd"
) else (
  set "CODEX_CMD=codex.cmd"
)

echo.
echo [Codex / ChatGPT Login]
echo Current status:
call "%CODEX_CMD%" login status
echo.
echo Starting Codex login. Complete the browser login flow if it opens.
call "%CODEX_CMD%" login
echo.
echo New status:
call "%CODEX_CMD%" login status
echo.
pause
