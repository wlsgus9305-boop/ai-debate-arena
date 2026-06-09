# CLI Setup

The app can run with any subset of supported providers.
Connect only the CLIs you want to use.

## Web Login Flow

1. Start the web app.

   ```powershell
   npm run web
   ```

2. Open `http://localhost:3000`.
3. In `CLI 연결`, click `로그인` for the provider you want.
4. Complete the provider login flow.
5. The provider card changes to `연결됨` when the local CLI can be verified.

## Codex CLI

Manual check:

```powershell
codex.cmd login status
```

Manual login:

```powershell
codex.cmd login
```

Windows PowerShell may block `codex.ps1`; use `codex.cmd` if that happens.

## Claude Code

Manual check:

```powershell
claude.cmd auth status
```

Manual login:

```powershell
claude.cmd auth login
```

Optional API-key based setups should be kept in `.env` or the user's shell environment.
Never commit real keys.

## Gemini CLI

The default adapter uses `npx`:

```powershell
npx.cmd --yes @google/gemini-cli --help
```

Run Gemini once and complete its login flow if prompted:

```powershell
npx.cmd --yes @google/gemini-cli --skip-trust
```

Alternative API-key based setup:

```powershell
GEMINI_API_KEY=...
```

## Smoke Tests

```powershell
node controller/main.mjs smoke --player gpt_1
scripts\test-claude.cmd
scripts\test-gemini.cmd
```

Generated logs stay local and are ignored by git.
