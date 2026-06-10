@echo off
setlocal
title AI Debate Arena - Gemini Smoke Test
set "ROOT=%~dp0.."
cd /d "%ROOT%\agents\gemini_1"
set "NPX_CMD="
for /f "delims=" %%I in ('where npx.cmd 2^>nul') do if not defined NPX_CMD set "NPX_CMD=%%I"
if not defined NPX_CMD (
  set "NPX_CMD=npx"
)
call "%NPX_CMD%" --yes @google/gemini-cli -p "너는 테스트 플레이어야. 한국어로 한 문장만 말하고 마지막 줄에 <<<END>>>만 출력해." --approval-mode plan --output-format text --skip-trust
echo.
pause
