import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT_DIR, "config.json");
const LOCAL_CONFIG_PATH = path.join(ROOT_DIR, "config.local.json");
const END_TOKEN_FALLBACK = "<<<END>>>";

loadEnvFile();

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

function rootPath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
}

function parseArgs(argv) {
  const args = {
    command: argv[0] || "help",
    dryRun: false
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
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

async function loadSessionFile(args) {
  if (!args.sessionFile) return {};
  return JSON.parse(await readFile(rootPath(args.sessionFile), "utf8"));
}

function nowStamp() {
  return new Date().toISOString();
}

function fileStamp() {
  return nowStamp().replace(/[:.]/g, "-");
}

function splitCsv(value) {
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function emitEvent(args, type, data = {}) {
  const event = { type, at: nowStamp(), ...data };
  if (args.eventsJson) {
    console.log(JSON.stringify(event));
  } else if (type === "turn" || type === "victory-speech") {
    console.log(`[${data.phase || type}] ${data.displayName}: ${data.speech}`);
  } else {
    console.log(`[${type}] ${data.message || JSON.stringify(data)}`);
  }
}

function emitActivity(args, state, data = {}) {
  emitEvent(args, "activity", { state, ...data });
}

function normalizeSessionPlayer(config, player, index) {
  const incoming = typeof player === "string" ? { id: player } : player;
  const base = config.players.find((entry) => entry.id === incoming.id) || {};
  const id = incoming.id || `custom_${index + 1}`;
  return {
    ...base,
    ...incoming,
    id,
    provider: incoming.provider || base.provider || "codex",
    displayName: incoming.displayName || base.displayName || `참가자${index + 1}`,
    personality: incoming.personality || base.personality || "새로 합류한 AI. 아직 플레이 스타일을 숨기고 있다.",
    color: incoming.color || base.color || "#aeb7c0",
    model: incoming.model || base.model || "",
    workdir: incoming.workdir || base.workdir || `agents/${id}`,
    enabled: incoming.enabled ?? base.enabled ?? true
  };
}

function normalizeSessionModerator(config, moderator = {}) {
  const base = config.moderator || {};
  return {
    ...base,
    ...moderator,
    id: "moderator",
    displayName: moderator.displayName || base.displayName || "회의 진행자",
    provider: moderator.provider || base.provider || "codex",
    personality: moderator.personality || base.personality || "토론의 열기를 살리면서 논점 이탈을 잡고 다음 질문을 좁히는 진행자.",
    color: moderator.color || base.color || "#e4b84a",
    model: moderator.model || base.model || "",
    workdir: moderator.workdir || base.workdir || "agents/moderator",
    enabled: moderator.enabled ?? base.enabled ?? true
  };
}

function getEnabledPlayers(config, playerFilter, session = {}) {
  const ids = splitCsv(playerFilter);
  const source = session.request && Array.isArray(session.request.players) ? session.request : session;
  const sessionPlayers = Array.isArray(source.players) ? source.players : [];
  const normalizedSessionPlayers = sessionPlayers.map((player, index) => normalizeSessionPlayer(config, player, index));
  const sessionIds = normalizedSessionPlayers.map((player) => player.id);
  const selectedIds = ids.length > 0 ? ids : sessionIds;
  const overrideById = new Map(normalizedSessionPlayers.map((player) => [player.id, player]));

  if (normalizedSessionPlayers.length > 0) {
    return selectedIds.length > 0
      ? selectedIds.map((id) => normalizedSessionPlayers.find((player) => player.id === id)).filter(Boolean)
      : normalizedSessionPlayers;
  }

  const players = config.players
    .filter((player) => selectedIds.length > 0 ? selectedIds.includes(player.id) : player.enabled)
    .map((player) => ({ ...player, ...(overrideById.get(player.id) || {}) }));

  if (players.length === 0) {
    throw new Error("No players selected. Enable players in config.json or pass --players.");
  }

  return selectedIds.length > 0
    ? selectedIds.map((id) => players.find((player) => player.id === id)).filter(Boolean)
    : players;
}

function getPlayer(config, playerId) {
  const player = config.players.find((entry) => entry.id === playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  return player;
}

async function ensureProjectDirs(config) {
  await mkdir(rootPath(config.game.privateLogDir), { recursive: true });
  await mkdir(path.dirname(rootPath(config.game.publicLogPath)), { recursive: true });
  await mkdir(rootPath("logs/sessions"), { recursive: true });

  for (const player of config.players) {
    await mkdir(rootPath(player.workdir), { recursive: true });
  }
  if (config.moderator?.workdir) {
    await mkdir(rootPath(config.moderator.workdir), { recursive: true });
  }

  await writeFile(rootPath("logs/private/.gitkeep"), "", { flag: "a" });
  await writeFile(rootPath("logs/sessions/.gitkeep"), "", { flag: "a" });
}

function applyProviderPlaceholders(value, context) {
  return String(value)
    .replaceAll("{output_file}", context.outputFile)
    .replaceAll("{player_id}", context.player.id)
    .replaceAll("{workdir}", context.workdir)
    .replaceAll("{model}", context.player.model || "");
}

function providerArgs(provider, context) {
  const rendered = (provider.args || []).map((arg) => applyProviderPlaceholders(arg, context));
  const model = String(context.player.model || "").trim();
  if (!model || !provider.model) return rendered;

  const modelArgs = (provider.model.args || ["--model", "{model}"])
    .map((arg) => applyProviderPlaceholders(arg, context));

  if (provider.model.insertAt === "start") {
    rendered.splice(0, 0, ...modelArgs);
    return rendered;
  }

  if (provider.model.insertAfter) {
    const index = rendered.indexOf(provider.model.insertAfter);
    rendered.splice(index >= 0 ? index + 1 : 0, 0, ...modelArgs);
    return rendered;
  }

  rendered.splice(0, 0, ...modelArgs);
  return rendered;
}

async function runProcess({ command, args, cwd, stdin, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const spawnSpec = process.platform === "win32"
      ? windowsSpawnSpec(command, args)
      : { command, args };

    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
        return;
      }
      resolve({ code, stdout, stderr });
    });

    child.stdin.end(stdin, "utf8");
  });
}

function windowsSpawnSpec(command, args) {
  const commandLine = [command, ...args].map(quoteForCmd).join(" ");
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", commandLine]
  };
}

function quoteForCmd(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./\\:+=,@-]+$/.test(text)) return text;
  return `"${text.replace(/(["^&|<>%])/g, "^$1")}"`;
}

async function invokePlayer({ config, player, prompt, dryRun }) {
  const endToken = config.game.responseEndToken || END_TOKEN_FALLBACK;
  const workdir = rootPath(player.workdir);
  const outputFile = path.join(rootPath(config.game.privateLogDir), `${fileStamp()}-${player.id}-last.md`);

  if (dryRun) {
    const raw = `${player.displayName}: 방금 흐름에서 단서 하나를 잡았습니다. 저는 말투보다 근거의 빈틈을 먼저 보겠습니다.\n${endToken}`;
    return { raw, stdout: raw, stderr: "", exitCode: 0, outputFile: null, commandLine: "dry-run" };
  }

  const provider = config.providers[player.provider];
  if (!provider) throw new Error(`No provider configured for ${player.provider}.`);

  const context = { player, outputFile, workdir };
  const args = providerArgs(provider, context);
  const result = await runProcess({
    command: provider.command,
    args,
    cwd: workdir,
    stdin: prompt,
    timeoutMs: config.game.turnTimeoutMs
  });

  let raw = result.stdout;
  if (existsSync(outputFile)) raw = await readFile(outputFile, "utf8");

  return {
    raw,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code,
    outputFile,
    commandLine: [provider.command, ...args].join(" ")
  };
}

function extractSpeech(raw, config) {
  const endToken = config.game.responseEndToken || END_TOKEN_FALLBACK;
  const index = raw.indexOf(endToken);
  const ended = index >= 0;
  const beforeToken = ended ? raw.slice(0, index) : raw;
  let speech = beforeToken.trim();

  if (speech.length > config.game.maxSpeechChars) {
    speech = `${speech.slice(0, config.game.maxSpeechChars).trim()}\n[controller: truncated]`;
  }

  return { speech, ended };
}

function stripSpeakerPrefix(speech, displayName) {
  const name = String(displayName || "").trim();
  if (!name) return String(speech || "").trim();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(speech || "")
    .replace(new RegExp(`^\\s*${escaped}\\s*[:：]\\s*`), "")
    .trim();
}

