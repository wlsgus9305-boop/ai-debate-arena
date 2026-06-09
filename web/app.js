const state = {
  players: [],
  providers: {},
  providerStatus: {},
  playerById: new Map(),
  roleById: new Map(),
  lifeById: new Map(),
  recommendedRoles: { mafia: 2, police: 1, doctor: 1 },
  running: false,
  customIndex: 0,
  namePool: ["나래", "시우", "다온", "로아", "태오", "은서", "현우", "소율", "준호", "채원"],
  colorPool: ["#f97316", "#22c55e", "#e879f9", "#60a5fa", "#facc15", "#2dd4bf", "#c084fc", "#fb7185"]
};

const els = {
  statusText: document.querySelector("#statusText"),
  connectionStatus: document.querySelector("#connectionStatus"),
  modeSelect: document.querySelector("#modeSelect"),
  topic: document.querySelector("#topic"),
  maxDays: document.querySelector("#maxDays"),
  dayRounds: document.querySelector("#dayRounds"),
  mafiaCount: document.querySelector("#mafiaCount"),
  policeCount: document.querySelector("#policeCount"),
  doctorCount: document.querySelector("#doctorCount"),
  applyRecommendBtn: document.querySelector("#applyRecommendBtn"),
  recommendText: document.querySelector("#recommendText"),
  checkProvidersBtn: document.querySelector("#checkProvidersBtn"),
  providerStatusList: document.querySelector("#providerStatusList"),
  interruptEnabled: document.querySelector("#interruptEnabled"),
  spectatorRevealRoles: document.querySelector("#spectatorRevealRoles"),
  dryRun: document.querySelector("#dryRun"),
  players: document.querySelector("#players"),
  addPlayerBtn: document.querySelector("#addPlayerBtn"),
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  timeline: document.querySelector("#timeline"),
  roleBoard: document.querySelector("#roleBoard"),
  sessionMeta: document.querySelector("#sessionMeta"),
  activityPanel: document.querySelector("#activityPanel"),
  activityTitle: document.querySelector("#activityTitle"),
  activityDetail: document.querySelector("#activityDetail"),
  aliveList: document.querySelector("#aliveList"),
  deadList: document.querySelector("#deadList")
};

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function setRunning(running) {
  state.running = running;
  els.startBtn.disabled = running;
  els.stopBtn.disabled = !running;
  els.statusText.textContent = running ? "게임 진행 중" : "대기 중";
}

