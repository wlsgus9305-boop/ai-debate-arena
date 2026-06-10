const state = {
  players: [],
  moderator: null,
  providers: {},
  integrations: [],
  history: [],
  providerStatus: {},
  playerById: new Map(),
  roleById: new Map(),
  lifeById: new Map(),
  sessionPlayerIds: [],
  currentMode: "debate",
  currentSessionId: "",
  canAskFollowUp: false,
  followUpLoadingId: "",
  followUpCollapsed: false,
  activePlayerId: "",
  activeActivityState: "",
  draggingPlayerId: "",
  dragDropped: false,
  pointerDrag: null,
  viewingArchive: false,
  liveHasUpdates: false,
  replayingEvents: false,
  autoScroll: true,
  recommendedRoles: { mafia: 2, police: 1, doctor: 1 },
  running: false,
  customIndex: 0,
  namePool: ["알파", "브라보", "찰리", "델타", "에코", "폭스트롯", "루나", "오리온", "제타", "카이", "노바", "세이지"],
  colorPool: ["#f97316", "#22c55e", "#e879f9", "#60a5fa", "#facc15", "#2dd4bf", "#c084fc", "#fb7185"]
};

const els = {
  statusText: document.querySelector("#statusText"),
  connectionStatus: document.querySelector("#connectionStatus"),
  modeSelect: document.querySelector("#modeSelect"),
  mafiaOptions: document.querySelector("#mafiaOptions"),
  templateRow: document.querySelector("#templateRow"),
  topicLabel: document.querySelector("#topicLabel"),
  topic: document.querySelector("#topic"),
  maxDays: document.querySelector("#maxDays"),
  dayRounds: document.querySelector("#dayRounds"),
  mafiaCount: document.querySelector("#mafiaCount"),
  policeCount: document.querySelector("#policeCount"),
  doctorCount: document.querySelector("#doctorCount"),
  applyRecommendBtn: document.querySelector("#applyRecommendBtn"),
  recommendText: document.querySelector("#recommendText"),
  openConnectionsBtn: document.querySelector("#openConnectionsBtn"),
  refreshConnectionsBtn: document.querySelector("#refreshConnectionsBtn"),
  closeConnectionsBtn: document.querySelector("#closeConnectionsBtn"),
  connectionsModal: document.querySelector("#connectionsModal"),
  integrationList: document.querySelector("#integrationList"),
  providerStatusList: document.querySelector("#providerStatusList"),
  interruptEnabled: document.querySelector("#interruptEnabled"),
  spectatorRevealRoles: document.querySelector("#spectatorRevealRoles"),
  dryRun: document.querySelector("#dryRun"),
  players: document.querySelector("#players"),
  addPlayerBtn: document.querySelector("#addPlayerBtn"),
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  returnLiveBtn: document.querySelector("#returnLiveBtn"),
  refreshHistoryBtn: document.querySelector("#refreshHistoryBtn"),
  sessionHistory: document.querySelector("#sessionHistory"),
  followUpPanel: document.querySelector("#followUpPanel"),
  followUpTitle: document.querySelector("#followUpTitle"),
  followUpDescription: document.querySelector("#followUpDescription"),
  toggleFollowUpBtn: document.querySelector("#toggleFollowUpBtn"),
  followUpList: document.querySelector("#followUpList"),
  scrollBottomBtn: document.querySelector("#scrollBottomBtn"),
  timeline: document.querySelector("#timeline"),
  roleBoard: document.querySelector("#roleBoard"),
  insightPanel: document.querySelector("#insightPanel"),
  insightSummary: document.querySelector("#insightSummary"),
  insightAction: document.querySelector("#insightAction"),
  sessionMeta: document.querySelector("#sessionMeta"),
  activityPanel: document.querySelector("#activityPanel"),
  activityTitle: document.querySelector("#activityTitle"),
  activityDetail: document.querySelector("#activityDetail"),
  lifePanel: document.querySelector("#lifePanel"),
  aliveList: document.querySelector("#aliveList"),
  deadList: document.querySelector("#deadList")
};

const topicTemplates = {
  tech: "새로운 기능을 Next.js와 Node.js 중 어디까지 나눠 구현하는 것이 유지보수와 배포에 유리한가?",
  support: "영업팀의 [지원요청] 메일을 Jira 일정으로 자동 등록하고, 팀장 승인과 엔지니어 완료보고까지 연결하려면 어떤 워크플로우가 적절한가?",
  product: "AI 토론 아레나를 마피아 게임 데모에서 업무용 의사결정 도구로 확장하려면 어떤 기능을 먼저 만들어야 하는가?",
  risk: "회사 계정과 개인 계정의 AI CLI 인증이 섞일 때 발생할 수 있는 보안/운영 리스크와 예방책은 무엇인가?"
};

const participantActiveStates = new Set(["dispatch", "thinking", "voting", "night-action", "follow-up"]);

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
  els.statusText.textContent = running
    ? `진행 중${state.viewingArchive ? " · 지난 판 보는 중" : ""}`
    : state.viewingArchive ? "지난 판 보는 중" : "대기 중";
  updateReturnLiveButton();
  renderFollowUpPanel();
}

function updateReturnLiveButton() {
  if (!els.returnLiveBtn) return;
  els.returnLiveBtn.hidden = !state.viewingArchive;
  els.returnLiveBtn.textContent = state.running
    ? state.liveHasUpdates ? "실시간 회의로 돌아가기 *" : "실시간 회의로 돌아가기"
    : "현재 화면으로 돌아가기";
}