async function writePrivateTurnLog({ config, player, prompt, result, speechInfo, phase, round }) {
  const privateDir = rootPath(config.game.privateLogDir);
  const logPath = path.join(privateDir, `${fileStamp()}-${phase}-round-${round}-${player.id}.md`);
  const body = [
    `# Private Turn Log: ${player.id}`,
    "",
    `- phase: ${phase}`,
    `- round: ${round}`,
    `- at: ${nowStamp()}`,
    `- command: ${result.commandLine}`,
    `- exitCode: ${result.exitCode}`,
    `- ended: ${speechInfo.ended}`,
    result.outputFile ? `- outputFile: ${result.outputFile}` : "- outputFile: none",
    "",
    "## Prompt",
    "```text",
    prompt,
    "```",
    "",
    "## Raw Response",
    "```text",
    result.raw,
    "```",
    "",
    "## Stdout",
    "```text",
    result.stdout,
    "```",
    "",
    "## Stderr",
    "```text",
    result.stderr,
    "```"
  ].join("\n");

  await writeFile(logPath, body, "utf8");
  return logPath;
}

async function appendPublicLog(config, lines) {
  await appendFile(rootPath(config.game.publicLogPath), `${lines.join("\n")}\n`, "utf8");
}

function compactTranscript(turns) {
  if (turns.length === 0) return "아직 공개 발언이 없습니다.";
  return turns
    .slice(-28)
    .map((turn) => `[Day ${turn.day} ${phaseLabel(turn.phase)}] ${turn.displayName}: ${turn.speech}`)
    .join("\n\n");
}

function compactEventTranscript(events, mode = "debate") {
  const publicTypes = new Set(["turn", "victory-speech", "follow-up", "vote", "execution", "night", "game-over"]);
  const lines = (events || [])
    .filter((event) => publicTypes.has(event.type))
    .slice(-42)
    .map((event) => {
      if (event.type === "turn" || event.type === "victory-speech" || event.type === "follow-up") {
        const roundLabel = mode === "debate" ? `Round ${event.day || "-"}` : `Day ${event.day || "-"}`;
        return `[${roundLabel} ${phaseLabel(event.phase)}] ${event.displayName}: ${event.speech}`;
      }
      if (event.type === "vote") {
        const votes = (event.votes || []).map((vote) => `${vote.voterName}->${vote.targetName}`).join("; ");
        return `[Day ${event.day || "-"} 투표] ${event.executedName ? `${event.executedName} 처형` : "처형 없음"}${votes ? ` / ${votes}` : ""}`;
      }
      if (event.type === "execution") return `[Day ${event.day || "-"} 처형] ${event.message || ""}`;
      if (event.type === "night") {
        if (event.protected) return `[Night ${event.day || "-"}] 사망자 없음. 의사의 보호가 성공했다.`;
        return `[Night ${event.day || "-"}] ${event.killedName ? `${event.killedName} 사망` : "사망자 없음"}`;
      }
      if (event.type === "game-over") return `[종료] ${event.message || ""}`;
      return "";
    })
    .filter(Boolean);
  return lines.length ? lines.join("\n\n") : "아직 공개 발언이 없습니다.";
}

function livingPlayers(game) {
  return game.players.filter((player) => game.alive.has(player.id));
}

function providerLabel(config, providerId) {
  return config.providers[providerId]?.label || providerId;
}

function aiIdentity(config, player) {
  return `${providerLabel(config, player.provider)}${player.model ? `/${player.model}` : ""}`;
}

function publicRoster(game) {
  return game.players.map((player) => {
    if (game.mode === "debate") {
      return `- ${player.displayName} (${aiIdentity(game.config, player)}): ${player.personality}`;
    }
    const alive = game.alive.has(player.id) ? "생존" : "탈락";
    return `- ${player.displayName} (${aiIdentity(game.config, player)}, ${alive}): ${player.personality}`;
  }).join("\n");
}

function roleForPlayerFromEvents(events, playerId) {
  const roleEvent = [...(events || [])].reverse().find((event) => event.type === "roles" && Array.isArray(event.roles));
  return roleEvent?.roles?.find((entry) => entry.id === playerId)?.role || "";
}

function buildFollowUpPrompt({ config, archive, player, role, question }) {
  const endToken = config.game.responseEndToken || END_TOKEN_FALLBACK;
  const mode = archive.mode || "debate";
  const topic = archive.topic || archive.request?.topic || "";
  const source = archive.request || archive;
  const players = Array.isArray(source.players)
    ? source.players.map((entry, index) => normalizeSessionPlayer(config, entry, index))
    : [];
  const roster = players.map((entry) => {
    const roleText = mode === "mafia" && entry.id === player.id && role ? `, 네 역할: ${roleLabel(role)}` : "";
    return `- ${entry.displayName} (${aiIdentity(config, entry)}${roleText}): ${entry.personality}`;
  }).join("\n") || `- ${player.displayName} (${aiIdentity(config, player)}): ${player.personality}`;
  const transcript = compactEventTranscript(archive.events || [], mode);
  const task = question || (mode === "mafia"
    ? "판이 끝난 뒤 네 관점에서 소감, 아쉬웠던 판단, 다음 판에서 바꿀 전략을 말해라."
    : "회의가 끝난 뒤 네 관점에서 가장 실용적인 추가 의견, 놓친 리스크, 바로 만들 수 있는 첫 버전을 말해라.");
  const rules = mode === "mafia"
    ? [
        "- 이미 끝난 마피아 게임의 후속 인터뷰다.",
        "- 공개 기록을 근거로 네 판단과 속마음을 설명해도 된다.",
        "- 소감만 말하지 말고, 다음에 누가 어떤 선택을 했어야 하는지까지 짧게 짚어라."
      ]
    : [
        "- 지금은 일반토론/아이디어 회의의 후속 의견이다.",
        "- 마피아, 생존, 사망, 처형, 밤 행동 같은 게임 용어를 쓰지 마라.",
        "- 사용자가 바로 행동할 수 있게 아이디어, 사용자 가치, 첫 구현 범위, 리스크를 구체적으로 말해라."
      ];

  return [
    "# AI Debate Arena 추가 의견",
    "",
    `주제: ${topic}`,
    `너: ${player.displayName} (${aiIdentity(config, player)})`,
    `성격: ${player.personality}`,
    mode === "mafia" && role ? `역할: ${roleLabel(role)}` : "",
    "",
    "## 규칙",
    ...rules,
    "- 이전 기록을 반복 요약하지 말고, 새로 보탤 의견을 중심으로 말해라.",
    "- 5문장 이내로 답하라.",
    "",
    "## 참가자",
    roster,
    "",
    "## 공개 기록",
    transcript,
    "",
    "## 사용자의 추가 요청",
    task,
    "",
    `마지막 줄에는 반드시 ${endToken}만 출력해라.`
  ].filter((line) => line !== "").join("\n");
}