function resetBoard() {
  state.roleById = new Map();
  state.lifeById = new Map();
  els.timeline.innerHTML = "";
  els.roleBoard.innerHTML = "";
  setActivity({ state: "idle", message: "새 게임을 기다리는 중" });
  renderLifeBoard();
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

function phaseLabel(phase) {
  return {
    day: "낮 토론",
    interrupt: "돌발",
    mafiaChat: "마피아 회의",
    victory: "승리 소감",
    debate: "토론"
  }[phase] || phase || "발언";
}

function roleClass(role) {
  return `role-${role || "hidden"}`;
}

function roleColor(role, fallback = "#aeb7c0") {
  return {
    mafia: "#ff8b8b",
    police: "#8bbcff",
    doctor: "#86efac",
    citizen: "#f8fafc",
    hidden: fallback
  }[role] || fallback;
}

function providerColor(provider) {
  return state.providers[provider]?.color || "#aeb7c0";
}

function providerIds() {
  const ids = Object.keys(state.providers);
  return ids.length > 0 ? ids : ["codex", "claude", "gemini"];
}

function normalizeProvider(provider) {
  return providerIds().includes(provider) ? provider : providerIds()[0];
}

function playerColor(idOrPlayer) {
  if (typeof idOrPlayer === "object" && idOrPlayer) return idOrPlayer.color || "#aeb7c0";
  return state.playerById.get(idOrPlayer)?.color || "#aeb7c0";
}

function selectedPlayerCards() {
  return [...els.players.querySelectorAll(".player-card")]
    .filter((card) => card.querySelector(".player-enabled").checked);
}

function selectedPlayerCount() {
  return selectedPlayerCards().length;
}

function renderPlayers() {
  els.players.innerHTML = "";
  for (const player of state.players) {
    const providerId = normalizeProvider(player.provider);
    const provider = state.providers[providerId] || {};
    const card = document.createElement("article");
    card.className = `player-card ${providerId}`;
    card.dataset.id = player.id;
    card.dataset.custom = player.id.startsWith("custom_") ? "true" : "false";
    card.style.setProperty("--provider-color", providerColor(providerId));
    card.style.setProperty("--player-color", player.color || "#aeb7c0");
    card.innerHTML = `
      <div class="player-top">
        <label class="player-check">
          <input class="player-enabled" type="checkbox" ${player.enabled ? "checked" : ""}>
          <span class="player-dot"></span>
        </label>
        <select class="player-provider" aria-label="LLM">
          ${buildProviderOptions(providerId)}
        </select>
        <input class="player-name" value="${escapeAttr(player.displayName)}" aria-label="이름">
        ${card.dataset.custom === "true" ? `<button class="remove-player" type="button">삭제</button>` : ""}
      </div>
      <textarea class="player-personality" rows="2" aria-label="성격">${escapeHtml(player.personality || "")}</textarea>
      <div class="model-row">
        <select class="player-model" aria-label="모델">
          ${buildModelOptions(providerId, player.model || "")}
        </select>
        <input class="player-model-custom" value="" placeholder="model id">
      </div>
    `;
    els.players.append(card);
  }
  bindPlayerInputs();
  updateRecommendation();
}

function renderProviderStatus() {
  const ids = providerIds();
  els.providerStatusList.innerHTML = ids.map((id) => {
    const provider = state.providers[id] || {};
    const status = state.providerStatus[id] || { status: "unknown", message: "아직 확인 안 함" };
    const connected = status.status === "ok";
    return `
      <div class="provider-status ${statusClass(status.status)}">
        <span class="status-light"></span>
        <strong>${escapeHtml(id)}</strong>
        <small>${escapeHtml(status.message || provider.note || "")}</small>
        <div class="provider-actions">
          <span>${connected ? "연결됨" : status.status === "checking" ? "확인 중" : "미연결"}</span>
          <button class="connect-provider" type="button" data-provider="${escapeAttr(id)}">로그인</button>
        </div>
      </div>
    `;
  }).join("");
  bindProviderButtons();
}

function statusClass(value) {
  return {
    ok: "status-ok",
    checking: "status-checking",
    warning: "status-warning",
    error: "status-error",
    unknown: "status-unknown"
  }[value] || "status-unknown";
}

async function checkProviders() {
  state.providerStatus = Object.fromEntries(providerIds().map((id) => [id, { status: "checking", message: "확인 중" }]));
  renderProviderStatus();
  try {
    const response = await fetch("/api/provider-status");
    const payload = await response.json();
    state.providerStatus = payload.providers || {};
  } catch (error) {
    state.providerStatus = Object.fromEntries(providerIds().map((id) => [id, { status: "error", message: error.message || "확인 실패" }]));
  }
  renderProviderStatus();
}

async function refreshProviderStatuses() {
  const response = await fetch("/api/provider-status");
  const payload = await response.json();
  state.providerStatus = payload.providers || {};
  renderProviderStatus();
  return state.providerStatus;
}

function bindProviderButtons() {
  for (const button of els.providerStatusList.querySelectorAll(".connect-provider")) {
    button.addEventListener("click", () => connectProvider(button.dataset.provider));
  }
}

async function connectProvider(provider) {
  state.providerStatus[provider] = { status: "checking", message: "연결 창 여는 중" };
  renderProviderStatus();
  try {
    const response = await fetch("/api/provider-connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider })
    });
    const payload = await response.json();
    state.providerStatus[provider] = {
      status: response.ok ? "warning" : "error",
      message: response.ok ? "로그인 창을 열었습니다. 완료되면 자동으로 연결됨으로 바뀝니다." : payload.error || "로그인 창 열기 실패"
    };
  } catch (error) {
    state.providerStatus[provider] = { status: "error", message: error.message || "로그인 창 열기 실패" };
  }
  renderProviderStatus();
  pollProviderUntilConnected(provider);
}

