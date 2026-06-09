import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = path.join(ROOT_DIR, "web");
const CONFIG_PATH = path.join(ROOT_DIR, "config.json");
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

loadEnvFile();

const clients = new Set();
const session = {
  running: false,
  id: null,
  startedAt: null,
  endedAt: null,
  topic: "",
  players: [],
  mode: "mafia",
  events: [],
  child: null
};

function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function emit(type, data) {
  const event = {
    type,
    at: new Date().toISOString(),
    ...data
  };

  session.events.push(event);
  if (session.events.length > 500) {
    session.events.splice(0, session.events.length - 500);
  }

  const payload = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
  }
  return body ? JSON.parse(body) : {};
}

async function loadConfig() {
  return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
}

function recommendRoles(playerCount) {
  if (playerCount <= 4) return { mafia: 1, police: 1, doctor: 0 };
  if (playerCount <= 6) return { mafia: 1, police: 1, doctor: 1 };
  if (playerCount <= 8) return { mafia: 2, police: 1, doctor: 1 };
  if (playerCount <= 11) return { mafia: 3, police: 1, doctor: 1 };
  return { mafia: Math.max(3, Math.floor(playerCount / 3)), police: 1, doctor: 2 };
}

function quoteForCmd(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./\\:+=,@-]+$/.test(text)) return text;
  return `"${text.replace(/(["^&|<>%])/g, "^$1")}"`;
}

function windowsSpawnSpec(command, args) {
  const commandLine = [command, ...args].map(quoteForCmd).join(" ");
  return { command: "cmd.exe", args: ["/d", "/s", "/c", commandLine] };
}

function runStatusCommand(command, args, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const spawnSpec = process.platform === "win32"
      ? windowsSpawnSpec(command, args)
      : { command, args };
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: ROOT_DIR,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ code: 124, stdout, stderr: `${stderr}\nTimeout`.trim() });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || "";
}

function authSummary(output, fallback) {
  const text = String(output || "").trim();
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      return data.loggedIn ? "CLI 인증 확인됨" : fallback;
    } catch {
      return fallback;
    }
  }
  return firstLine(text) || fallback;
}

async function checkProviderStatus(id, provider) {
  if (id === "codex") {
    const result = await runStatusCommand(provider.command, ["login", "status"], 10000);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    return {
      status: result.code === 0 && !/not logged|not authenticated|error/i.test(output) ? "ok" : "error",
      message: result.code === 0 ? "CLI 인증 확인됨" : firstLine(output) || `exit ${result.code}`
    };
  }

  if (id === "claude") {
    const result = await runStatusCommand(provider.command, ["auth", "status"], 10000);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    return {
      status: result.code === 0 && !/not logged|not authenticated|no active/i.test(output) ? "ok" : "error",
      message: authSummary(output, `exit ${result.code}`)
    };
  }

  if (id === "gemini") {
    const settingsPath = path.join(process.env.USERPROFILE || process.env.HOME || "", ".gemini", "settings.json");
    if (process.env.GEMINI_API_KEY) {
      return { status: "ok", message: "API 키 확인됨" };
    }
    if (existsSync(settingsPath)) {
      return { status: "ok", message: "CLI 설정 확인됨" };
    }
    return { status: "warning", message: "Gemini 로그인 확인 필요" };
  }

  return { status: "unknown", message: provider.note || "상태 확인 미지원" };
}

async function providerStatusPayload() {
  const config = await loadConfig();
  const entries = await Promise.all(Object.entries(config.providers).map(async ([id, provider]) => {
    return [id, await checkProviderStatus(id, provider)];
  }));
  return { providers: Object.fromEntries(entries) };
}

function loginScriptForProvider(id) {
  return {
    codex: path.join(ROOT_DIR, "scripts", "login-codex.cmd"),
    claude: path.join(ROOT_DIR, "scripts", "login-claude.cmd"),
    gemini: path.join(ROOT_DIR, "scripts", "login-gemini.cmd")
  }[id];
}

function openLoginWindow(id) {
  const scriptPath = loginScriptForProvider(id);
  if (!scriptPath || !existsSync(scriptPath)) {
    throw new Error(`${id} 연결 스크립트를 찾을 수 없습니다.`);
  }

  if (process.platform === "win32") {
    const commandLine = `start "AI Debate Arena - ${id} 연결" cmd /k "${scriptPath}"`;
    spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: ROOT_DIR,
      windowsHide: false,
      detached: true,
      stdio: "ignore"
    }).unref();
    return;
  }

  spawn(scriptPath, {
    cwd: ROOT_DIR,
    detached: true,
    stdio: "ignore"
  }).unref();
}

