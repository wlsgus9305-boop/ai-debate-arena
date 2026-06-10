import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = path.join(ROOT_DIR, "web");
const CONFIG_PATH = path.join(ROOT_DIR, "config.json");
const LOCAL_CONFIG_PATH = path.join(ROOT_DIR, "config.local.json");
const SESSION_DIR = path.join(ROOT_DIR, "logs", "sessions");
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const USER_HOME = process.env.USERPROFILE || process.env.HOME || "";
const GEMINI_SETTINGS_PATH = path.join(USER_HOME, ".gemini", "settings.json");
const GEMINI_ACCOUNTS_PATH = path.join(USER_HOME, ".gemini", "google_accounts.json");
const GEMINI_OAUTH_CREDS_PATH = path.join(USER_HOME, ".gemini", "oauth_creds.json");

loadEnvFile();

const clients = new Set();
let archiveWriteQueue = Promise.resolve();
const session = {
  running: false,
  id: null,
  startedAt: null,
  endedAt: null,
  topic: "",
  players: [],
  mode: "debate",
  events: [],
  child: null,
  sessionFile: null,
  request: null
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
  if (session.events.length > 3000) {
    session.events.splice(0, session.events.length - 3000);
  }

  const payload = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
  scheduleArchiveSnapshot();
  return event;
}

function scheduleArchiveSnapshot(code = null) {
  if (!session.id || !session.sessionFile) return;
  archiveWriteQueue = archiveWriteQueue
    .then(() => archiveCurrentSession(code))
    .catch((error) => {
      console.error(`Failed to snapshot session ${session.id}:`, error);
    });
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
  }
  return body ? JSON.parse(body) : {};
}

async function loadConfig() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  if (!existsSync(LOCAL_CONFIG_PATH)) return config;
  const localConfig = JSON.parse(await readFile(LOCAL_CONFIG_PATH, "utf8"));
  return mergeConfig(config, localConfig);
}

function mergeConfig(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  if (!base || typeof base !== "object" || !override || typeof override !== "object") {
    return override === undefined ? base : override;
  }
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = mergeConfig(base[key], value);
  }
  return merged;
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
      killProcessTree(child);
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

function readJsonFileIfExists(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function extractEmail(value) {
  return String(value || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] || "";
}

function accountLabel(provider, detected = "") {
  return detected || provider.account || "";
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
    const connected = result.code === 0 && !/not logged|not authenticated|error/i.test(output);
    const account = accountLabel(provider, extractEmail(output));
    return {
      status: connected ? "ok" : "error",
      account,
      accountSource: extractEmail(output) ? "detected" : account ? "configured" : "",
      authMethod: "ChatGPT/Codex CLI",
      message: connected ? "CLI 인증 확인됨" : firstLine(output) || `exit ${result.code}`
    };
  }

  if (id === "claude") {
    const result = await runStatusCommand(provider.command, ["auth", "status"], 10000);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    const parsed = output.startsWith("{") ? readJsonText(output) : null;
    const connected = result.code === 0 && !/not logged|not authenticated|no active/i.test(output);
    const account = accountLabel(provider, parsed?.email || extractEmail(output));
    return {
      status: connected ? "ok" : "error",
      account,
      accountSource: parsed?.email || extractEmail(output) ? "detected" : account ? "configured" : "",
      authMethod: parsed?.authMethod || "Claude Code",
      message: authSummary(output, `exit ${result.code}`)
    };
  }

  if (id === "gemini") {
    const account = accountLabel(provider);
    const settings = readJsonFileIfExists(GEMINI_SETTINGS_PATH);
    const selectedType = settings?.security?.auth?.selectedType;
    if (!settings || !selectedType) {
      return {
        status: "error",
        account,
        accountSource: account ? "configured" : "",
        authMethod: "",
        message: "Gemini 인증 방식 없음"
      };
    }

    const accounts = readJsonFileIfExists(GEMINI_ACCOUNTS_PATH);
    const detectedAccount = accounts?.active || "";
    if (selectedType === "oauth-personal" && detectedAccount && existsSync(GEMINI_OAUTH_CREDS_PATH)) {
      return {
        status: "ok",
        account: accountLabel(provider, detectedAccount),
        accountSource: "detected",
        authMethod: selectedType,
        message: "Gemini CLI OAuth 인증 확인됨"
      };
    }

    const result = await runStatusCommand(provider.command, ["--yes", "@google/gemini-cli", "--list-sessions", "--skip-trust"], 20000);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    const connected = result.code === 0 && !/Please set an Auth method|Manual authorization|required|not authenticated|error/i.test(output);
    const detectedEmail = extractEmail(output);
    return {
      status: connected ? "ok" : "error",
      account: accountLabel(provider, detectedEmail),
      accountSource: detectedEmail ? "detected" : account ? "configured" : "",
      authMethod: selectedType,
      message: connected ? "Gemini CLI 인증 확인됨" : result.code === 124 ? "Gemini OAuth 로그인 미완료" : firstLine(output) || `exit ${result.code}`
    };
  }

  return {
    status: "unknown",
    account: provider.account || "",
    accountSource: provider.account ? "configured" : "",
    authMethod: "",
    message: provider.note || "상태 확인 미지원"
  };
}

function readJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function providerStatusPayload() {
  const config = await loadConfig();
  const entries = await Promise.all(Object.entries(config.providers).map(async ([id, provider]) => {
    return [id, await checkProviderStatus(id, provider)];
  }));
  return { providers: Object.fromEntries(entries) };
}

function integrationCatalog(config) {
  const runnable = Object.entries(config.providers).map(([id, provider]) => ({
    id,
    label: provider.label || id,
    account: provider.account || "",
    color: provider.color || "#aeb7c0",
    note: provider.note || "",
    setup: provider.setup || "",
    available: true
  }));

  const planned = Array.isArray(config.integrations) ? config.integrations.map((item) => ({
    id: item.id,
    label: item.label || item.id,
    account: item.account || "",
    color: item.color || "#59636f",
    note: item.note || "",
    setup: item.setup || "",
    available: false,
    status: item.status || "planned"
  })) : [];

  return [...runnable, ...planned];
}

function shuffledNamePool(config) {
  const pool = Array.isArray(config.game?.namePool) ? config.game.namePool.filter(Boolean) : [];
  return [...new Set(pool)].sort(() => Math.random() - 0.5);
}

function playersWithRandomNames(config) {
  const names = shuffledNamePool(config);
  return config.players.map((player, index) => ({
    ...player,
    displayName: names[index % names.length] || player.displayName
  }));
}

async function connectedProviderIds(config) {
  const entries = await Promise.all(Object.entries(config.providers).map(async ([id, provider]) => {
    try {
      return [id, await checkProviderStatus(id, provider)];
    } catch (error) {
      return [id, { status: "error", message: error.message }];
    }
  }));
  const connected = entries.filter(([, status]) => status.status === "ok").map(([id]) => id);
  return connected.length > 0 ? connected : Object.keys(config.providers);
}

async function defaultStatePlayers(config) {
  const providerIds = await connectedProviderIds(config);
  const candidates = playersWithRandomNames(config).filter((player) => player.enabled !== false);
  const selected = [];

  for (const providerId of providerIds) {
    const player = candidates.find((entry) => entry.provider === providerId && !selected.some((picked) => picked.id === entry.id));
    if (player) selected.push({ ...player, enabled: true });
  }

  return selected.length > 0 ? selected : candidates.slice(0, Math.max(1, providerIds.length));
}

function normalizeStatePlayers(config, players) {
  return players.map((player, index) => {
    if (typeof player !== "string") return player;
    return config.players.find((entry) => entry.id === player) || {
      id: player,
      displayName: player,
      provider: "codex",
      enabled: true,
      workdir: `agents/${player}`,
      model: "",
      color: "#aeb7c0",
      personality: ""
    };
  });
}