async function pollProviderUntilConnected(provider) {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statuses = await refreshProviderStatuses();
    if (statuses[provider]?.status === "ok") return;
  }
}

function bindPlayerInputs() {
  for (const input of els.players.querySelectorAll(".player-enabled")) {
    input.addEventListener("change", updateRecommendation);
  }
  for (const select of els.players.querySelectorAll(".player-provider")) {
    select.addEventListener("change", () => {
      const card = select.closest(".player-card");
      const provider = normalizeProvider(select.value);
      card.className = `player-card ${provider}`;
      card.style.setProperty("--provider-color", providerColor(provider));
      card.querySelector(".player-model").innerHTML = buildModelOptions(provider, "");
      syncPlayerMapFromCards();
      updateRecommendation();
    });
  }
  for (const button of els.players.querySelectorAll(".remove-player")) {
    button.addEventListener("click", () => {
      button.closest(".player-card").remove();
      state.players = collectAllPlayers();
      state.playerById = new Map(state.players.map((player) => [player.id, player]));
      updateRecommendation();
    });
  }
}

function buildProviderOptions(selected) {
  return providerIds().map((provider) => {
    return `<option value="${escapeAttr(provider)}" ${provider === selected ? "selected" : ""}>${provider}</option>`;
  }).join("");
}

function buildModelOptions(provider, selected) {
  const presets = state.providers[provider]?.modelPresets || [""];
  return [
    ...presets.map((preset) => `<option value="${escapeAttr(preset)}" ${preset === selected ? "selected" : ""}>${preset || "기본 모델"}</option>`),
    `<option value="__custom">직접 입력</option>`
  ].join("");
}

function collectAllPlayers() {
  return [...els.players.querySelectorAll(".player-card")].map(cardToPlayer);
}

function syncPlayerMapFromCards() {
  for (const player of collectAllPlayers()) {
    state.playerById.set(player.id, player);
  }
}

async function updateRecommendation() {
  const count = Math.max(1, selectedPlayerCount());
  try {
    const response = await fetch(`/api/recommend-roles?players=${count}`);
    state.recommendedRoles = await response.json();
  } catch {
    state.recommendedRoles = recommendRoles(count);
  }
  els.recommendText.textContent = `${count}명 추천: 마피아 ${state.recommendedRoles.mafia}, 경찰 ${state.recommendedRoles.police}, 의사 ${state.recommendedRoles.doctor}`;
}

function recommendRoles(playerCount) {
  if (playerCount <= 4) return { mafia: 1, police: 1, doctor: 0 };
  if (playerCount <= 6) return { mafia: 1, police: 1, doctor: 1 };
  if (playerCount <= 8) return { mafia: 2, police: 1, doctor: 1 };
  if (playerCount <= 11) return { mafia: 3, police: 1, doctor: 1 };
  return { mafia: Math.max(3, Math.floor(playerCount / 3)), police: 1, doctor: 2 };
}

function applyRecommendedRoles() {
  els.mafiaCount.value = state.recommendedRoles.mafia;
  els.policeCount.value = state.recommendedRoles.police;
  els.doctorCount.value = state.recommendedRoles.doctor;
}

function collectPlayers() {
  const players = selectedPlayerCards().map(cardToPlayer);
  for (const player of players) state.playerById.set(player.id, player);
  return players;
}

function cardToPlayer(card) {
  const modelSelect = card.querySelector(".player-model");
  const custom = card.querySelector(".player-model-custom").value.trim();
  const selected = modelSelect.value === "__custom" ? custom : modelSelect.value;
  const base = state.playerById.get(card.dataset.id) || {};
  const provider = normalizeProvider(card.querySelector(".player-provider").value);
  return {
    id: card.dataset.id,
    displayName: card.querySelector(".player-name").value.trim(),
    provider,
    enabled: card.querySelector(".player-enabled").checked,
    personality: card.querySelector(".player-personality").value.trim(),
    model: selected,
    color: base.color || "#aeb7c0",
    workdir: base.workdir || `agents/${card.dataset.id}`
  };
}