function applyModeUi() {
  const mode = els.modeSelect.value;
  const isMafia = mode === "mafia";
  state.currentMode = mode;
  document.body.dataset.mode = mode;
  els.mafiaOptions.hidden = !isMafia;
  els.templateRow.hidden = isMafia;
  els.maxDays.closest(".field").hidden = !isMafia;
  els.dayRounds.closest(".field").querySelector("span").textContent = isMafia ? "낮 발언 라운드" : "토론 라운드";
  els.topicLabel.textContent = isMafia ? "오늘의 판" : "토론 주제";
  els.roleBoard.hidden = !isMafia;
  els.lifePanel.hidden = !isMafia;
  if (isMafia && els.topic.value.trim() === topicTemplates.product) {
    els.topic.value = "서로의 공개 발언만 보고 마피아를 찾아라.";
  }
  renderLifeBoard();
  renderFollowUpPanel();
}

function resetBoard(options = {}) {
  const autoScroll = options.autoScroll ?? true;
  state.roleById = new Map();
  state.lifeById = new Map();
  state.sessionPlayerIds = [];
  state.canAskFollowUp = false;
  state.followUpLoadingId = "";
  state.activePlayerId = "";
  state.activeActivityState = "";
  els.timeline.innerHTML = "";
  state.autoScroll = autoScroll;
  els.roleBoard.innerHTML = "";
  els.insightSummary.textContent = "토론을 시작하면 핵심 흐름이 여기에 정리됩니다.";
  els.insightAction.textContent = "참가자와 주제를 정한 뒤 시작하세요.";
  setActivity({ state: "idle", message: "새 세션을 기다리는 중" });
  renderLifeBoard();
  renderFollowUpPanel();
  updateScrollBottomButton();
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

function providerLabel(provider) {
  return state.providers[provider]?.label || provider;
}

function providerStatus(provider) {
  return state.providerStatus[provider] || { status: "unknown", message: "아직 확인 안 함" };
}

function providerIsConnected(provider) {
  return providerStatus(provider).status === "ok";
}

function providerAccountText(provider, status = providerStatus(provider)) {
  const configured = state.providers[provider]?.account || "";
  const account = status.account || configured;
  if (!account) return "계정 확인 불가";
  return `${status.accountSource === "detected" ? "계정" : "예상 계정"}: ${account}`;
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
  return [...els.players.querySelectorAll(".player-card:not(.moderator-card)")];
}

function selectedPlayerCount() {
  return selectedPlayerCards().length;
}

function renderPlayers() {
  els.players.innerHTML = "";
  if (state.moderator) {
    const moderator = {
      id: "moderator",
      displayName: "회의 진행자",
      provider: normalizeProvider("codex"),
      enabled: true,
      workdir: "agents/moderator",
      model: "",
      color: "#e4b84a",
      personality: "토론의 열기를 살리면서 논점 이탈을 잡고, 라운드 끝마다 선택지와 다음 질문을 좁히는 진행자.",
      ...state.moderator
    };
    const providerId = normalizeProvider(moderator.provider);
    const card = document.createElement("article");
    card.className = `player-card moderator-card ${providerId}`;
    card.dataset.id = moderator.id;
    card.dataset.custom = "false";
    card.dataset.moderator = "true";
    card.dataset.initialEnabled = moderator.enabled ? "true" : "false";
    card.style.setProperty("--provider-color", providerColor(providerId));
    card.style.setProperty("--player-color", moderator.color || "#e4b84a");
    card.innerHTML = `
      <div class="moderator-banner">
        <span>진행자 AI</span>
        <strong>라운드 끝마다 논점을 정리합니다</strong>
      </div>
      <div class="player-top">
        <select class="player-provider" aria-label="진행자 LLM">
          ${buildProviderOptions(providerId)}
        </select>
        <input class="player-name" value="${escapeAttr(moderator.displayName)}" aria-label="진행자 이름">
      </div>
      <textarea class="player-personality" rows="2" aria-label="진행 성격">${escapeHtml(moderator.personality || "")}</textarea>
      <div class="model-row">
        <select class="player-model" aria-label="진행자 모델">
          ${buildModelOptions(providerId, moderator.model || "")}
        </select>
        <input class="player-model-custom" value="" placeholder="model id">
      </div>
      <div class="player-connection-warning" hidden></div>
    `;
    els.players.append(card);
  }
  for (const player of state.players) {
    const providerId = normalizeProvider(player.provider);
    const provider = state.providers[providerId] || {};
    const card = document.createElement("article");
    card.className = `player-card ${providerId}`;
    card.dataset.id = player.id;
    card.dataset.custom = player.id.startsWith("custom_") ? "true" : "false";
    card.dataset.initialEnabled = player.enabled ? "true" : "false";
    card.style.setProperty("--provider-color", providerColor(providerId));
    card.style.setProperty("--player-color", player.color || "#aeb7c0");
    card.innerHTML = `
      <div class="player-top">
        <select class="player-provider" aria-label="LLM">
          ${buildProviderOptions(providerId)}
        </select>
        <input class="player-name" value="${escapeAttr(player.displayName)}" aria-label="이름">
        <button class="remove-player icon-remove-player" type="button" aria-label="${escapeAttr(player.displayName)} 빼기" title="AI 빼기">×</button>
      </div>
      <textarea class="player-personality" rows="2" aria-label="성격">${escapeHtml(player.personality || "")}</textarea>
      <div class="model-row">
        <select class="player-model" aria-label="모델">
          ${buildModelOptions(providerId, player.model || "")}
        </select>
        <input class="player-model-custom" value="" placeholder="model id">
      </div>
      <div class="player-connection-warning" hidden></div>
    `;
    els.players.append(card);
  }
  bindPlayerInputs();
  applyProviderAvailability();
  updateRecommendation();
}

function renderProviderStatus() {
  const ids = providerIds();
  if (!els.providerStatusList) {
    renderIntegrationList();
    return;
  }
  els.providerStatusList.innerHTML = ids.map((id) => {
    const status = providerStatus(id);
    const connected = status.status === "ok";
    return `
      <div class="provider-status ${statusClass(status.status)}">
        <span class="status-light"></span>
        <div class="provider-copy">
          <strong>${escapeHtml(providerLabel(id))}</strong>
          <small>${escapeHtml(providerAccountText(id, status))}</small>
        </div>
        <small class="provider-message">${escapeHtml(status.message || state.providers[id]?.note || "")}</small>
        <div class="provider-actions">
          <span>${connected ? "연결됨" : status.status === "checking" ? "확인 중" : "미연결"}</span>
          <button class="connect-provider" type="button" data-provider="${escapeAttr(id)}">로그인</button>
        </div>
      </div>
    `;
  }).join("");
  renderIntegrationList();
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
  applyProviderAvailability();
  renderProviderStatus();
}

async function refreshProviderStatuses() {
  const response = await fetch("/api/provider-status");
  const payload = await response.json();
  state.providerStatus = payload.providers || {};
  applyProviderAvailability();
  renderProviderStatus();
  return state.providerStatus;
}

function bindProviderButtons() {
  const buttons = [
    ...(els.providerStatusList ? els.providerStatusList.querySelectorAll(".connect-provider") : []),
    ...(els.integrationList ? els.integrationList.querySelectorAll(".connect-provider") : [])
  ];
  for (const button of buttons) {
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
  applyProviderAvailability();
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

function applyProviderAvailability() {
  for (const card of els.players.querySelectorAll(".player-card")) {
    const provider = normalizeProvider(card.querySelector(".player-provider").value);
    const warning = card.querySelector(".player-connection-warning");
    const status = providerStatus(provider);
    const checked = providerIsConnected(provider);
    card.classList.toggle("provider-missing", !checked);
    if (!checked) {
      warning.hidden = false;
      warning.textContent = `${providerLabel(provider)} 미연결: 연결 관리에서 로그인한 뒤 참가할 수 있습니다.`;
    } else {
      warning.hidden = true;
      warning.textContent = "";
    }
    card.dataset.providerStatus = status.status;
  }
  updateRecommendation();
}

function renderIntegrationList() {
  if (!els.integrationList) return;
  const integrations = state.integrations.length
    ? state.integrations
    : providerIds().map((id) => ({ id, label: providerLabel(id), account: state.providers[id]?.account || "", available: true }));

  els.integrationList.innerHTML = integrations.map((item) => {
    const status = item.available ? providerStatus(item.id) : { status: item.status || "planned", message: item.note || "연결 후보" };
    const account = status.account || item.account || "";
    const canLogin = item.available && providerIds().includes(item.id);
    return `
      <article class="integration-item ${statusClass(status.status)}">
        <div class="integration-main">
          <span class="status-light"></span>
          <div>
            <strong>${escapeHtml(item.label || item.id)}</strong>
            <small>${account ? escapeHtml(`${status.accountSource === "detected" ? "계정" : "예상 계정"}: ${account}`) : "계정 미지정"}</small>
          </div>
        </div>
        <p>${escapeHtml(status.message || item.note || "")}</p>
        ${item.setup ? `<small class="setup-text">${escapeHtml(item.setup)}</small>` : ""}
        <div class="integration-actions">
          <span>${canLogin ? (status.status === "ok" ? "연결됨" : "연결 가능") : "연결 후보"}</span>
          ${canLogin ? `<button class="connect-provider" type="button" data-provider="${escapeAttr(item.id)}">로그인</button>` : ""}
        </div>
      </article>
    `;
  }).join("");
  bindProviderButtons();
}

function openConnectionsModal() {
  els.connectionsModal.hidden = false;
  renderIntegrationList();
  checkProviders();
}

function closeConnectionsModal() {
  els.connectionsModal.hidden = true;
}

function bindPlayerInputs() {
  for (const input of els.players.querySelectorAll(".player-name, .player-personality, .player-model-custom")) {
    input.addEventListener("input", syncPlayerMapFromCards);
  }
  for (const select of els.players.querySelectorAll(".player-model")) {
    select.addEventListener("change", syncPlayerMapFromCards);
  }
  for (const select of els.players.querySelectorAll(".player-provider")) {
    select.addEventListener("change", () => {
      const card = select.closest(".player-card");
      const provider = normalizeProvider(select.value);
      card.className = `player-card ${card.dataset.moderator === "true" ? "moderator-card " : ""}${provider}`;
      card.style.setProperty("--provider-color", providerColor(provider));
      card.querySelector(".player-model").innerHTML = buildModelOptions(provider, "");
      syncPlayerMapFromCards();
      applyProviderAvailability();
      updateRecommendation();
    });
  }
  for (const button of els.players.querySelectorAll(".remove-player")) {
    button.addEventListener("click", () => {
      removePlayerCard(button.closest(".player-card"));
    });
  }
  bindPlayerCardDragging();
}

function buildProviderOptions(selected) {
  return providerIds().map((provider) => {
    return `<option value="${escapeAttr(provider)}" ${provider === selected ? "selected" : ""}>${escapeHtml(providerLabel(provider))}</option>`;
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
  return [...els.players.querySelectorAll(".player-card:not(.moderator-card)")].map(cardToPlayer);
}

function syncPlayerMapFromCards() {
  state.players = collectAllPlayers();
  state.playerById = new Map(state.players.map((player) => [player.id, player]));
  const moderatorCard = els.players.querySelector(".moderator-card");
  if (moderatorCard) {
    state.moderator = collectModerator();
    state.playerById.set(state.moderator.id, state.moderator);
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

function collectModerator() {
  const card = els.players.querySelector(".moderator-card");
  const base = {
    id: "moderator",
    displayName: "회의 진행자",
    provider: "codex",
    enabled: true,
    personality: "토론의 열기를 살리면서 논점 이탈을 잡고, 라운드 끝마다 선택지와 다음 질문을 좁히는 진행자.",
    model: "",
    color: "#e4b84a",
    workdir: "agents/moderator",
    ...(state.moderator || {})
  };
  if (!card) return base;
  const player = cardToPlayer(card);
  return {
    ...base,
    ...player,
    id: "moderator",
    color: base.color || "#e4b84a",
    workdir: base.workdir || "agents/moderator"
  };
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
    enabled: true,
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
  focusPlayerCard(id);
}

function focusPlayerCard(id) {
  requestAnimationFrame(() => {
    const card = els.players.querySelector(`.player-card[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    card.querySelector(".player-name")?.focus();
    card.classList.add("player-card-new");
    setTimeout(() => card.classList.remove("player-card-new"), 1200);
  });
}

function removePlayerCard(card) {
  if (!card || card.classList.contains("moderator-card")) return;
  card.remove();
  removeDropIndicator();
  removeDeleteZone();
  syncPlayerMapFromCards();
  updateRecommendation();
}

function bindPlayerCardDragging() {
  for (const card of els.players.querySelectorAll(".player-card:not(.moderator-card)")) {
    card.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isInteractiveDragTarget(event.target)) return;
      beginPointerPlayerDrag(event, card);
    });
  }
}

function isInteractiveDragTarget(target) {
  return Boolean(target.closest?.("input, select, textarea, button, label, a"));
}

function beginPointerPlayerDrag(event, card) {
  event.preventDefault();
  const box = card.getBoundingClientRect();
  const ghost = createPlayerDragGhost(card, box);
  state.draggingPlayerId = card.dataset.id;
  state.dragDropped = false;
  state.pointerDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - box.left,
    offsetY: event.clientY - box.top,
    ghost
  };
  card.classList.add("dragging");
  card.setPointerCapture?.(event.pointerId);
  document.addEventListener("pointermove", updatePointerPlayerDrag);
  document.addEventListener("pointerup", finishPointerPlayerDrag);
  document.addEventListener("pointercancel", cancelPointerPlayerDrag);
  positionPlayerDragGhost(event.clientX, event.clientY);
  updatePlayerDragIndicator(event.clientY, event.clientX);
}

function updatePointerPlayerDrag(event) {
  if (!state.pointerDrag || event.pointerId !== state.pointerDrag.pointerId) return;
  event.preventDefault();
  positionPlayerDragGhost(event.clientX, event.clientY);
  updatePlayerDragIndicator(event.clientY, event.clientX);
}

function finishPointerPlayerDrag(event) {
  if (!state.pointerDrag || event.pointerId !== state.pointerDrag.pointerId) return;
  event.preventDefault();
  const card = els.players.querySelector(`.player-card[data-id="${CSS.escape(state.draggingPlayerId)}"]`);
  const indicator = els.players.querySelector(".drop-indicator");
  const deleteZone = els.players.querySelector(".drop-delete-zone");
  if (card && isDeleteDropTarget(deleteZone, event.clientX, event.clientY)) {
    removePlayerCard(card);
  } else if (card && indicator) {
    els.players.insertBefore(card, indicator);
    syncPlayerMapFromCards();
    updateRecommendation();
  }
  cleanupPlayerDrag();
}

function cancelPointerPlayerDrag(event) {
  if (state.pointerDrag && event.pointerId !== state.pointerDrag.pointerId) return;
  cleanupPlayerDrag();
}

function createPlayerDragGhost(card, box) {
  const ghost = card.cloneNode(true);
  ghost.classList.remove("dragging", "drop-remove", "player-card-new");
  ghost.classList.add("player-drag-ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${box.width}px`;
  ghost.style.height = `${box.height}px`;
  syncGhostFormValues(card, ghost);
  document.body.append(ghost);
  return ghost;
}

function syncGhostFormValues(source, ghost) {
  const sourceFields = source.querySelectorAll("input, textarea, select");
  const ghostFields = ghost.querySelectorAll("input, textarea, select");
  sourceFields.forEach((field, index) => {
    const ghostField = ghostFields[index];
    if (!ghostField) return;
    if ("checked" in ghostField) ghostField.checked = field.checked;
    if ("value" in ghostField) ghostField.value = field.value;
  });
}

function positionPlayerDragGhost(x, y) {
  const drag = state.pointerDrag;
  if (!drag?.ghost) return;
  drag.ghost.style.left = `${x - drag.offsetX}px`;
  drag.ghost.style.top = `${y - drag.offsetY}px`;
}

function updatePlayerDragIndicator(y, x = 0) {
  const card = els.players.querySelector(`.player-card[data-id="${CSS.escape(state.draggingPlayerId)}"]`);
  const deleteZone = ensureDeleteZone();
  const deleteIntent = isDeleteDropTarget(deleteZone, x, y);
  card?.classList.toggle("drop-remove", deleteIntent);
  state.pointerDrag?.ghost?.classList.toggle("drop-remove", deleteIntent);
  deleteZone.classList.toggle("active", deleteIntent);
  if (deleteIntent) {
    removeDropIndicator();
    return;
  }

  const indicator = ensureDropIndicator();
  const afterCard = getDragAfterCard(y);
  if (afterCard) {
    els.players.insertBefore(indicator, afterCard);
  } else if (deleteZone) {
    els.players.insertBefore(indicator, deleteZone);
  } else {
    els.players.append(indicator);
  }
}

function getDragAfterCard(y) {
  const cards = [...els.players.querySelectorAll(".player-card:not(.moderator-card):not(.dragging)")];
  return cards.reduce((closest, card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, card };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, card: null }).card;
}

function ensureDropIndicator() {
  let indicator = els.players.querySelector(".drop-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "drop-indicator";
  }
  return indicator;
}

function removeDropIndicator() {
  els.players.querySelector(".drop-indicator")?.remove();
}

function ensureDeleteZone() {
  let zone = els.players.querySelector(".drop-delete-zone");
  if (!zone) {
    zone = document.createElement("div");
    zone.className = "drop-delete-zone";
    zone.textContent = "여기에 놓으면 삭제";
    els.players.append(zone);
  }
  return zone;
}

function removeDeleteZone() {
  els.players.querySelector(".drop-delete-zone")?.remove();
}

function cleanupPlayerDrag() {
  document.removeEventListener("pointermove", updatePointerPlayerDrag);
  document.removeEventListener("pointerup", finishPointerPlayerDrag);
  document.removeEventListener("pointercancel", cancelPointerPlayerDrag);
  state.pointerDrag?.ghost?.remove();
  for (const card of els.players.querySelectorAll(".player-card.dragging")) {
    card.classList.remove("dragging");
    card.classList.remove("drop-remove");
  }
  state.draggingPlayerId = "";
  state.dragDropped = false;
  state.pointerDrag = null;
  removeDropIndicator();
  removeDeleteZone();
}

function isPointInsideElement(element, x, y) {
  if (!element || (!x && !y)) return false;
  const box = element.getBoundingClientRect();
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

function isDeleteDropTarget(deleteZone, x, y) {
  return isPointInsideElement(deleteZone, x, y) || isOutsidePlayersDragArea(x, y);
}

function isOutsidePlayersDragArea(x, y) {
  if (!x && !y) return false;
  const box = els.players.getBoundingClientRect();
  const margin = 14;
  return x < box.left - margin
    || x > box.right + margin
    || y < box.top - margin
    || y > box.bottom + margin;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function modeLabel(value) {
  return value === "mafia" ? "마피아" : "토론";
}

function winnerLabel(value) {
  return {
    mafia: "마피아 승",
    citizen: "시민 승",
    debate: "토론 종료",
    timeout: "시간 종료"
  }[value] || "종료";
}

function syncPlayersFromEvent(event) {
  if (event.session?.id) state.currentSessionId = event.session.id;
  if (event.session?.mode) {
    state.currentMode = event.session.mode;
    els.modeSelect.value = event.session.mode;
    applyModeUi();
  }

  if (Array.isArray(event.session?.players)) {
    state.sessionPlayerIds = event.session.players.map((player) => typeof player === "string" ? player : player.id).filter(Boolean);
    for (const id of state.sessionPlayerIds) {
      if (!state.playerById.has(id)) {
        const base = state.players.find((player) => player.id === id);
        if (base) state.playerById.set(id, base);
      }
    }
  }

  if (Array.isArray(event.players)) {
    state.sessionPlayerIds = event.players.map((player) => player.id).filter(Boolean);
    for (const player of event.players) {
      const known = state.playerById.get(player.id) || {};
      state.playerById.set(player.id, { ...known, ...player });
    }
  }

  if (Array.isArray(event.roles)) {
    state.sessionPlayerIds = event.roles.map((player) => player.id).filter(Boolean);
    for (const player of event.roles) {
      const known = state.playerById.get(player.id) || {};
      state.playerById.set(player.id, { ...known, ...player });
    }
  }

  if (event.playerId) {
    const known = state.playerById.get(event.playerId) || {};
    state.playerById.set(event.playerId, {
      ...known,
      id: event.playerId,
      displayName: event.displayName || known.displayName || event.playerId,
      provider: event.provider || known.provider || "",
      model: event.model || known.model || "",
      personality: event.personality || known.personality || "",
      color: event.color || known.color || playerColor(event.playerId)
    });
    if (!state.sessionPlayerIds.includes(event.playerId)) state.sessionPlayerIds.push(event.playerId);
  }
}

function sessionParticipants() {
  return state.sessionPlayerIds
    .filter((id) => id !== "moderator")
    .map((id) => state.playerById.get(id))
    .filter((player) => player?.id && player.displayName);
}

function renderFollowUpPanel() {
  if (!els.followUpPanel || !els.followUpList) return;
  const participants = sessionParticipants();
  const canAsk = state.canAskFollowUp && !state.running;
  const visible = (state.running || canAsk) && participants.length > 0;
  els.followUpPanel.hidden = !visible;
  if (!visible) {
    els.followUpList.innerHTML = "";
    return;
  }

  els.followUpPanel.classList.toggle("is-collapsed", state.followUpCollapsed);
  els.followUpTitle.textContent = canAsk ? "추가 의견" : "참여자";
  els.followUpDescription.textContent = canAsk
    ? "참가자에게 한 번 더 물어봅니다."
    : "회의에 참여 중인 AI입니다.";
  els.toggleFollowUpBtn.textContent = state.followUpCollapsed ? "펼치기" : "숨기기";
  els.toggleFollowUpBtn.setAttribute("aria-expanded", String(!state.followUpCollapsed));

  els.followUpList.innerHTML = participants.map((player) => {
    const loading = state.followUpLoadingId === player.id;
    const active = state.running && state.activePlayerId === player.id && participantActiveStates.has(state.activeActivityState);
    const disabled = !canAsk || loading;
    const statusText = loading
      ? "요청 중"
      : active
        ? activeParticipantLabel(state.activeActivityState)
        : canAsk ? "의견 더 듣기" : "참여 중";
    return `
      <button class="follow-up-btn ${active ? "is-speaking" : ""}" type="button" data-player-id="${escapeAttr(player.id)}" ${disabled ? "disabled" : ""}>
        <span class="player-dot" style="--player-color:${escapeAttr(player.color || playerColor(player.id))}"></span>
        ${escapeHtml(player.displayName)}
        <small>${statusText}</small>
      </button>
    `;
  }).join("");
}

function activeParticipantLabel(value) {
  return {
    voting: "투표 중",
    "night-action": "선택 중",
    "follow-up": "답변 중"
  }[value] || "말하는 중";
}

function appendEvent(event) {
  if (event.type === "reset") {
    resetBoard();
    return;
  }

  const shouldFollowScroll = !state.replayingEvents && (state.autoScroll || isNearPageBottom());
  syncPlayersFromEvent(event);

  if (event.type === "activity") {
    setActivity(event);
    return;
  }

  if (event.type === "status" && event.session?.players) {
    if (state.currentMode === "mafia") seedLifeFromSession(event.session.players);
    renderFollowUpPanel();
  }

  if (event.type === "roles") {
    renderRoleBoard(event.roles || []);
    return;
  }

  updateLifeFromEvent(event);
  updateInsights(event);

  const item = document.createElement("article");
  item.className = `event ${event.type || "log"} ${event.provider || ""}`;
  const color = event.color || event.actorColor || event.playerColor || playerColor(event.playerId);
  item.style.setProperty("--player-color", color || "#aeb7c0");
  if (event.provider) item.style.setProperty("--provider-color", providerColor(event.provider));

  if (event.type === "turn" || event.type === "victory-speech") {
    item.innerHTML = renderTurn(event);
  } else if (event.type === "follow-up") {
    item.innerHTML = renderFollowUpEvent(event);
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
    item.innerHTML = renderSimpleEvent(event, `처형 · Day ${event.day || ""}`, event.message || "처형 없음");
  } else if (event.type === "interrupt") {
    item.innerHTML = renderSimpleEvent(event, "돌발 발언권", event.message);
  } else if (event.type === "moderator-note") {
    item.innerHTML = renderSimpleEvent(event, event.final ? "최종 정리" : "회의 진행자", event.message);
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
  if (shouldFollowScroll) {
    scrollToTimelineEnd();
  } else {
    updateScrollBottomButton();
  }
}

function scrollToTimelineEnd() {
  requestAnimationFrame(() => {
    const target = document.scrollingElement || document.documentElement;
    target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
    state.autoScroll = true;
    updateScrollBottomButton();
  });
}

function isNearPageBottom() {
  const target = document.scrollingElement || document.documentElement;
  return target.scrollHeight - target.scrollTop - target.clientHeight < 140;
}

function updateScrollState() {
  state.autoScroll = isNearPageBottom();
  updateScrollBottomButton();
}

function updateScrollBottomButton() {
  if (!els.scrollBottomBtn) return;
  const hasTimeline = els.timeline.children.length > 0;
  els.scrollBottomBtn.hidden = !hasTimeline || state.autoScroll;
}

function updateInsights(event) {
  if (event.type === "status" && event.session?.topic) {
    const modeLabel = event.session.mode === "mafia" ? "마피아 게임" : "일반 토론";
    els.insightSummary.textContent = `${modeLabel} 시작: ${event.session.topic}`;
    els.insightAction.textContent = "각 AI의 첫 발언을 기다리는 중입니다.";
    return;
  }

  if (event.type === "turn") {
    const phase = phaseLabel(event.phase);
    els.insightSummary.textContent = `${event.displayName}의 ${phase} 발언이 추가되었습니다.`;
    els.insightAction.textContent = event.phase === "debate"
      ? "상반된 주장과 합의점을 비교해 최종 결론을 정리하세요."
      : "발언, 투표, 밤 결과의 모순을 비교하세요.";
    return;
  }

  if (event.type === "vote") {
    els.insightSummary.textContent = event.executedName
      ? `투표 결과 ${event.executedName}이 처형되었습니다.`
      : "투표가 끝났지만 처형은 발생하지 않았습니다.";
    els.insightAction.textContent = "속마음과 다음 라운드 발언의 변화를 비교하세요.";
    return;
  }

  if (event.type === "moderator-note") {
    els.insightSummary.textContent = event.final
      ? "회의 진행자가 최종 정리를 남겼습니다."
      : "회의 진행자가 흐름을 정리했습니다.";
    els.insightAction.textContent = event.final
      ? "최종 결론과 리스크를 확인한 뒤 필요한 참가자에게 추가 의견을 물어볼 수 있습니다."
      : "다음 발언은 진행자 지시에 맞춰 후보와 실행안을 좁혀갑니다.";
    return;
  }

  if (event.type === "game-over") {
    els.insightSummary.textContent = event.message || "세션이 종료되었습니다.";
    els.insightAction.textContent = "로그를 바탕으로 결론, 리스크, 다음 실험 주제를 정리하세요.";
    return;
  }

  if (event.type === "done") {
    els.insightAction.textContent = "세션이 종료되었습니다. 필요한 부분을 복사하거나 다음 주제를 시작하세요.";
  }
}

function renderTurn(event) {
  const label = event.type === "victory-speech" ? "승리 소감" : phaseLabel(event.phase);
  const nameColor = roleColor(event.role, event.color || playerColor(event.playerId));
  const turnLabel = event.phase === "debate" ? `Round ${event.day}` : `Day ${event.day}`;
  return `
    <div class="meta">
      <span><span class="speaker" style="--name-color:${escapeAttr(nameColor)}">${escapeHtml(event.displayName)}</span> · ${label} · ${turnLabel}</span>
      <span>${formatTime(event.at)}</span>
    </div>
    <div class="tags">
      <span class="provider ${event.provider}">${event.provider}</span>
      ${event.model ? `<span class="tag">${escapeHtml(event.model)}</span>` : ""}
    </div>
    <div class="speech">${renderSpeech(event.speech)}</div>
  `;
}

function renderFollowUpEvent(event) {
  const nameColor = roleColor(event.role, event.color || playerColor(event.playerId));
  return `
    <div class="follow-up-divider"><span>추가 의견</span></div>
    <div class="meta">
      <span><span class="speaker" style="--name-color:${escapeAttr(nameColor)}">${escapeHtml(event.displayName)}</span> · 후속 의견</span>
      <span>${formatTime(event.at)}</span>
    </div>
    <div class="tags">
      <span class="provider ${event.provider}">${event.provider}</span>
      ${event.model ? `<span class="tag">${escapeHtml(event.model)}</span>` : ""}
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
    return `<div class="detail-row secret-row"><span>${mention(vote.voterName, vote.voterId, vote.voterColor)}</span><span>→</span><span>${mention(vote.targetName, vote.targetId, vote.targetColor)}</span><small><b>속마음</b>${escapeHtml(vote.reason)}</small></div>`;
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
    <div class="details"><small class="secret-reason"><b>속마음</b>${escapeHtml(reason || "")}</small></div>
  `;
}

function renderNightEvent(event) {
  let summary = "아무도 죽지 않았습니다.";
  if (event.protected) {
    summary = "아무도 죽지 않았습니다. 의사의 보호가 성공했습니다.";
  } else if (event.killedName) {
    summary = `사망: ${event.killedName}`;
  }

  const choices = (event.mafiaChoices || []).map((choice) => {
    return `<div class="detail-row secret-row">${mention(choice.actorName, choice.actorId, choice.actorColor)}<span>→</span>${mention(choice.targetName, choice.targetId, choice.targetColor)}<small><b>속마음</b>${escapeHtml(choice.reason)}</small></div>`;
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
      <small>${escapeHtml(player.personality || "")}</small>
    </article>
  `).join("");
  renderLifeBoard();
}

function seedLifeFromSession(playerIds) {
  if (state.currentMode !== "mafia") {
    renderLifeBoard();
    return;
  }
  for (const id of playerIds) {
    if (!state.lifeById.has(id)) {
      state.lifeById.set(id, { status: "alive", reason: "참여 중" });
    }
  }
  renderLifeBoard();
}

function updateLifeFromEvent(event) {
  if (state.currentMode !== "mafia") return;
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
  if (state.currentMode !== "mafia") {
    if (els.aliveList) els.aliveList.innerHTML = "";
    if (els.deadList) els.deadList.innerHTML = "";
    return;
  }
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
  return `<span class="mention" style="--mention-color:${escapeAttr(roleColor(role, color || playerColor(id)))}">${escapeHtml(name)}</span>`;
}

function setActivity(event) {
  const current = event || {};
  const color = current.color || playerColor(current.playerId) || "#aeb7c0";
  if (current.playerId && participantActiveStates.has(current.state)) {
    state.activePlayerId = current.playerId;
    state.activeActivityState = current.state;
  } else if (!current.playerId || ["idle", "received", "done"].includes(current.state)) {
    state.activePlayerId = "";
    state.activeActivityState = "";
  }
  els.activityPanel.className = `activity-panel activity-${current.state || "idle"}`;
  els.activityPanel.style.setProperty("--activity-color", color);
  els.activityTitle.textContent = activityLabel(current.state);
  els.activityDetail.textContent = current.message || "대기 중";
  renderFollowUpPanel();
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
    "follow-up": "추가 의견 요청 중",
    done: "세션 종료"
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

async function loadHistory() {
  if (!els.sessionHistory) return;
  try {
    const response = await fetch("/api/sessions");
    const payload = await response.json();
    state.history = payload.sessions || [];
  } catch {
    state.history = [];
  }
  renderHistory();
}

function renderHistory() {
  if (!els.sessionHistory) return;
  if (state.history.length === 0) {
    els.sessionHistory.innerHTML = `<span class="history-empty">아직 완료된 판이 없습니다.</span>`;
    return;
  }

  els.sessionHistory.innerHTML = state.history.map((item) => `
    <button class="history-item" type="button" data-session-id="${escapeAttr(item.id)}">
      <span class="history-main">
        <strong>${escapeHtml(item.topic || "제목 없음")}</strong>
        <small>${formatDateTime(item.endedAt || item.startedAt)} · ${item.playerCount || 0}명 · ${item.eventCount || 0}개 이벤트</small>
      </span>
      <span class="history-badges">
        <em>${modeLabel(item.mode)}</em>
        <em>${winnerLabel(item.winner)}</em>
      </span>
    </button>
  `).join("");
}

async function openArchivedSession(id) {
  const response = await fetch(`/api/session?id=${encodeURIComponent(id)}`);
  const archive = await response.json();
  if (!response.ok) {
    appendEvent({ type: "runner-error", at: new Date().toISOString(), message: archive.error || "지난 판을 불러오지 못했습니다." });
    return;
  }

  state.viewingArchive = true;
  state.liveHasUpdates = false;
  updateReturnLiveButton();
  resetBoard({ autoScroll: false });
  els.sessionMeta.textContent = `[지난 판] ${archive.topic || "제목 없음"}`;
  state.currentSessionId = archive.id || id;
  state.currentMode = archive.mode || "debate";
  els.modeSelect.value = archive.mode || "debate";
  applyModeUi();
  state.replayingEvents = true;
  try {
    for (const event of archive.events || []) {
      appendEvent(event);
    }
  } finally {
    state.replayingEvents = false;
    updateScrollBottomButton();
  }
  setRunning(state.running);
  state.canAskFollowUp = true;
  renderFollowUpPanel();
  els.insightAction.textContent = state.running
    ? "지난 판을 보고 있습니다. 진행 중인 회의로 돌아가려면 위 버튼을 누르세요."
    : "지난 판을 보고 있습니다. 새 주제를 시작하면 현재 화면은 새 판으로 바뀝니다.";
}

async function loadState() {
  const response = await fetch("/api/state");
  const payload = await response.json();
  state.players = payload.players;
  state.moderator = payload.moderator || state.moderator;
  state.providers = payload.providers;
  state.integrations = payload.integrations || [];
  state.namePool = payload.defaults.namePool || state.namePool;
  state.recommendedRoles = payload.defaults.recommendedRoles;
  state.providerStatus = Object.fromEntries(Object.keys(payload.providers).map((id) => [id, { status: "unknown", message: "아직 확인 안 함" }]));
  state.playerById = new Map(payload.players.map((player) => [player.id, player]));
  if (state.moderator) state.playerById.set(state.moderator.id, state.moderator);
  renderPlayers();
  renderProviderStatus();
  applyRecommendedRoles();
  state.viewingArchive = false;
  state.liveHasUpdates = false;
  setRunning(payload.session.running);
  state.currentSessionId = payload.session.id || "";
  state.currentMode = payload.session.mode || "debate";
  els.modeSelect.value = payload.session.mode || "debate";
  els.maxDays.value = payload.defaults.game.maxDays || 3;
  els.dayRounds.value = payload.defaults.game.dayRounds || 1;
  els.interruptEnabled.checked = Boolean(payload.defaults.game.interrupt?.enabled);
  els.spectatorRevealRoles.checked = Boolean(payload.defaults.game.spectatorRevealRoles);

  if (payload.session.topic) {
    els.sessionMeta.textContent = payload.session.topic;
  }

  applyModeUi();
  resetBoard({ autoScroll: false });
  state.currentSessionId = payload.session.id || "";
  state.currentMode = payload.session.mode || els.modeSelect.value || "debate";
  state.replayingEvents = true;
  try {
    for (const event of payload.events) {
      appendEvent(event);
    }
  } finally {
    state.replayingEvents = false;
    updateScrollBottomButton();
  }
  state.canAskFollowUp = !payload.session.running && payload.events.some((event) => event.type === "done" || event.type === "game-over");
  renderFollowUpPanel();
}

async function startSession() {
  syncPlayerMapFromCards();
  await refreshProviderStatuses();
  const players = collectPlayers();
  const moderator = collectModerator();
  const mode = els.modeSelect.value;
  const minimumPlayers = mode === "mafia" ? 4 : 2;
  if (players.length < minimumPlayers) {
    appendEvent({ type: "runner-error", at: new Date().toISOString(), message: `${mode === "mafia" ? "마피아 게임" : "일반 토론"}은 최소 ${minimumPlayers}명을 선택하세요.` });
    return;
  }

  state.viewingArchive = false;
  state.liveHasUpdates = false;
  updateReturnLiveButton();
  resetBoard();
  state.currentMode = mode;
  const body = {
    topic: els.topic.value.trim(),
    players,
    moderator,
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
  state.currentSessionId = payload.session?.id || state.currentSessionId;
  els.sessionMeta.textContent = els.topic.value.trim();
}

async function stopGame() {
  await fetch("/api/stop", { method: "POST" });
}

async function requestFollowUp(playerId) {
  if (!playerId || state.running || state.followUpLoadingId) return;
  state.followUpLoadingId = playerId;
  renderFollowUpPanel();
  try {
    const response = await fetch("/api/follow-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: state.currentSessionId, playerId })
    });
    const payload = await response.json();
    if (!response.ok) {
      appendEvent({ type: "runner-error", at: new Date().toISOString(), message: payload.error || "추가 의견 요청 실패" });
    }
  } catch (error) {
    appendEvent({ type: "runner-error", at: new Date().toISOString(), message: error.message || "추가 의견 요청 실패" });
  } finally {
    state.followUpLoadingId = "";
    renderFollowUpPanel();
  }
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
    "moderator-note",
    "follow-up",
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
      if (state.viewingArchive) {
        if (type === "status") {
          state.liveHasUpdates = true;
          setRunning(true);
          updateReturnLiveButton();
          return;
        }
        if (type === "done") {
          state.liveHasUpdates = true;
          setRunning(false);
          setTimeout(loadHistory, 800);
          updateReturnLiveButton();
          return;
        }
        if (type === "follow-up" && event.sessionId === state.currentSessionId) {
          appendEvent(event);
          return;
        }
        if (type !== "activity") {
          state.liveHasUpdates = true;
          updateReturnLiveButton();
        }
        return;
      }
      if (type === "status") setRunning(true);
      if (type === "done") {
        setRunning(false);
        state.canAskFollowUp = true;
        renderFollowUpPanel();
        setActivity({ state: "done", message: "세션 종료" });
        setTimeout(loadHistory, 800);
      }
      appendEvent(event);
    });
  }
}

els.applyRecommendBtn.addEventListener("click", applyRecommendedRoles);
els.refreshConnectionsBtn.addEventListener("click", checkProviders);
els.openConnectionsBtn.addEventListener("click", openConnectionsModal);
els.closeConnectionsBtn.addEventListener("click", closeConnectionsModal);
els.connectionsModal.addEventListener("click", (event) => {
  if (event.target === els.connectionsModal) closeConnectionsModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.connectionsModal.hidden) closeConnectionsModal();
});
els.addPlayerBtn.addEventListener("click", addPlayer);
els.modeSelect.addEventListener("change", applyModeUi);
els.templateRow.addEventListener("click", (event) => {
  const button = event.target.closest(".template-btn");
  if (!button) return;
  els.topic.value = topicTemplates[button.dataset.template] || els.topic.value;
});
els.startBtn.addEventListener("click", startSession);
els.stopBtn.addEventListener("click", stopGame);
els.clearBtn.addEventListener("click", resetBoard);
els.returnLiveBtn.addEventListener("click", loadState);
els.refreshHistoryBtn.addEventListener("click", loadHistory);
els.sessionHistory.addEventListener("click", (event) => {
  const button = event.target.closest(".history-item");
  if (!button) return;
  openArchivedSession(button.dataset.sessionId);
});

els.followUpList.addEventListener("click", (event) => {
  const button = event.target.closest(".follow-up-btn");
  if (!button) return;
  requestFollowUp(button.dataset.playerId);
});

els.toggleFollowUpBtn.addEventListener("click", () => {
  state.followUpCollapsed = !state.followUpCollapsed;
  renderFollowUpPanel();
});

els.scrollBottomBtn.addEventListener("click", scrollToTimelineEnd);
document.addEventListener("scroll", updateScrollState, { passive: true });
els.topic.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!state.running) startSession();
});

await loadState();
await loadHistory();
checkProviders();
connectEvents();
