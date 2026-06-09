# Design Notes

This file condenses the pasted planning notes into the implementation shape used by this repo.

## Goal

Create a spectator simulation where multiple AI players debate, lie, accuse, defend, vote, and eventually play a Mafia-style game. The user watches the public conversation and game state rather than directly controlling a player.

## Initial Players

- GPT A and GPT B through Codex CLI
- Claude A and Claude B later
- Gemini A and Gemini B later

The first implementation focuses on GPT/Codex so the controller loop can be tested with one provider before adding more adapters.

## Controller Principles

- The controller owns the full game state.
- AI players never read the complete state file directly.
- Each AI receives only the public transcript plus its own private role/action information.
- The controller invokes exactly one AI process at a time.
- A turn is complete only when the response contains `<<<END>>>` or the process fails/times out.
- Public logs and private logs are separated.

## Build Order

1. Project structure, config loading, and GPT CLI smoke test
2. Sequential debate mode for all enabled players
3. Role assignment and day voting
4. Night actions for Mafia, Police, and Doctor
5. Spectator UI and replay
