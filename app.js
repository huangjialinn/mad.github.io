/* 可修改配置：站点名称、标语、成员资料、云端持久化接口 */
const APP_CONFIG = {
  siteTitle: "一车面包人",
  siteTagline: "这是一个减肥群",
  tickerText: "李柏辰是GAY",
  adminPassword: "2026",
  github: {
    owner: "huangjialinn",
    repo: "mad.github.io",
    branch: "main",
    dataPath: "data/mad-data.json"
  },
  persistence: {
    autoSyncOnChange: true,
    saveDebounceMs: 1200,
    localDataPath: "data/mad-data.json"
  },
  upload: {
    maxSingleImageMB: 12,
    maxBatchImageMB: 24,
    autoCompressMaxSide: 1600,
    jpegQuality: 0.82
  },
  members: [
    { id: "m1", name: "YG", avatar: "./png/p1.png" },
    { id: "m2", name: "P1", avatar: "./png/p2.png" },
    { id: "m3", name: "烟", avatar: "./png/p3.png" },
    { id: "m4", name: "轩", avatar: "./png/p4.png" },
    { id: "m5", name: "陶", avatar: "./png/p5.png" },
    { id: "m6", name: "柏", avatar: "./png/p6.png" },
    { id: "m7", name: "姜", avatar: "./png/p7.png" },
    { id: "m8", name: "二", avatar: "./png/p8.png" }
  ],
};

const STORAGE_KEYS = {
  draft: "mad_local_draft_v1",
  githubToken: "mad_github_token_v1"
};

const EVENT_TYPE_META = {
  drink: { label: "DRINK", maxImages: 1 },
  meal: { label: "HUNT", maxImages: 9 },
  sport: { label: "SPORT", maxImages: 0 }
};

let MEMBER_MAP = new Map(APP_CONFIG.members.map((member) => [member.id, member]));
const UNKNOWN_MEMBER = { id: "unknown", name: "未知成员", avatar: "./png/p1.png" };
const EMPTY_COUNTER = Object.freeze({ drink: 0, meal: 0, sport: 0 });
const ADMIN_ACTOR_ID = "admin";

const state = {
  data: createEmptyData(),
  currentUser: { role: "guest", memberId: null, name: "访客" },
  selectedDate: toISODate(new Date()),
  calendarMonth: startOfMonth(new Date()),
  adminSessionPassword: ""
};

const dom = {};
let draftPersistHandle = null;
let draftPersistMode = null;
let pendingDraftText = "";
let githubSyncTimer = null;
let githubSyncInFlight = false;
let githubSyncDirty = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();
  applyHeader();
  populateMemberControls();
  renderSettingsEditor();
  bindEvents();
  setupDefaultDates();
  applyEventTypeRules();
  refreshPermissionUI();
  window.addEventListener("beforeunload", flushPendingDraftSync);

  await loadDataFromStorage();
  applyDataConfig();
  renderAll();
}

function cacheDom() {
  const ids = [
    "site-title",
    "site-tagline",
    "top-ticker-track",
    "manage-toggle-btn",
    "login-panel",
    "admin-password",
    "admin-token",
    "admin-login-form",
    "sync-status",
    "login-status",
    "sync-now-btn",
    "settings-title",
    "settings-tagline",
    "settings-ticker",
    "save-settings-btn",
    "save-members-btn",
    "member-list",
    "add-member-btn",
    "image-viewer",
    "image-viewer-img",
    "image-viewer-close",
    "prev-month-btn",
    "next-month-btn",
    "calendar-title",
    "calendar-grid",
    "selected-date-title",
    "selected-date-events",
    "event-form",
    "event-date",
    "event-type",
    "event-location-wrap",
    "event-location",
    "event-activity-wrap",
    "event-activity",
    "event-time-wrap",
    "event-sport-time",
    "event-score-wrap",
    "event-score",
    "event-member-checkboxes",
    "event-images-wrap",
    "event-images",
    "event-image-hint",
    "honor-form",
    "honor-date",
    "honor-member",
    "honor-story",
    "honor-images",
    "honor-list",
    "pet-form",
    "pet-member",
    "pet-name",
    "pet-age",
    "pet-images",
    "pet-list",
    "log-list"
    ,
    "tab-prev-btn",
    "tab-next-btn"
  ];
  ids.forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}

function applyHeader() {
  document.title = APP_CONFIG.siteTitle;
  dom["site-title"].textContent = APP_CONFIG.siteTitle;
  dom["site-title"].setAttribute("data-text", APP_CONFIG.siteTitle);
  dom["site-tagline"].textContent = APP_CONFIG.siteTagline;
  renderTicker();
}

function setMembers(members) {
  const safe = Array.isArray(members) ? members : [];
  APP_CONFIG.members = safe;
  MEMBER_MAP = new Map(APP_CONFIG.members.map((member) => [member.id, member]));
}

function applyDataConfig() {
  const settings = state.data.settings || {};
  if (settings.siteTitle) {
    APP_CONFIG.siteTitle = settings.siteTitle;
  }
  if (settings.siteTagline) {
    APP_CONFIG.siteTagline = settings.siteTagline;
  }
  if (settings.tickerText) {
    APP_CONFIG.tickerText = settings.tickerText;
  }
  if (Array.isArray(state.data.members) && state.data.members.length) {
    setMembers(state.data.members);
  }
  applyHeader();
  populateMemberControls();
  renderSettingsEditor();
}