function normalizeModerator(config, incoming = {}) {
  const base = config.moderator || {};
  return {
    ...base,
    ...incoming,
    id: "moderator",
    displayName: incoming.displayName || base.displayName || "회의 진행자",
    provider: incoming.provider || base.provider || "codex",
    enabled: incoming.enabled ?? base.enabled ?? true,
    workdir: incoming.workdir || base.workdir || "agents/moderator",
    model: incoming.model || base.model || "",
    color: incoming.color || base.color || "#e4b84a",
    personality: incoming.personality || base.personality || "토론을 정리하고 다음 질문을 좁히는 진행자."
  };
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
    const command = process.env.ComSpec || "cmd.exe";
    spawn(command, ["/d", "/k", "call", scriptPath], {
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
  const activePlayers = Array.isArray(session.request?.players) ? session.request.players : [];
  const players = session.running && activePlayers.length > 0
    ? normalizeStatePlayers(config, activePlayers)
    : await defaultStatePlayers(config);
  const moderator = normalizeModerator(config, session.request?.moderator || config.moderator || {});
  return {
    session: {
      running: session.running,
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      topic: session.topic,
      players: session.players,
      mode: session.mode,
      moderator
    },
    defaults: {
      game: config.game,
      namePool: config.game?.namePool || [],
      recommendedRoles: recommendRoles(players.filter((player) => player.enabled).length)
    },
    players: players.map((player) => ({
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
    moderator: {
      id: moderator.id,
      displayName: moderator.displayName,
      provider: moderator.provider,
      enabled: moderator.enabled,
      workdir: moderator.workdir,
      model: moderator.model || "",
      color: moderator.color || "#e4b84a",
      personality: moderator.personality || "",
      note: config.providers[moderator.provider]?.note || ""
    },
    providers: Object.fromEntries(Object.entries(config.providers).map(([id, provider]) => [
      id,
      {
        label: provider.label || id,
        command: provider.command,
        color: provider.color,
        account: provider.account || "",
        note: provider.note || "",
        setup: provider.setup || "",
        modelPresets: provider.model?.presets || [""]
      }
    ])),
    integrations: integrationCatalog(config),
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
  const moderator = normalizeModerator(config, body.moderator || config.moderator || {});
  const sessionBody = {
    ...body,
    players: selectedPlayers,
    moderator
  };

  if (!body.dryRun) {
    await validateConnectedProviders(config, [...selectedPlayers, ...(moderator.enabled ? [moderator] : [])]);
  }

  session.running = true;
  session.id = `${Date.now()}`;
  session.startedAt = new Date().toISOString();
  session.endedAt = null;
  session.topic = body.topic || (mode === "mafia" ? "AI 마피아 게임" : "AI 토론 아레나");
  session.players = selectedPlayers.map((player) => player.id || player);
  session.mode = mode;
  session.events = [];
  session.request = sessionBody;

  const sessionFile = path.join(SESSION_DIR, `${session.id}-${mode}.json`);
  session.sessionFile = sessionFile;
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

  emit("reset", { message: "새 세션 메모리 초기화" });
  emit("status", {
    message: "새 세션 시작",
    session: {
      id: session.id,
      mode,
      topic: session.topic,
      players: session.players,
      moderator
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
    scheduleArchiveSnapshot(code);
  });
}

async function archiveCurrentSession(code = null) {
  if (!session.id || !session.sessionFile) return;
  const outcome = [...session.events].reverse().find((event) => event.type === "game-over") || null;
  const lastEventAt = session.events.at(-1)?.at || session.endedAt || session.startedAt || new Date().toISOString();
  const archive = {
    id: session.id,
    mode: session.mode,
    topic: session.topic,
    startedAt: session.startedAt,
    endedAt: session.endedAt || null,
    lastEventAt,
    running: session.running,
    players: session.players,
    code,
    winner: outcome?.winner || "",
    message: outcome?.message || "",
    eventCount: session.events.length,
    request: session.request || {},
    events: session.events
  };
  await mkdir(SESSION_DIR, { recursive: true });
  await writeFile(session.sessionFile, JSON.stringify(archive, null, 2), "utf8");
}

async function appendEventToArchive(sessionId, event) {
  const archive = await readSessionArchive(sessionId);
  if (!archive?.file || !Array.isArray(archive.events)) return;
  archive.events.push(event);
  archive.eventCount = archive.events.length;
  await writeFile(path.join(SESSION_DIR, archive.file), JSON.stringify(archive, null, 2), "utf8");
}

function killProcessTree(child) {
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore"
    });
    return;
  }
  child.kill("SIGTERM");
}

async function validateConnectedProviders(config, selectedPlayers) {
  const providerIds = [...new Set(selectedPlayers.map((player) => {
    const id = typeof player === "string" ? player : player.id;
    const provider = typeof player === "string"
      ? config.players.find((entry) => entry.id === id)?.provider
      : player.provider;
    return provider || "";
  }).filter(Boolean))];

  const checks = await Promise.all(providerIds.map(async (id) => {
    const provider = config.providers[id];
    if (!provider) {
      return { id, status: { status: "error", message: "지원하지 않는 provider" } };
    }
    return { id, status: await checkProviderStatus(id, provider) };
  }));

  const blocked = checks.filter((item) => item.status.status !== "ok");
  if (blocked.length === 0) return;

  const summary = blocked
    .map((item) => `${config.providers[item.id]?.label || item.id}: ${item.status.message}`)
    .join("; ");
  throw new Error(`미연결 AI가 참가자로 선택되어 있습니다. ${summary}`);
}

async function listSessionArchives() {
  await mkdir(SESSION_DIR, { recursive: true });
  const files = await readdir(SESSION_DIR);
  const archives = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const archive = await readSessionArchiveFile(file);
    if (!archive || !Array.isArray(archive.events)) continue;
    if (!archive.endedAt && archive.events.length === 0) continue;
    archives.push(sessionSummary(archive));
  }
  return archives.sort((a, b) => String(b.endedAt || b.lastEventAt || "").localeCompare(String(a.endedAt || a.lastEventAt || "")));
}

async function readSessionArchive(id) {
  if (!/^[A-Za-z0-9_.-]+$/.test(id)) return null;
  await mkdir(SESSION_DIR, { recursive: true });
  const files = await readdir(SESSION_DIR);
  const file = files.find((name) => name === `${id}.json` || name.startsWith(`${id}-`) && name.endsWith(".json"));
  return file ? readSessionArchiveFile(file) : null;
}

async function readSessionArchiveFile(file) {
  try {
    const data = JSON.parse(await readFile(path.join(SESSION_DIR, file), "utf8"));
    return { ...data, file };
  } catch {
    return null;
  }
}

function sessionSummary(archive) {
  const lastEventAt = archive.lastEventAt || archive.events?.at(-1)?.at || archive.endedAt || archive.startedAt || "";
  return {
    id: archive.id,
    mode: archive.mode || "debate",
    topic: archive.topic || "제목 없음",
    startedAt: archive.startedAt || "",
    endedAt: archive.endedAt || lastEventAt,
    lastEventAt,
    running: Boolean(archive.running && !archive.endedAt),
    players: Array.isArray(archive.players) ? archive.players : [],
    playerCount: Array.isArray(archive.players) ? archive.players.length : 0,
    winner: archive.winner || (archive.mode === "debate" ? "debate" : ""),
    message: archive.message || "",
    eventCount: Array.isArray(archive.events) ? archive.events.length : 0
  };
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

function playerFromArchive(config, archive, playerId) {
  const players = Array.isArray(archive?.request?.players) ? archive.request.players : [];
  const fromArchive = players.find((player) => (typeof player === "string" ? player : player.id) === playerId);
  const fromConfig = config.players.find((player) => player.id === playerId);
  const player = typeof fromArchive === "string" ? fromConfig : { ...(fromConfig || {}), ...(fromArchive || {}) };
  return player?.id ? player : null;
}

async function requestFollowUp(body) {
  if (session.running) {
    throw new Error("세션 진행 중에는 추가 의견을 요청할 수 없습니다.");
  }

  const sessionId = String(body.sessionId || session.id || "");
  const playerId = String(body.playerId || body.player || "");
  if (!sessionId) throw new Error("추가 의견을 받을 세션을 찾지 못했습니다.");
  if (!playerId) throw new Error("추가 의견을 받을 참가자를 선택하세요.");

  const archive = await readSessionArchive(sessionId);
  if (!archive?.file) throw new Error("세션 기록을 찾지 못했습니다.");

  const config = await loadConfig();
  const player = playerFromArchive(config, archive, playerId);
  if (!player) throw new Error("세션 참가자를 찾지 못했습니다.");
  if (!archive.request?.dryRun) {
    await validateConnectedProviders(config, [player]);
  }

  emit("activity", {
    state: "follow-up",
    phase: "followUp",
    playerId: player.id,
    displayName: player.displayName,
    provider: player.provider,
    color: player.color,
    message: `${player.displayName} 추가 의견 요청 중`
  });

  const args = [
    path.join(ROOT_DIR, "controller", "main.mjs"),
    "followup",
    "--events-json",
    "--session-file",
    path.join(SESSION_DIR, archive.file),
    "--player",
    player.id
  ];
  if (body.question) args.push("--question", String(body.question));
  if (archive.request?.dryRun) args.push("--dry-run");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT_DIR,
      windowsHide: true,
      env: process.env
    });

    let stdoutBuffer = "";
    let stderr = "";
    let followUpEvent = null;

    function parseLine(line) {
      const text = line.trim();
      if (!text) return;
      try {
        const event = JSON.parse(text);
        const emitted = emit(event.type || "log", event);
        if ((event.type || "") === "follow-up") followUpEvent = emitted;
      } catch {
        emit("log", { message: text });
      }
    }

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";
      for (const line of lines) parseLine(line);
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", async (code) => {
      try {
        if (stdoutBuffer.trim()) parseLine(stdoutBuffer.trim());
        if (code !== 0 && stderr.trim()) {
          emit("runner-error", { message: stderr.trim() });
        }
        if (!followUpEvent) {
          reject(new Error(stderr.trim() || `추가 의견 요청 실패: exit ${code}`));
          return;
        }
        await appendEventToArchive(sessionId, followUpEvent);
        emit("activity", { state: "done", phase: "followUp", message: "추가 의견 수신 완료" });
        resolve(followUpEvent);
      } catch (error) {
        reject(error);
      }
    });
  });
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

    if (req.method === "GET" && url.pathname === "/api/sessions") {
      sendJson(res, 200, { sessions: await listSessionArchives() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/session") {
      const archive = await readSessionArchive(String(url.searchParams.get("id") || ""));
      if (!archive || !Array.isArray(archive.events)) {
        sendJson(res, 404, { error: "Session not found" });
        return;
      }
      sendJson(res, 200, archive);
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

    if (req.method === "POST" && url.pathname === "/api/follow-up") {
      const event = await requestFollowUp(await readBody(req));
      sendJson(res, 200, { ok: true, event });
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
