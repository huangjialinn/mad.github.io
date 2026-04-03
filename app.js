/* 可修改配置：站点名称、标语、成员资料、云端持久化接口 */
const APP_CONFIG = {
  siteTitle: "一车面包人",
  siteTagline: "这是一个减肥群",
  tickerText: "李柏辰是GAY",
  adminPassword: "2026",
  ui: {
    showCloudPanel: false
  },
  persistence: {
    autoSyncOnChange: true,
    saveDebounceMs: 0,
    cloudApiBase: "",
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
  cloudDefaults: {
    endpoint: ""
  }
};

const STORAGE_KEYS = {
  draft: "mad_local_draft_v1",
  cloudConfig: "mad_cloud_config_v1"
};

const EVENT_TYPE_META = {
  drink: { label: "DRINK", maxImages: 1 },
  meal: { label: "HUNT", maxImages: 9 },
  sport: { label: "SPORT", maxImages: 0 }
};

const MEMBER_MAP = new Map(APP_CONFIG.members.map((member) => [member.id, member]));
const UNKNOWN_MEMBER = { id: "unknown", name: "未知成员", avatar: "./png/p1.png" };
const EMPTY_COUNTER = Object.freeze({ drink: 0, meal: 0, sport: 0 });
const ADMIN_ACTOR_ID = "admin";

const state = {
  data: createEmptyData(),
  currentUser: { role: "guest", memberId: null, name: "访客" },
  selectedDate: toISODate(new Date()),
  calendarMonth: startOfMonth(new Date()),
  cloudConfig: { ...APP_CONFIG.cloudDefaults },
  adminSessionPassword: ""
};

const dom = {};
let draftPersistHandle = null;
let draftPersistMode = null;
let pendingDraftText = "";
let autoSyncInFlight = false;
let autoSyncDirty = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();
  applyHeader();
  applyFeatureVisibility();
  initCloudConfig();
  populateMemberControls();
  bindEvents();
  setupDefaultDates();
  applyEventTypeRules();
  refreshPermissionUI();
  window.addEventListener("beforeunload", flushPendingDraftSync);

  await loadDataFromCloud();
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
    "admin-login-form",
    "cloud-panel",
    "login-status",
    "api-endpoint",
    "save-api-config-btn",
    "reload-data-btn",
    "sync-cloud-btn",
    "sync-status",
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

function applyFeatureVisibility() {
  if (!APP_CONFIG.ui.showCloudPanel && dom["cloud-panel"]) {
    dom["cloud-panel"].classList.add("hidden");
  }
}

function initCloudConfig() {
  const stored = localStorage.getItem(STORAGE_KEYS.cloudConfig);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state.cloudConfig = { ...state.cloudConfig, ...parsed };
    } catch (error) {
      console.warn("云端配置读取失败，将使用默认配置", error);
    }
  }
  fillCloudInputs();
}

function fillCloudInputs() {
  dom["api-endpoint"].value = state.cloudConfig.endpoint || APP_CONFIG.persistence.cloudApiBase || "";
}

function readCloudConfigInputs() {
  return {
    endpoint: dom["api-endpoint"].value.trim()
  };
}

function saveCloudConfig() {
  state.cloudConfig = readCloudConfigInputs();
  localStorage.setItem(STORAGE_KEYS.cloudConfig, JSON.stringify(state.cloudConfig));
  setSyncStatus("已保存云端配置。", false);
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

function bindEvents() {
  dom["admin-login-form"].addEventListener("submit", handleAdminLogin);
  dom["manage-toggle-btn"].addEventListener("click", handleManageToggle);

  dom["event-type"].addEventListener("change", applyEventTypeRules);
  dom["event-form"].addEventListener("submit", handleEventSubmit);
  dom["honor-form"].addEventListener("submit", handleHonorSubmit);
  dom["pet-form"].addEventListener("submit", handlePetSubmit);

  dom["prev-month-btn"].addEventListener("click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() - 1,
      1
    );
    renderCalendar();
  });
  dom["next-month-btn"].addEventListener("click", () => {
    state.calendarMonth = new Date(
      state.calendarMonth.getFullYear(),
      state.calendarMonth.getMonth() + 1,
      1
    );
    renderCalendar();
  });

  dom["save-api-config-btn"].addEventListener("click", saveCloudConfig);
  dom["reload-data-btn"].addEventListener("click", async () => {
    await loadDataFromCloud();
    renderAll();
  });
  dom["sync-cloud-btn"].addEventListener("click", handleSyncToCloud);
}

function handleManageToggle() {
  if (canEdit()) {
    state.currentUser = { role: "guest", memberId: null, name: "访客" };
    state.adminSessionPassword = "";
    dom["admin-password"].value = "";
    toggleLoginPanel(false);
    refreshPermissionUI();
    setLoginStatus();
    return;
  }

  const shouldShow = dom["login-panel"].classList.contains("hidden");
  toggleLoginPanel(shouldShow);
  if (shouldShow) {
    dom["admin-password"].focus();
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
  const cloudConfig = readCloudConfigInputs();
  state.cloudConfig = cloudConfig;

  if (!password) {
    alert("请输入管理密码。");
    return;
  }

  if (cloudConfig.endpoint) {
    const verified = await verifyAdminPassword(cloudConfig, password);
    if (!verified) {
      if (password !== APP_CONFIG.adminPassword) {
        alert("管理密码错误或云端认证失败。");
        return;
      }
      setSyncStatus("云端认证失败，已进入本地管理模式。", true);
    }
  } else if (password !== APP_CONFIG.adminPassword) {
    alert("管理密码错误。");
    return;
  }

  state.currentUser = {
    role: "admin",
    memberId: ADMIN_ACTOR_ID,
    name: "管理员"
  };
  state.adminSessionPassword = password;
  dom["admin-password"].value = "";
  toggleLoginPanel(false);
  refreshPermissionUI();
  setLoginStatus();
}

async function verifyAdminPassword(config, password) {
  const endpoint = buildCloudApiUrl(config.endpoint, "/auth");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "X-Admin-Password": password }
    });
    return response.ok;
  } catch (error) {
    setSyncStatus(`云端认证失败：${error.message}`, true);
    return false;
  }
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