function renderTicker() {
  const track = dom["top-ticker-track"];
  if (!track) {
    return;
  }
  const text = (APP_CONFIG.tickerText || "TEST").trim() || "TEST";
  const makeGroup = (ariaHidden) => {
    const group = document.createElement("div");
    group.className = "top-ticker-group";
    if (ariaHidden) {
      group.setAttribute("aria-hidden", "true");
    }
    for (let i = 0; i < 10; i += 1) {
      const span = document.createElement("span");
      span.className = "top-ticker-item";
      span.textContent = text;
      group.appendChild(span);
    }
    return group;
  };
  const fragment = document.createDocumentFragment();
  fragment.appendChild(makeGroup(false));
  fragment.appendChild(makeGroup(true));
  track.innerHTML = "";
  track.appendChild(fragment);

  // restart animation after content updates
  track.style.animation = "none";
  void track.offsetWidth;
  track.style.animation = "";
}

function populateMemberControls() {
  dom["honor-member"].innerHTML = "";
  dom["pet-member"].innerHTML = "";
  dom["event-member-checkboxes"].innerHTML = "";
  const honorFragment = document.createDocumentFragment();
  const petFragment = document.createDocumentFragment();
  const chipsFragment = document.createDocumentFragment();

  APP_CONFIG.members.forEach((member) => {
    const honorOption = document.createElement("option");
    honorOption.value = member.id;
    honorOption.textContent = member.name;
    honorFragment.appendChild(honorOption);

    const petOption = document.createElement("option");
    petOption.value = member.id;
    petOption.textContent = member.name;
    petFragment.appendChild(petOption);

    const chip = document.createElement("label");
    chip.className = "chip";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = member.id;
    checkbox.name = "event-member";

    const text = document.createElement("span");
    text.textContent = member.name;

    chip.appendChild(checkbox);
    chip.appendChild(text);
    chipsFragment.appendChild(chip);
  });

  dom["honor-member"].appendChild(honorFragment);
  dom["pet-member"].appendChild(petFragment);
  dom["event-member-checkboxes"].appendChild(chipsFragment);
}

function renderSettingsEditor() {
  if (dom["settings-title"]) {
    dom["settings-title"].value = APP_CONFIG.siteTitle || "";
  }
  if (dom["settings-tagline"]) {
    dom["settings-tagline"].value = APP_CONFIG.siteTagline || "";
  }
  if (dom["settings-ticker"]) {
    dom["settings-ticker"].value = APP_CONFIG.tickerText || "";
  }
  renderMemberEditorList();
}

function renderMemberEditorList() {
  if (!dom["member-list"]) {
    return;
  }
  dom["member-list"].innerHTML = "";
  const fragment = document.createDocumentFragment();
  APP_CONFIG.members.forEach((member) => {
    fragment.appendChild(createMemberEditorRow(member));
  });
  dom["member-list"].appendChild(fragment);
}

function createMemberEditorRow(member) {
  const row = document.createElement("div");
  row.className = "member-row";
  row.dataset.id = member.id;

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "姓名";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = member.name || "";
  nameInput.className = "member-name";
  nameLabel.appendChild(nameInput);

  const avatarLabel = document.createElement("label");
  avatarLabel.textContent = "头像";
  const avatarInput = document.createElement("input");
  avatarInput.type = "text";
  avatarInput.value = member.avatar || "";
  avatarInput.placeholder = "由上传自动生成";
  avatarInput.className = "member-avatar hidden";
  avatarLabel.appendChild(avatarInput);

  const uploadLabel = document.createElement("label");
  uploadLabel.textContent = "头像上传";
  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "image/*";
  uploadInput.className = "member-avatar-upload";
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) {
      return;
    }
    try {
      const dataUrl = await readImageFiles([file], 1);
      avatarInput.value = Array.isArray(dataUrl) ? dataUrl[0] : dataUrl;
      updateMemberPreview(row, avatarInput.value);
    } catch (error) {
      alert(error.message);
    }
  });
  uploadLabel.appendChild(uploadInput);

  const preview = document.createElement("img");
  preview.className = "member-avatar-preview";
  preview.alt = "头像预览";
  preview.src = member.avatar || "";

  avatarInput.addEventListener("input", () => {
    updateMemberPreview(row, avatarInput.value.trim());
  });

  row.appendChild(nameLabel);
  row.appendChild(avatarLabel);
  row.appendChild(uploadLabel);
  row.appendChild(preview);
  return row;
}

function updateMemberPreview(row, src) {
  const preview = row.querySelector(".member-avatar-preview");
  if (!preview) {
    return;
  }
  preview.src = src || "";
}

function handleAddMember() {
  const next = {
    id: makeId("member"),
    name: "新成员",
    avatar: "./png/p1.png"
  };
  APP_CONFIG.members.push(next);
  setMembers(APP_CONFIG.members);
  renderMemberEditorList();
}

function handleSaveSettings() {
  if (!canEdit()) {
    return;
  }
  const title = dom["settings-title"] ? dom["settings-title"].value.trim() : "";
  const tagline = dom["settings-tagline"] ? dom["settings-tagline"].value.trim() : "";
  const ticker = dom["settings-ticker"] ? dom["settings-ticker"].value.trim() : "";

  if (title) {
    APP_CONFIG.siteTitle = title;
  }
  if (tagline) {
    APP_CONFIG.siteTagline = tagline;
  }
  if (ticker) {
    APP_CONFIG.tickerText = ticker;
  }

  const nextMembers = [];
  if (dom["member-list"]) {
    dom["member-list"].querySelectorAll(".member-row").forEach((row) => {
      const id = row.dataset.id || makeId("member");
      const name = row.querySelector(".member-name")?.value.trim() || "成员";
      const avatar = row.querySelector(".member-avatar")?.value.trim() || "";
      nextMembers.push({ id, name, avatar });
    });
  }

  setMembers(nextMembers);
  state.data.settings = {
    siteTitle: APP_CONFIG.siteTitle,
    siteTagline: APP_CONFIG.siteTagline,
    tickerText: APP_CONFIG.tickerText
  };
  state.data.members = APP_CONFIG.members;
  addLog("更新了站点配置与成员信息。");
  persistLocalDraft(true);
  queueGithubSync();
  applyHeader();
  populateMemberControls();
  renderHonorList();
  renderPetList();
  renderSelectedDateEvents();
}

