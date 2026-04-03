/* 可修改接口：站点名称、标语、8 位成员资料、GitHub 默认仓库配置 */
const APP_CONFIG = {
  siteTitle: "MAD",
  siteTagline: "内部娱乐网站 · 记录你们的高光和糗事",
  ui: {
    showGithubPanel: false
  },
  upload: {
    maxSingleImageMB: 12,
    maxBatchImageMB: 24,
    autoCompressMaxSide: 1600,
    jpegQuality: 0.82
  },
  members: [
    { id: "m1", name: "阿凯", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Kai", password: "mad001" },
    { id: "m2", name: "阿林", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lin", password: "mad002" },
    { id: "m3", name: "阿哲", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Zhe", password: "mad003" },
    { id: "m4", name: "阿宇", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Yu", password: "mad004" },
    { id: "m5", name: "阿周", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Zhou", password: "mad005" },
    { id: "m6", name: "阿南", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Nan", password: "mad006" },
    { id: "m7", name: "阿浩", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Hao", password: "mad007" },
    { id: "m8", name: "阿飞", avatar: "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Fei", password: "mad008" }
  ],
  githubDefaults: {
    owner: "huangjialinn",
    repo: "mad.github.io",
    branch: "main",
    dataPath: "data/mad-data.json"
  }
};

const STORAGE_KEYS = {
  draft: "mad_local_draft_v1",
  githubConfig: "mad_github_config_v1"
};

const EVENT_TYPE_META = {
  drink: { label: "喝酒记录", maxImages: 1 },
  meal: { label: "吃饭记录", maxImages: 9 },
  sport: { label: "群体运动记录", maxImages: 0 }
};

const MEMBER_MAP = new Map(APP_CONFIG.members.map((member) => [member.id, member]));
const UNKNOWN_MEMBER = { id: "unknown", name: "未知成员", avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=unknown" };
const EMPTY_COUNTER = Object.freeze({ drink: 0, meal: 0, sport: 0 });

const state = {
  data: createEmptyData(),
  currentUser: { role: "guest", memberId: null, name: "访客" },
  selectedDate: toISODate(new Date()),
  calendarMonth: startOfMonth(new Date()),
  githubConfig: { ...APP_CONFIG.githubDefaults }
};

const dom = {};
let draftPersistHandle = null;
let draftPersistMode = null;
let pendingDraftText = "";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();
  applyHeader();
  applyFeatureVisibility();
  initGithubConfig();
  populateMemberControls();
  bindEvents();
  setupDefaultDates();
  applyEventTypeRules();
  refreshPermissionUI();
  window.addEventListener("beforeunload", flushPendingDraftSync);

  await loadDataFromPages();
  renderAll();
}

function cacheDom() {
  const ids = [
    "site-title",
    "site-tagline",
    "login-member",
    "login-password",
    "member-login-form",
    "github-panel",
    "guest-login-btn",
    "logout-btn",
    "login-status",
    "gh-owner",
    "gh-repo",
    "gh-branch",
    "gh-path",
    "gh-token",
    "save-gh-config-btn",
    "reload-data-btn",
    "sync-github-btn",
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
  dom["site-tagline"].textContent = APP_CONFIG.siteTagline;
}

function applyFeatureVisibility() {
  if (!APP_CONFIG.ui.showGithubPanel && dom["github-panel"]) {
    dom["github-panel"].classList.add("hidden");
  }
}

function initGithubConfig() {
  const stored = localStorage.getItem(STORAGE_KEYS.githubConfig);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state.githubConfig = { ...state.githubConfig, ...parsed };
    } catch (error) {
      console.warn("GitHub 配置读取失败，将使用默认配置", error);
    }
  }
  fillGithubInputs();
}

function fillGithubInputs() {
  dom["gh-owner"].value = state.githubConfig.owner || "";
  dom["gh-repo"].value = state.githubConfig.repo || "";
  dom["gh-branch"].value = state.githubConfig.branch || "main";
  dom["gh-path"].value = state.githubConfig.dataPath || "data/mad-data.json";
}

function readGithubConfigInputs() {
  return {
    owner: dom["gh-owner"].value.trim(),
    repo: dom["gh-repo"].value.trim(),
    branch: dom["gh-branch"].value.trim() || "main",
    dataPath: dom["gh-path"].value.trim() || "data/mad-data.json"
  };
}

function saveGithubConfig() {
  state.githubConfig = readGithubConfigInputs();
  localStorage.setItem(STORAGE_KEYS.githubConfig, JSON.stringify(state.githubConfig));
  setSyncStatus("已保存 GitHub 配置。", false);
}

function populateMemberControls() {
  dom["login-member"].innerHTML = "";
  dom["honor-member"].innerHTML = "";
  dom["pet-member"].innerHTML = "";
  dom["event-member-checkboxes"].innerHTML = "";
  const loginFragment = document.createDocumentFragment();
  const honorFragment = document.createDocumentFragment();
  const petFragment = document.createDocumentFragment();
  const chipsFragment = document.createDocumentFragment();

  APP_CONFIG.members.forEach((member) => {
    const loginOption = document.createElement("option");
    loginOption.value = member.id;
    loginOption.textContent = member.name;
    loginFragment.appendChild(loginOption);

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

  dom["login-member"].appendChild(loginFragment);
  dom["honor-member"].appendChild(honorFragment);
  dom["pet-member"].appendChild(petFragment);
  dom["event-member-checkboxes"].appendChild(chipsFragment);
}

function bindEvents() {
  dom["member-login-form"].addEventListener("submit", handleMemberLogin);
  dom["guest-login-btn"].addEventListener("click", () => {
    state.currentUser = { role: "guest", memberId: null, name: "访客" };
    refreshPermissionUI();
    setLoginStatus();
  });
  dom["logout-btn"].addEventListener("click", () => {
    state.currentUser = { role: "guest", memberId: null, name: "访客" };
    refreshPermissionUI();
    setLoginStatus();
  });

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

  dom["save-gh-config-btn"].addEventListener("click", saveGithubConfig);
  dom["reload-data-btn"].addEventListener("click", async () => {
    await loadDataFromPages();
    renderAll();
  });
  dom["sync-github-btn"].addEventListener("click", handleSyncToGithub);
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
    ? "喝酒记录最多 1 张图片。"
    : type === "meal"
      ? "吃饭记录最多 9 张图片。"
      : "运动记录不需要图片。";
  dom["event-image-hint"].textContent = hint;
}

function handleMemberLogin(event) {
  event.preventDefault();
  const memberId = dom["login-member"].value;
  const password = dom["login-password"].value;

  const target = APP_CONFIG.members.find((member) => member.id === memberId);
  if (!target || target.password !== password) {
    alert("成员或密码错误。");
    return;
  }

  state.currentUser = {
    role: "member",
    memberId: target.id,
    name: target.name
  };
  dom["login-password"].value = "";
  refreshPermissionUI();
  setLoginStatus();
}

function setLoginStatus() {
  if (canEdit()) {
    dom["login-status"].textContent = `当前状态：成员 ${state.currentUser.name}（可编辑）`;
  } else {
    dom["login-status"].textContent = "当前状态：只读模式（访客）";
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
  setLoginStatus();
  renderSelectedDateEvents();
  renderHonorList();
  renderPetList();
}

function canEdit() {
  return state.currentUser.role === "member";
}

async function loadDataFromPages() {
  const config = readGithubConfigInputs();
  state.githubConfig = config;
  const path = config.dataPath || "data/mad-data.json";

  try {
    const response = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const raw = await response.json();
    state.data = normalizeData(raw);
    persistLocalDraft(true);
    setSyncStatus(`读取成功：${path}`, false);
  } catch (error) {
    const fallback = loadLocalDraft();
    if (fallback) {
      state.data = fallback;
      setSyncStatus(`读取远程失败，已使用本地草稿：${error.message}`, true);
      return;
    }
    state.data = createEmptyData();
    setSyncStatus(`读取失败，已初始化空数据：${error.message}`, true);
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
    alert("请填写事件日期。");
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
  persistLocalDraft();
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
    alert("请完整填写糗事信息。");
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
  addLog(`${formatCNDate(date)}，新增一条成员糗事。`);
  persistLocalDraft();
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
    alert("请完整填写宠物信息。");
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
  addLog(`${formatCNDate(new Date())}，新增一条宠物记录。`);
  persistLocalDraft();
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
  dom["selected-date-title"].textContent = `${formatCNDate(date)} 事件`;
  dom["selected-date-events"].innerHTML = "";
  const fragment = document.createDocumentFragment();

  const list = state.data.events
    .filter((item) => item.date === date)
    .sort((a, b) => sortDescByTime(a.createdAt || a.date, b.createdAt || b.date));

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "当天暂无事件。";
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
    empty.textContent = "暂无糗事记录。";
    fragment.appendChild(empty);
    dom["honor-list"].appendChild(fragment);
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "entry";
    const member = getMember(item.memberId);
    card.appendChild(makeEntryHead(`${member.name} 的糗事`, item.date, () => {
      removeById("honors", item.id, `${formatCNDate(item.date)}，删除一条成员糗事。`);
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
    empty.textContent = "暂无宠物记录。";
    fragment.appendChild(empty);
    dom["pet-list"].appendChild(fragment);
    return;
  }

  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "entry";
    const member = getMember(item.memberId);
    card.appendChild(makeEntryHead(`${item.name} · ${item.age} 岁`, member.name, () => {
      removeById("pets", item.id, `${formatCNDate(new Date())}，删除一条宠物记录。`);
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
    const actor = log.actorId ? getMember(log.actorId).name : "系统";
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
    person.appendChild(avatar);
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
  persistLocalDraft();
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

async function handleSyncToGithub() {
  if (!canEdit()) {
    return;
  }
  const config = readGithubConfigInputs();
  const token = dom["gh-token"].value.trim();
  if (!config.owner || !config.repo || !config.branch || !config.dataPath) {
    alert("请完整填写 GitHub Owner/Repo/Branch/Data Path。");
    return;
  }
  if (!token) {
    alert("请填写 GitHub PAT。");
    return;
  }

  state.githubConfig = config;
  localStorage.setItem(STORAGE_KEYS.githubConfig, JSON.stringify(config));

  try {
    setSyncStatus("正在提交到 GitHub...", false);
    await syncDataFileToGithub(config, token, state.data);
    setSyncStatus("同步成功：数据已提交到 GitHub。", false);
  } catch (error) {
    setSyncStatus(`同步失败：${error.message}`, true);
  }
}

async function syncDataFileToGithub(config, token, data) {
  const endpoint = buildContentsApiUrl(config);
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };

  let sha;
  const checkResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(config.branch)}`, {
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
    branch: config.branch
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

function normalizeData(raw) {
  return {
    version: Number(raw.version || 1),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    events: Array.isArray(raw.events) ? raw.events : [],
    honors: Array.isArray(raw.honors) ? raw.honors : [],
    pets: Array.isArray(raw.pets) ? raw.pets : [],
    logs: Array.isArray(raw.logs) ? raw.logs : []
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
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatCNDate(input) {
  const date = typeof input === "string" ? new Date(input) : input;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateTime(input) {
  const date = typeof input === "string" ? new Date(input) : input;
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${formatCNDate(date)} ${hh}:${mm}`;
}

function sortDescByTime(a, b) {
  return String(b || "").localeCompare(String(a || ""));
}
