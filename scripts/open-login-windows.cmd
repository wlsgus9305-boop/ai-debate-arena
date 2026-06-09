@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"

start "AI Debate Arena - Codex Login" cmd /k "%ROOT%\scripts\login-codex.cmd"
start "AI Debate Arena - Claude Code Login" cmd /k "%ROOT%\scripts\login-claude.cmd"
start "AI Debate Arena - Gemini CLI Login" cmd /k "%ROOT%\scripts\login-gemini.cmd"

echo Opened Codex, Claude Code, and Gemini CLI login windows.
pause