function extractDebateIdeaLabels(turns) {
  const labels = [];
  const seen = new Set();
  for (const turn of turns || []) {
    const text = String(turn.speech || "");
    const matches = text.matchAll(/(?:\[?아이디어\]?|아이디어)\s*[:：]\s*[‘'"]?([^’'"\]\n*]+)/g);
    for (const match of matches) {
      const label = match[1].replace(/[`*_#>-]/g, "").trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      labels.push(label);
    }
  }
  return labels.slice(0, 4);
}

function buildDebateModeratorNote({ game, round, rounds, topic }) {
  const ideas = extractDebateIdeaLabels(game.turns);
  const latest = game.turns.slice(-game.players.length).map((turn) => turn.displayName).join(", ");
  const ideaText = ideas.length ? ideas.join(" / ") : "아직 명확한 후보가 부족함";

  if (round >= rounds) {
    return [
      `회의 진행자 최종 정리: 주제는 "${topic}"입니다.`,
      `지금까지 강하게 남은 후보는 ${ideaText}입니다.`,
      "이제 추가 발언이나 자료를 요청하지 말고, 현재 공개 기록만으로 결론을 내려야 합니다.",
      "최종 답은 핵심 결론, 채택안, 근거, 반론/리스크, 바로 할 다음 액션으로 정리해야 합니다.",
      "부족한 정보는 '검증 필요'로 표시하되, 회의를 더 끌지 말고 사용자가 바로 판단할 수 있게 마무리해야 합니다."
    ].join(" ");
  }

  return [
    `회의 진행자: Round ${round} 발언(${latest || "없음"})은 충분히 날카로웠지만, 이제 싸움만 늘리면 결론이 흐려집니다.`,
    `이번 주제는 "${topic}"입니다. 주제 밖으로 나간 발언은 다음 라운드에서 바로 끌어와야 합니다.`,
    `현재 후보: ${ideaText}.`,
    "다음 라운드는 세게 반박하고 비꼬아도 좋지만, 후보 1개를 선택해 MVP, 실제 사용자, 차별점, 탈락 리스크를 말하세요.",
    "재미있는 충돌은 살리되 반드시 보완안이나 선택 기준을 같이 내야 합니다."
  ].join(" ");
}

function buildModeratorPrompt({ config, game, moderator, round, rounds, topic }) {
  const endToken = config.game.responseEndToken || END_TOKEN_FALLBACK;
  const transcript = publicRecordsFor(game, moderator);
  const finalRound = round >= rounds;
  const stageRules = finalRound
    ? [
        "## 현재 단계",
        `Round ${round}/${rounds}. 모든 참가자 발언이 끝났고, 이것이 회의의 마지막 진행자 발언이다. 이후 라운드와 추가 참가자 발언은 없다.`,
        "",
        "## 최종 정리 규칙",
        "- 첫 문장은 반드시 '최종 정리:'로 시작하라.",
        "- 참가자에게 무엇을 가져오라, 더 논의하라, 다음 라운드에서 검토하라 같은 지시를 하지 마라.",
        "- 공개 기록에 있는 발언만 근거로 삼고, 모르는 정보는 '검증 필요'라고 표시하라.",
        "- 사용자가 바로 읽을 최종 결과물이다. 회의 진행 멘트가 아니라 결론문으로 써라.",
        "- 반드시 핵심 결론, 채택안, 근거, 반론/리스크, 바로 할 다음 액션을 포함하라.",
        "- 8문장 이내로 말하라."
      ]
    : [
        "## 현재 단계",
        `Round ${round}/${rounds}. 아직 회의가 끝나지 않았다. 이번 라운드 흐름을 잡고 다음 라운드의 충돌 지점을 좁혀라.`,
        "",
        "## 진행 규칙",
        "- 다음 참가자가 무엇을 비교하고 무엇을 버려야 하는지 분명히 말하라.",
        "- 다음 라운드에서 반드시 부딪혀야 할 쟁점, 버릴 주장, 살릴 후보를 지정하라.",
        "- 5문장 이내로 말하라."
      ];

  return [
    "# AI Debate Arena 회의 진행자",
    "",
    `너는 ${moderator.displayName} (${aiIdentity(config, moderator)})다.`,
    `진행 성격: ${moderator.personality}`,
    "너는 참가자가 아니라 회의 진행자다. 직접 아이디어의 주인공이 되지 말고, 흐름을 끌고 결론이 나오게 압박한다.",
    "",
    "## 토론 주제",
    topic,
    "",
    "## 참가자",
    publicRoster(game),
    "",
    "## 공개 기록",
    transcript,
    "",
    "## 진행 규칙",
    "- 반박, 비난, 도발은 막지 마라. 대신 그 충돌이 선택 기준이나 실행안으로 이어지게 만들어라.",
    "- 주제와 무관한 이전 회의 내용이나 게임 용어가 나오면 이름을 직접 지목해 바로 잡아라.",
    "",
    ...stageRules,
    `마지막 줄에는 반드시 ${endToken}만 출력해라.`
  ].join("\n");
}

async function runDebateModerator({ args, config, game, moderator, round, rounds, topic }) {
  if (!moderator.enabled) return buildDebateModeratorNote({ game, round, rounds, topic });

  const prompt = buildModeratorPrompt({ config, game, moderator, round, rounds, topic });
  if (args.dryRun) {
    await mkdir(rootPath(moderator.workdir), { recursive: true });
    await writeFile(path.join(rootPath(moderator.workdir), "input.md"), prompt, "utf8");
    return buildDebateModeratorNote({ game, round, rounds, topic });
  }

  try {
    return await runTurn({
      args,
      config,
      game,
      player: moderator,
      prompt,
      phase: "moderator",
      day: round
    });
  } catch (error) {
    emitEvent(args, "runner-error", {
      message: `회의 진행자 응답 실패: ${error.message}. 기본 진행자 정리로 대체합니다.`
    });
    return buildDebateModeratorNote({ game, round, rounds, topic });
  }
}

function privateRoleInfo(game, player) {
  const role = game.roles[player.id];
  const lines = [`너의 비밀 역할: ${roleLabel(role)}`];

  if (role === "mafia") {
    const teammates = game.players
      .filter((entry) => entry.id !== player.id && game.roles[entry.id] === "mafia")
      .map((entry) => entry.displayName);
    lines.push(`마피아 동료: ${teammates.length ? teammates.join(", ") : "없음"}`);
    lines.push("시민인 척 거짓말하라. 동료와 너무 티 나게 편먹지 말고, 공개 발언의 빈틈을 이용해 의심을 돌려라.");
    lines.push("마피아는 자기 팀의 밤 선택 기록을 안다. 사망자 없음과 의사 보호 성공이 공개되면 최종 공격 대상이 보호받았다고 추론할 수 있지만, 의사가 누구인지는 공개 발언 전까지 모른다.");
  } else if (role === "police") {
    const records = game.investigations.filter((item) => item.actorId === player.id);
    lines.push(`조사 기록: ${records.length ? records.map((item) => `${item.targetName}=${item.result}`).join(", ") : "아직 없음"}`);
    lines.push("조사 결과는 너만 안다. 바로 경찰이라고 밝힐 수도 있고, 더 많은 정보를 모으기 위해 숨길 수도 있다.");
    lines.push("경찰은 조사 기록 외에는 밤 피격 대상이나 의사 보호 대상을 모른다. 의사 보호 성공이 공개되어도 누가 공격받았는지는 단정하지 마라.");
  } else if (role === "doctor") {
    const records = game.protections.filter((item) => item.actorId === player.id);
    lines.push(`보호 기록: ${records.length ? records.map((item) => `${item.targetName}${item.success === true ? "(성공)" : item.success === false ? "(실패)" : ""}`).join(", ") : "아직 없음"}`);
    lines.push("보호 대상과 성공/실패는 네가 가진 비밀 정보다. 성공이면 네 보호 대상이 밤 공격을 받았다고 추론할 수 있다.");
    lines.push("다음날 이 정보를 공개해서 신뢰를 얻을 수도 있고, 마피아 표적을 피하려 숨기거나 일부만 말할 수도 있다.");
  } else {
    lines.push("너는 시민이다. 공개 발언, 투표, 밤 결과만으로 마피아를 찾아야 한다.");
    lines.push("시민은 밤 피격 대상이나 의사 보호 대상을 모른다. 의사 보호 성공이 공개되어도 누가 공격받았는지는 단정하지 마라.");
  }

  return lines.join("\n");
}

function roleLabel(role) {
  return {
    mafia: "마피아",
    police: "경찰",
    doctor: "의사",
    citizen: "시민",
    hidden: "비공개"
  }[role] || role;
}

function publicRecordsFor(game, viewer) {
  const viewerIsMafia = viewer && game.roles?.[viewer.id] === "mafia";
  return (game.records || [])
    .filter((entry) => entry.visibility === "public" || (entry.visibility === "mafia" && viewerIsMafia))
    .slice(-36)
    .map((entry) => `[Day ${entry.day ?? "-"} ${phaseLabel(entry.phase)}] ${entry.text}`)
    .join("\n\n") || "아직 공개 발언이 없습니다.";
}

function addRecord(game, { day, phase, text, visibility = "public" }) {
  game.records.push({ day, phase, text, visibility });
  if (game.records.length > 120) {
    game.records.splice(0, game.records.length - 120);
  }
}

function addTurnRecord(game, turn, visibility = "public") {
  addRecord(game, {
    day: turn.day,
    phase: turn.phase,
    visibility,
    text: `${turn.displayName}: ${turn.speech}`
  });
}

function addVoteRecord(game, voteResult) {
  const pairs = voteResult.votes.length
    ? voteResult.votes.map((vote) => `${vote.voterName}->${vote.targetName}`).join("; ")
    : "유효표 없음";
  const outcome = voteResult.pressureOnly
    ? `첫날 압박 투표. 최다 의심: ${voteResult.topSuspectName || "없음"}. 처형 없음.`
    : voteResult.executedName
      ? `처형 대상: ${voteResult.executedName}.`
      : "처형 없음.";

  addRecord(game, {
    day: voteResult.day,
    phase: "vote",
    text: `${outcome} 투표: ${pairs}`
  });
}

function addNightRecord(game, nightResult, revealRoles) {
  let publicText = "밤 결과: 사망자 없음.";
  if (nightResult.protected) {
    publicText = "밤 결과: 사망자 없음. 의사의 보호가 성공했다.";
  } else if (nightResult.killedName) {
    publicText = `밤 결과: ${nightResult.killedName} 사망${revealRoles ? ` (${roleLabel(nightResult.killedRole)})` : ""}.`;
  }

  addRecord(game, {
    day: nightResult.day,
    phase: "night",
    text: publicText
  });

  if (nightResult.mafiaChoices?.length) {
    const choices = nightResult.mafiaChoices
      .map((choice) => `${choice.actorName}->${choice.targetName}`)
      .join("; ");
    addRecord(game, {
      day: nightResult.day,
      phase: "night",
      visibility: "mafia",
      text: `마피아 밤 선택 기록: ${choices}. 최종 대상: ${nightResult.selectedTargetName || "없음"}.`
    });
  }
}

function phaseLabel(phase) {
  return {
    day: "낮 토론",
    interrupt: "돌발 발언",
    mafiaChat: "마피아 회의",
    vote: "투표",
    night: "밤",
    victory: "승리 소감",
    moderator: "진행자 정리",
    followUp: "추가 의견",
    debate: "토론"
  }[phase] || phase || "발언";
}

function buildSpeechPrompt({ config, game, player, day, phase, instruction }) {
  const endToken = config.game.responseEndToken || END_TOKEN_FALLBACK;
  const isDebate = phase === "debate";
  const topic = game.topic || "";
  const visibleRecord = publicRecordsFor(game, player);
  const hasTranscript = visibleRecord !== "아직 공개 발언이 없습니다.";
  const isFirstPublicSpeaker = (phase === "day" || phase === "debate")
    && !game.records.some((entry) => entry.visibility === "public" && entry.day === day && entry.phase === phase);
  const alive = livingPlayers(game).map((entry) => entry.displayName).join(", ");
  const eliminated = game.players
    .filter((entry) => !game.alive.has(entry.id))
    .map((entry) => entry.displayName)
    .join(", ") || "없음";
  const statusLines = isDebate
    ? [`라운드: ${day}`]
    : [`Day: ${day}`, `생존자: ${alive}`, `탈락자: ${eliminated}`];
  const debateIsFinalRound = isDebate && Number.isFinite(Number(game.rounds)) && day >= Number(game.rounds);
  const debateStageRule = debateIsFinalRound
    ? "- 마지막 라운드다. 강한 반박과 비난도 허용하지만, 최종안 하나를 고른 뒤 MVP, 사용자 가치, 리스크, 다음 액션을 정리하라."
    : "- 중간 라운드다. 강한 반박과 비난도 허용하지만, 후보를 선택하거나 보완해서 다음 사람이 결론에 가까워지게 만들어라.";
  const closingInstruction = isDebate
    ? "짧고 생생하게 말해라. 보고서처럼 늘어놓지 말고, 실제 아이디어 회의에서 말하듯 제안, 반박, 실행 방법, 리스크를 분명히 섞어라."
    : "짧고 생생하게 말해라. 보고서처럼 말하지 말고, 실제 마피아 게임 테이블에서 말하듯 의심과 반박을 섞어라.";
  const premise = isDebate
    ? "너는 여러 AI가 서로의 논리, 말투, 추론 습관을 공개 검증하는 AI 아이디어 회의의 참가자다. 사용자는 실용적이고 획기적인 결론을 얻기 위해 AI끼리 충돌하는 장면을 보고 있다."
    : "너는 실제 마피아 게임의 플레이어다. 관전자는 네 말과 행동을 실시간으로 보고 있다.";
  const modeRules = isDebate
    ? [
        "- 지금은 너 혼자만 말한다.",
        "- 네 응답이 끝날 때까지 다른 AI는 말할 수 없다.",
        "- 반드시 아래 '토론 주제'에 직접 답하라. 주제와 무관한 제품 아이디어, 이전 회의 내용, 다른 대회 이야기를 꺼내면 실패다.",
        "- 다른 AI의 provider, 성격, 이전 발언 스타일을 근거로 삼아도 된다.",
        "- 단순히 예쁘게 합의하지 마라. 강한 반박, 비난, 도발도 허용된다. 다만 끝에는 결론에 도움이 되는 선택 기준이나 보완안을 남겨라.",
        "- 회의 진행자의 공개 기록이 있으면 그 지시를 우선한다.",
        debateStageRule,
        "- 마피아, 생존, 사망, 처형, 밤 행동 같은 게임 용어를 쓰지 마라. 지금은 일반 회의/아이디어 검증 모드다.",
        "- 좋은 답변은 아이디어의 사용자, 핵심 기능, 차별점, 만들기 쉬운 첫 버전, 리스크를 구체적으로 말한다.",
        "- 매 발언마다 선택/보완/리스크/다음 액션 중 최소 2개를 반드시 남겨라.",
        hasTranscript
          ? "- 반드시 이전 공개 발언 중 하나를 근거로 삼아 찬성, 반박, 보완 중 하나를 분명히 하라."
          : "- 첫 발언이면 쟁점 기준을 세우고, 어떤 AI가 어떤 관점에서 강하게 나올지 예고하라."
      ]
    : [
        "- 지금은 너 혼자만 말한다.",
        "- 네 응답이 완전히 끝날 때까지 다른 플레이어는 말할 수 없다.",
        "- 다른 플레이어의 비밀 역할이나 내부 로그를 읽으려 하지 마라.",
        hasTranscript
          ? "- 반드시 이전 공개 발언, 투표, 밤 결과 중 하나를 근거로 추론하라."
          : "- 첫 발언이면 의심 기준을 던지고, 누가 어떤 반응을 보이면 수상한지 예고하라.",
        "- 마피아라면 시민처럼 행동하고, 그럴듯한 거짓 추론으로 의심을 돌려라."
      ];
  const mafiaRules = isDebate ? [] : [
    "",
    "## 역할 규칙과 심리전",
    "- 경찰은 밤마다 의심되는 사람 한 명을 조사해 마피아인지 아닌지 비밀로 알 수 있다. 다음날 바로 공개할지, 더 숨길지는 전략이다.",
    "- 의사는 밤마다 마피아가 죽일 것 같은 사람 한 명을 보호한다. 마피아가 같은 대상을 죽이려 하면 사망이 막힌다.",
    "- 능력자 정보는 공개 의무가 없다. 경찰 조사, 의사 보호 대상, 성공/실패를 언제 밝힐지, 숨길지, 일부만 말할지는 승리를 기준으로 판단하라.",
    "- 경찰이나 의사라고 밝히면 마피아의 표적이 될 수 있다. 결과를 바로 말하거나, 여러 밤을 모으거나, 미끼처럼 일부만 흘리는 선택이 모두 가능하다.",
    "- 공개 기록에 '의사의 보호가 성공했다'고 나오면 모두 의사 보호 성공 자체는 안다. 마피아가 아닌 플레이어는 누가 공격받았고 누가 보호받았는지 모른다.",
    "- 마피아는 자기들이 밤에 선택한 최종 공격 대상이 살아났다면 그 대상이 의사 보호를 받았다고 추론할 수 있다. 단, 의사가 누구인지는 공개 발언 전까지 모른다.",
    "- 특히 경찰은 자기 조사 결과만 안다. 의사 보호 성공이 공개되어도 '마피아가 나를 찔렀고 의사가 살렸다'고 단정하지 마라.",
    "- 의사는 자기 보호 대상과 성공/실패만 안다. 성공했다면 '내가 보호한 사람이 공격받았을 가능성이 높다'고 추론할 수 있지만, 공개할지는 전략이다.",
    "- 마피아는 밤에 동료를 알고, 시민팀을 이끌 사람이나 경찰/의사처럼 보이는 사람을 제거하려 한다.",
    "- 마피아는 경찰이나 의사를 사칭할 수 있다. 다만 아무 근거 없는 트롤식 자폭이 아니라, 압박을 피하거나 진짜 능력자를 흔드는 심리전으로 써라.",
    "- 시민팀은 첫날 정보가 적으므로 단정하지 말고, 말의 모순/투표/밤 결과/능력자 주장과 반박을 이어서 추론하라.",
    "- 누가 경찰/의사라고 주장하면 조사 대상, 조사 결과, 보호 논리를 따져라. 맞다이 상황이면 양쪽 발언의 시점과 위험 부담을 비교하라.",
    "- 첫 발언자는 정보가 거의 없다. 첫 발언이라는 이유만으로 과하게 몰아가거나, 첫 발언자가 무리하게 단정하는 플레이는 피하라.",
    "- 네가 첫 발언자라면 강한 지목보다 의심 기준과 검증 질문을 먼저 던져라. 단, 너무 안전한 말만 해서 회피처럼 보이지 않게 한 명 정도는 약하게 압박해도 된다.",
    "- 네가 첫 발언자가 아니라면 첫 발언자의 위치상 불리함을 감안하고, 단순히 '처음이라 애매했다'가 아니라 실제 표현/모순/반응을 근거로 삼아라."
  ];

  return [
    "# AI Debate Arena",
    "",
    premise,
    "",
    isDebate ? "## 토론 주제" : "## 오늘의 판",
    topic || (isDebate ? "사용자가 입력한 사안" : "서로의 공개 발언만 보고 마피아를 찾아라."),
    "",
    "## 절대 진행 규칙",
    ...modeRules,
    ...mafiaRules,
    "",
    "## 네 정보",
    `이름: ${player.displayName}`,
    `성격: ${player.personality}`,
    `AI 계열: ${aiIdentity(config, player)}`,
    isDebate ? "역할: 토론 참가 AI" : privateRoleInfo(game, player),
    "",
    "## 공개 상태",
    ...statusLines,
    "",
    isDebate && game.moderator ? "## 회의 진행자" : "",
    isDebate && game.moderator ? `${game.moderator.displayName} (${aiIdentity(config, game.moderator)}): ${game.moderator.personality}` : "",
    isDebate && game.moderator ? "" : "",
    isDebate ? "## 참가자 목록" : "## 플레이어 목록",
    publicRoster(game),
    "",
    "## 공개 기록",
    visibleRecord,
    "",
    "## 이번 발언",
    isFirstPublicSpeaker
      ? isDebate
        ? "너는 이번 회의의 첫 발언자다. 쟁점 기준을 세우고, 이후 참가자들이 검증해야 할 질문을 던져라."
        : "너는 이번 낮 토론의 첫 발언자다. 정보가 없다는 점을 인정하고, 이후 사람들이 어떻게 반응하면 수상한지 기준을 세워라."
      : "",
    instruction,
    closingInstruction,
    `마지막 줄에는 반드시 ${endToken}만 출력해라.`
  ].join("\n");
}

function buildJsonPrompt({ config, game, player, day, kind }) {
  const endToken = config.game.responseEndToken || END_TOKEN_FALLBACK;
  const targets = livingPlayers(game)
    .filter((entry) => entry.id !== player.id)
    .filter((entry) => kind !== "kill" || game.roles[entry.id] !== "mafia")
    .map((entry) => `${entry.id}=${entry.displayName}`)
    .join(", ");

  const schemas = {
    vote: {
      task: day === 1 && !game.firstDayExecution
        ? "첫날은 처형 없는 압박 투표다. 지금 가장 의심되는 사람을 찍어 다음날 검증할 포인트를 만들어라."
        : "오늘 처형할 사람에게 투표하라.",
      schema: '{"vote":"player_id","reason":"화면에만 보일 네 솔직한 속마음. 공개 기록의 단서와 네 실제 의도를 함께 써라."}'
    },
    kill: {
      task: "마피아 회의와 공개 발언을 근거로 밤에 제거할 대상을 고르라. 마피아가 아닌 생존자만 골라라. 우선순위는 시민팀을 묶을 리더, 논리적으로 강한 사람, 경찰/의사처럼 보이는 사람이다.",
      schema: '{"action":"kill","target":"player_id","reason":"화면에만 보일 네 솔직한 속마음. 예: 경찰로 보이니 제거 우선순위가 높다."}'
    },
    investigate: {
      task: "밤에 조사할 대상을 고르라. 낮 발언과 투표에서 모순이 있거나, 사칭 가능성이 있는 사람을 우선 조사하라.",
      schema: '{"action":"investigate","target":"player_id","reason":"화면에만 보일 네 솔직한 속마음. 왜 이 사람이 진짜 의심되는지 써라."}'
    },
    protect: {
      task: "밤에 보호할 대상을 고르라. 마피아가 죽이고 싶어 할 리더, 경찰 주장자, 너무 정확히 추리한 사람을 우선 보호하라.",
      schema: '{"action":"protect","target":"player_id","reason":"화면에만 보일 네 솔직한 속마음. 왜 이 사람이 죽을 것 같은지 써라."}'
    }
  };

  const current = schemas[kind];

  return [
    "# AI Mafia Arena JSON Action",
    "",
    "너는 실제 마피아 게임의 플레이어다. 다른 참가자는 모두 AI이며 서로의 AI 계열, 성격, 발언 습관을 보고 추론한다.",
    "",
    "## 네 정보",
    `이름: ${player.displayName}`,
    `성격: ${player.personality}`,
    `AI 계열: ${aiIdentity(config, player)}`,
    privateRoleInfo(game, player),
    "",
    "## 공개 기록",
    publicRecordsFor(game, player),
    "",
    "## 선택 가능한 대상",
    targets || "없음",
    "",
    "## 지시",
    current.task,
    "반드시 공개 기록에서 나온 단서와 상대 AI의 계열/성격을 함께 고려해 결정하라.",
    "공개 기록에 의사 보호 성공이 있어도, 경찰/시민은 밤 피격 대상과 보호 대상을 모른다. 마피아는 자신들의 최종 공격 대상이 보호받았다고 추론할 수 있지만 의사 정체는 모른다. 추측과 확정을 구분하라.",
    "reason은 화면에 속마음으로만 보이며 다른 AI에게 공개 기록으로 전달되지 않는다.",
    "마피아라면 시민인 척하는 겉말이 아니라, 마피아로서의 실제 제거/교란 의도를 솔직하게 써라.",
    "아래 JSON만 출력하고, 마지막 줄에는 종료 토큰만 출력하라.",
    "",
    current.schema,
    "",
    `마지막 줄: ${endToken}`
  ].join("\n");
}

async function runTurn({ args, config, game, player, prompt, phase, day }) {
  emitActivity(args, "dispatch", {
    day,
    phase,
    playerId: player.id,
    displayName: player.displayName,
    provider: player.provider,
    color: player.color,
    message: `사회자가 ${player.displayName}에게 ${phaseLabel(phase)} 지시를 전달 중`
  });
  await mkdir(rootPath(player.workdir), { recursive: true });
  await writeFile(path.join(rootPath(player.workdir), "input.md"), prompt, "utf8");
  emitActivity(args, "thinking", {
    day,
    phase,
    playerId: player.id,
    displayName: player.displayName,
    provider: player.provider,
    color: player.color,
    message: `${player.displayName} 응답 대기 중`
  });
  const result = await invokePlayer({ config, player, prompt, dryRun: args.dryRun });
  emitActivity(args, "received", {
    day,
    phase,
    playerId: player.id,
    displayName: player.displayName,
    provider: player.provider,
    color: player.color,
    message: `${player.displayName} 발언 수신 완료`
  });
  const speechInfo = extractSpeech(result.raw, config);
  const privateLogPath = await writePrivateTurnLog({ config, player, prompt, result, speechInfo, phase, round: day });

  if (result.exitCode !== 0) {
    throw new Error(`${player.id} exited with code ${result.exitCode}. See ${privateLogPath}`);
  }
  if (!speechInfo.ended) {
    throw new Error(`${player.id} did not emit the end token. See ${privateLogPath}`);
  }

  return speechInfo.speech;
}

async function requestJsonAction({ args, config, game, player, day, kind }) {
  emitActivity(args, kind === "vote" ? "voting" : "night-action", {
    day,
    phase: kind,
    playerId: player.id,
    displayName: player.displayName,
    provider: player.provider,
    color: player.color,
    message: kind === "vote"
      ? `${player.displayName} 투표 받는 중`
      : `${player.displayName} 밤 행동 선택 중`
  });
  if (args.dryRun) return fallbackAction(game, player, kind);
  const prompt = buildJsonPrompt({ config, game, player, day, kind });
  const speech = await runTurn({ args, config, game, player, prompt, phase: kind, day });
  return parseJsonFromText(speech) || fallbackAction(game, player, kind);
}

function parseJsonFromText(text) {
  let cleaned = String(text).trim();
  cleaned = cleaned.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function fallbackAction(game, player, kind) {
  if (kind === "vote") {
    const target = chooseVoteTarget(game, player);
    return { vote: target.id, reason: `${target.displayName}의 발언 근거가 약해 보여 압박 반응을 보고 싶습니다.` };
  }
  const target = chooseRoleActionTarget(game, player, kind);
  const action = kind === "investigate" ? "investigate" : kind === "protect" ? "protect" : "kill";
  return { action, target: target.id, reason: fallbackReason(game, kind, target) };
}

function chooseVoteTarget(game, player) {
  const candidates = livingPlayers(game).filter((entry) => entry.id !== player.id);
  const lastVotedTargets = game.votes.at(-1)?.votes?.map((vote) => vote.targetId) || [];
  const scored = candidates.map((candidate) => ({
    candidate,
    score: (lastVotedTargets.filter((id) => id === candidate.id).length * 2)
      + (game.roles[player.id] === "mafia" && game.roles[candidate.id] !== "mafia" ? 1 : 0)
      + Math.random()
  }));
  return scored.sort((a, b) => b.score - a.score)[0]?.candidate || candidates[0] || player;
}

function chooseRoleActionTarget(game, player, kind) {
  let candidates = livingPlayers(game).filter((entry) => entry.id !== player.id);
  if (kind === "kill") {
    candidates = candidates.filter((entry) => game.roles[entry.id] !== "mafia");
    return candidates.sort((a, b) => leadershipScore(game, b) - leadershipScore(game, a))[0] || candidates[0] || player;
  }
  if (kind === "investigate") {
    const investigated = new Set(game.investigations.filter((item) => item.actorId === player.id).map((item) => item.targetId));
    return candidates
      .filter((entry) => !investigated.has(entry.id))
      .sort((a, b) => suspicionScore(game, b) - suspicionScore(game, a))[0] || candidates[0] || player;
  }
  if (kind === "protect") {
    return candidates.sort((a, b) => leadershipScore(game, b) - leadershipScore(game, a))[0] || candidates[0] || player;
  }
  return candidates[0] || player;
}

function leadershipScore(game, player) {
  const text = `${player.displayName} ${player.personality || ""}`;
  const keywordScore = [
    "리더", "논리", "전략", "침착", "날카", "분석", "압박", "공감"
  ].reduce((score, keyword) => score + (text.includes(keyword) ? 2 : 0), 0);
  const speechCount = game.turns.filter((turn) => turn.playerId === player.id && turn.phase !== "mafiaChat").length;
  const voteHeat = game.votes.flatMap((round) => round.votes).filter((vote) => vote.targetId === player.id).length;
  return keywordScore + speechCount - voteHeat + Math.random();
}

function suspicionScore(game, player) {
  const voteHeat = game.votes.flatMap((round) => round.votes).filter((vote) => vote.targetId === player.id).length;
  const survivedPressure = game.votes.some((round) => round.executedId === player.id || round.topSuspectId === player.id) ? 2 : 0;
  return voteHeat + survivedPressure + Math.random();
}

function fallbackReason(game, kind, target) {
  if (kind === "kill") return `${target.displayName}이 경찰이나 시민팀 리더처럼 보여 마피아 입장에서 제거 우선순위가 높습니다.`;
  if (kind === "investigate") return `${target.displayName}의 말과 투표 흐름이 어긋나 보여 실제 정체를 먼저 확인하고 싶습니다.`;
  if (kind === "protect") return `${target.displayName}이 너무 정확히 추리해 마피아가 노릴 가능성이 높다고 봅니다.`;
  return "컨트롤러 기본 선택";
}

function recommendRoles(playerCount) {
  if (playerCount <= 4) return { mafia: 1, police: 1, doctor: 0 };
  if (playerCount <= 6) return { mafia: 1, police: 1, doctor: 1 };
  if (playerCount <= 8) return { mafia: 2, police: 1, doctor: 1 };
  if (playerCount <= 11) return { mafia: 3, police: 1, doctor: 1 };
  return { mafia: Math.max(3, Math.floor(playerCount / 3)), police: 1, doctor: 2 };
}

function assignRoles(players, requestedRoles) {
  const roles = {
    mafia: Number.parseInt(requestedRoles.mafia, 10),
    police: Number.parseInt(requestedRoles.police, 10),
    doctor: Number.parseInt(requestedRoles.doctor, 10)
  };

  if (roles.mafia < 1) throw new Error("Mafia count must be at least 1.");
  if (roles.mafia + roles.police + roles.doctor > players.length) {
    throw new Error("Role counts exceed selected player count.");
  }

  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const assigned = {};
  let index = 0;
  for (let i = 0; i < roles.mafia; i += 1) assigned[shuffled[index++].id] = "mafia";
  for (let i = 0; i < roles.police; i += 1) assigned[shuffled[index++].id] = "police";
  for (let i = 0; i < roles.doctor; i += 1) assigned[shuffled[index++].id] = "doctor";
  for (; index < shuffled.length; index += 1) assigned[shuffled[index].id] = "citizen";
  return assigned;
}

function checkWinner(game) {
  const alive = livingPlayers(game);
  const mafiaAlive = alive.filter((player) => game.roles[player.id] === "mafia").length;
  const townAlive = alive.length - mafiaAlive;
  if (mafiaAlive === 0) return { winner: "citizen", message: "모든 마피아가 제거되어 시민팀 승리" };
  if (mafiaAlive >= townAlive) return { winner: "mafia", message: "마피아 수가 시민 진영 이상이 되어 마피아팀 승리" };
  return null;
}

function safePlayer(game, playerId) {
  return game.players.find((player) => player.id === playerId);
}

async function runMafia(args) {
  const config = await loadConfig();
  const loadedSession = await loadSessionFile(args);
  const session = loadedSession.request || loadedSession;
  await ensureProjectDirs(config);

  const players = getEnabledPlayers(config, args.players, session);
  const roles = session.roles || config.game.roles || recommendRoles(players.length);
  const maxDays = Number.parseInt(session.maxDays || args.maxDays || config.game.maxDays || 3, 10);
  const dayRounds = Number.parseInt(session.dayRounds || args.dayRounds || config.game.dayRounds || 1, 10);
  const interruptEnabled = session.interruptEnabled ?? config.game.interrupt?.enabled ?? true;
  const interruptChance = Number.parseFloat(session.interruptChance ?? config.game.interrupt?.chance ?? 0.65);
  const revealRoles = session.spectatorRevealRoles ?? config.game.spectatorRevealRoles ?? true;
  const topic = session.topic || args.topic || "서로의 공개 발언만 보고 마피아를 찾아라.";

  const game = {
    config,
    mode: "mafia",
    topic,
    players,
    roles: assignRoles(players, roles),
    firstDayExecution: session.firstDayExecution ?? config.game.firstDayExecution ?? false,
    alive: new Set(players.map((player) => player.id)),
    turns: [],
    records: [],
    votes: [],
    nights: [],
    investigations: [],
    protections: []
  };

  emitActivity(args, "moderator", { message: "사회자가 새 판을 준비 중" });
  emitEvent(args, "phase", { message: "게임 시작", topic, players: players.map(publicPlayer) });
  emitEvent(args, "roles", {
    reveal: revealRoles,
    roles: players.map((player) => ({
      ...publicPlayer(player),
      role: revealRoles ? game.roles[player.id] : "hidden"
    }))
  });

  await appendPublicLog(config, [
    "",
    `## Mafia Session: ${nowStamp()}`,
    `Topic: ${topic}`,
    `Players: ${players.map((player) => player.displayName).join(", ")}`,
    ""
  ]);

  for (let day = 1; day <= maxDays; day += 1) {
    emitActivity(args, "moderator", { day, phase: "day", message: `사회자가 Day ${day} 낮 토론을 여는 중` });
    emitEvent(args, "phase", { day, phase: "day", message: `Day ${day} 낮 토론 시작` });

    for (let round = 1; round <= dayRounds; round += 1) {
      for (const player of livingPlayers(game)) {
        const prompt = buildSpeechPrompt({
          config,
          game,
          player,
          day,
          phase: "day",
          instruction: `낮 토론 ${round}라운드다. 이전 공개 기록에서 단서 하나를 잡아 누가 수상한지 말해라.`
        });
        const speech = await runTurn({ args, config, game, player, prompt, phase: "day", day });
        const turn = publicTurn(game, player, day, "day", speech, revealRoles);
        game.turns.push(turn);
        addTurnRecord(game, turn);
        emitEvent(args, "turn", turn);
        await appendPublicLog(config, [`### Day ${day} - ${player.displayName}`, "", speech, ""]);
      }
    }

    if (interruptEnabled && livingPlayers(game).length > 3 && Math.random() < interruptChance) {
      const speaker = chooseInterruptSpeaker(game);
      emitEvent(args, "interrupt", {
        day,
        playerId: speaker.id,
        displayName: speaker.displayName,
        color: speaker.color,
        message: `사회자가 ${speaker.displayName}에게 긴급 발언권을 줬습니다.`
      });
      const prompt = buildSpeechPrompt({
        config,
        game,
        player: speaker,
        day,
        phase: "interrupt",
        instruction: "돌발 발언권이다. 지금 꼭 끼어들어야 하는 이유를 말하고, 한 사람을 강하게 의심하거나 너를 향한 의심을 반박해라."
      });
      const speech = await runTurn({ args, config, game, player: speaker, prompt, phase: "interrupt", day });
      const turn = publicTurn(game, speaker, day, "interrupt", speech, revealRoles);
      game.turns.push(turn);
      addTurnRecord(game, turn);
      emitEvent(args, "turn", turn);
    }

    emitActivity(args, "voting", { day, phase: "vote", message: `사회자가 Day ${day} 투표를 받는 중` });
    emitEvent(args, "phase", { day, phase: "vote", message: `Day ${day} 투표 시작` });
    const voteResult = await runVotes({ args, config, game, day });
    if (day === 1 && !game.firstDayExecution) {
      voteResult.pressureOnly = true;
      voteResult.topSuspectId = voteResult.executedId;
      voteResult.topSuspectName = voteResult.executedName;
      voteResult.topSuspectColor = voteResult.executedColor;
      voteResult.executedId = null;
      voteResult.executedName = null;
      voteResult.executedColor = null;
    }
    if (game.votes.length > 0) {
      game.votes[game.votes.length - 1] = { day, votes: voteResult.votes, executedId: voteResult.executedId, topSuspectId: voteResult.topSuspectId };
    }
    emitEvent(args, "vote", voteResult);
    addVoteRecord(game, voteResult);

    if (voteResult.executedId) {
      game.alive.delete(voteResult.executedId);
      const executed = safePlayer(game, voteResult.executedId);
      const role = game.roles[voteResult.executedId];
      emitEvent(args, "execution", {
        day,
        playerId: voteResult.executedId,
        displayName: executed?.displayName || voteResult.executedId,
        color: executed?.color,
        role: revealRoles ? role : "hidden",
        message: `${executed?.displayName || voteResult.executedId} 처형`
      });
      addRecord(game, {
        day,
        phase: "execution",
        text: `${executed?.displayName || voteResult.executedId} 처형${revealRoles ? ` (${roleLabel(role)})` : ""}`
      });
    } else {
      const message = voteResult.pressureOnly
        ? "첫날은 압박 투표만 진행되어 처형 없음"
        : "동률 또는 무효표로 처형 없음";
      emitEvent(args, "execution", { day, message });
      addRecord(game, { day, phase: "execution", text: message });
    }

    const dayWinner = checkWinner(game);
    if (dayWinner) {
      await concludeGame({ args, config, game, winner: dayWinner, revealRoles, day });
      return;
    }

    emitActivity(args, "moderator", { day, phase: "night", message: `사회자가 Night ${day} 밤 행동을 안내 중` });
    emitEvent(args, "phase", { day, phase: "night", message: `Night ${day} 밤 행동 시작` });
    const nightResult = await runNight({ args, config, game, day, revealRoles });
    emitEvent(args, "night", nightResult);
    addNightRecord(game, nightResult, revealRoles);

    const nightWinner = checkWinner(game);
    if (nightWinner) {
      await concludeGame({ args, config, game, winner: nightWinner, revealRoles, day });
      return;
    }
  }

  await concludeGame({
    args,
    config,
    game,
    revealRoles,
    day: maxDays,
    winner: { winner: "timeout", message: `${maxDays}일이 지나도 결판이 나지 않았습니다.` }
  });
}

function publicPlayer(player) {
  return {
    id: player.id,
    displayName: player.displayName,
    provider: player.provider,
    personality: player.personality,
    model: player.model || "",
    color: player.color || "#aeb7c0"
  };
}

function publicTurn(game, player, day, phase, speech, revealRole = true) {
  return {
    day,
    phase,
    playerId: player.id,
    displayName: player.displayName,
    provider: player.provider,
    model: player.model || "",
    personality: player.personality,
    color: player.color || "#aeb7c0",
    role: revealRole ? game.roles[player.id] : "hidden",
    speech: stripSpeakerPrefix(speech, player.displayName)
  };
}

function chooseInterruptSpeaker(game) {
  const alive = livingPlayers(game);
  const lastSpeaker = game.turns.at(-1)?.playerId;
  const candidates = alive.filter((player) => player.id !== lastSpeaker);
  return candidates[Math.floor(Math.random() * candidates.length)] || alive[0];
}

async function runVotes({ args, config, game, day }) {
  const votes = [];
  for (const player of livingPlayers(game)) {
    const action = await requestJsonAction({ args, config, game, player, day, kind: "vote" });
    const target = safePlayer(game, action.vote);
    if (target && game.alive.has(target.id) && target.id !== player.id) {
      votes.push({
        voterId: player.id,
        voterName: player.displayName,
        voterColor: player.color,
        targetId: target.id,
        targetName: target.displayName,
        targetColor: target.color,
        reason: action.reason || "이유 없음"
      });
    }
  }

  const counts = new Map();
  for (const vote of votes) counts.set(vote.targetId, (counts.get(vote.targetId) || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const tied = sorted.length > 1 && sorted[1][1] === top?.[1];
  const executedId = top && !tied ? top[0] : null;
  game.votes.push({ day, votes, executedId });

  return {
    day,
    votes,
    executedId,
    executedName: executedId ? safePlayer(game, executedId)?.displayName : null,
    executedColor: executedId ? safePlayer(game, executedId)?.color : null
  };
}

async function runMafiaDiscussion({ args, config, game, day, revealRoles }) {
  const mafia = livingPlayers(game).filter((player) => game.roles[player.id] === "mafia");
  if (mafia.length === 0) return [];

  emitActivity(args, "moderator", { day, phase: "mafiaChat", message: `사회자가 Night ${day} 마피아 회의를 여는 중` });
  emitEvent(args, "phase", { day, phase: "mafiaChat", message: `Night ${day} 마피아 회의` });
  const turns = [];

  for (const player of mafia) {
    const prompt = buildSpeechPrompt({
      config,
      game,
      player,
      day,
      phase: "mafiaChat",
      instruction: "밤 마피아 회의다. 제거 후보 한 명을 제안하고, 공개 발언에서 나온 근거를 붙여라. 동료에게 확인 질문을 던져도 좋다."
    });
    const speech = await runTurn({ args, config, game, player, prompt, phase: "mafiaChat", day });
    const turn = publicTurn(game, player, day, "mafiaChat", speech, revealRoles);
    game.turns.push(turn);
    addTurnRecord(game, turn, "mafia");
    turns.push(turn);
    emitEvent(args, "turn", turn);
  }

  if (mafia.length > 1) {
    const asker = mafia.at(-1);
    const responder = mafia.find((player) => player.id !== asker.id) || mafia[0];

    const askPrompt = buildSpeechPrompt({
      config,
      game,
      player: asker,
      day,
      phase: "mafiaChat",
      instruction: `마피아 회의 확인 질문이다. ${responder.displayName}에게 "이 선택이 맞냐"는 식으로 마지막 확인을 짧게 던져라.`
    });
    const askSpeech = await runTurn({ args, config, game, player: asker, prompt: askPrompt, phase: "mafiaChat", day });
    const askTurn = publicTurn(game, asker, day, "mafiaChat", askSpeech, revealRoles);
    game.turns.push(askTurn);
    addTurnRecord(game, askTurn, "mafia");
    turns.push(askTurn);
    emitEvent(args, "turn", askTurn);

    const answerPrompt = buildSpeechPrompt({
      config,
      game,
      player: responder,
      day,
      phase: "mafiaChat",
      instruction: `${asker.displayName}의 확인 질문에 답해라. 동의하거나 반대하면서 최종 제거 후보를 하나로 좁혀라.`
    });
    const answerSpeech = await runTurn({ args, config, game, player: responder, prompt: answerPrompt, phase: "mafiaChat", day });
    const answerTurn = publicTurn(game, responder, day, "mafiaChat", answerSpeech, revealRoles);
    game.turns.push(answerTurn);
    addTurnRecord(game, answerTurn, "mafia");
    turns.push(answerTurn);
    emitEvent(args, "turn", answerTurn);
  }

  return turns;
}

async function runNight({ args, config, game, day, revealRoles }) {
  const mafia = livingPlayers(game).filter((player) => game.roles[player.id] === "mafia");
  const police = livingPlayers(game).filter((player) => game.roles[player.id] === "police");
  const doctors = livingPlayers(game).filter((player) => game.roles[player.id] === "doctor");

  await runMafiaDiscussion({ args, config, game, day, revealRoles });

  const killVotes = [];
  for (const player of mafia) {
    const action = await requestJsonAction({ args, config, game, player, day, kind: "kill" });
    const target = safePlayer(game, action.target);
    if (target && game.alive.has(target.id) && game.roles[target.id] !== "mafia") {
      const item = {
        day,
        actorId: player.id,
        actorName: player.displayName,
        actorColor: player.color,
        targetId: target.id,
        targetName: target.displayName,
        targetColor: target.color,
        reason: action.reason || "이유 없음"
      };
      killVotes.push(item);
      emitEvent(args, "mafia-action", item);
    }
  }

  const investigations = [];
  for (const player of police) {
    const action = await requestJsonAction({ args, config, game, player, day, kind: "investigate" });
    const target = safePlayer(game, action.target);
    if (target && game.alive.has(target.id)) {
      const isMafia = game.roles[target.id] === "mafia";
      const item = {
        day,
        actorId: player.id,
        actorName: player.displayName,
        actorColor: player.color,
        targetId: target.id,
        targetName: target.displayName,
        targetColor: target.color,
        result: isMafia ? "마피아" : "마피아 아님",
        isMafia,
        reason: action.reason || "이유 없음"
      };
      investigations.push(item);
      game.investigations.push(item);
      emitEvent(args, "police-action", item);
    }
  }

  let protectedId = null;
  let protection = null;
  for (const player of doctors) {
    const action = await requestJsonAction({ args, config, game, player, day, kind: "protect" });
    const target = safePlayer(game, action.target);
    if (target && game.alive.has(target.id)) {
      protectedId = target.id;
      protection = {
        day,
        actorId: player.id,
        actorName: player.displayName,
        actorColor: player.color,
        targetId: target.id,
        targetName: target.displayName,
        targetColor: target.color,
        reason: action.reason || "이유 없음"
      };
      game.protections.push(protection);
      emitEvent(args, "doctor-action", protection);
    }
  }

  const targetId = majorityTarget(killVotes.map((vote) => vote.targetId));
  const selectedTarget = targetId ? safePlayer(game, targetId) : null;
  const killed = targetId && targetId !== protectedId ? selectedTarget : null;
  if (protection) {
    protection.success = Boolean(targetId && targetId === protectedId);
  }
  if (killed) game.alive.delete(killed.id);

  const result = {
    day,
    mafiaChoices: killVotes,
    investigations,
    protection,
    selectedTargetId: selectedTarget?.id || null,
    selectedTargetName: selectedTarget?.displayName || null,
    selectedTargetColor: selectedTarget?.color || null,
    killedId: killed?.id || null,
    killedName: killed?.displayName || null,
    killedColor: killed?.color || null,
    protected: Boolean(targetId && targetId === protectedId),
    killedRole: killed && revealRoles ? game.roles[killed.id] : "hidden"
  };
  game.nights.push(result);
  return result;
}

function majorityTarget(ids) {
  if (ids.length === 0) return null;
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function concludeGame({ args, config, game, winner, revealRoles, day }) {
  const winners = winnerPlayers(game, winner.winner);
  emitActivity(args, "moderator", { day, phase: "victory", message: "사회자가 승리자 인터뷰를 진행 중" });
  emitEvent(args, "phase", {
    day,
    phase: "victory",
    message: `승리 진영 인터뷰: ${winner.message}`
  });

  for (const player of winners) {
    const prompt = buildSpeechPrompt({
      config,
      game,
      player,
      day,
      phase: "victory",
      instruction: "게임이 끝났다. 승리자 소감과 약간의 꺼드럭거림을 짧게 말해라. 네가 어떻게 이겼는지, 누가 속았는지 한 번 찔러도 좋다."
    });
    const speech = await runTurn({ args, config, game, player, prompt, phase: "victory", day });
    emitEvent(args, "victory-speech", publicTurn(game, player, day, "victory", speech, revealRoles));
  }

  emitEvent(args, "game-over", winner);
  emitActivity(args, "done", { day, phase: "done", message: "게임 종료" });
}

function winnerPlayers(game, winner) {
  const alive = livingPlayers(game);
  if (winner === "mafia") return alive.filter((player) => game.roles[player.id] === "mafia");
  if (winner === "citizen") return alive.filter((player) => game.roles[player.id] !== "mafia");
  return alive;
}

async function runCheck() {
  const config = await loadConfig();
  await ensureProjectDirs(config);

  console.log("AI Mafia Arena check");
  console.log(`root: ${ROOT_DIR}`);
  console.log(`public log: ${rootPath(config.game.publicLogPath)}`);
  console.log("");
  console.log("players:");
  for (const player of config.players) {
    const state = player.enabled ? "enabled" : "disabled";
    console.log(`- ${player.displayName} / ${player.id} (${player.provider}) ${state} -> ${rootPath(player.workdir)}`);
  }

  if (config.providers.codex) {
    console.log("");
    console.log("codex login status:");
    const status = await runProcess({
      command: config.providers.codex.command,
      args: ["login", "status"],
      cwd: ROOT_DIR,
      stdin: "",
      timeoutMs: 10000
    });
    console.log(status.stdout.trim() || status.stderr.trim() || `(exit ${status.code})`);
  }
}

async function runSmoke(args) {
  const config = await loadConfig();
  await ensureProjectDirs(config);

  const player = getPlayer(config, args.player || "gpt_1");
  const prompt = [
    "# Connection smoke test",
    `너는 ${player.displayName}이다.`,
    `성격: ${player.personality}`,
    "한국어로 한 문장만 말하고 마지막 줄에는 <<<END>>>만 출력해."
  ].join("\n");

  await writeFile(path.join(rootPath(player.workdir), "input.md"), prompt, "utf8");
  const result = await invokePlayer({ config, player, prompt, dryRun: args.dryRun });
  const speechInfo = extractSpeech(result.raw, config);
  await writePrivateTurnLog({ config, player, prompt, result, speechInfo, phase: "smoke", round: 1 });

  const status = result.exitCode === 0 && speechInfo.ended ? "ok" : `failed (exit ${result.exitCode}, end token ${speechInfo.ended ? "ok" : "missing"})`;
  console.log(`${player.id}: ${status}`);
  console.log(speechInfo.speech);

  if (result.exitCode !== 0 || !speechInfo.ended) process.exitCode = 1;
}

async function runDebate(args) {
  const config = await loadConfig();
  const loadedSession = await loadSessionFile(args);
  const session = loadedSession.request || loadedSession;
  await ensureProjectDirs(config);

  const players = getEnabledPlayers(config, args.players, session);
  const moderator = normalizeSessionModerator(config, session.moderator || {});
  const topic = session.topic || args.topic || "사용자가 입력한 사안에 대해 여러 관점으로 토론하고 실행 가능한 결론을 도출하라.";
  const rounds = Number.parseInt(session.rounds || args.rounds || config.game.rounds || 1, 10);
  const game = {
    config,
    mode: "debate",
    topic,
    rounds,
    moderator,
    players,
    roles: Object.fromEntries(players.map((player) => [player.id, "citizen"])),
    alive: new Set(players.map((player) => player.id)),
    turns: [],
    records: [],
    votes: [],
    nights: [],
    investigations: [],
    protections: []
  };

  emitEvent(args, "phase", {
    message: "토론 시작",
    topic,
    players: players.map(publicPlayer),
    moderator: publicPlayer(moderator)
  });
  for (let round = 1; round <= rounds; round += 1) {
    for (const player of players) {
      const prompt = buildSpeechPrompt({
        config,
        game,
        player,
        day: round,
        phase: "debate",
        instruction: round >= rounds
          ? "역할 없는 일반토론 모드의 마지막 라운드다. 이전 발언에서 최종 후보 하나를 고르고, 실행안과 리스크를 정리해라."
          : "역할 없는 일반토론 모드다. 이전 발언에서 쟁점 하나를 잡고 짧게 반박, 보완, 실행안 제안 중 하나를 해라."
      });
      const speech = await runTurn({ args, config, game, player, prompt, phase: "debate", day: round });
      const turn = publicTurn(game, player, round, "debate", speech, true);
      game.turns.push(turn);
      addTurnRecord(game, turn);
      emitEvent(args, "turn", turn);
    }
    const note = stripSpeakerPrefix(
      await runDebateModerator({ args, config, game, moderator, round, rounds, topic }),
      moderator.displayName
    );
    addRecord(game, {
      day: round,
      phase: "moderator",
      text: `${moderator.displayName}: ${note}`
    });
    emitEvent(args, "moderator-note", {
      day: round,
      phase: "moderator",
      final: round >= rounds,
      displayName: moderator.displayName,
      provider: moderator.provider,
      model: moderator.model || "",
      color: moderator.color || "#e4b84a",
      message: note
    });
  }
}

async function runFollowUp(args) {
  const config = await loadConfig();
  const archive = await loadSessionFile(args);
  await ensureProjectDirs(config);

  const source = archive.request || archive;
  const players = getEnabledPlayers(config, args.players, source);
  const playerId = args.player || args.playerId;
  const player = players.find((entry) => entry.id === playerId) || normalizeSessionPlayer(config, { id: playerId }, players.length);
  if (!player?.id) throw new Error("추가 의견을 들을 참가자를 찾지 못했습니다.");

  const role = roleForPlayerFromEvents(archive.events || [], player.id);
  const prompt = buildFollowUpPrompt({
    config,
    archive: {
      ...archive,
      mode: archive.mode || args.mode || "debate",
      request: source
    },
    player,
    role,
    question: args.question
  });

  await writeFile(path.join(rootPath(player.workdir), "input.md"), prompt, "utf8");
  const result = await invokePlayer({ config, player, prompt, dryRun: args.dryRun || source.dryRun });
  const speechInfo = extractSpeech(result.raw, config);
  await writePrivateTurnLog({ config, player, prompt, result, speechInfo, phase: "follow-up", round: 1 });

  emitEvent(args, "follow-up", {
    sessionId: archive.id || "",
    mode: archive.mode || args.mode || "debate",
    topic: archive.topic || source.topic || "",
    phase: "followUp",
    day: "",
    playerId: player.id,
    displayName: player.displayName,
    provider: player.provider,
    model: player.model || "",
    personality: player.personality || "",
    color: player.color || "#aeb7c0",
    role: role || "hidden",
    question: args.question || "",
    speech: stripSpeakerPrefix(speechInfo.speech, player.displayName)
  });

  if (result.exitCode !== 0 || !speechInfo.ended) process.exitCode = 1;
}

function printHelp() {
  console.log(`AI Mafia Arena

Usage:
  node controller/main.mjs check
  node controller/main.mjs smoke [--dry-run] [--player gpt_1]
  node controller/main.mjs debate [--dry-run] [--players gpt_1,gpt_2] [--topic "..."] [--rounds 1]
  node controller/main.mjs mafia [--dry-run] [--session-file logs/sessions/example.json]
  node controller/main.mjs followup [--session-file logs/sessions/example.json] [--player gpt_1]
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "check") return runCheck();
  if (args.command === "smoke") return runSmoke(args);
  if (args.command === "debate") return runDebate(args);
  if (args.command === "mafia") return runMafia(args);
  if (args.command === "followup") return runFollowUp(args);
  printHelp();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