function addPlayer() {
  state.players = collectAllPlayers();
  state.playerById = new Map(state.players.map((player) => [player.id, player]));

  state.customIndex += 1;
  const id = `custom_${Date.now()}_${state.customIndex}`;
  const usedNames = new Set(state.players.map((player) => player.displayName));
  const displayName = state.namePool.find((name) => !usedNames.has(name)) || `참가자${state.customIndex}`;
  const provider = normalizeProvider("codex");
  const player = {
    id,
    displayName,
    provider,
    enabled: true,
    workdir: `agents/${id}`,
    model: "",
    color: state.colorPool[(state.players.length + state.customIndex) % state.colorPool.length],
    personality: "새로 합류한 AI. 판을 읽으면서도 자기 정체를 잘 숨긴다."
  };

  state.players.push(player);
  state.playerById.set(id, player);
  renderPlayers();
}

function appendEvent(event) {
  if (event.type === "reset") {
    resetBoard();
    return;
  }

  if (event.type === "activity") {
    setActivity(event);
    return;
  }

  if (event.type === "status" && event.session?.players) {
    if (event.session.mode) els.modeSelect.value = event.session.mode;
    seedLifeFromSession(event.session.players);
  }

  if (event.type === "roles") {
    renderRoleBoard(event.roles || []);
    return;
  }

  updateLifeFromEvent(event);

  const item = document.createElement("article");
  item.className = `event ${event.type || "log"} ${event.provider || ""}`;
  const color = event.color || event.actorColor || event.playerColor || playerColor(event.playerId);
  item.style.setProperty("--player-color", color || "#aeb7c0");
  if (event.provider) item.style.setProperty("--provider-color", providerColor(event.provider));

  if (event.type === "turn" || event.type === "victory-speech") {
    item.innerHTML = renderTurn(event);
  } else if (event.type === "vote") {
    item.innerHTML = renderVoteEvent(event);
  } else if (event.type === "mafia-action") {
    item.innerHTML = renderActionEvent("마피아 선택", event, `${event.actorName} → ${event.targetName}`, event.reason);
  } else if (event.type === "police-action") {
    item.innerHTML = renderActionEvent("경찰 조사", event, `${event.actorName} → ${event.targetName}: ${event.result}`, event.reason);
  } else if (event.type === "doctor-action") {
    item.innerHTML = renderActionEvent("의사 보호", event, `${event.actorName} → ${event.targetName}`, event.reason);
  } else if (event.type === "night") {
    item.innerHTML = renderNightEvent(event);
  } else if (event.type === "execution") {
    item.innerHTML = renderSimpleEvent(event, `처형 · Day ${event.day || ""}`, `${event.message || "처형 없음"}${event.role ? ` · ${roleLabel(event.role)}` : ""}`);
  } else if (event.type === "interrupt") {
    item.innerHTML = renderSimpleEvent(event, "돌발 발언권", event.message);
  } else if (event.type === "game-over") {
    item.innerHTML = renderSimpleEvent(event, "게임 종료", `${event.message}${event.winner ? ` · 승리: ${event.winner}` : ""}`);
  } else if (event.type === "phase" || event.type === "status" || event.type === "done" || event.type === "log") {
    item.innerHTML = renderSimpleEvent(event, event.type, event.message || (event.code !== undefined ? `exit ${event.code}` : ""));
  } else if (event.type === "runner-error") {
    item.innerHTML = renderSimpleEvent(event, "오류", event.message);
  } else {
    item.innerHTML = renderSimpleEvent(event, event.type || "event", event.message || JSON.stringify(event));
  }

  els.timeline.append(item);
  item.scrollIntoView({ block: "end", behavior: "smooth" });
}