async function statePayload() {
  const config = await loadConfig();
  return {
    session: {
      running: session.running,
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      topic: session.topic,
      players: session.players,
      mode: session.mode
    },
    defaults: {
      game: config.game,
      recommendedRoles: recommendRoles(config.players.filter((player) => player.enabled).length)
    },
    players: config.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      provider: player.provider,
      enabled: player.enabled,
      workdir: player.workdir,
      model: player.model || "",
      color: player.color || "#aeb7c0",
      personality: player.personality || "",
      note: config.providers[player.provider]?.note || ""
    })),
    providers: Object.fromEntries(Object.entries(config.providers).map(([id, provider]) => [
      id,
      {
        command: provider.command,
        color: provider.color,
        note: provider.note || "",
        modelPresets: provider.model?.presets || [""]
      }
    ])),
    events: session.events
  };
}

async function startRunner(mode, body) {
  if (session.running) {
    throw new Error("A session is already running.");
  }

  const config = await loadConfig();
  const selectedPlayers = Array.isArray(body.players) && body.players.length > 0
    ? body.players
    : config.players.filter((player) => player.enabled);
  const sessionBody = {
    ...body,
    players: selectedPlayers
  };

  session.running = true;
  session.id = `${Date.now()}`;
  session.startedAt = new Date().toISOString();
  session.endedAt = null;
  session.topic = body.topic || "AI 마피아 아레나";
  session.players = selectedPlayers.map((player) => player.id || player);
  session.mode = mode;
  session.events = [];

  const sessionFile = path.join(ROOT_DIR, "logs", "sessions", `${session.id}-${mode}.json`);
  await mkdir(path.dirname(sessionFile), { recursive: true });
  await writeFile(sessionFile, JSON.stringify(sessionBody, null, 2), "utf8");

  const runnerArgs = [
    path.join(ROOT_DIR, "controller", "main.mjs"),
    mode,
    "--events-json",
    "--session-file",
    sessionFile
  ];

  if (body.dryRun) {
    runnerArgs.push("--dry-run");
  }

  emit("reset", { message: "새 게임 메모리 초기화" });
  emit("status", {
    message: "새 게임 시작",
    session: {
      id: session.id,
      mode,
      topic: session.topic,
      players: session.players
    }
  });

  const child = spawn(process.execPath, runnerArgs, {
    cwd: ROOT_DIR,
    windowsHide: true,
    env: process.env
  });
  session.child = child;

  let stdoutBuffer = "";
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString("utf8");
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || "";
    for (const line of lines) {
      handleChildLine(line);
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8").trim();
    if (text) {
      emit("runner-error", { message: text });
    }
  });

  child.on("close", (code) => {
    if (stdoutBuffer.trim()) {
      handleChildLine(stdoutBuffer.trim());
    }
    session.running = false;
    session.endedAt = new Date().toISOString();
    session.child = null;
    emit("done", { code });
  });
}

function handleChildLine(line) {
  const text = line.trim();
  if (!text) return;

  try {
    const event = JSON.parse(text);
    emit(event.type || "log", event);
  } catch {
    emit("log", { message: text });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const target = path.normalize(path.join(WEB_DIR, requested));

  if (!target.startsWith(WEB_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
  } catch {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(target);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";

  res.writeHead(200, { "content-type": contentType });
  createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/state") {
      sendJson(res, 200, await statePayload());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/recommend-roles") {
      const players = Number.parseInt(url.searchParams.get("players") || "6", 10);
      sendJson(res, 200, recommendRoles(players));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/provider-status") {
      sendJson(res, 200, await providerStatusPayload());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/provider-connect") {
      const body = await readBody(req);
      const id = String(body.provider || "");
      openLoginWindow(id);
      sendJson(res, 202, { ok: true, provider: id, message: `${id} 연결 창을 열었습니다.` });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/debate") {
      await startRunner("debate", await readBody(req));
      sendJson(res, 202, await statePayload());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/mafia") {
      await startRunner("mafia", await readBody(req));
      sendJson(res, 202, await statePayload());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/stop") {
      if (session.child) {
        session.child.kill("SIGTERM");
      }
      sendJson(res, 202, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      });
      clients.add(res);
      res.write(`event: hello\ndata: ${JSON.stringify(await statePayload())}\n\n`);
      req.on("close", () => {
        clients.delete(res);
      });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

await mkdir(WEB_DIR, { recursive: true });
server.listen(PORT, () => {
  console.log(`AI Debate Arena web: http://localhost:${PORT}`);
});