function bindEvents() {
  addDomListener("admin-login-form", "submit", handleAdminLogin);
  addDomListener("sync-now-btn", "click", handleSyncNow);
  addDomListener("save-settings-btn", "click", handleSaveSettings);
  addDomListener("save-members-btn", "click", handleSaveSettings);
  addDomListener("add-member-btn", "click", handleAddMember);
  initStackedTabs();
  addDomListener("image-viewer-close", "click", closeImageViewer);
  if (dom["image-viewer"]) {
    dom["image-viewer"].addEventListener("click", (event) => {
      if (event.target === dom["image-viewer"]) {
        closeImageViewer();
      }
    });
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeImageViewer();
    }
  });
  addDomListener("manage-toggle-btn", "click", handleManageToggle);
  // Mobile fallback: some browsers may miss click when layered effects are present.
  addDomListener("manage-toggle-btn", "touchend", (event) => {
    event.preventDefault();
    handleManageToggle();
  });

  addDomListener("event-type", "change", applyEventTypeRules);
  addDomListener("event-form", "submit", handleEventSubmit);
  addDomListener("honor-form", "submit", handleHonorSubmit);
  addDomListener("pet-form", "submit", handlePetSubmit);

  addDomListener("prev-month-btn", "click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() - 1,
      1
    );
    renderCalendar();
  });
  addDomListener("next-month-btn", "click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() + 1,
      1
    );
    renderCalendar();
  });

}

function addDomListener(id, eventName, handler) {
  const element = dom[id];
  if (!element) {
    console.warn(`缺少节点，已跳过事件绑定：#${id}`);
    return;
  }
  element.addEventListener(eventName, handler);
}

function initStackedTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
  if (!tabButtons.length) {
    return;
  }
  const panels = Array.from(document.querySelectorAll(".stacked-panel"));

  const setActive = (nextId) => {
    tabButtons.forEach((btn) => {
      const active = btn.dataset.tab === nextId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === nextId);
    });
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActive(btn.dataset.tab));
  });

  const rotate = (dir) => {
    const activeIdx = tabButtons.findIndex((btn) => btn.classList.contains("is-active"));
    const nextIdx = (activeIdx + dir + tabButtons.length) % tabButtons.length;
    setActive(tabButtons[nextIdx].dataset.tab);
  };

  if (dom["tab-prev-btn"]) {
    dom["tab-prev-btn"].addEventListener("click", () => rotate(-1));
  }
  if (dom["tab-next-btn"]) {
    dom["tab-next-btn"].addEventListener("click", () => rotate(1));
  }
}