async function loadDataFromCloud() {
  const config = readCloudConfigInputs();
  state.cloudConfig = config;
  const hasCloudEndpoint = Boolean(config.endpoint);
  const sourceLabel = hasCloudEndpoint ? "云端" : "本地数据文件";
  const path = hasCloudEndpoint
    ? buildCloudApiUrl(config.endpoint, "/mad-data")
    : APP_CONFIG.persistence.localDataPath || "data/mad-data.json";
  const localDraft = loadLocalDraft();

  try {
    const response = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const remoteData = normalizeData(await response.json());
    if (localDraft) {
      const localTs = getDataTimestamp(localDraft);
      const remoteTs = getDataTimestamp(remoteData);
      if (localTs >= remoteTs) {
        state.data = localDraft;
        setSyncStatus(`已读取本地最新草稿（覆盖${sourceLabel}旧数据）`, false);
      } else {
        state.data = remoteData;
        setSyncStatus(`已读取${sourceLabel}数据`, false);
      }
    } else {
      state.data = remoteData;
      setSyncStatus(`已读取${sourceLabel}数据`, false);
    }
    persistLocalDraft(true);
  } catch (error) {
    if (localDraft) {
      state.data = localDraft;
      setSyncStatus(`读取${sourceLabel}失败，已使用本地草稿：${error.message}`, true);
      return;
    }
    state.data = createEmptyData();
    setSyncStatus(`读取${sourceLabel}失败，已初始化空数据：${error.message}`, true);
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
  queueAutoSync();
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
  queueAutoSync();
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
  queueAutoSync();
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
    wrap.appendChild(img);
  });
  return wrap;
}

function removeById(collectionName, id, logText) {
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
  queueAutoSync();
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

function queueAutoSync() {
  if (!canEdit() || !APP_CONFIG.persistence.autoSyncOnChange) {
    return;
  }

  const endpoint = getCloudEndpoint();
  if (!endpoint) {
    setSyncStatus("未配置云端接口地址，当前仅本地保存，跨端不可见。", true);
    return;
  }
  if (!state.adminSessionPassword) {
    setSyncStatus("管理会话已失效，请重新进入管理模式。", true);
    return;
  }

  if (autoSyncInFlight) {
    autoSyncDirty = true;
    return;
  }
  void runAutoSync();
}

async function runAutoSync() {
  if (autoSyncInFlight) {
    autoSyncDirty = true;
    return;
  }
  autoSyncInFlight = true;
  state.cloudConfig = readCloudConfigInputs();
  try {
    await syncDataToCloud(state.cloudConfig, state.adminSessionPassword, state.data);
    setSyncStatus("自动同步成功：已保存到云端。", false);
  } catch (error) {
    setSyncStatus(`自动同步失败：${error.message}`, true);
  } finally {
    autoSyncInFlight = false;
    if (autoSyncDirty) {
      autoSyncDirty = false;
      queueAutoSync();
    }
  }
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

async function handleSyncToCloud() {
  if (!canEdit()) {
    return;
  }
  const config = readCloudConfigInputs();
  if (!config.endpoint) {
    alert("请先填写云端接口地址。");
    return;
  }
  if (!state.adminSessionPassword) {
    alert("管理会话已失效，请重新登录管理模式。");
    return;
  }

  state.cloudConfig = config;
  localStorage.setItem(STORAGE_KEYS.cloudConfig, JSON.stringify(config));

  try {
    setSyncStatus("正在提交到云端...", false);
    await syncDataToCloud(config, state.adminSessionPassword, state.data);
    setSyncStatus("同步成功：数据已提交到云端。", false);
  } catch (error) {
    setSyncStatus(`同步失败：${error.message}`, true);
  }
}

async function syncDataToCloud(config, adminPassword, data) {
  const endpoint = buildCloudApiUrl(config.endpoint, "/mad-data");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": adminPassword
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error(await extractApiError(response));
  }
}

function getCloudEndpoint() {
  const inputValue = dom["api-endpoint"] ? dom["api-endpoint"].value.trim() : "";
  if (inputValue) {
    return inputValue;
  }
  if (state.cloudConfig.endpoint) {
    return state.cloudConfig.endpoint;
  }
  return (APP_CONFIG.persistence.cloudApiBase || "").trim();
}

function buildCloudApiUrl(baseUrl, pathname) {
  const base = String(baseUrl || "").trim();
  if (!base) {
    return "";
  }
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}${pathname}`;
}

async function extractApiError(response) {
  try {
    const json = await response.json();
    return json.message || `${response.status} ${response.statusText}`;
  } catch (error) {
    return `${response.status} ${response.statusText}`;
  }
}

function normalizeData(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    version: Number(source.version || 1),
    updatedAt: source.updatedAt || new Date().toISOString(),
    events: Array.isArray(source.events) ? source.events : [],
    honors: Array.isArray(source.honors) ? source.honors : [],
    pets: Array.isArray(source.pets) ? source.pets : [],
    logs: Array.isArray(source.logs) ? source.logs : []
  };
}

function createEmptyData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
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
  dom["sync-status"].textContent = `同步状态：${message}`;
  dom["sync-status"].style.borderColor = isError ? "rgba(207, 63, 69, 0.35)" : "rgba(92, 107, 255, 0.28)";
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