function renderTurn(event) {
  const label = event.type === "victory-speech" ? "승리 소감" : phaseLabel(event.phase);
  const nameColor = roleColor(event.role, event.color || playerColor(event.playerId));
  return `
    <div class="meta">
      <span><span class="speaker" style="--name-color:${escapeAttr(nameColor)}">${escapeHtml(event.displayName)}</span> · ${label} · Day ${event.day}</span>
      <span>${formatTime(event.at)}</span>
    </div>
    <div class="tags">
      <span class="player-name-chip" style="--mention-color:${escapeAttr(nameColor)}">${escapeHtml(event.displayName)}</span>
      <span class="provider ${event.provider}">${event.provider}</span>
      ${event.model ? `<span class="tag">${escapeHtml(event.model)}</span>` : ""}
      <span class="role-chip ${roleClass(event.role)}">${roleLabel(event.role)}</span>
    </div>
    <div class="speech">${renderSpeech(event.speech)}</div>
  `;
}

function renderVoteEvent(event) {
  let summary = event.executedName ? `처형: ${event.executedName}` : "처형 없음";
  if (event.pressureOnly) {
    summary = `첫날 압박 투표: 처형 없음${event.topSuspectName ? ` · 최다 의심 ${event.topSuspectName}` : ""}`;
  }
  const details = (event.votes || []).map((vote) => {
    return `<div class="detail-row"><span>${mention(vote.voterName, vote.voterId, vote.voterColor)}</span><span>→</span><span>${mention(vote.targetName, vote.targetId, vote.targetColor)}</span><small>${escapeHtml(vote.reason)}</small></div>`;
  }).join("");
  return `
    <div class="meta"><span>투표 결과 · Day ${event.day}</span><span>${formatTime(event.at)}</span></div>
    <div class="summary-line">${escapeHtml(summary)}</div>
    <div class="details">${details}</div>
  `;
}

function renderActionEvent(title, event, summary, reason) {
  return `
    <div class="meta"><span>${title} · Night ${event.day}</span><span>${formatTime(event.at)}</span></div>
    <div class="summary-line">${renderSpeech(summary)}</div>
    <div class="details"><small>${escapeHtml(reason || "")}</small></div>
  `;
}

function renderNightEvent(event) {
  let summary = "아무도 죽지 않았습니다.";
  if (event.protected) {
    summary = `의사의 보호로 ${event.selectedTargetName} 제거가 막혔습니다.`;
  } else if (event.killedName) {
    summary = `사망: ${event.killedName}${event.killedRole && event.killedRole !== "hidden" ? ` · ${roleLabel(event.killedRole)}` : ""}`;
  }

  const choices = (event.mafiaChoices || []).map((choice) => {
    return `<div class="detail-row">${mention(choice.actorName, choice.actorId, choice.actorColor)}<span>→</span>${mention(choice.targetName, choice.targetId, choice.targetColor)}<small>${escapeHtml(choice.reason)}</small></div>`;
  }).join("");

  return `
    <div class="meta"><span>밤 결과 · Night ${event.day}</span><span>${formatTime(event.at)}</span></div>
    <div class="summary-line">${renderSpeech(summary)}</div>
    ${choices ? `<div class="details"><strong>마피아 선택</strong>${choices}</div>` : ""}
  `;
}

function renderSimpleEvent(event, title, message) {
  return `
    <div class="meta"><span>${escapeHtml(title)}</span><span>${formatTime(event.at)}</span></div>
    <div class="summary-line">${renderSpeech(message || "")}</div>
  `;
}