function handleManageToggle() {
  if (!dom["login-panel"]) {
    alert("登录面板加载失败，请刷新页面后重试。");
    return;
  }
  if (canEdit()) {
    state.currentUser = { role: "guest", memberId: null, name: "访客" };
    state.adminSessionPassword = "";
    dom["admin-password"].value = "";
    toggleLoginPanel(false);
    refreshPermissionUI();
    setLoginStatus();
    setSyncStatus("未登录管理模式。", false);
    return;
  }

  const shouldShow = dom["login-panel"].classList.contains("hidden");
  toggleLoginPanel(shouldShow);
  if (shouldShow) {
    if (dom["admin-password"]) {
      dom["admin-password"].focus();
    }
    if (dom["login-panel"] && typeof dom["login-panel"].scrollIntoView === "function") {
      dom["login-panel"].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function toggleLoginPanel(show) {
  if (!dom["login-panel"]) {
    return;
  }
  dom["login-panel"].classList.toggle("hidden", !show);
}

function setupDefaultDates() {
  const today = toISODate(new Date());
  dom["event-date"].value = today;
  dom["honor-date"].value = today;
}

function applyEventTypeRules() {
  const type = dom["event-type"].value;
  const showMeal = type === "meal";
  const showSport = type === "sport";
  const showImages = type !== "sport";

  dom["event-score-wrap"].classList.toggle("hidden", !showMeal);
  dom["event-activity-wrap"].classList.toggle("hidden", !showSport);
  dom["event-time-wrap"].classList.toggle("hidden", !showSport);
  dom["event-images-wrap"].classList.toggle("hidden", !showImages);

  const hint = type === "drink"
    ? "喝酒搞事最多 1 张图片。"
    : type === "meal"
      ? "吃饭搞事最多 9 张图片。"
      : "运动搞事不需要图片。";
  dom["event-image-hint"].textContent = hint;
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const password = dom["admin-password"].value.trim();

  if (!password) {
    alert("请输入管理密码。");
    return;
  }

  if (password !== APP_CONFIG.adminPassword) {
    alert("管理密码错误。");
    return;
  }

  ensureGithubToken();

  state.currentUser = {
    role: "admin",
    memberId: ADMIN_ACTOR_ID,
    name: "管理员"
  };
  state.adminSessionPassword = password;
  dom["admin-password"].value = "";
  if (dom["admin-token"]) {
    dom["admin-token"].value = "";
  }
  toggleLoginPanel(false);
  refreshPermissionUI();
  setLoginStatus();
}

function setLoginStatus() {
  if (dom["manage-toggle-btn"]) {
    dom["manage-toggle-btn"].textContent = canEdit() ? "退出管理模式" : "进入管理模式";
  }
  if (canEdit()) {
    dom["login-status"].textContent = `当前状态：${state.currentUser.name}（可编辑）`;
  } else {
    dom["login-status"].textContent = "当前状态：未登录管理权限（只读）";
  }
}

function refreshPermissionUI() {
  const editable = canEdit();
  const blocks = document.querySelectorAll("[data-edit-only='true']");
  blocks.forEach((block) => {
    if (block.matches("button")) {
      block.disabled = !editable;
      return;
    }
    const controls = block.querySelectorAll("input, select, textarea, button");
    controls.forEach((control) => {
      control.disabled = !editable;
    });
  });

  const adminOnlyBlocks = document.querySelectorAll("[data-admin-only='true']");
  adminOnlyBlocks.forEach((block) => {
    block.classList.toggle("hidden", !editable);
  });

  setLoginStatus();
  renderSelectedDateEvents();
  renderHonorList();
  renderPetList();
}

function canEdit() {
  return state.currentUser.role === "admin";
}

function ensureGithubToken() {
  const inputToken = dom["admin-token"] ? dom["admin-token"].value.trim() : "";
  if (inputToken) {
    localStorage.setItem(STORAGE_KEYS.githubToken, inputToken);
    return inputToken;
  }
  const stored = localStorage.getItem(STORAGE_KEYS.githubToken) || "";
  if (stored) {
    return stored;
  }
  setSyncStatus("未配置 GitHub Token，无法同步到 GitHub。", true);
  return "";
}

async function loadDataFromStorage() {
  const localDraft = loadLocalDraft();
  const localPath = buildRawDataUrl(APP_CONFIG.github) || APP_CONFIG.persistence.localDataPath || "data/mad-data.json";
  try {
    const response = await fetch(`${localPath}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const localFileData = normalizeData(await response.json());
    if (localDraft) {
      const draftTs = getDataTimestamp(localDraft);
      const fileTs = getDataTimestamp(localFileData);
      const useDraft = draftTs >= fileTs;
      state.data = normalizeData(useDraft ? localDraft : localFileData);
      state.data.settings = localFileData.settings;
      state.data.members = localFileData.members;
    } else {
      state.data = localFileData;
    }
    persistLocalDraft(true);
    setSyncStatus("已读取本地数据文件", false);
  } catch (error) {
    if (localDraft) {
      state.data = localDraft;
      return;
    }
    state.data = createEmptyData();
    setSyncStatus("本地数据读取失败，已初始化空数据。", true);
  }
}

function loadLocalDraft() {
  const text = localStorage.getItem(STORAGE_KEYS.draft);
  if (!text) {
    return null;
  }
  try {
    return normalizeData(JSON.parse(text));
  } catch (error) {
    console.warn("本地草稿损坏", error);
    return null;
  }
}

function getDataTimestamp(data) {
  if (!data || !data.updatedAt) {
    return 0;
  }
  const ts = Date.parse(data.updatedAt);
  return Number.isFinite(ts) ? ts : 0;
}

function persistLocalDraft(force = false) {
  pendingDraftText = JSON.stringify(state.data);
  if (force) {
    return flushPendingDraftSync();
  }

  if (draftPersistHandle) {
    return true;
  }

  const flush = () => {
    draftPersistHandle = null;
    draftPersistMode = null;
    flushPendingDraftSync();
  };

  if ("requestIdleCallback" in window) {
    draftPersistMode = "idle";
    draftPersistHandle = window.requestIdleCallback(flush, { timeout: 900 });
  } else {
    draftPersistMode = "timeout";
    draftPersistHandle = window.setTimeout(flush, 180);
  }
  return true;
}

function flushPendingDraftSync() {
  if (!pendingDraftText) {
    clearPendingPersistHandle();
    return true;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.draft, pendingDraftText);
    pendingDraftText = "";
    clearPendingPersistHandle();
    return true;
  } catch (error) {
    console.warn("本地草稿写入失败", error);
    setSyncStatus("本地草稿空间不足，建议减少图片数量或压缩后再上传。", true);
    clearPendingPersistHandle();
    return false;
  }
}

function clearPendingPersistHandle() {
  if (!draftPersistHandle) {
    return;
  }
  if (draftPersistMode === "idle" && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(draftPersistHandle);
  } else if (draftPersistMode === "timeout") {
    clearTimeout(draftPersistHandle);
  }
  draftPersistHandle = null;
  draftPersistMode = null;
}

function queueGithubSync() {
  if (!canEdit() || !APP_CONFIG.persistence.autoSyncOnChange) {
    return;
  }
  const token = ensureGithubToken();
  if (!token) {
    return;
  }

  if (githubSyncInFlight) {
    githubSyncDirty = true;
    return;
  }

  if (githubSyncTimer) {
    clearTimeout(githubSyncTimer);
  }

  githubSyncTimer = window.setTimeout(() => {
    githubSyncTimer = null;
    void runGithubSync(token);
  }, APP_CONFIG.persistence.saveDebounceMs || 1200);
}

async function runGithubSync(token) {
  if (githubSyncInFlight) {
    githubSyncDirty = true;
    return;
  }
  githubSyncInFlight = true;
  try {
    await syncDataToGithub(token, state.data);
    setSyncStatus("同步成功：已保存到 GitHub。", false);
    addLog("GitHub 同步成功。");
  } catch (error) {
    setSyncStatus(`同步失败：${error.message}`, true);
    addLog(`GitHub 同步失败：${error.message}`);
  } finally {
    githubSyncInFlight = false;
    if (githubSyncDirty) {
      githubSyncDirty = false;
      queueGithubSync();
    }
  }
}

async function handleSyncNow() {
  if (!canEdit()) {
    return;
  }
  const token = ensureGithubToken();
  if (!token) {
    return;
  }
  try {
    setSyncStatus("正在提交到 GitHub...", false);
    await syncDataToGithub(token, state.data);
    setSyncStatus("同步成功：已保存到 GitHub。", false);
    addLog("GitHub 手动同步成功。");
  } catch (error) {
    setSyncStatus(`同步失败：${error.message}`, true);
    addLog(`GitHub 手动同步失败：${error.message}`);
  }
}

async function syncDataToGithub(token, data) {
  const endpoint = buildContentsApiUrl(APP_CONFIG.github);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };

  let sha;
  const checkResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(APP_CONFIG.github.branch)}`, {
    method: "GET",
    headers
  });
  if (checkResponse.ok) {
    const info = await checkResponse.json();
    sha = info.sha;
  } else if (checkResponse.status !== 404) {
    throw new Error(await extractGithubError(checkResponse));
  }

  const content = utf8ToBase64(JSON.stringify(data, null, 2));
  const payload = {
    message: `chore: update MAD data ${new Date().toISOString()}`,
    content,
    branch: APP_CONFIG.github.branch
  };
  if (sha) {
    payload.sha = sha;
  }

  const putResponse = await fetch(endpoint, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!putResponse.ok) {
    throw new Error(await extractGithubError(putResponse));
  }
}

function buildContentsApiUrl(config) {
  const encodedPath = config.dataPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;
}

function buildRawDataUrl(config) {
  if (!config || !config.owner || !config.repo || !config.branch || !config.dataPath) {
    return "";
  }
  return `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/${encodeURIComponent(config.branch)}/${config.dataPath}`;
}

async function extractGithubError(response) {
  try {
    const json = await response.json();
    return json.message || `${response.status} ${response.statusText}`;
  } catch (error) {
    return `${response.status} ${response.statusText}`;
  }
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function handleEventSubmit(event) {
  event.preventDefault();
  if (!canEdit()) {
    return;
  }

  const type = dom["event-type"].value;
  const date = dom["event-date"].value;
  const location = dom["event-location"].value.trim();
  const activity = dom["event-activity"].value.trim();
  const sportTime = dom["event-sport-time"].value;
  const scoreValue = Number(dom["event-score"].value);
  const memberIds = getCheckedMemberIds();

  if (!date) {
    alert("请填写搞事日期。");
    return;
  }
  if (!memberIds.length) {
    alert("请至少选择 1 位成员。");
    return;
  }
  if ((type === "drink" || type === "meal") && !location) {
    alert("请填写地点。");
    return;
  }
  if (type === "meal" && (scoreValue < -3 || scoreValue > 3 || Number.isNaN(scoreValue))) {
    alert("Y其林评分需在 -3 到 3 之间。");
    return;
  }
  if (type === "sport" && !activity) {
    alert("请填写运动项目。");
    return;
  }
  if (type === "sport" && !sportTime) {
    alert("请填写运动时间。");
    return;
  }

  const maxImages = EVENT_TYPE_META[type].maxImages;
  let images = [];
  if (maxImages > 0) {
    try {
      images = await readImageFiles(dom["event-images"].files, maxImages);
    } catch (error) {
      alert(error.message);
      return;
    }
  }

  const item = {
    id: makeId("event"),
    type,
    date,
    location: location || "",
    memberIds,
    images,
    mealScore: type === "meal" ? scoreValue : null,
    activity: type === "sport" ? activity : "",
    sportTime: type === "sport" ? sportTime : "",
    createdAt: new Date().toISOString(),
    createdBy: state.currentUser.memberId
  };

  state.data.events.push(item);
  addLog(`${formatCNDate(date)}，新增一次${EVENT_TYPE_META[type].label}。`);
  persistLocalDraft(true);
  queueGithubSync();
  renderCalendar();
  renderSelectedDateEvents();
  renderLogList();
  dom["event-form"].reset();
  setupDefaultDates();
  applyEventTypeRules();
}

async function handleHonorSubmit(event) {
  event.preventDefault();
  if (!canEdit()) {
    return;
  }

  const date = dom["honor-date"].value;
  const memberId = dom["honor-member"].value;
  const story = dom["honor-story"].value.trim();
  if (!date || !memberId || !story) {
    alert("请完整填写全场最佳信息。");
    return;
  }

  let images = [];
  try {
    images = await readImageFiles(dom["honor-images"].files, 9);
  } catch (error) {
    alert(error.message);
    return;
  }

  state.data.honors.push({
    id: makeId("honor"),
    date,
    memberId,
    story,
    images,
    createdAt: new Date().toISOString(),
    createdBy: state.currentUser.memberId
  });
  addLog(`${formatCNDate(date)}，新增一条全场最佳。`);
  persistLocalDraft(true);
  queueGithubSync();
  renderHonorList();
  renderLogList();
  dom["honor-form"].reset();
  setupDefaultDates();
}

async function handlePetSubmit(event) {
  event.preventDefault();
  if (!canEdit()) {
    return;
  }

  const memberId = dom["pet-member"].value;
  const name = dom["pet-name"].value.trim();
  const age = Number(dom["pet-age"].value);
  if (!memberId || !name || Number.isNaN(age)) {
    alert("请完整填写灵宠信息。");
    return;
  }

  let images = [];
  try {
    images = await readImageFiles(dom["pet-images"].files, 9);
  } catch (error) {
    alert(error.message);
    return;
  }

  state.data.pets.push({
    id: makeId("pet"),
    memberId,
    name,
    age,
    images,
    createdAt: new Date().toISOString(),
    createdBy: state.currentUser.memberId
  });
  addLog(`${formatCNDate(new Date())}，新增一条灵宠记录。`);
  persistLocalDraft(true);
  queueGithubSync();
  renderPetList();
  renderLogList();
  dom["pet-form"].reset();
}

async function readImageFiles(fileList, maxCount) {
  const files = Array.from(fileList || []);
  if (files.length > maxCount) {
    throw new Error(`最多上传 ${maxCount} 张图片。`);
  }
  const maxSingleBytes = APP_CONFIG.upload.maxSingleImageMB * 1024 * 1024;
  const maxBatchBytes = APP_CONFIG.upload.maxBatchImageMB * 1024 * 1024;

  const result = [];
  let totalBytes = 0;
  for (const file of files) {
    if (!file.type || !file.type.startsWith("image/")) {
      throw new Error(`文件类型不支持：${file.name}`);
    }
    if (file.size > maxSingleBytes) {
      throw new Error(`单张图片不能超过 ${APP_CONFIG.upload.maxSingleImageMB}MB：${file.name}`);
    }

    const optimized = await readAndOptimizeImage(file);
    totalBytes += estimateDataUrlBytes(optimized);
    if (totalBytes > maxBatchBytes) {
      throw new Error(`本次上传图片总大小不能超过 ${APP_CONFIG.upload.maxBatchImageMB}MB。`);
    }
    result.push(optimized);
  }
  return result;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`读取图片失败：${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function readAndOptimizeImage(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const maxSide = APP_CONFIG.upload.autoCompressMaxSide;

  let image;
  try {
    image = await loadImage(rawDataUrl);
  } catch (error) {
    return rawDataUrl;
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    return rawDataUrl;
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  if (scale === 1 && file.size <= 2 * 1024 * 1024) {
    return rawDataUrl;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return rawDataUrl;
  }
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const compressed = canvas.toDataURL("image/jpeg", APP_CONFIG.upload.jpegQuality);
  if (!compressed || compressed.length >= rawDataUrl.length) {
    return rawDataUrl;
  }
  return compressed;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function estimateDataUrlBytes(dataUrl) {
  const parts = String(dataUrl).split(",");
  const base64 = parts.length > 1 ? parts[1] : "";
  return Math.ceil((base64.length * 3) / 4);
}

function getCheckedMemberIds() {
  const boxes = dom["event-member-checkboxes"].querySelectorAll("input[type='checkbox']");
  return Array.from(boxes)
    .filter((box) => box.checked)
    .map((box) => box.value);
}

function renderAll() {
  renderCalendar();
  renderSelectedDateEvents();
  renderHonorList();
  renderPetList();
  renderLogList();
}

function renderCalendar() {
  const year = state.calendarMonth.getFullYear();
  const month = state.calendarMonth.getMonth();
  dom["calendar-title"].textContent = `${year}年 ${month + 1}月`;

  dom["calendar-grid"].innerHTML = "";
  const fragment = document.createDocumentFragment();
  const countersByDate = buildEventCountersByDate(state.data.events);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  weekdays.forEach((name) => {
    const el = document.createElement("div");
    el.className = "calendar-weekday";
    el.textContent = name;
    fragment.appendChild(el);
  });

  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const totalCells = 42;

  for (let i = 0; i < totalCells; i += 1) {
    let dayNumber;
    let dateObj;
    let inactive = false;

    if (i < firstWeekday) {
      dayNumber = prevDays - firstWeekday + i + 1;
      dateObj = new Date(year, month - 1, dayNumber);
      inactive = true;
    } else if (i >= firstWeekday + daysInMonth) {
      dayNumber = i - (firstWeekday + daysInMonth) + 1;
      dateObj = new Date(year, month + 1, dayNumber);
      inactive = true;
    } else {
      dayNumber = i - firstWeekday + 1;
      dateObj = new Date(year, month, dayNumber);
    }

    const dateKey = toISODate(dateObj);
    const counters = countersByDate.get(dateKey) || EMPTY_COUNTER;

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day-cell";
    if (inactive) {
      cell.classList.add("inactive");
    }
    if (dateKey === state.selectedDate) {
      cell.classList.add("selected");
    }
    cell.addEventListener("click", () => {
      state.selectedDate = dateKey;
      state.calendarMonth = startOfMonth(dateObj);
      renderCalendar();
      renderSelectedDateEvents();
    });

    const dayEl = document.createElement("div");
    dayEl.className = "day-number";
    dayEl.textContent = String(dayNumber);
    cell.appendChild(dayEl);

    const dots = document.createElement("div");
    dots.className = "event-dots";
    if (counters.drink) {
      dots.appendChild(makeDot(`酒 ${counters.drink}`, "dot dot-drink"));
    }
    if (counters.meal) {
      dots.appendChild(makeDot(`饭 ${counters.meal}`, "dot dot-meal"));
    }
    if (counters.sport) {
      dots.appendChild(makeDot(`动 ${counters.sport}`, "dot dot-sport"));
    }
    cell.appendChild(dots);

    fragment.appendChild(cell);
  }
  dom["calendar-grid"].appendChild(fragment);
}

function makeDot(text, className) {
  const dot = document.createElement("span");
  dot.className = className;
  dot.textContent = text;
  return dot;
}

function buildEventCountersByDate(events = []) {
  const map = new Map();
  for (const item of events) {
    const key = item.date;
    if (!key) {
      continue;
    }
    const counter = map.get(key) || { drink: 0, meal: 0, sport: 0 };
    if (item.type === "drink") {
      counter.drink += 1;
    } else if (item.type === "meal") {
      counter.meal += 1;
    } else if (item.type === "sport") {
      counter.sport += 1;
    }
    map.set(key, counter);
  }
  return map;
}

function renderSelectedDateEvents() {
  const date = state.selectedDate;
  dom["selected-date-title"].textContent = `${formatCNDate(date)} 搞事`;
  dom["selected-date-events"].innerHTML = "";
  const fragment = document.createDocumentFragment();

  const list = state.data.events
    .filter((item) => item.date === date)
    .sort((a, b) => sortDescByTime(a.createdAt || a.date, b.createdAt || b.date));

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "当天暂无搞事。";
    fragment.appendChild(empty);
    dom["selected-date-events"].appendChild(fragment);
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "entry";
    card.appendChild(makeEntryHead(EVENT_TYPE_META[item.type].label, item.date, () => {
      removeById("events", item.id, `${formatCNDate(item.date)}，删除一条${EVENT_TYPE_META[item.type].label}。`);
    }));

    if (item.location) {
      card.appendChild(makeParagraph(`地点：${item.location}`));
    }
    if (item.type === "meal") {
      card.appendChild(makeParagraph(`Y其林评分：${item.mealScore}`));
    }
    if (item.type === "sport") {
      card.appendChild(makeParagraph(`活动：${item.activity}`));
      card.appendChild(makeParagraph(`运动时间：${item.sportTime ? item.sportTime.replace("T", " ") : "未填写"}`));
    }
    card.appendChild(makeParagraph(`成员：${toMemberNames(item.memberIds).join("、")}`));
    const images = makeImages(item.images);
    if (images) {
      card.appendChild(images);
    }
    fragment.appendChild(card);
  });
  dom["selected-date-events"].appendChild(fragment);
}

function renderHonorList() {
  dom["honor-list"].innerHTML = "";
  const fragment = document.createDocumentFragment();
  const list = [...state.data.honors].sort((a, b) => sortDescByTime(a.createdAt || a.date, b.createdAt || b.date));

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "暂无全场最佳记录。";
    fragment.appendChild(empty);
    dom["honor-list"].appendChild(fragment);
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "entry";
    const member = getMember(item.memberId);
    card.appendChild(makeEntryHead(`${member.name} 的全场最佳`, item.date, () => {
      removeById("honors", item.id, `${formatCNDate(item.date)}，删除一条全场最佳。`);
    }, member));
    card.appendChild(makeParagraph(item.story));
    const images = makeImages(item.images);
    if (images) {
      card.appendChild(images);
    }
    fragment.appendChild(card);
  });
  dom["honor-list"].appendChild(fragment);
}

function renderPetList() {
  dom["pet-list"].innerHTML = "";
  const fragment = document.createDocumentFragment();
  const list = [...state.data.pets].sort((a, b) => sortDescByTime(a.createdAt, b.createdAt));

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "暂无灵宠记录。";
    fragment.appendChild(empty);
    dom["pet-list"].appendChild(fragment);
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "entry";
    const member = getMember(item.memberId);
    card.appendChild(makeEntryHead(`${item.name} · ${item.age} 岁`, member.name, () => {
      removeById("pets", item.id, `${formatCNDate(new Date())}，删除一条灵宠记录。`);
    }, member));
    const images = makeImages(item.images);
    if (images) {
      card.appendChild(images);
    }
    fragment.appendChild(card);
  });
  dom["pet-list"].appendChild(fragment);
}

function renderLogList() {
  dom["log-list"].innerHTML = "";
  const fragment = document.createDocumentFragment();
  const list = [...state.data.logs].sort((a, b) => sortDescByTime(a.timestamp, b.timestamp)).slice(0, 80);

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "暂无更新日志。";
    fragment.appendChild(empty);
    dom["log-list"].appendChild(fragment);
    return;
  }

  list.forEach((log) => {
    const row = document.createElement("div");
    row.className = "entry";
    const actor = getActorName(log.actorId);
    row.appendChild(makeParagraph(`${formatDateTime(log.timestamp)} · ${actor}`));
    row.appendChild(makeParagraph(log.text));
    fragment.appendChild(row);
  });
  dom["log-list"].appendChild(fragment);
}

function makeEntryHead(title, extra, onDelete, member) {
  const head = document.createElement("div");
  head.className = "entry-head";
  const left = document.createElement("div");
  if (member) {
    const person = document.createElement("span");
    person.className = "person";
    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.src = member.avatar;
    avatar.alt = member.name;
    avatar.loading = "lazy";
    avatar.decoding = "async";
    const avatarShell = document.createElement("span");
    avatarShell.className = "avatar-shell";
    avatarShell.appendChild(avatar);
    person.appendChild(avatarShell);
    const txt = document.createElement("strong");
    txt.textContent = title;
    person.appendChild(txt);
    left.appendChild(person);
  } else {
    const strong = document.createElement("strong");
    strong.textContent = title;
    left.appendChild(strong);
  }

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent = extra;
  left.appendChild(info);
  head.appendChild(left);

  if (canEdit()) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "删除";
    del.addEventListener("click", onDelete);
    head.appendChild(del);
  }
  return head;
}

function makeParagraph(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

function makeImages(images = []) {
  if (!images || !images.length) {
    return null;
  }
  const wrap = document.createElement("div");
  wrap.className = "images";
  images.forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "上传图片";
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("click", () => openImageViewer(src));
    wrap.appendChild(img);
  });
  return wrap;
}

function openImageViewer(src) {
  if (!dom["image-viewer"] || !dom["image-viewer-img"]) {
    return;
  }
  dom["image-viewer-img"].src = src;
  dom["image-viewer"].classList.add("open");
  dom["image-viewer"].setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  if (!dom["image-viewer"] || !dom["image-viewer-img"]) {
    return;
  }
  dom["image-viewer"].classList.remove("open");
  dom["image-viewer"].setAttribute("aria-hidden", "true");
  dom["image-viewer-img"].src = "";
  document.body.style.overflow = "";
}

async function removeById(collectionName, id, logText) {
  if (!canEdit()) {
    return;
  }
  if (!window.confirm("确认删除这条记录？")) {
    return;
  }
  const list = state.data[collectionName];
  const next = list.filter((item) => item.id !== id);
  state.data[collectionName] = next;
  addLog(logText);
  persistLocalDraft(true);
  queueGithubSync();
  if (collectionName === "events") {
    renderCalendar();
    renderSelectedDateEvents();
  } else if (collectionName === "honors") {
    renderHonorList();
  } else if (collectionName === "pets") {
    renderPetList();
  }
  renderLogList();
}

function addLog(text) {
  state.data.logs.unshift({
    id: makeId("log"),
    text,
    actorId: state.currentUser.memberId,
    timestamp: new Date().toISOString()
  });
  state.data.logs = state.data.logs.slice(0, 200);
  state.data.updatedAt = new Date().toISOString();
}


function normalizeData(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    version: Number(source.version || 1),
    updatedAt: source.updatedAt || new Date().toISOString(),
    settings: {
      siteTitle: source.settings?.siteTitle || APP_CONFIG.siteTitle,
      siteTagline: source.settings?.siteTagline || APP_CONFIG.siteTagline,
      tickerText: source.settings?.tickerText || APP_CONFIG.tickerText
    },
    members: Array.isArray(source.members) && source.members.length ? source.members : APP_CONFIG.members,
    events: Array.isArray(source.events) ? source.events : [],
    honors: Array.isArray(source.honors) ? source.honors : [],
    pets: Array.isArray(source.pets) ? source.pets : [],
    logs: Array.isArray(source.logs) ? source.logs : []
  };
}

function mergeData(primary, fallback) {
  const merged = normalizeData(primary);
  const fallbackData = normalizeData(fallback);
  const mergedSettings = merged.settings || {};
  const fallbackSettings = fallbackData.settings || {};
  const mergedIsDefault =
    mergedSettings.siteTitle === APP_CONFIG.siteTitle &&
    mergedSettings.siteTagline === APP_CONFIG.siteTagline &&
    mergedSettings.tickerText === APP_CONFIG.tickerText;
  const fallbackIsDifferent =
    fallbackSettings.siteTitle !== APP_CONFIG.siteTitle ||
    fallbackSettings.siteTagline !== APP_CONFIG.siteTagline ||
    fallbackSettings.tickerText !== APP_CONFIG.tickerText;
  if (mergedIsDefault && fallbackIsDifferent) {
    merged.settings = fallbackSettings;
  }

  const mergedMembers = Array.isArray(merged.members) ? merged.members : [];
  const fallbackMembers = Array.isArray(fallbackData.members) ? fallbackData.members : [];
  const mergedLooksDefault = isSameMembers(mergedMembers, APP_CONFIG.members);
  const fallbackLooksDifferent = !isSameMembers(fallbackMembers, APP_CONFIG.members);
  if ((mergedMembers.length === 0 || mergedLooksDefault) && fallbackLooksDifferent) {
    merged.members = fallbackMembers;
  }
  return merged;
}

function isSameMembers(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every((item, idx) => {
    const other = b[idx];
    if (!other) {
      return false;
    }
    return item.id === other.id && item.name === other.name && item.avatar === other.avatar;
  });
}

function createEmptyData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    settings: {
      siteTitle: APP_CONFIG.siteTitle,
      siteTagline: APP_CONFIG.siteTagline,
      tickerText: APP_CONFIG.tickerText
    },
    members: APP_CONFIG.members,
    events: [],
    honors: [],
    pets: [],
    logs: []
  };
}

function getMember(memberId) {
  return MEMBER_MAP.get(memberId) || UNKNOWN_MEMBER;
}

function getActorName(actorId) {
  if (!actorId) {
    return "系统";
  }
  if (actorId === ADMIN_ACTOR_ID) {
    return "管理员";
  }
  return getMember(actorId).name;
}

function toMemberNames(memberIds = []) {
  return memberIds.map((id) => getMember(id).name);
}

function setSyncStatus(message, isError) {
  const status = dom["sync-status"];
  if (!status) {
    return;
  }
  status.textContent = `同步状态：${message}`;
  status.style.borderColor = isError ? "rgba(207, 63, 69, 0.35)" : "rgba(92, 107, 255, 0.28)";
}

function makeId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toISODate(dateInput) {
  const date = parseDateInput(dateInput);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatCNDate(input) {
  const date = parseDateInput(input);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateTime(input) {
  const date = parseDateInput(input);
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${formatCNDate(date)} ${hh}:${mm}`;
}

function sortDescByTime(a, b) {
  return String(b || "").localeCompare(String(a || ""));
}

function parseDateInput(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "string") {
    return new Date(value);
  }
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
  const matched = value.match(isoDateOnly);
  if (matched) {
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

