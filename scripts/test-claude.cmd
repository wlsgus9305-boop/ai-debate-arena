@echo off
setlocal
title AI Debate Arena - Claude Smoke Test
set "ROOT=%~dp0.."
cd /d "%ROOT%\agents\claude_1"
where claude.cmd >nul 2>nul
if errorlevel 1 (
  set "CLAUDE_CMD=%APPDATA%\npm\claude.cmd"
) else (
  set "CLAUDE_CMD=claude.cmd"
)
echo 너는 테스트 플레이어야. 한국어로 한 문장만 말하고 마지막 줄에 ^<^<^<END^>^>^>만 출력해. | "%CLAUDE_CMD%" -p --permission-mode dontAsk --tools "" --output-format text --no-session-persistence
echo.
pause