function renderRoleBoard(roles) {
  state.roleById = new Map();
  for (const player of roles) {
    state.roleById.set(player.id, player.role);
    state.lifeById.set(player.id, { status: "alive", reason: "생존" });
    const known = state.playerById.get(player.id) || {};
    state.playerById.set(player.id, { ...known, ...player });
  }

  els.roleBoard.innerHTML = roles.map((player) => `
    <article class="role-card ${player.provider}" style="--provider-color:${providerColor(player.provider)};--player-color:${escapeAttr(player.color || playerColor(player.id))}">
      <div>
        <strong class="role-name" style="--name-color:${escapeAttr(roleColor(player.role, player.color || playerColor(player.id)))}"><span class="player-dot"></span>${escapeHtml(player.displayName)}</strong>
        <span class="provider ${player.provider}">${player.provider}</span>
      </div>
      <span class="role-chip ${roleClass(player.role)}">${roleLabel(player.role)}</span>
      <small>${escapeHtml(player.personality || "")}</small>
    </article>
  `).join("");
  renderLifeBoard();
}

function seedLifeFromSession(playerIds) {
  for (const id of playerIds) {
    if (!state.lifeById.has(id)) {
      state.lifeById.set(id, { status: "alive", reason: "참여 중" });
    }
  }
  renderLifeBoard();
}

function updateLifeFromEvent(event) {
  if (event.type === "execution" && event.playerId) {
    state.lifeById.set(event.playerId, { status: "dead", reason: "처형" });
    renderLifeBoard();
  }

  if (event.type === "night" && event.killedId) {
    state.lifeById.set(event.killedId, { status: "dead", reason: "밤 사망" });
    renderLifeBoard();
  }
}

function renderLifeBoard() {
  const players = [...state.playerById.values()].filter((player) => state.lifeById.has(player.id));
  const alive = players.filter((player) => state.lifeById.get(player.id)?.status !== "dead");
  const dead = players.filter((player) => state.lifeById.get(player.id)?.status === "dead");

  els.aliveList.innerHTML = alive.length
    ? alive.map((player) => renderLifeChip(player, "alive")).join("")
    : `<span class="empty-life">게임 시작 전</span>`;
  els.deadList.innerHTML = dead.length
    ? dead.map((player) => renderLifeChip(player, "dead")).join("")
    : `<span class="empty-life">아직 없음</span>`;
}

function renderLifeChip(player, stateName) {
  const life = state.lifeById.get(player.id) || {};
  const role = state.roleById.get(player.id);
  return `
    <span class="life-chip ${stateName}" style="--chip-color:${escapeAttr(roleColor(role, player.color || playerColor(player.id)))}">
      ${escapeHtml(player.displayName)}
      ${role ? `<em>${roleLabel(role)}</em>` : ""}
      ${life.reason && stateName === "dead" ? `<small>${escapeHtml(life.reason)}</small>` : ""}
    </span>
  `;
}

function renderSpeech(value) {
  let output = escapeHtml(value || "");
  const players = [...state.playerById.values()]
    .filter((player) => player.displayName)
    .sort((a, b) => b.displayName.length - a.displayName.length);

  for (const player of players) {
    const name = escapeHtml(player.displayName);
    const role = state.roleById.get(player.id);
    const chip = mention(player.displayName, player.id, player.color, role);
    output = output.replaceAll(name, chip);
  }
  return output;
}

function mention(name, id, color, role = state.roleById.get(id)) {
  return `<span class="mention" style="--mention-color:${escapeAttr(roleColor(role, color || playerColor(id)))}">${escapeHtml(name)}${role ? `<span class="mention-role ${roleClass(role)}">${roleLabel(role)}</span>` : ""}</span>`;
}

function setActivity(event) {
  const current = event || {};
  const color = current.color || playerColor(current.playerId) || "#aeb7c0";
  els.activityPanel.className = `activity-panel activity-${current.state || "idle"}`;
  els.activityPanel.style.setProperty("--activity-color", color);
  els.activityTitle.textContent = activityLabel(current.state);
  els.activityDetail.textContent = current.message || "대기 중";
}

