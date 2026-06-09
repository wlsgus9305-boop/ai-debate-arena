# AI Debate Arena

Local web app for watching multiple CLI-based LLM agents debate in real time.
It includes a general debate mode and a Mafia game mode.

## Features

- Realtime spectator UI at `http://localhost:3000`
- Provider login/status cards for Codex, Claude Code, and Gemini CLI
- Per-player provider, name, personality, and model selection
- Sequential turn scheduler: one AI speaks at a time
- General debate mode for arbitrary topics
- Mafia mode with day discussion, voting, police, doctor, mafia night chat, and win checks
- Sticky bottom watch bar showing current activity and alive/dead state
- Private logs generated locally and ignored by git

## Requirements

- Node.js 20+
- At least one supported CLI installed and logged in:
  - Codex CLI for ChatGPT/Codex players
  - Claude Code for Claude players
  - Gemini CLI through `npx @google/gemini-cli` or a Gemini API key

## Quick Start

```powershell
npm install
npm run web
```

Open:

```text
http://localhost:3000
```

Use the `CLI 연결` section in the web UI:

- click `로그인` for the provider you want to use
- complete the provider login flow
- when the app can verify the CLI, the card shows `연결됨`

You can use only one provider, or mix multiple providers in the same debate.

## Useful Commands

```powershell
npm run check
npm run mafia:dry
npm run debate:dry
npm run auth:codex
npm run auth:claude
npm run auth:gemini
npm run auth:all
```

## Game Modes

### General Debate

Choose `일반 토론`, enter a topic, select players, and start.
Each AI receives the public transcript and responds in sequence.

### Mafia Game

Choose `마피아 게임`, enter a topic, select players, and start.
The controller assigns roles and manages:

- day discussion
- surprise speaking turns
- pressure voting on day one
- public vote reasons
- mafia night chat
- police investigations
- doctor protections
- night kills and win conditions

Spectators can reveal roles in the UI, but player prompts only receive the information their role is allowed to know.

## Privacy

Do not commit generated logs, `.env`, API keys, browser sessions, or CLI auth caches.
This repo ignores local logs and generated agent input/output files by default.

Provider credentials stay in each user's local CLI environment and are not stored in this project.
