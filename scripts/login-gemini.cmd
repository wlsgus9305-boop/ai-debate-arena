@echo off
setlocal
title AI Debate Arena - Gemini CLI Login
set "ROOT=%~dp0.."
cd /d "%ROOT%"
set "NPX_CMD="
for /f "delims=" %%I in ('where npx.cmd 2^>nul') do if not defined NPX_CMD set "NPX_CMD=%%I"
if not defined NPX_CMD (
  set "NPX_CMD=npx"
)

echo.
echo [Gemini CLI First Setup]
echo Gemini is launched through npx for now.
echo If a login/auth menu appears, choose the login option and complete it in your browser.
echo.
echo Preparing Gemini auth settings for Google OAuth...
node -e "const fs=require('fs'),os=require('os'),path=require('path');const file=path.join(os.homedir(),'.gemini','settings.json');fs.mkdirSync(path.dirname(file),{recursive:true});let data={};try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}data.security??={};data.security.auth??={};data.security.auth.selectedType??='oauth-personal';fs.writeFileSync(file,JSON.stringify(data,null,2));console.log('settings.json auth method:',data.security.auth.selectedType);"
if errorlevel 1 (
  echo Failed to prepare Gemini settings.json. Check Node.js installation.
  echo.
  pause
  exit /b 1
)
echo.
echo After login, leave this window open until Gemini reaches its prompt, then close it.
echo.
call "%NPX_CMD%" --yes @google/gemini-cli --skip-trust
echo.
pause