function activityLabel(value) {
  return {
    idle: "대기 중",
    moderator: "사회자 진행 중",
    dispatch: "명령 하달 중",
    thinking: "AI 생각 중",
    received: "응답 수신",
    voting: "투표 받는 중",
    "night-action": "밤 행동 처리 중",
    done: "게임 종료"
  }[value] || "진행 중";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

async function loadState() {
  const response = await fetch("/api/state");
  const payload = await response.json();
  state.players = payload.players;
  state.providers = payload.providers;
  state.recommendedRoles = payload.defaults.recommendedRoles;
  state.providerStatus = Object.fromEntries(Object.keys(payload.providers).map((id) => [id, { status: "unknown", message: "아직 확인 안 함" }]));
  state.playerById = new Map(payload.players.map((player) => [player.id, player]));
  renderPlayers();
  renderProviderStatus();
  applyRecommendedRoles();
  setRunning(payload.session.running);
  els.modeSelect.value = payload.session.mode || payload.defaults.game.mode || "mafia";
  els.maxDays.value = payload.defaults.game.maxDays || 3;
  els.dayRounds.value = payload.defaults.game.dayRounds || 1;
  els.interruptEnabled.checked = Boolean(payload.defaults.game.interrupt?.enabled);
  els.spectatorRevealRoles.checked = Boolean(payload.defaults.game.spectatorRevealRoles);

  if (payload.session.topic) {
    els.sessionMeta.textContent = payload.session.topic;
  }

  resetBoard();
  for (const event of payload.events) {
    appendEvent(event);
  }
}

async function startSession() {
  const players = collectPlayers();
  if (players.length < 4) {
    appendEvent({ type: "runner-error", at: new Date().toISOString(), message: "최소 4명을 선택하세요." });
    return;
  }

  resetBoard();
  const mode = els.modeSelect.value;
  const body = {
    topic: els.topic.value.trim(),
    players,
    rounds: Number.parseInt(els.dayRounds.value, 10),
    maxDays: Number.parseInt(els.maxDays.value, 10),
    dayRounds: Number.parseInt(els.dayRounds.value, 10),
    interruptEnabled: els.interruptEnabled.checked,
    interruptChance: 0.65,
    spectatorRevealRoles: els.spectatorRevealRoles.checked,
    dryRun: els.dryRun.checked
  };

  if (mode === "mafia") {
    body.roles = {
      mafia: Number.parseInt(els.mafiaCount.value, 10),
      police: Number.parseInt(els.policeCount.value, 10),
      doctor: Number.parseInt(els.doctorCount.value, 10)
    };
  }

  const response = await fetch(mode === "debate" ? "/api/debate" : "/api/mafia", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok) {
    appendEvent({ type: "runner-error", at: new Date().toISOString(), message: payload.error || "시작 실패" });
    return;
  }

  setRunning(true);
  els.sessionMeta.textContent = els.topic.value.trim();
}

async function stopGame() {
  await fetch("/api/stop", { method: "POST" });
}

function connectEvents() {
  const source = new EventSource("/events");
  const eventTypes = [
    "reset",
    "status",
    "activity",
    "phase",
    "roles",
    "turn",
    "victory-speech",
    "interrupt",
    "vote",
    "execution",
    "mafia-action",
    "police-action",
    "doctor-action",
    "night",
    "game-over",
    "runner-error",
    "log",
    "done"
  ];

  source.addEventListener("open", () => {
    els.connectionStatus.textContent = "연결됨";
  });

  source.addEventListener("error", () => {
    els.connectionStatus.textContent = "재연결 중";
  });

  for (const type of eventTypes) {
    source.addEventListener(type, (message) => {
      const event = JSON.parse(message.data);
      if (type === "status") setRunning(true);
      if (type === "done") {
        setRunning(false);
        setActivity({ state: "done", message: "게임 종료" });
      }
      appendEvent(event);
    });
  }
}

els.applyRecommendBtn.addEventListener("click", applyRecommendedRoles);
els.checkProvidersBtn.addEventListener("click", checkProviders);
els.addPlayerBtn.addEventListener("click", addPlayer);
els.startBtn.addEventListener("click", startSession);
els.stopBtn.addEventListener("click", stopGame);
els.clearBtn.addEventListener("click", resetBoard);

await loadState();
checkProviders();
connectEvents();
