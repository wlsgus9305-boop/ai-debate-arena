@echo off
setlocal
title AI Debate Arena - Claude Code Login
set "ROOT=%~dp0.."
cd /d "%ROOT%"
where claude.cmd >nul 2>nul
if errorlevel 1 (
  set "CLAUDE_CMD=%APPDATA%\npm\claude.cmd"
) else (
  set "CLAUDE_CMD=claude.cmd"
)

echo.
echo [Claude Code Login]
echo Current status:
call "%CLAUDE_CMD%" auth status
echo.
echo Starting Claude Code login. Complete the browser login flow when it opens.
call "%CLAUDE_CMD%" auth login
echo.
echo New status:
call "%CLAUDE_CMD%" auth status
echo.
pause
