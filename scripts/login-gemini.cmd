@echo off
setlocal
title AI Debate Arena - Gemini CLI Login
set "ROOT=%~dp0.."
cd /d "%ROOT%"
where npx.cmd >nul 2>nul
if errorlevel 1 (
  set "NPX_CMD=npx"
) else (
  set "NPX_CMD=npx.cmd"
)

echo.
echo [Gemini CLI First Setup]
echo Gemini is launched through npx for now.
echo If a login/auth menu appears, choose the login option and complete it in your browser.
echo.
echo After login, leave this window open until Gemini reaches its prompt, then close it.
echo.
call "%NPX_CMD%" --yes @google/gemini-cli --skip-trust
echo.
pause
