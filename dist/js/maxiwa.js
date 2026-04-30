var MaxiwaKpiApp = (() => {
  const { useEffect, useMemo, useState, useCallback } = React;
  const SESSION_KEY = "maxiwa-kpi-session";
  const SESSION_ID_KEY = "maxiwa-kpi-session-id";
  const SESSION_LOCK_KEY = "maxiwa-kpi-active-session";
  const SESSION_LOCK_TTL = 45e3;
  const THEME_KEY = "maxiwa-kpi-theme";
  const RUNTIME_SESSION_ID = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const MONTH_NAMES = [
    "\u0E21\u0E01\u0E23\u0E32\u0E04\u0E21",
    "\u0E01\u0E38\u0E21\u0E20\u0E32\u0E1E\u0E31\u0E19\u0E18\u0E4C",
    "\u0E21\u0E35\u0E19\u0E32\u0E04\u0E21",
    "\u0E40\u0E21\u0E29\u0E32\u0E22\u0E19",
    "\u0E1E\u0E24\u0E29\u0E20\u0E32\u0E04\u0E21",
    "\u0E21\u0E34\u0E16\u0E38\u0E19\u0E32\u0E22\u0E19",
    "\u0E01\u0E23\u0E01\u0E0E\u0E32\u0E04\u0E21",
    "\u0E2A\u0E34\u0E07\u0E2B\u0E32\u0E04\u0E21",
    "\u0E01\u0E31\u0E19\u0E22\u0E32\u0E22\u0E19",
    "\u0E15\u0E38\u0E25\u0E32\u0E04\u0E21",
    "\u0E1E\u0E24\u0E28\u0E08\u0E34\u0E01\u0E32\u0E22\u0E19",
    "\u0E18\u0E31\u0E19\u0E27\u0E32\u0E04\u0E21"
  ];
  const NAV_BY_ROLE = {
    Staff: [
      { id: "dashboard", label: "My Dashboard", icon: "fa-chart-line" },
      { id: "tasks", label: "My Tasks", icon: "fa-list-check" },
      { id: "create", label: "Create Task", icon: "fa-square-plus" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project" }
    ],
    Lead: [
      { id: "dashboard", label: "Team Command", icon: "fa-chart-line" },
      { id: "tasks", label: "Team Tasks", icon: "fa-list-check" },
      { id: "assign", label: "Assign Task", icon: "fa-user-plus" },
      { id: "people", label: "Team People", icon: "fa-users" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project" }
    ],
    Manager: [
      { id: "dashboard", label: "Executive Dashboard", icon: "fa-chart-line" },
      { id: "tasks", label: "Task Center", icon: "fa-list-check" },
      { id: "assign", label: "Assign Task", icon: "fa-user-plus" },
      { id: "people", label: "People", icon: "fa-users-viewfinder" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project" },
      { id: "admin", label: "Admin Studio", icon: "fa-shield-halved" }
    ],
    Admin: [
      { id: "dashboard", label: "System Dashboard", icon: "fa-chart-line" },
      { id: "admin", label: "Admin Studio", icon: "fa-shield-halved" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project" }
    ]
  };
  const ROLE_HOME = { Staff: "dashboard", Lead: "dashboard", Manager: "dashboard", Admin: "dashboard" };
  function cn(...values) {
    return values.filter(Boolean).join(" ");
  }
  function apiBase() {
    return typeof window !== "undefined" && window.API_BASE ? window.API_BASE : "/api";
  }
  function adminHeaders(empId) {
    return { "Content-Type": "application/json", "x-admin-empid": empId || "" };
  }
  async function adminGet(path, empId) {
    const res = await fetch(`${apiBase()}/${path}`, { headers: adminHeaders(empId) });
    return res.json();
  }
  async function adminPost(path, payload, empId) {
    const res = await fetch(`${apiBase()}/${path}`, {
      method: "POST",
      headers: adminHeaders(empId),
      body: JSON.stringify(payload)
    });
    return res.json();
  }
  async function adminDelete(path, empId) {
    const res = await fetch(`${apiBase()}/${path}`, {
      method: "DELETE",
      headers: adminHeaders(empId)
    });
    return res.json();
  }
  function formatDate(value, withTime = false) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", withTime ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { year: "numeric", month: "short", day: "numeric" });
  }
  function parseJsonSafe(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  function safeSessionGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function safeSessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
    }
  }
  function safeSessionRemove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
    }
  }
  function safeLocalGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function safeLocalSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
    }
  }
  function safeLocalRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
    }
  }
  function getBrowserSessionId() {
    safeSessionSet(SESSION_ID_KEY, RUNTIME_SESSION_ID);
    return RUNTIME_SESSION_ID;
  }
  function getActiveSessionLock() {
    const lock = parseJsonSafe(safeLocalGet(SESSION_LOCK_KEY), null);
    if (!(lock == null ? void 0 : lock.empId) || !(lock == null ? void 0 : lock.sessionId) || !(lock == null ? void 0 : lock.expiresAt)) return null;
    if (Number(lock.expiresAt) <= Date.now()) {
      safeLocalRemove(SESSION_LOCK_KEY);
      return null;
    }
    return lock;
  }
  function writeActiveSessionLock(user) {
    if (!(user == null ? void 0 : user.empId) && !(user == null ? void 0 : user.empid)) return;
    safeLocalSet(SESSION_LOCK_KEY, JSON.stringify({
      empId: String(user.empId || user.empid).trim(),
      name: user.name || "",
      sessionId: getBrowserSessionId(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_LOCK_TTL
    }));
  }
  function clearActiveSessionLock() {
    const lock = getActiveSessionLock();
    if (!lock || lock.sessionId === getBrowserSessionId()) safeLocalRemove(SESSION_LOCK_KEY);
  }
  function isLoginLocked(empId) {
    const lock = getActiveSessionLock();
    if (!lock) return false;
    return String(lock.empId).toLowerCase() === String(empId || "").trim().toLowerCase() && lock.sessionId !== getBrowserSessionId();
  }
  function getStatusClass(status) {
    if (status === "Completed") return "mx-status-completed";
    if (status === "On Process") return "mx-status-process";
    if (status === "Pending") return "mx-status-pending";
    if (status === "On Hold") return "mx-status-hold";
    return "mx-status-cancelled";
  }
  function extractJobCode(jobStr) {
    if (!jobStr) return "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2B\u0E31\u0E2A";
    const match = jobStr.match(/^([A-Za-z]+\d+_\d+)/);
    return match ? match[1].toUpperCase() : jobStr.substring(0, 20);
  }
  function getTimestamp() {
    const now = /* @__PURE__ */ new Date();
    return `[${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}]`;
  }
  function renderExtraData(extraData) {
    const ed = extraData || {};
    const entries = [
      ["Building", ed.building],
      ["Client", ed.client],
      ["Contractor", ed.contractor],
      ["Contractor Name", ed.contractorName],
      ["Type", ed.contractorType],
      ["SSR", ed.ssrNumber],
      ["OSP", ed.ospNumber],
      ["Fund", ed.fundNumber],
      ["Amount", ed.amount ? Number(ed.amount).toLocaleString("th-TH") : ""]
    ].filter(([, v]) => v !== void 0 && v !== null && v !== "");
    if (entries.length === 0) return null;
    return /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, entries.map(([label, value]) => /* @__PURE__ */ React.createElement("span", { key: label, className: "mx-badge mx-status-process" }, label, ": ", value)));
  }
  function getTaskWeight(task) {
    var _a, _b, _c, _d;
    const raw = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpiweight) != null ? _a : task == null ? void 0 : task.main_weight) != null ? _b : task == null ? void 0 : task.weight) != null ? _c : task == null ? void 0 : task.kpiweight) != null ? _d : 1;
    const weight = typeof raw === "string" ? Number.parseFloat(raw.replace("%", "").trim()) : Number(raw);
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  }
  function formatWeight(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0";
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, "");
  }
  function formatWeightPercent(value) {
    return `${formatWeight(value)}%`;
  }
  function getKpiGroupKey(task) {
    var _a, _b, _c, _d, _e;
    return String((_e = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpi) != null ? _a : task == null ? void 0 : task.mainKpi) != null ? _b : task == null ? void 0 : task.main) != null ? _c : task == null ? void 0 : task.subkpi) != null ? _d : task == null ? void 0 : task.sub) != null ? _e : "Other").trim() || "Other";
  }
  function isCompletedOnTime(task) {
    const deadline = (task == null ? void 0 : task.deadline) ? new Date(task.deadline) : null;
    const completedAt = (task == null ? void 0 : task.completiondate) ? new Date(task.completiondate) : null;
    return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt <= deadline);
  }
  function getSlaWeight(scores) {
    var _a, _b;
    return (_b = (_a = scores == null ? void 0 : scores.slaWeight) != null ? _a : scores == null ? void 0 : scores.completedWeight) != null ? _b : 0;
  }
  function formatScorePercent(value) {
    return value !== null && value !== void 0 ? `${value}%` : "-";
  }
  function completionMetricSub(scores) {
    if (!scores || scores.completion === null || scores.completion === void 0) return "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19";
    return `\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 ${scores.completion}% \u0E08\u0E32\u0E01\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E23\u0E27\u0E21 ${formatWeightPercent(scores.totalWeight)}`;
  }
  function slaMetricSub(scores, score = scores == null ? void 0 : scores.sla) {
    if (!scores || score === null || score === void 0) return "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01\u0E10\u0E32\u0E19 SLA";
    return `\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32 ${score}% \u0E08\u0E32\u0E01\u0E10\u0E32\u0E19 SLA ${formatWeightPercent(getSlaWeight(scores))}`;
  }
  function calcTaskWeightedScores(tasks) {
    if (window.calcWeightedScores) return window.calcWeightedScores(tasks || []);
    const groups = {};
    (tasks || []).forEach((task) => {
      const key = getKpiGroupKey(task);
      const weight = getTaskWeight(task);
      const status = String((task == null ? void 0 : task.status) || "").toLowerCase();
      if (!groups[key]) groups[key] = { weight, total: 0, completed: 0, onTime: 0, cancelled: 0 };
      else if (groups[key].weight === 1 && weight !== 1) groups[key].weight = weight;
      if (status === "cancelled") {
        groups[key].cancelled += 1;
        return;
      }
      groups[key].total += 1;
      if (status === "completed") {
        groups[key].completed += 1;
        if (isCompletedOnTime(task)) groups[key].onTime += 1;
      }
    });
    let totalWeight = 0;
    let completedWeight = 0;
    let slaWeight = 0;
    let onTimeWeight = 0;
    Object.values(groups).forEach((group) => {
      const weight = getTaskWeight({ weight: group.weight });
      if (group.total > 0) {
        totalWeight += weight;
        completedWeight += weight * (group.completed / group.total);
      }
      if (group.completed > 0) {
        slaWeight += weight;
        onTimeWeight += weight * (group.onTime / group.completed);
      }
    });
    return {
      sla: slaWeight > 0 ? Math.round(onTimeWeight / slaWeight * 100) : null,
      completion: totalWeight > 0 ? Math.round(completedWeight / totalWeight * 100) : null,
      totalWeight,
      completedWeight,
      onTimeWeight,
      slaWeight
    };
  }
  function WeightFormulaStrip({ scores }) {
    if (!scores) return null;
    return /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "\u0E2A\u0E39\u0E15\u0E23\u0E04\u0E33\u0E19\u0E27\u0E13\u0E41\u0E1A\u0E1A\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, "SLA = \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32 / \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 \u0E41\u0E25\u0E30 Completion = \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08 / \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32 ", formatWeightPercent(scores.onTimeWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E40\u0E2A\u0E23\u0E47\u0E08 ", formatWeightPercent(scores.completedWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, "\u0E10\u0E32\u0E19 SLA ", formatWeightPercent(getSlaWeight(scores))), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "\u0E23\u0E27\u0E21 ", formatWeightPercent(scores.totalWeight)))));
  }
  function personKey(value) {
    return String(value || "").trim().toLowerCase();
  }
  function taskMatchesPerson(task, person) {
    const taskEmp = personKey(task.empId || task.empid || task.assignedToEmpId);
    const personEmp = personKey(person.empId || person.empid);
    if (taskEmp && personEmp && taskEmp === personEmp) return true;
    return personKey(task.name) === personKey(person.name) && (!person.team || task.team === person.team);
  }
  function enrichSummaryWithTaskWeights(summary, tasks) {
    const sourceSummary = summary || [];
    const sourceTasks = tasks || [];
    return sourceSummary.map((person) => {
      const personTasks = sourceTasks.filter((task) => taskMatchesPerson(task, person));
      if (personTasks.length === 0) return person;
      const weighted = calcTaskWeightedScores(personTasks);
      return {
        ...person,
        totalTasks: personTasks.length,
        completedTasks: personTasks.filter((task) => String(task.status || "").toLowerCase() === "completed").length,
        weightedSlaScore: weighted.sla,
        weightedCompletionScore: weighted.completion,
        totalWeight: weighted.totalWeight,
        completedWeight: weighted.completedWeight,
        onTimeWeight: weighted.onTimeWeight,
        slaWeight: weighted.slaWeight
      };
    });
  }
  function MetricCard({ label, value, sub, icon, accent = "var(--mx-blue)" }) {
    return /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[20px] p-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] uppercase tracking-[0.14em] text-[var(--mx-muted)] font-extrabold" }, label), /* @__PURE__ */ React.createElement("div", { className: "w-11 h-11 rounded-2xl grid place-items-center", style: { background: `color-mix(in srgb, ${accent} 16%, transparent)` } }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${icon}`, style: { color: accent } }))), /* @__PURE__ */ React.createElement("div", { className: "mt-5 text-[34px] font-extrabold tracking-normal" }, value), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, sub));
  }
  function Panel({ title, subtitle, actions, children }) {
    return /* @__PURE__ */ React.createElement("section", { className: "mx-shell-card rounded-[28px] p-5 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-[22px] font-extrabold tracking-normal m-0" }, title), subtitle && /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, subtitle)), actions && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, actions)), children);
  }
  function ThemeToggle({ theme, onToggle }) {
    const isDark = theme === "dark";
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !py-2 !px-3 inline-flex items-center gap-2",
        onClick: onToggle,
        title: isDark ? "Switch to light mode" : "Switch to dark mode",
        "aria-label": isDark ? "Switch to light mode" : "Switch to dark mode"
      },
      /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${isDark ? "fa-sun" : "fa-moon"}` }),
      /* @__PURE__ */ React.createElement("span", { className: "text-sm font-extrabold" }, isDark ? "Light" : "Dark")
    );
  }
  function UserAvatar({ user, size = "lg" }) {
    const [imgFailed, setImgFailed] = useState(false);
    const rawPhoto = (user == null ? void 0 : user.pigurl) || (user == null ? void 0 : user.pigUrl) || (user == null ? void 0 : user.pigURL) || (user == null ? void 0 : user.picurl) || (user == null ? void 0 : user.picUrl) || (user == null ? void 0 : user.picture) || (user == null ? void 0 : user.pictureUrl) || (user == null ? void 0 : user.profilePicture) || (user == null ? void 0 : user.profile_picture) || (user == null ? void 0 : user.avatar) || (user == null ? void 0 : user.avatarUrl) || (user == null ? void 0 : user.photoUrl) || (user == null ? void 0 : user.photo_url) || (user == null ? void 0 : user.profileUrl) || (user == null ? void 0 : user.profile_url) || (user == null ? void 0 : user.imageUrl) || (user == null ? void 0 : user.image_url) || (user == null ? void 0 : user.image) || (user == null ? void 0 : user.photo) || "";
    const normalizePhotoUrl = (value) => {
      const src = String(value || "").trim();
      if (!src) return "";
      const driveMatch = src.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w240`;
      const driveOpenMatch = src.match(/[?&]id=([^&]+)/);
      if (src.includes("drive.google.com") && driveOpenMatch) return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w240`;
      if (/^[A-Za-z0-9_-]{20,}$/.test(src)) return `https://drive.google.com/thumbnail?id=${src}&sz=w240`;
      if (src.startsWith("//")) return `https:${src}`;
      if (src.startsWith("/")) {
        const base = typeof window !== "undefined" && window.API_BASE ? window.API_BASE.replace(/\/api\/?$/, "") : "";
        return `${base}${src}`;
      }
      return src;
    };
    const photo = normalizePhotoUrl(rawPhoto);
    const initials = String((user == null ? void 0 : user.name) || (user == null ? void 0 : user.empId) || "U").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "U";
    const box = size === "xl" ? "w-20 h-20 text-2xl" : "w-14 h-14 text-lg";
    return /* @__PURE__ */ React.createElement("div", { className: cn("relative rounded-lg overflow-hidden mx-brand-mark grid place-items-center font-black flex-shrink-0", box) }, photo && !imgFailed ? /* @__PURE__ */ React.createElement(
      "img",
      {
        src: photo,
        alt: "User profile",
        className: "w-full h-full object-cover",
        referrerPolicy: "no-referrer",
        onError: () => setImgFailed(true)
      }
    ) : /* @__PURE__ */ React.createElement("span", null, initials));
  }
  function ActionModal({ config, onClose }) {
    const [inputVal, setInputVal] = useState("");
    useEffect(() => {
      if (config.show) setInputVal(config.inputValue || "");
    }, [config.show, config.inputValue]);
    if (!config.show) return null;
    const colorMap = {
      blue: "mx-btn-primary",
      rose: "mx-action-danger",
      emerald: "mx-action-success",
      amber: "mx-action-warning",
      slate: "mx-action-muted"
    };
    const btnClass = colorMap[config.color] || colorMap.blue;
    const handleConfirm = () => {
      if (config.type === "prompt") {
        if (config.action) config.action(inputVal);
      } else {
        if (config.action) config.action();
      }
      onClose();
    };
    return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-md shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-2" }, config.title), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--mx-muted)] mb-4" }, config.message), config.type === "prompt" && /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "mx-textarea min-h-[80px] mb-4",
        placeholder: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14...",
        value: inputVal,
        onChange: (e) => setInputVal(e.target.value),
        autoFocus: true
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, config.type !== "alert" && /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: onClose }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement("button", { className: `mx-btn flex-1 ${btnClass}`, onClick: handleConfirm }, config.type === "alert" ? "\u0E23\u0E31\u0E1A\u0E17\u0E23\u0E32\u0E1A" : "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19"))));
  }
  function StatusChangeModal({ task, onSave, onClose }) {
    var _a;
    const [newStatus, setNewStatus] = useState(task.status || "On Process");
    const [reason, setReason] = useState("");
    return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-1" }, "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--mx-muted)] mb-5 break-all" }, (task.job || "").substring(0, 60), ((_a = task.job) == null ? void 0 : _a.length) > 60 ? "..." : ""), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E43\u0E2B\u0E21\u0E48"), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: newStatus, onChange: (e) => setNewStatus(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "Pending" }, "Pending"), /* @__PURE__ */ React.createElement("option", { value: "On Process" }, "On Process"), /* @__PURE__ */ React.createElement("option", { value: "On Hold" }, "On Hold"), /* @__PURE__ */ React.createElement("option", { value: "Completed" }, "Completed"), /* @__PURE__ */ React.createElement("option", { value: "Cancelled" }, "Cancelled"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25 / \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "mx-textarea min-h-[80px]",
        placeholder: "\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E2B\u0E23\u0E37\u0E2D\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21...",
        value: reason,
        onChange: (e) => setReason(e.target.value),
        autoFocus: true
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: onClose }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-primary flex-1",
        onClick: () => {
          onSave(newStatus, reason);
          onClose();
        }
      },
      "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19"
    ))));
  }
  function Sidebar({ user, view, setView, onLogout, notifCount = 0 }) {
    const navItems = NAV_BY_ROLE[user == null ? void 0 : user.role] || NAV_BY_ROLE.Staff;
    return /* @__PURE__ */ React.createElement("aside", { className: "mx-shell-card rounded-[28px] p-5 md:p-6 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4 mb-7" }, /* @__PURE__ */ React.createElement("div", { className: "mx-brand-mark w-14 h-14 rounded-lg grid place-items-center text-xl font-black" }, "M"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-xl font-extrabold tracking-[0.02em]" }, "MAXIWA KPI"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "Executive Performance System"))), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement(UserAvatar, { user, size: "xl" }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Signed In"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 font-extrabold text-base truncate" }, user == null ? void 0 : user.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)] truncate" }, user == null ? void 0 : user.role, " \u2022 ", user == null ? void 0 : user.team))), /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, (user == null ? void 0 : user.role) || "-"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Emp ID: ", user == null ? void 0 : user.empId))), /* @__PURE__ */ React.createElement("div", { className: "mt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Navigation"), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid gap-2" }, navItems.map((item) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: item.id,
        onClick: () => setView(item.id),
        className: cn(
          "mx-btn text-left flex items-center gap-3 px-4 py-4 rounded-[18px]",
          view === item.id ? "mx-nav-active" : "bg-transparent border border-transparent"
        )
      },
      /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${item.icon} w-5 text-center text-[var(--mx-accent-2)]` }),
      /* @__PURE__ */ React.createElement("span", null, item.label),
      item.id === "tasks" && notifCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black" }, notifCount)
    ))), /* @__PURE__ */ React.createElement("button", { onClick: onLogout, className: "mx-btn mx-btn-soft w-full mt-6" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-right-from-bracket mr-2" }), "\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A"));
  }
  function LoginScreenPro({ onLogin, loading, error, theme, onToggleTheme }) {
    const [empId, setEmpId] = useState("");
    const accessHighlights = [
      ["fa-chart-line", "Weighted KPI", "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E04\u0E30\u0E41\u0E19\u0E19\u0E15\u0E32\u0E21\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 KPI \u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E07\u0E32\u0E19"],
      ["fa-clock", "SLA Monitoring", "\u0E40\u0E2B\u0E47\u0E19\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07 \u0E07\u0E32\u0E19\u0E04\u0E49\u0E32\u0E07 \u0E41\u0E25\u0E30 deadline \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21"],
      ["fa-building-user", "Role Based View", "\u0E41\u0E2A\u0E14\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C Staff, Lead, Manager \u0E41\u0E25\u0E30 Admin"]
    ];
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen grid place-items-center p-4 md:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-[1180px] mx-shell-card overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-[0.95fr_1.05fr]" }, /* @__PURE__ */ React.createElement("section", { className: "p-6 md:p-9 border-b lg:border-b-0 lg:border-r border-[var(--mx-line)] bg-[var(--mx-surface)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "mx-brand-pill inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-[0.14em]" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-gauge-high" }), " MAXIWA KPI"), /* @__PURE__ */ React.createElement(ThemeToggle, { theme, onToggle: onToggleTheme })), /* @__PURE__ */ React.createElement("div", { className: "mt-10 max-w-[520px]" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] uppercase tracking-[0.18em] text-[var(--mx-muted)] font-extrabold" }, "Performance Portal"), /* @__PURE__ */ React.createElement("h1", { className: "mt-4 mb-0 text-[34px] md:text-[46px] leading-tight font-extrabold tracking-normal" }, "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21 KPI \u0E41\u0E25\u0E30 SLA"), /* @__PURE__ */ React.createElement("p", { className: "mt-5 mb-0 text-[15px] leading-7 text-[var(--mx-muted)]" }, "\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E01\u0E25\u0E32\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E07\u0E32\u0E19 \u0E04\u0E30\u0E41\u0E19\u0E19\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 \u0E2A\u0E16\u0E32\u0E19\u0E30 SLA \u0E41\u0E25\u0E30\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21\u0E43\u0E19\u0E17\u0E35\u0E48\u0E40\u0E14\u0E35\u0E22\u0E27")), /* @__PURE__ */ React.createElement("div", { className: "mt-9 grid gap-3 max-w-[560px]" }, accessHighlights.map(([icon, title, desc]) => /* @__PURE__ */ React.createElement("div", { key: title, className: "flex items-start gap-3 rounded-lg border border-[var(--mx-line)] bg-[var(--mx-panel)] p-4" }, /* @__PURE__ */ React.createElement("span", { className: "w-10 h-10 rounded-lg mx-brand-mark grid place-items-center flex-shrink-0" }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${icon} text-[var(--mx-accent)]` })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold" }, title), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm leading-6 text-[var(--mx-muted)]" }, desc)))))), /* @__PURE__ */ React.createElement("section", { className: "p-6 md:p-10 lg:p-12 flex items-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-[460px] mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "mx-brand-mark w-14 h-14 rounded-lg grid place-items-center text-xl font-black" }, "M"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] uppercase tracking-[0.18em] text-[var(--mx-muted)] font-extrabold" }, "Secure Access"), /* @__PURE__ */ React.createElement("h2", { className: "mt-1 mb-0 text-[28px] md:text-[34px] tracking-normal font-extrabold" }, "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A"))), /* @__PURE__ */ React.createElement("p", { className: "mt-5 mb-0 text-[var(--mx-muted)] leading-7" }, "\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48 MAXIWA KPI \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E42\u0E14\u0E22\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34"), /* @__PURE__ */ React.createElement("div", { className: "mt-8" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--mx-muted)]" }, "Employee ID"), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-id-badge absolute left-4 top-1/2 -translate-y-1/2 text-[var(--mx-muted)]" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input !pl-11 !py-4 text-[18px] font-extrabold tracking-[0.08em]",
        placeholder: "\u0E40\u0E0A\u0E48\u0E19 EMP001",
        value: empId,
        onChange: (e) => setEmpId(e.target.value.toUpperCase()),
        onKeyDown: (e) => e.key === "Enter" && onLogin(empId),
        autoFocus: true
      }
    )), error && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-lg border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm text-[#ffb7b7] font-bold" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-circle-exclamation mr-2" }), error)), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary mt-6 w-full !py-4 flex items-center justify-center gap-2", disabled: loading, onClick: () => onLogin(empId) }, loading ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate-right fa-spin" }), /* @__PURE__ */ React.createElement("span", null, "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25...")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A"), /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-arrow-right" }))), /* @__PURE__ */ React.createElement("div", { className: "mt-6 flex items-center gap-3 text-xs text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-shield-halved" }), /* @__PURE__ */ React.createElement("span", null, "\u0E43\u0E0A\u0E49\u0E23\u0E2B\u0E31\u0E2A\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E25\u0E07\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E44\u0E27\u0E49\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19")))))));
  }
  function useAppData(user, view) {
    const [state, setState] = useState({
      loading: false,
      error: "",
      dashboard: null,
      tasks: [],
      people: [],
      admin: null
    });
    const [filterMonth, setFilterMonth] = useState((/* @__PURE__ */ new Date()).getMonth() + 1);
    const [filterYear, setFilterYear] = useState((/* @__PURE__ */ new Date()).getFullYear());
    const safeSet = (patch) => setState((prev) => ({ ...prev, ...patch }));
    const loadDashboard = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      const monthParam = filterMonth === 0 ? null : filterMonth;
      try {
        if (user.role === "Staff") {
          const res = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
          safeSet({ dashboard: { tasks: res.tasks || res || [] }, loading: false });
          return;
        }
        if (user.role === "Lead") {
          const [summaryRes, tasksRes] = await Promise.all([
            API.getTeamSummaryReport(user.team, monthParam, filterYear, user.empId),
            API.getAllTasks(monthParam, filterYear, user.team, user.empId)
          ]);
          safeSet({ dashboard: { summary: summaryRes.summary || [], tasks: tasksRes.tasks || [], period: summaryRes.period }, loading: false });
          return;
        }
        if (user.role === "Manager") {
          const [summaryRes, tasksRes] = await Promise.all([
            API.getSummaryReport(monthParam, filterYear, user.empId),
            API.getAllTasks(monthParam, filterYear, "all", user.empId)
          ]);
          safeSet({ dashboard: { summary: summaryRes.summary || [], tasks: tasksRes.tasks || [], period: summaryRes.period }, loading: false });
          return;
        }
        const [dashboardRes, staffRes] = await Promise.all([
          API.getDashboardData(),
          API.getAllStaff(user.empId)
        ]);
        safeSet({
          dashboard: { summary: dashboardRes.tasks || [], staff: staffRes.staff || [], kpis: dashboardRes.kpis || [] },
          loading: false
        });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14 dashboard \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user, filterMonth, filterYear]);
    const loadTasks = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      const monthParam = filterMonth === 0 ? null : filterMonth;
      try {
        if (user.role === "Staff") {
          const res2 = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
          safeSet({ tasks: res2.tasks || res2 || [], loading: false });
          return;
        }
        const team = user.role === "Lead" ? user.team : "all";
        const res = await API.getAllTasks(monthParam, filterYear, team, user.empId);
        safeSet({ tasks: res.tasks || [], loading: false });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14 tasks \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user, filterMonth, filterYear]);
    const loadPeople = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      try {
        let res;
        if (user.role === "Lead") res = await API.getAllStaffInTeam(user.team, user.empId);
        else res = await API.getAllStaff(user.empId);
        safeSet({ people: res.staff || [], loading: false });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user]);
    const loadAdmin = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      try {
        const [logs, teams, holidays, staff, dashboardRes] = await Promise.all([
          adminGet("admin/getAuditLogs", user.empId),
          adminGet("admin/getTeams", user.empId),
          adminGet("admin/getHolidays", user.empId),
          API.getAllStaff(user.empId),
          API.getDashboardData()
        ]);
        safeSet({
          admin: {
            logs: logs.logs || [],
            teams: teams.teams || [],
            holidays: holidays.holidays || [],
            staff: staff.staff || [],
            kpis: dashboardRes.kpis || [],
            tasks: dashboardRes.tasks || []
          },
          loading: false
        });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14 admin data \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user]);
    useEffect(() => {
      if (!user) return;
      if (view === "dashboard") loadDashboard();
      if (view === "tasks") loadTasks();
      if (view === "people") loadPeople();
      if (view === "assign") loadPeople();
      if (view === "admin") loadAdmin();
    }, [user, view, loadDashboard, loadTasks, loadPeople, loadAdmin]);
    useEffect(() => {
      if (!user || !window.subscribeToRealtime) return;
      window.subscribeToRealtime("tasks", () => {
        if (view === "dashboard") loadDashboard();
        if (view === "tasks") loadTasks();
      });
      return () => {
        if (window.unsubscribeFromRealtime) window.unsubscribeFromRealtime("tasks");
      };
    }, [user, view]);
    return {
      state,
      filterMonth,
      setFilterMonth,
      filterYear,
      setFilterYear,
      reloadDashboard: loadDashboard,
      reloadTasks: loadTasks,
      reloadPeople: loadPeople,
      reloadAdmin: loadAdmin
    };
  }
  function DashboardView({ user, data, filterMonth, filterYear, onAccept, onStatusChange, onNavigate }) {
    if (!data) {
      return /* @__PURE__ */ React.createElement(Panel, { title: "Executive Overview", subtitle: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25..." }, /* @__PURE__ */ React.createElement("div", { className: "text-[var(--mx-muted)]" }, "Loading..."));
    }
    if (user.role === "Staff") {
      const tasks2 = data.tasks || [];
      const completed = tasks2.filter((t) => t.status === "Completed").length;
      const active = tasks2.filter((t) => ["On Process", "Pending", "On Hold"].includes(t.status)).length;
      const now = /* @__PURE__ */ new Date();
      const scores = calcTaskWeightedScores(tasks2);
      const kpiDist = {};
      tasks2.forEach((t) => {
        if (String(t.status || "").toLowerCase() === "cancelled") return;
        const k = t.mainkpi || "Other";
        const weight = getTaskWeight(t);
        if (!kpiDist[k] || kpiDist[k] === 1 && weight !== 1) kpiDist[k] = weight;
      });
      const kpiEntries = Object.entries(kpiDist).sort((a, b) => b[1] - a[1]);
      const maxKpi = kpiEntries.length > 0 ? kpiEntries[0][1] : 1;
      const activeTasks = tasks2.filter((t) => !["Completed", "Cancelled"].includes(t.status));
      const periodLabel = filterMonth === 0 ? `\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19 ${filterYear}` : `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`;
      const [dashModal, setDashModal] = useState({ show: false });
      const [dashNotePopup, setDashNotePopup] = useState({ show: false, note: "" });
      const handleDashAction = (task, action) => {
        const ts = getTimestamp();
        if (action === "accept") {
          setDashModal({ show: true, title: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19", message: "\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E23\u0E34\u0E48\u0E21\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?", color: "blue", type: "confirm", action: () => onAccept(task) });
        } else if (action === "complete") {
          setDashModal({ show: true, title: "\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19", message: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E27\u0E48\u0E32\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?", color: "emerald", type: "confirm", action: () => onStatusChange(task, "Completed", `${ts} \u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19`) });
        } else if (action === "hold") {
          setDashModal({ show: true, title: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19", message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E01\u0E32\u0E23\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19:", color: "amber", type: "prompt", action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "On Hold", `${ts} [On Hold] ${reason}`);
          } });
        } else if (action === "resume") {
          onStatusChange(task, "On Process", `${ts} \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D`);
        } else if (action === "cancel") {
          setDashModal({ show: true, title: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19", message: "\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19:", color: "rose", type: "prompt", action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "Cancelled", `${ts} [Cancelled] ${reason}`);
          } });
        } else if (action === "note") {
          setDashModal({ show: true, title: "\u0E40\u0E1E\u0E34\u0E48\u0E21 Note", message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21:", color: "blue", type: "prompt", action: (note) => {
            if (note == null ? void 0 : note.trim()) onStatusChange(task, task.status, `${ts} ${note}`, "note_only");
          } });
        }
      };
      const ActionBtn = ({ icon, color, onClick, label }) => {
        const variants = {
          emerald: "mx-action-success",
          amber: "mx-action-warning",
          rose: "mx-action-danger",
          blue: "mx-action-info",
          indigo: "mx-action-muted"
        };
        return /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("button", { onClick, className: `w-10 h-10 flex items-center justify-center rounded-lg border transition-colors duration-200 ${variants[color] || ""}` }, /* @__PURE__ */ React.createElement("i", { className: `fas ${icon} text-sm` })), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50" }, label, /* @__PURE__ */ React.createElement("div", { className: "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" })));
      };
      return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(ActionModal, { config: dashModal, onClose: () => setDashModal({ show: false }) }), dashNotePopup.show && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-4" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-2 text-[var(--mx-info)]" }), "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "max-h-80 overflow-y-auto rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm leading-7 whitespace-pre-wrap" }, dashNotePopup.note)), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft w-full mt-5", onClick: () => setDashNotePopup({ show: false, note: "" }) }, "\u0E1B\u0E34\u0E14"))), /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Tasks", value: tasks2.length, sub: `\u0E07\u0E32\u0E19\u0E43\u0E19${periodLabel}`, icon: "fa-list-check" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Weight", value: formatWeightPercent(scores.totalWeight), sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13 KPI", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted Completion", value: formatScorePercent(scores.completion), sub: completionMetricSub(scores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted SLA", value: formatScorePercent(scores.sla), sub: slaMetricSub(scores), icon: "fa-chart-line", accent: "var(--mx-amber)" })), /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores }), kpiEntries.length > 0 && /* @__PURE__ */ React.createElement(Panel, { title: "KPI Weight Distribution", subtitle: "\u0E2A\u0E31\u0E14\u0E2A\u0E48\u0E27\u0E19\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E41\u0E22\u0E01\u0E15\u0E32\u0E21 Main KPI" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, kpiEntries.map(([kpi, count]) => /* @__PURE__ */ React.createElement("div", { key: kpi, className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold w-44 truncate flex-shrink-0" }, kpi), /* @__PURE__ */ React.createElement("div", { className: "flex-1 h-3 rounded-full mx-progress-track overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full mx-progress-fill", style: { width: `${count / maxKpi * 100}%` } })), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)] w-20 text-right flex-shrink-0" }, formatWeightPercent(count)))))), /* @__PURE__ */ React.createElement(
        Panel,
        {
          title: "\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23",
          subtitle: "\u0E07\u0E32\u0E19 Pending / On Process / On Hold \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21",
          actions: [
            /* @__PURE__ */ React.createElement("button", { key: "add", className: "mx-btn mx-btn-primary", onClick: () => onNavigate("create") }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-plus mr-2" }), "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19\u0E43\u0E2B\u0E21\u0E48")
          ]
        },
        /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, activeTasks.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23"), activeTasks.map((task) => {
          const dl = task.deadline ? new Date(task.deadline) : null;
          const daysLeft = dl ? Math.ceil((dl - now) / 864e5) : null;
          const isOverdue = daysLeft !== null && daysLeft < 0;
          return /* @__PURE__ */ React.createElement("div", { key: task.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold break-all" }, task.job), /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getStatusClass(task.status)) }, task.status), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(getTaskWeight(task))), task.note && /* @__PURE__ */ React.createElement("button", { onClick: () => setDashNotePopup({ show: true, note: task.note }), className: "mx-note-btn text-xs px-3 py-1.5 rounded-lg font-bold" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-1" }), "\u0E14\u0E39\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01")), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, task.mainkpi || "-", " \u2022 ", task.subkpi || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, "Deadline ", formatDate(task.deadline), isOverdue && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-red-400 font-bold" }, "\u0E40\u0E01\u0E34\u0E19 ", Math.abs(daysLeft), " \u0E27\u0E31\u0E19"), !isOverdue && daysLeft !== null && daysLeft <= 3 && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-[var(--mx-warning)] font-bold" }, "\u0E2D\u0E35\u0E01 ", daysLeft, " \u0E27\u0E31\u0E19"))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 flex-shrink-0 items-start" }, task.status === "Pending" && /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-play", color: "blue", onClick: () => handleDashAction(task, "accept"), label: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19" }), task.status === "On Process" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-check", color: "emerald", onClick: () => handleDashAction(task, "complete"), label: "\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19" }), /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-pause", color: "amber", onClick: () => handleDashAction(task, "hold"), label: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19" }), /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-comment-dots", color: "blue", onClick: () => handleDashAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), task.status === "On Hold" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-play", color: "blue", onClick: () => handleDashAction(task, "resume"), label: "\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D" }), /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-comment-dots", color: "blue", onClick: () => handleDashAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), !["Completed", "Cancelled"].includes(task.status) && /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-trash", color: "rose", onClick: () => handleDashAction(task, "cancel"), label: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01" }))));
        }))
      ));
    }
    if (user.role === "Lead") {
      const tasks2 = data.tasks || [];
      const summary = enrichSummaryWithTaskWeights(data.summary || [], tasks2);
      const teamScores = tasks2.length > 0 ? calcTaskWeightedScores(tasks2) : null;
      const avgSla = teamScores && teamScores.sla !== null ? teamScores.sla : summary.length ? Math.round(summary.reduce((s, p) => s + (Number(p.weightedSlaScore) || 0), 0) / summary.length) : 0;
      return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Team Members", value: summary.length, sub: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E41\u0E2A\u0E14\u0E07\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E02\u0E2D\u0E07 Lead", icon: "fa-users" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Team Weight", value: teamScores ? formatWeightPercent(teamScores.totalWeight) : "-", sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E23\u0E27\u0E21\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted Completion", value: teamScores ? formatScorePercent(teamScores.completion) : "-", sub: completionMetricSub(teamScores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Avg SLA", value: `${avgSla}%`, sub: teamScores ? slaMetricSub(teamScores, avgSla) : "\u0E04\u0E48\u0E32\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22 weighted SLA score", icon: "fa-chart-line", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Period", value: data.period || "-", sub: "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E39", icon: "fa-calendar-days", accent: "var(--mx-amber)" })), teamScores && /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores: teamScores }), /* @__PURE__ */ React.createElement(Panel, { title: "Team Performance Pulse", subtitle: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E17\u0E35\u0E21\u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2D\u0E48\u0E32\u0E19\u0E07\u0E48\u0E32\u0E22\u0E02\u0E36\u0E49\u0E19" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, summary.map((person) => {
        var _a, _b;
        return /* @__PURE__ */ React.createElement("div", { key: person.empId || person.name, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, person.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, person.team, " \u2022 Total ", person.totalTasks, " \u2022 Completed ", person.completedTasks), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(person.totalWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, "Completion ", (_a = person.weightedCompletionScore) != null ? _a : "-", "%"))), /* @__PURE__ */ React.createElement("div", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold text-lg" }, (_b = person.weightedSlaScore) != null ? _b : "-", "%"), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-[var(--mx-muted)]" }, "Weighted SLA"))));
      }))));
    }
    if (user.role === "Manager") {
      const tasks2 = data.tasks || [];
      const summary = enrichSummaryWithTaskWeights(data.summary || [], tasks2);
      const risky = tasks2.filter((t) => ["Pending", "On Hold"].includes(t.status)).length;
      const orgScores = tasks2.length > 0 ? calcTaskWeightedScores(tasks2) : null;
      const avgSla = orgScores && orgScores.sla !== null ? orgScores.sla : summary.length ? Math.round(summary.reduce((s, p) => s + (Number(p.weightedSlaScore) || 0), 0) / summary.length) : 0;
      const topPeople = [...summary].sort((a, b) => (b.weightedSlaScore || 0) - (a.weightedSlaScore || 0)).slice(0, 6);
      return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Active Tasks", value: tasks2.length, sub: "\u0E42\u0E2B\u0E25\u0E14\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E14\u0E34\u0E21\u0E41\u0E1A\u0E1A\u0E15\u0E23\u0E07 \u0E46", icon: "fa-briefcase" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Risk Queue", value: risky, sub: "Pending / On Hold \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21", icon: "fa-triangle-exclamation", accent: "var(--mx-amber)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Weight", value: orgScores ? formatWeightPercent(orgScores.totalWeight) : "-", sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E23\u0E27\u0E21\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Completion", value: orgScores ? formatScorePercent(orgScores.completion) : "-", sub: completionMetricSub(orgScores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Avg SLA", value: `${avgSla}%`, sub: orgScores ? slaMetricSub(orgScores, avgSla) : "weighted SLA across visible staff", icon: "fa-chart-line", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "People", value: summary.length, sub: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E04\u0E19\u0E43\u0E19\u0E21\u0E38\u0E21\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23", icon: "fa-users-viewfinder", accent: "var(--mx-blue)" })), orgScores && /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores: orgScores }), /* @__PURE__ */ React.createElement(Panel, { title: "Executive Scoreboard", subtitle: "\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E40\u0E2B\u0E47\u0E19\u0E04\u0E30\u0E41\u0E19\u0E19, \u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E07\u0E32\u0E19, \u0E41\u0E25\u0E30\u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23 intervene \u0E17\u0E31\u0E19\u0E17\u0E35" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-3" }, topPeople.map((person) => {
        var _a, _b;
        return /* @__PURE__ */ React.createElement("div", { key: person.empId || person.name, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, person.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, person.team, " \u2022 Total ", person.totalTasks), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(person.totalWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, "Completion ", (_a = person.weightedCompletionScore) != null ? _a : "-", "%"))), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, (_b = person.weightedSlaScore) != null ? _b : "-", "%")));
      }))));
    }
    const tasks = data.summary || [];
    const staff = data.staff || [];
    const kpis = data.kpis || [];
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Tasks", value: tasks.length, sub: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E27\u0E21\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E14\u0E34\u0E21", icon: "fa-briefcase" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Users", value: staff.length, sub: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A", icon: "fa-users", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "KPI Items", value: kpis.length, sub: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 KPI \u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19", icon: "fa-sliders", accent: "var(--mx-amber)" })), /* @__PURE__ */ React.createElement(Panel, { title: "System Overview", subtitle: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "MAXIWA KPI \u0E43\u0E0A\u0E49 backend \u0E40\u0E14\u0E34\u0E21\u0E41\u0E25\u0E30\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E14\u0E34\u0E21\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07 \u0E41\u0E15\u0E48\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19")));
  }
  function TaskCenterView({ user, tasks, onAccept, onStatusChange, onDelete, onRefresh }) {
    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [modal, setModal] = useState({ show: false });
    const closeModal = () => setModal({ show: false });
    const showModal = (cfg) => setModal({ show: true, ...cfg });
    const [statusTarget, setStatusTarget] = useState(null);
    const [notePopup, setNotePopup] = useState({ show: false, note: "" });
    const [editingTask, setEditingTask] = useState(null);
    const [editForm, setEditForm] = useState({ job: "", subkpi: "", extra_data: {} });
    const [savingEdit, setSavingEdit] = useState(false);
    const [prModal, setPrModal] = useState({ show: false, task: null, fundNumber: "", amount: "" });
    const [savingPr, setSavingPr] = useState(false);
    const ActionButton = ({ icon, color, onClick, label }) => {
      const variants = {
        emerald: "mx-action-success",
        amber: "mx-action-warning",
        rose: "mx-action-danger",
        slate: "mx-action-muted",
        blue: "mx-action-info",
        indigo: "mx-action-muted"
      };
      return /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick,
          className: `w-10 h-10 flex items-center justify-center rounded-lg border transition-colors duration-200 ${variants[color] || variants.slate}`
        },
        /* @__PURE__ */ React.createElement("i", { className: `fas ${icon} text-sm` })
      ), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50" }, label, /* @__PURE__ */ React.createElement("div", { className: "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" })));
    };
    const filtered = useMemo(() => {
      return (tasks || []).filter((task) => {
        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [task.job, task.name, task.team, task.subkpi, task.status].some((v) => String(v || "").toLowerCase().includes(q));
      });
    }, [tasks, statusFilter, search]);
    const taskSummary = useMemo(() => ({
      total: (tasks || []).length,
      active: (tasks || []).filter((t) => ["On Process", "Pending", "On Hold"].includes(t.status)).length,
      completed: (tasks || []).filter((t) => t.status === "Completed").length,
      risk: (tasks || []).filter((t) => ["Pending", "On Hold"].includes(t.status)).length
    }), [tasks]);
    const taskScores = useMemo(() => calcTaskWeightedScores(tasks || []), [tasks]);
    const handleStaffAction = (task, action) => {
      var _a, _b;
      const ts = getTimestamp();
      if (action === "accept") {
        showModal({
          title: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19",
          message: "\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E23\u0E34\u0E48\u0E21\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?",
          color: "blue",
          type: "confirm",
          action: () => onAccept(task)
        });
      } else if (action === "complete") {
        if ((task.subkpi || "").toLowerCase().includes("open pr")) {
          setPrModal({ show: true, task, fundNumber: ((_a = task.extra_data) == null ? void 0 : _a.fundNumber) || "", amount: ((_b = task.extra_data) == null ? void 0 : _b.amount) || "" });
        } else {
          showModal({
            title: "\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19",
            message: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E27\u0E48\u0E32\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?",
            color: "emerald",
            type: "confirm",
            action: () => onStatusChange(task, "Completed", `${ts} \u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19`)
          });
        }
      } else if (action === "hold") {
        showModal({
          title: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19",
          message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E01\u0E32\u0E23\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19:",
          color: "amber",
          type: "prompt",
          action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "On Hold", `${ts} [On Hold] ${reason}`);
          }
        });
      } else if (action === "resume") {
        onStatusChange(task, "On Process", `${ts} \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D`);
      } else if (action === "cancel") {
        showModal({
          title: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19",
          message: "\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19:",
          color: "rose",
          type: "prompt",
          action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "Cancelled", `${ts} [Cancelled] ${reason}`);
          }
        });
      } else if (action === "note") {
        showModal({
          title: "\u0E40\u0E1E\u0E34\u0E48\u0E21 Note",
          message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21:",
          color: "blue",
          type: "prompt",
          action: (note) => {
            if (note == null ? void 0 : note.trim()) onStatusChange(task, task.status, `${ts} ${note}`, "note_only");
          }
        });
      }
    };
    const handleEditOpen = (task) => {
      setEditForm({ job: task.job || "", subkpi: task.subkpi || "", extra_data: task.extra_data || {} });
      setEditingTask(task);
    };
    const handleEditSave = async () => {
      if (!editForm.job.trim() || !editForm.subkpi.trim()) {
        alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 Job \u0E41\u0E25\u0E30 Sub KPI");
        return;
      }
      setSavingEdit(true);
      try {
        await API.updateTaskDetails({
          id: editingTask.id,
          team: editingTask.team,
          job: editForm.job,
          subkpi: editForm.subkpi,
          mainkpi: editingTask.mainkpi,
          deadline: editingTask.deadline,
          extra_data: editForm.extra_data || {}
        });
        setEditingTask(null);
        onRefresh();
      } catch (e) {
        alert(e.message || "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setSavingEdit(false);
      }
    };
    const handlePrComplete = async () => {
      if (!prModal.task) return;
      setSavingPr(true);
      const ts = getTimestamp();
      try {
        const newExtra = { ...prModal.task.extra_data || {}, fundNumber: prModal.fundNumber, amount: prModal.amount };
        await Promise.all([
          API.updateTaskStatus(prModal.task.id, prModal.task.team, "Completed", `${ts} \u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19`, "append"),
          API.updateTaskDetails({
            id: prModal.task.id,
            team: prModal.task.team,
            job: prModal.task.job,
            subkpi: prModal.task.subkpi,
            mainkpi: prModal.task.mainkpi,
            deadline: prModal.task.deadline,
            extra_data: newExtra
          })
        ]);
        setPrModal({ show: false, task: null, fundNumber: "", amount: "" });
        onRefresh();
      } catch (e) {
        alert(e.message || "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setSavingPr(false);
      }
    };
    const canEdit = (task) => !["Completed", "Cancelled"].includes(task.status);
    const canCancel = (task) => !["Completed", "Cancelled"].includes(task.status);
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(ActionModal, { config: modal, onClose: closeModal }), notePopup.show && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-4" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-2 text-[var(--mx-info)]" }), "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "max-h-80 overflow-y-auto rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm leading-7 whitespace-pre-wrap" }, notePopup.note || "-")), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft w-full mt-5", onClick: () => setNotePopup({ show: false, note: "" }) }, "\u0E1B\u0E34\u0E14"))), statusTarget && /* @__PURE__ */ React.createElement(
      StatusChangeModal,
      {
        task: statusTarget,
        onSave: (status, reason) => onStatusChange(statusTarget, status, reason),
        onClose: () => setStatusTarget(null)
      }
    ), editingTask && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-5" }, "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Job / \u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "mx-textarea min-h-[100px]",
        value: editForm.job,
        onChange: (e) => setEditForm((p) => ({ ...p, job: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Sub KPI"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        value: editForm.subkpi,
        onChange: (e) => setEditForm((p) => ({ ...p, subkpi: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement(
      ExtraDataFields,
      {
        subkpi: editForm.subkpi,
        extraData: editForm.extra_data,
        onChange: (ed) => setEditForm((p) => ({ ...p, extra_data: ed }))
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "Main KPI: ", editingTask.mainkpi || "-", " \u2022 Deadline: ", formatDate(editingTask.deadline))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: () => setEditingTask(null) }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary flex-1", disabled: savingEdit, onClick: handleEditSave }, savingEdit ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01")))), prModal.show && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-2" }, "Complete Open PR"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--mx-muted)] mb-5" }, "\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E48\u0E2D\u0E19\u0E1B\u0E34\u0E14\u0E07\u0E32\u0E19 PR"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Fund Number"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        placeholder: "\u0E40\u0E25\u0E02\u0E01\u0E2D\u0E07\u0E17\u0E38\u0E19",
        value: prModal.fundNumber,
        onChange: (e) => setPrModal((p) => ({ ...p, fundNumber: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Amount (\u0E1A\u0E32\u0E17)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        type: "number",
        placeholder: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19",
        value: prModal.amount,
        onChange: (e) => setPrModal((p) => ({ ...p, amount: e.target.value }))
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: () => setPrModal({ show: false, task: null, fundNumber: "", amount: "" }) }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn flex-1 mx-action-success",
        disabled: savingPr,
        onClick: handlePrComplete
      },
      savingPr ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1B\u0E34\u0E14\u0E07\u0E32\u0E19 PR"
    )))), /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Tasks", value: taskSummary.total, sub: "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E43\u0E19\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E19\u0E35\u0E49", icon: "fa-list-check" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Weight", value: formatWeightPercent(taskScores.totalWeight), sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Completion", value: formatScorePercent(taskScores.completion), sub: completionMetricSub(taskScores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted SLA", value: formatScorePercent(taskScores.sla), sub: slaMetricSub(taskScores), icon: "fa-chart-line", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Need Attention", value: taskSummary.risk, sub: "Pending / On Hold", icon: "fa-triangle-exclamation", accent: "var(--mx-amber)" })), /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores: taskScores }), /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: "Task Center",
        subtitle: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E07\u0E32\u0E19\u0E41\u0E1A\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2D\u0E48\u0E32\u0E19\u0E40\u0E23\u0E47\u0E27\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E07\u0E48\u0E32\u0E22\u0E01\u0E27\u0E48\u0E32\u0E40\u0E14\u0E34\u0E21",
        actions: [
          /* @__PURE__ */ React.createElement("button", { key: "refresh", className: "mx-btn mx-btn-soft", onClick: onRefresh }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate-right mr-2" }), "Refresh")
        ]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-[1fr_220px] gap-3 mb-5" }, /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32 job / \u0E04\u0E19 / team / status",
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }
      ), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "\u0E17\u0E38\u0E01\u0E2A\u0E16\u0E32\u0E19\u0E30"), /* @__PURE__ */ React.createElement("option", { value: "Pending" }, "Pending"), /* @__PURE__ */ React.createElement("option", { value: "On Process" }, "On Process"), /* @__PURE__ */ React.createElement("option", { value: "On Hold" }, "On Hold"), /* @__PURE__ */ React.createElement("option", { value: "Completed" }, "Completed"), /* @__PURE__ */ React.createElement("option", { value: "Cancelled" }, "Cancelled"))),
      /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19"), filtered.map((task) => /* @__PURE__ */ React.createElement("div", { key: task.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-base break-all" }, task.job), /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getStatusClass(task.status)) }, task.status), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(getTaskWeight(task))), /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "mx-btn mx-btn-soft !py-2 !px-3",
          onClick: () => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
        },
        expandedTaskId === task.id ? "\u0E0B\u0E48\u0E2D\u0E19" : "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14"
      ), task.note && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setNotePopup({ show: true, note: task.note }),
          className: "mx-note-btn text-xs px-3 py-1.5 rounded-lg transition-colors font-bold"
        },
        /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-1" }),
        "\u0E14\u0E39\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"
      )), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, task.name || "-", " \u2022 ", task.team || "-", " \u2022 ", task.subkpi || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38 Sub KPI"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, "Start ", formatDate(task.startdate), " \u2022 Deadline ", formatDate(task.deadline), task.completiondate ? ` \u2022 \u0E40\u0E2A\u0E23\u0E47\u0E08 ${formatDate(task.completiondate)}` : ""), expandedTaskId === task.id && /* @__PURE__ */ React.createElement("div", { className: "mt-4 rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-xs text-[var(--mx-muted)]" }, "Task ID: ", task.id), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)]" }, "Weight: ", formatWeightPercent(getTaskWeight(task))), task.note ? /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-sm leading-7 whitespace-pre-wrap" }, task.note) : /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35 note"), renderExtraData(task.extra_data))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 flex-shrink-0 items-start" }, user.role === "Staff" && /* @__PURE__ */ React.createElement(React.Fragment, null, task.status === "Pending" && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-play", color: "blue", onClick: () => handleStaffAction(task, "accept"), label: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19" }), task.status === "On Process" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-check", color: "emerald", onClick: () => handleStaffAction(task, "complete"), label: "\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19" }), /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-pause", color: "amber", onClick: () => handleStaffAction(task, "hold"), label: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19" }), /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-comment-dots", color: "blue", onClick: () => handleStaffAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), task.status === "On Hold" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-play", color: "blue", onClick: () => handleStaffAction(task, "resume"), label: "\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D" }), /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-comment-dots", color: "blue", onClick: () => handleStaffAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), canCancel(task) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-trash", color: "rose", onClick: () => handleStaffAction(task, "cancel"), label: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01" }), canEdit(task) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-edit", color: "indigo", onClick: () => handleEditOpen(task), label: "\u0E41\u0E01\u0E49\u0E44\u0E02" })), ["Lead", "Manager", "Admin"].includes(user.role) && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-arrow-right-arrow-left", color: "blue", onClick: () => setStatusTarget(task), label: "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30" }), canEdit(task) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-edit", color: "indigo", onClick: () => handleEditOpen(task), label: "\u0E41\u0E01\u0E49\u0E44\u0E02" }), ["Manager", "Admin"].includes(user.role) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-trash", color: "rose", onClick: () => onDelete(task), label: "\u0E25\u0E1A\u0E07\u0E32\u0E19" })))))))
    ));
  }
  function TrackerViewNew() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [logsByTask, setLogsByTask] = useState({});
    const [expandedJob, setExpandedJob] = useState(null);
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const handleSearch = async () => {
      if (query.trim().length < 3) {
        setError("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 3 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await API.getTasksByJob(query.trim());
        const tasks = res.tasks || [];
        setItems(tasks);
        setExpandedJob(null);
        setExpandedTaskId(null);
        const logPairs = await Promise.all(
          tasks.map(async (task) => {
            try {
              const logRes = await API.getAuditLogsByTask(task.id);
              return [task.id, logRes.logs || []];
            } catch {
              return [task.id, []];
            }
          })
        );
        setLogsByTask(Object.fromEntries(logPairs));
      } catch (e) {
        setError(e.message || "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setLoading(false);
      }
    };
    const grouped = useMemo(() => {
      const groups = {};
      items.forEach((task) => {
        const code = extractJobCode(task.job);
        if (!groups[code]) groups[code] = [];
        groups[code].push(task);
      });
      return Object.entries(groups);
    }, [items]);
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Job Tracker", subtitle: "\u0E41\u0E22\u0E01\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E27\u0E48\u0E32 Job \u0E2B\u0E19\u0E36\u0E48\u0E07\u0E2D\u0E32\u0E08\u0E21\u0E35\u0E2B\u0E25\u0E32\u0E22 Task \u0E22\u0E48\u0E2D\u0E22" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-[1fr_180px] gap-3 mb-5" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32 job code \u0E2B\u0E23\u0E37\u0E2D\u0E0A\u0E37\u0E48\u0E2D\u0E07\u0E32\u0E19",
        value: query,
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: (e) => e.key === "Enter" && handleSearch()
      }
    ), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: handleSearch, disabled: loading }, loading ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E49\u0E19\u0E2B\u0E32..." : "Search")), error && /* @__PURE__ */ React.createElement("div", { className: "mb-4 text-sm text-[#ffb7b7] font-bold" }, error), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, grouped.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E25\u0E01\u0E32\u0E23\u0E04\u0E49\u0E19\u0E2B\u0E32"), grouped.map(([code, tasks]) => /* @__PURE__ */ React.createElement("div", { key: code, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold text-lg" }, code), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, tasks.length, " task(s) under this job")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, [...new Set(tasks.map((t) => t.name).filter(Boolean))].length, " owner(s)"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !py-2 !px-3",
        onClick: () => setExpandedJob(expandedJob === code ? null : code)
      },
      expandedJob === code ? "Collapse" : "Open Timeline"
    ))), expandedJob === code && /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3" }, tasks.map((task, idx) => /* @__PURE__ */ React.createElement("div", { key: task.id, className: "rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, "Task ", idx + 1, " \u2022 ", task.name || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, task.team || "-", " \u2022 ", task.subkpi || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38 Sub KPI", " \u2022 Start ", formatDate(task.startdate)), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, "Deadline ", formatDate(task.deadline), " \u2022 Completed ", formatDate(task.completiondate))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getStatusClass(task.status)) }, task.status), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !py-2 !px-3",
        onClick: () => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
      },
      expandedTaskId === task.id ? "Hide Detail" : "View Detail"
    ))), expandedTaskId === task.id && /* @__PURE__ */ React.createElement("div", { className: "mt-4 rounded-[18px] p-4 bg-[rgba(0,0,0,0.16)] border border-[rgba(255,255,255,0.06)]" }, task.note ? /* @__PURE__ */ React.createElement("div", { className: "text-sm leading-7 whitespace-pre-wrap" }, task.note) : /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35 note \u0E02\u0E2D\u0E07 task \u0E19\u0E35\u0E49"), renderExtraData(task.extra_data), /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold mb-3" }, "Audit Timeline"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, (logsByTask[task.id] || []).length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 audit log"), (logsByTask[task.id] || []).map((log) => /* @__PURE__ */ React.createElement("div", { key: log.id, className: "rounded-[14px] p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-sm" }, log.action || "Activity"), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-[var(--mx-muted)]" }, formatDate(log.timestamp, true))), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, log.details || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)]" }, "By ", log.by_user || "-"))))))))))))));
  }
  function ExtraDataFields({ subkpi, extraData, onChange }) {
    if (!subkpi) return null;
    const sub = subkpi;
    const isCoord = sub.includes("\u0E1B\u0E23\u0E30\u0E2A\u0E32\u0E19\u0E07\u0E32\u0E19\u0E2D\u0E32\u0E04\u0E32\u0E23");
    const isNotify = sub.includes("\u0E41\u0E08\u0E49\u0E07 Job \u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E21\u0E32");
    const isSAP = sub.toLowerCase().includes("open job sap");
    const isOWF = sub.toLowerCase().includes("open job owf");
    if (!isCoord && !isNotify && !isSAP && !isOWF) return null;
    const ed = extraData || {};
    const upd = (k, v) => onChange({ ...ed, [k]: v });
    return /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2 rounded-[18px] p-4 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.25)]" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs font-extrabold text-[var(--mx-warning)] uppercase tracking-widest mb-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-clipboard-list" }), "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, isCoord && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E2D\u0E32\u0E04\u0E32\u0E23", value: ed.building || "", onChange: (e) => upd("building", e.target.value) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32", value: ed.client || "", onChange: (e) => upd("client", e.target.value) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E21\u0E32", value: ed.contractor || "", onChange: (e) => upd("contractor", e.target.value) })), isNotify && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E21\u0E32", value: ed.contractorName || "", onChange: (e) => upd("contractorName", e.target.value) }), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: ed.contractorType || "", onChange: (e) => upd("contractorType", e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01 TYPE"), ["B1", "C1", "C2", "E1"].map((t) => /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t)))), isSAP && /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "SSR Number", value: ed.ssrNumber || "", onChange: (e) => upd("ssrNumber", e.target.value) }), isOWF && /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "OSP Number", value: ed.ospNumber || "", onChange: (e) => upd("ospNumber", e.target.value) })));
  }
  function QuickCreateView({ user, people, onSaved }) {
    const isStaff = user.role === "Staff";
    const teamKpis = useMemo(() => {
      const kpis = (user == null ? void 0 : user.kpis) || [];
      if (isStaff) return kpis.filter((k) => !k.team || k.team === user.team);
      return kpis;
    }, [user, isStaff]);
    const [loadedStaffKpis, setLoadedStaffKpis] = useState([]);
    useEffect(() => {
      if (!isStaff) return;
      API.getKPIsByTeam(user.team).then((res) => {
        if (res && res.kpis && res.kpis.length > 0) setLoadedStaffKpis(res.kpis);
      }).catch(() => {
      });
    }, [user.team, isStaff]);
    const [form, setForm] = useState({
      job: "",
      note: "",
      subkpi: "",
      mainkpi: "",
      deadline: "",
      assignedToName: isStaff ? user.name : "",
      assignedToTeam: (user == null ? void 0 : user.team) || "",
      assignedToEmpId: "",
      extra_data: {}
    });
    const [assigneeKpis, setAssigneeKpis] = useState([]);
    const [loadingDeadline, setLoadingDeadline] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState("");
    useEffect(() => {
      if (isStaff) return;
      if (!form.assignedToEmpId) {
        setAssigneeKpis([]);
        return;
      }
      const person = (people || []).find((p) => p.empId === form.assignedToEmpId);
      if (!person) return;
      setForm((prev) => ({ ...prev, assignedToName: person.name, assignedToTeam: person.team, subkpi: "", mainkpi: "", deadline: "", extra_data: {} }));
      API.getKPIsByTeam(person.team).then((res) => setAssigneeKpis(res.kpis || [])).catch(() => setAssigneeKpis([]));
    }, [form.assignedToEmpId, isStaff, people]);
    const activeKpis = isStaff ? loadedStaffKpis.length > 0 ? loadedStaffKpis : teamKpis : assigneeKpis;
    const handleSubKpiChange = async (subkpi) => {
      if (!subkpi) {
        setForm((p) => ({ ...p, subkpi: "", mainkpi: "", deadline: "", extra_data: {} }));
        return;
      }
      const kpi = activeKpis.find((k) => k.sub === subkpi);
      setForm((p) => ({ ...p, subkpi, mainkpi: (kpi == null ? void 0 : kpi.main) || "", extra_data: {} }));
      setLoadingDeadline(true);
      try {
        const targetTeam = isStaff ? user.team : form.assignedToTeam;
        const res = await API.calculateDeadlinePreview({
          team: targetTeam,
          subkpi,
          startDate: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (res && !res.error) {
          setForm((p) => ({ ...p, mainkpi: res.mainkpi || (kpi == null ? void 0 : kpi.main) || "", deadline: res.deadline || "" }));
        }
      } catch {
      }
      setLoadingDeadline(false);
    };
    const handleSave = async () => {
      if (!form.job.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38 job");
      if (!form.subkpi.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI");
      if (!isStaff && !form.assignedToName.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A");
      setSaving(true);
      setSaveResult("");
      try {
        let res;
        if (isStaff) {
          res = await API.saveNewTask({
            name: user.name,
            team: user.team,
            empId: user.empId,
            job: form.job,
            subkpi: form.subkpi,
            mainkpi: form.mainkpi,
            deadline: form.deadline,
            note: form.note,
            extra_data: form.extra_data
          });
        } else {
          const jobs = form.job.split("\n").map((j) => j.trim()).filter(Boolean);
          res = await API.saveNewTask({
            jobs,
            name: form.assignedToName,
            team: form.assignedToTeam || user.team,
            mainkpi: form.mainkpi,
            subkpi: form.subkpi,
            deadline: form.deadline,
            note: form.note
          });
        }
        const msg = res && res.message ? res.message : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22";
        setSaveResult(msg);
        setForm({
          job: "",
          note: "",
          subkpi: "",
          mainkpi: "",
          deadline: "",
          assignedToName: isStaff ? user.name : "",
          assignedToTeam: user.team,
          assignedToEmpId: "",
          extra_data: {}
        });
        setAssigneeKpis([]);
        onSaved == null ? void 0 : onSaved();
      } catch (e) {
        alert(e.message || "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setSaving(false);
      }
    };
    return /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: isStaff ? "Create Personal Task" : "Assign Task",
        subtitle: isStaff ? "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E08\u0E32\u0E01 shell \u0E43\u0E2B\u0E21\u0E48" : "\u0E21\u0E2D\u0E1A\u0E2B\u0E21\u0E32\u0E22\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49\u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30\u0E2B\u0E25\u0E32\u0E22 Job (\u0E41\u0E15\u0E48\u0E25\u0E30\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 = 1 \u0E07\u0E32\u0E19)"
      },
      saveResult && /* @__PURE__ */ React.createElement("div", { className: "mb-4 rounded-[14px] p-3 mx-status-completed text-sm font-bold" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-check-circle mr-2" }), saveResult),
      /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Job / \u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19", !isStaff && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-xs text-[var(--mx-muted)] font-normal" }, "(\u0E41\u0E15\u0E48\u0E25\u0E30\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 = 1 \u0E07\u0E32\u0E19)")), /* @__PURE__ */ React.createElement(
        "textarea",
        {
          className: "mx-textarea min-h-[110px]",
          value: form.job,
          onChange: (e) => setForm((p) => ({ ...p, job: e.target.value })),
          placeholder: isStaff ? "\u0E23\u0E30\u0E1A\u0E38 job \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19" : "Job 1\nJob 2\nJob 3 (\u0E41\u0E15\u0E48\u0E25\u0E30\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E08\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19 1 \u0E07\u0E32\u0E19)"
        }
      )), !isStaff && /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A"), /* @__PURE__ */ React.createElement(
        "select",
        {
          className: "mx-select",
          value: form.assignedToEmpId,
          onChange: (e) => setForm((p) => ({ ...p, assignedToEmpId: e.target.value }))
        },
        /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A"),
        (people || []).map((person) => /* @__PURE__ */ React.createElement("option", { key: person.empId, value: person.empId }, person.name, " (", person.team, ")"))
      )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Sub KPI"), activeKpis.length > 0 ? /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: form.subkpi, onChange: (e) => handleSubKpiChange(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI"), activeKpis.map((k) => /* @__PURE__ */ React.createElement("option", { key: `${k.main}-${k.sub}`, value: k.sub }, k.sub, " (", k.main, ")"))) : /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          value: form.subkpi,
          onChange: (e) => setForm((p) => ({ ...p, subkpi: e.target.value })),
          placeholder: isStaff ? "Sub KPI" : "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A\u0E01\u0E48\u0E2D\u0E19"
        }
      )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Main KPI"), /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          value: form.mainkpi,
          readOnly: true,
          placeholder: loadingDeadline ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13..." : "\u0E01\u0E23\u0E2D\u0E01\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI"
        }
      )), /* @__PURE__ */ React.createElement(
        ExtraDataFields,
        {
          subkpi: form.subkpi,
          extraData: form.extra_data,
          onChange: (ed) => setForm((p) => ({ ...p, extra_data: ed }))
        }
      ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Deadline (\u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01 SLA)"), /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          value: form.deadline ? formatDate(form.deadline) : "",
          readOnly: true,
          placeholder: loadingDeadline ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13..." : "\u0E01\u0E23\u0E2D\u0E01\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI"
        }
      )), isStaff && /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Note (optional)"), /* @__PURE__ */ React.createElement(
        "textarea",
        {
          className: "mx-textarea min-h-[80px]",
          value: form.note,
          onChange: (e) => setForm((p) => ({ ...p, note: e.target.value })),
          placeholder: "\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21"
        }
      ))),
      /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", disabled: saving, onClick: handleSave }, saving ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : isStaff ? "Create Task" : "Assign Task"))
    );
  }
  function PeopleView({ user, people, onRefresh }) {
    return /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: user.role === "Lead" ? "Team People" : "People Directory",
        subtitle: "\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E48\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E44\u0E14\u0E49\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E14\u0E34\u0E21 \u0E41\u0E15\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E43\u0E19\u0E42\u0E04\u0E23\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2D\u0E48\u0E32\u0E19\u0E07\u0E48\u0E32\u0E22\u0E01\u0E27\u0E48\u0E32",
        actions: [/* @__PURE__ */ React.createElement("button", { key: "refresh", className: "mx-btn mx-btn-soft", onClick: onRefresh }, "Refresh")]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 xl:grid-cols-3 gap-3" }, (people || []).map((person) => /* @__PURE__ */ React.createElement("div", { key: `${person.empId}-${person.name}`, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, person.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, person.team, " \u2022 ", person.role), /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-xs text-[var(--mx-muted)]" }, "Emp ID: ", person.empId))), (!people || people.length === 0) && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D"))
    );
  }
  function AdminStudio({ user, adminData, onRefresh }) {
    var _a, _b, _c, _d;
    const [userForm, setUserForm] = useState({ empid: "", name: "", team: "", role: "Staff", pigurl: "" });
    const [teamName, setTeamName] = useState("");
    const [kpiForm, setKpiForm] = useState({ main: "", sub: "", team: "", days: 1, main_weight: 1 });
    const [holidayForm, setHolidayForm] = useState({ holiday_date: "", name: "", is_active: true });
    const saveUser = async () => {
      const res = await adminPost("admin/saveUser", { ...userForm, permissions: { allowedTeams: [], allowedStaff: [] } }, user.empId);
      if (res.error) return alert(res.error);
      setUserForm({ empid: "", name: "", team: "", role: "Staff", pigurl: "" });
      onRefresh();
      alert("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 user \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const saveTeam = async () => {
      const res = await adminPost("admin/saveTeam", { name: teamName }, user.empId);
      if (res.error) return alert(res.error);
      setTeamName("");
      onRefresh();
      alert("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E17\u0E35\u0E21\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const saveKpi = async () => {
      const res = await adminPost("admin/saveKpi", { ...kpiForm, days: Number(kpiForm.days), main_weight: Number(kpiForm.main_weight) }, user.empId);
      if (res.error) return alert(res.error);
      setKpiForm({ main: "", sub: "", team: "", days: 1, main_weight: 1 });
      alert("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 KPI \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const saveHoliday = async () => {
      const res = await adminPost("admin/saveHoliday", holidayForm, user.empId);
      if (res.error) return alert(res.error);
      setHolidayForm({ holiday_date: "", name: "", is_active: true });
      onRefresh();
      alert("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const recalc = async () => {
      const res = await adminPost("admin/recalculateDeadlines", {}, user.empId);
      if (res.error) return alert(res.error);
      alert(`Recalculated ${res.syncedTasks || 0} task(s)`);
    };
    const removeUser = async (empId) => {
      if (!window.confirm(`Delete user ${empId}?`)) return;
      const res = await adminDelete(`admin/deleteUser?empId=${encodeURIComponent(empId)}`, user.empId);
      if (res.error) return alert(res.error);
      onRefresh();
    };
    const removeTeam = async (id) => {
      if (!window.confirm("Delete this team?")) return;
      const res = await adminDelete(`admin/deleteTeam?id=${encodeURIComponent(id)}`, user.empId);
      if (res.error) return alert(res.error);
      onRefresh();
    };
    const removeHoliday = async (id) => {
      if (!window.confirm("Delete this holiday?")) return;
      const res = await adminDelete(`admin/deleteHoliday?id=${encodeURIComponent(id)}`, user.empId);
      if (res.error) return alert(res.error);
      onRefresh();
    };
    const removeKpi = async (id) => {
      if (!window.confirm("Delete this KPI?")) return;
      const res = await adminDelete(`admin/deleteKpi?id=${encodeURIComponent(id)}`, user.empId);
      if (res.error) return alert(res.error);
      onRefresh();
    };
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Admin Studio", subtitle: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E43\u0E2B\u0E21\u0E48 \u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E41\u0E15\u0E30 database" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Users", value: ((_a = adminData == null ? void 0 : adminData.staff) == null ? void 0 : _a.length) || 0, sub: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A", icon: "fa-users" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Teams", value: ((_b = adminData == null ? void 0 : adminData.teams) == null ? void 0 : _b.length) || 0, sub: "\u0E17\u0E35\u0E21\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E27\u0E49", icon: "fa-people-group", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Holidays", value: ((_c = adminData == null ? void 0 : adminData.holidays) == null ? void 0 : _c.length) || 0, sub: "\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E43\u0E19\u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 SLA", icon: "fa-calendar-days", accent: "var(--mx-amber)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Audit Logs", value: ((_d = adminData == null ? void 0 : adminData.logs) == null ? void 0 : _d.length) || 0, sub: "log \u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A", icon: "fa-shield-halved", accent: "var(--mx-blue)" }))), /* @__PURE__ */ React.createElement("div", { className: "grid xl:grid-cols-2 gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Create / Update User", subtitle: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E08\u0E32\u0E01\u0E20\u0E32\u0E22\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Emp ID", value: userForm.empid, onChange: (e) => setUserForm((p) => ({ ...p, empid: e.target.value })) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Name", value: userForm.name, onChange: (e) => setUserForm((p) => ({ ...p, name: e.target.value })) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Team", value: userForm.team, onChange: (e) => setUserForm((p) => ({ ...p, team: e.target.value })) }), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: userForm.role, onChange: (e) => setUserForm((p) => ({ ...p, role: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "Staff" }, "Staff"), /* @__PURE__ */ React.createElement("option", { value: "Lead" }, "Lead"), /* @__PURE__ */ React.createElement("option", { value: "Manager" }, "Manager"), /* @__PURE__ */ React.createElement("option", { value: "Admin" }, "Admin")), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Avatar URL (optional)", value: userForm.pigurl, onChange: (e) => setUserForm((p) => ({ ...p, pigurl: e.target.value })) }), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: saveUser }, "Save User"))), /* @__PURE__ */ React.createElement(Panel, { title: "Organization Controls", subtitle: "\u0E17\u0E35\u0E21, KPI, \u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14 \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E04\u0E33\u0E19\u0E27\u0E13 SLA" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-end gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "Team"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-xs text-[var(--mx-muted)]" }, "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E17\u0E35\u0E21\u0E43\u0E2B\u0E21\u0E48\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E08\u0E31\u0E14\u0E01\u0E25\u0E38\u0E48\u0E21\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30 KPI"), /* @__PURE__ */ React.createElement("input", { className: "mx-input mt-3", placeholder: "New Team Name", value: teamName, onChange: (e) => setTeamName(e.target.value) })), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft lg:w-36", onClick: saveTeam }, "Save Team"))), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "KPI Definition"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-xs text-[var(--mx-muted)]" }, "\u0E01\u0E33\u0E2B\u0E19\u0E14 SLA days \u0E41\u0E25\u0E30 Weight \u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13\u0E04\u0E30\u0E41\u0E19\u0E19\u0E41\u0E1A\u0E1A\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01")), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, "Weight affects score")), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Main KPI", /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Main KPI", value: kpiForm.main, onChange: (e) => setKpiForm((p) => ({ ...p, main: e.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Sub KPI", /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Sub KPI", value: kpiForm.sub, onChange: (e) => setKpiForm((p) => ({ ...p, sub: e.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Team", /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Team", value: kpiForm.team, onChange: (e) => setKpiForm((p) => ({ ...p, team: e.target.value })) })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "SLA Days", /* @__PURE__ */ React.createElement("input", { className: "mx-input", type: "number", min: "1", placeholder: "1", value: kpiForm.days, onChange: (e) => setKpiForm((p) => ({ ...p, days: e.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Weight", /* @__PURE__ */ React.createElement("input", { className: "mx-input", type: "number", min: "1", step: "0.1", placeholder: "1", value: kpiForm.main_weight, onChange: (e) => setKpiForm((p) => ({ ...p, main_weight: e.target.value })) })))), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft w-full mt-3", onClick: saveKpi }, "Save KPI")), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "Holiday Calendar"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-xs text-[var(--mx-muted)]" }, "\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E08\u0E30\u0E16\u0E39\u0E01\u0E43\u0E0A\u0E49\u0E15\u0E2D\u0E19\u0E04\u0E33\u0E19\u0E27\u0E13 deadline \u0E41\u0E25\u0E30 SLA"), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-[180px_1fr_auto] gap-3 mt-3" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input", type: "date", value: holidayForm.holiday_date, onChange: (e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value })) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Holiday Name", value: holidayForm.name, onChange: (e) => setHolidayForm((p) => ({ ...p, name: e.target.value })) }), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft md:w-36", onClick: saveHoliday }, "Save Holiday"))), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "Maintenance"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-xs text-[var(--mx-muted)]" }, "\u0E43\u0E0A\u0E49\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E21\u0E35\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E31\u0E1A KPI \u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14 \u0E41\u0E25\u0E49\u0E27\u0E15\u0E49\u0E2D\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13 deadline \u0E43\u0E2B\u0E21\u0E48")), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary lg:w-60", onClick: recalc }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate mr-2" }), "Recalculate Deadlines")))))), /* @__PURE__ */ React.createElement("div", { className: "grid xl:grid-cols-2 gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Teams", subtitle: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E21\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E14\u0E34\u0E21" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, ((adminData == null ? void 0 : adminData.teams) || []).map((team) => /* @__PURE__ */ React.createElement("div", { key: team.id || team.name, className: "mx-data-card flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, team.name), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeTeam(team.id) }, "Delete"))))), /* @__PURE__ */ React.createElement(Panel, { title: "Latest Audit Logs", subtitle: "\u0E14\u0E39\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E41\u0E1B\u0E25\u0E07\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E02\u0E49\u0E32 backend" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, ((adminData == null ? void 0 : adminData.logs) || []).slice(0, 12).map((log) => /* @__PURE__ */ React.createElement("div", { key: log.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-sm" }, log.action || "Activity"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, log.details || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)]" }, log.by_user || "-", " \u2022 ", formatDate(log.timestamp, true))))))), /* @__PURE__ */ React.createElement("div", { className: "grid xl:grid-cols-3 gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Users", subtitle: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E43\u0E2B\u0E21\u0E48" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, ((adminData == null ? void 0 : adminData.staff) || []).slice(0, 15).map((s) => /* @__PURE__ */ React.createElement("div", { key: s.empId, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, s.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, s.empId, " \u2022 ", s.team, " \u2022 ", s.role)), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeUser(s.empId) }, "Delete")))))), /* @__PURE__ */ React.createElement(Panel, { title: "KPI Catalog", subtitle: "\u0E40\u0E2B\u0E47\u0E19\u0E41\u0E25\u0E30\u0E25\u0E1A KPI \u0E44\u0E14\u0E49\u0E08\u0E32\u0E01\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, ((adminData == null ? void 0 : adminData.kpis) || []).slice(0, 15).map((kpi) => /* @__PURE__ */ React.createElement("div", { key: kpi.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, kpi.main, " / ", kpi.sub), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, kpi.team, " \u2022 ", kpi.days, " day(s) \u2022 weight ", kpi.main_weight)), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeKpi(kpi.id) }, "Delete")))))), /* @__PURE__ */ React.createElement(Panel, { title: "Holiday Calendar", subtitle: "\u0E14\u0E39\u0E41\u0E25\u0E30\u0E25\u0E1A\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, ((adminData == null ? void 0 : adminData.holidays) || []).slice(0, 15).map((holiday) => /* @__PURE__ */ React.createElement("div", { key: holiday.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, holiday.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, holiday.holiday_date, " \u2022 ", holiday.is_active ? "Active" : "Inactive")), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeHoliday(holiday.id) }, "Delete"))))))));
  }
  function App() {
    var _a, _b;
    const [user, setUser] = useState(() => {
      safeLocalRemove(SESSION_KEY);
      return parseJsonSafe(safeSessionGet(SESSION_KEY), null);
    });
    const [theme, setTheme] = useState(() => safeLocalGet(THEME_KEY) || "light");
    const [view, setView] = useState(() => {
      const saved = parseJsonSafe(safeSessionGet(SESSION_KEY), null);
      return ROLE_HOME[saved == null ? void 0 : saved.role] || "dashboard";
    });
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [showNotif, setShowNotif] = useState(false);
    const [showDashboardCreate, setShowDashboardCreate] = useState(false);
    const {
      state,
      filterMonth,
      setFilterMonth,
      filterYear,
      setFilterYear,
      reloadDashboard,
      reloadTasks,
      reloadPeople,
      reloadAdmin
    } = useAppData(user, view);
    useEffect(() => {
      document.documentElement.dataset.theme = theme;
      safeLocalSet(THEME_KEY, theme);
    }, [theme]);
    const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");
    const availableYears = useMemo(() => {
      const y = (/* @__PURE__ */ new Date()).getFullYear();
      const years = [];
      for (let i = y - 3; i <= y + 1; i++) years.push(i);
      return years;
    }, []);
    const notifications = useMemo(() => {
      if (!state.tasks || !state.tasks.length) return [];
      const now = /* @__PURE__ */ new Date();
      const result = [];
      state.tasks.forEach((task) => {
        var _a2;
        const st = (task.status || "").toLowerCase();
        if (st === "pending") {
          result.push({
            id: `pending-${task.id}`,
            type: "pending",
            icon: "fa-circle-exclamation",
            color: "#f59e0b",
            message: `Pending: ${(task.job || "").substring(0, 35)}${((_a2 = task.job) == null ? void 0 : _a2.length) > 35 ? "..." : ""}`
          });
        }
        if (["on process", "pending", "on hold"].includes(st) && task.deadline) {
          const dl = new Date(task.deadline);
          const daysLeft = Math.ceil((dl - now) / 864e5);
          if (daysLeft < 0) {
            result.push({
              id: `overdue-${task.id}`,
              type: "overdue",
              icon: "fa-triangle-exclamation",
              color: "#ef4444",
              message: `\u0E40\u0E01\u0E34\u0E19 deadline ${Math.abs(daysLeft)} \u0E27\u0E31\u0E19: ${(task.job || "").substring(0, 28)}`
            });
          } else if (daysLeft <= 3) {
            result.push({
              id: `deadline-${task.id}`,
              type: "deadline",
              icon: "fa-clock",
              color: "#f59e0b",
              message: `\u0E2D\u0E35\u0E01 ${daysLeft} \u0E27\u0E31\u0E19: ${(task.job || "").substring(0, 30)}`
            });
          }
        }
      });
      return result;
    }, [state.tasks]);
    useEffect(() => {
      if (!user) {
        safeSessionRemove(SESSION_KEY);
        return;
      }
      const empId = user.empId || user.empid;
      if (isLoginLocked(empId)) {
        safeSessionRemove(SESSION_KEY);
        setUser(null);
        setView("dashboard");
        setLoginError("\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E22\u0E39\u0E48 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E40\u0E14\u0E34\u0E21\u0E01\u0E48\u0E2D\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2D\u0E43\u0E2B\u0E49 session \u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38");
        return;
      }
      safeSessionSet(SESSION_KEY, JSON.stringify(user));
      writeActiveSessionLock(user);
    }, [user]);
    useEffect(() => {
      if (!user) return void 0;
      if (isLoginLocked(user.empId || user.empid)) return void 0;
      writeActiveSessionLock(user);
      const timer = setInterval(() => writeActiveSessionLock(user), 15e3);
      const handleBeforeUnload = () => clearActiveSessionLock();
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        clearInterval(timer);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }, [user]);
    const handleLogin = async (empId) => {
      const cleanEmpId = empId == null ? void 0 : empId.trim();
      if (!cleanEmpId) {
        setLoginError("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E2B\u0E31\u0E2A\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19");
        return;
      }
      if (isLoginLocked(cleanEmpId)) {
        setLoginError("\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E22\u0E39\u0E48 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E40\u0E14\u0E34\u0E21\u0E01\u0E48\u0E2D\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2D\u0E43\u0E2B\u0E49 session \u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38");
        return;
      }
      setLoginLoading(true);
      setLoginError("");
      try {
        const res = await API.getInitialData(cleanEmpId);
        if (res == null ? void 0 : res.error) throw new Error(res.error);
        if (!(res == null ? void 0 : res.user)) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19");
        const nextUser = { ...res.user, kpis: res.kpis || [] };
        if (isLoginLocked(nextUser.empId || nextUser.empid || cleanEmpId)) {
          throw new Error("\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E22\u0E39\u0E48 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E40\u0E14\u0E34\u0E21\u0E01\u0E48\u0E2D\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2D\u0E43\u0E2B\u0E49 session \u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38");
        }
        writeActiveSessionLock(nextUser);
        setUser(nextUser);
        setView(ROLE_HOME[nextUser.role] || "dashboard");
      } catch (e) {
        setLoginError(e.message || "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setLoginLoading(false);
      }
    };
    const logout = () => {
      clearActiveSessionLock();
      safeSessionRemove(SESSION_KEY);
      setUser(null);
      setView("dashboard");
      setLoginError("");
    };
    const handleAccept = async (task) => {
      setActionLoading(true);
      try {
        await API.acceptTask(task.id, task.team);
        await reloadTasks();
        await reloadDashboard();
      } catch (e) {
        alert(e.message || "\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setActionLoading(false);
      }
    };
    const handleStatusChange = async (task, status, note = "", mode = "normal") => {
      setActionLoading(true);
      try {
        if (mode === "note_only") {
          await API.updateTaskStatus(task.id, task.team, task.status, note, "append");
        } else if (user.role === "Staff") {
          await API.updateTaskStatus(task.id, task.team, status, note, "append");
        } else {
          await API.updateTaskStatusWithLog(task.id, task.team, status, note, user.name);
        }
        await reloadTasks();
        await reloadDashboard();
      } catch (e) {
        alert(e.message || "\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setActionLoading(false);
      }
    };
    const handleDelete = async (task) => {
      if (!window.confirm(`\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E07\u0E32\u0E19 "${(task.job || "").substring(0, 40)}"?`)) return;
      setActionLoading(true);
      try {
        await API.deleteTask(task.id, task.team, user.name);
        await reloadTasks();
        await reloadDashboard();
      } catch (e) {
        alert(e.message || "\u0E25\u0E1A\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setActionLoading(false);
      }
    };
    const downloadCSV = () => {
      const src = state.tasks || [];
      if (src.length === 0) return alert("\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A export");
      const headers = ["\u0E25\u0E33\u0E14\u0E31\u0E1A", "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19", "Main KPI", "Sub KPI", "\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A", "\u0E17\u0E35\u0E21", "\u0E2A\u0E16\u0E32\u0E19\u0E30", "\u0E27\u0E31\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19", "Deadline", "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08", "\u0E1C\u0E25"];
      const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
      const rows = src.map((t, i) => {
        const dl = t.deadline ? new Date(t.deadline) : null;
        const cp = t.completiondate ? new Date(t.completiondate) : null;
        const onTime = t.status === "Completed" && dl && cp && cp <= dl;
        return [
          i + 1,
          esc(t.job),
          esc(t.mainkpi),
          esc(t.subkpi),
          esc(t.name),
          esc(t.team),
          esc(t.status),
          esc(formatDate(t.startdate)),
          esc(formatDate(t.deadline)),
          esc(formatDate(t.completiondate)),
          t.status === "Completed" ? onTime ? "\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32" : "\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14" : "-"
        ].join(",");
      });
      const period = filterMonth === 0 ? `all_${filterYear}` : `${filterMonth}_${filterYear}`;
      const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
    const handleNavigate = (nextView) => {
      if (nextView === "create" && view === "dashboard" && user.role === "Staff") {
        setShowDashboardCreate(true);
        return;
      }
      setView(nextView);
    };
    if (!user) {
      return /* @__PURE__ */ React.createElement(LoginScreenPro, { onLogin: handleLogin, loading: loginLoading, error: loginError, theme, onToggleTheme: toggleTheme });
    }
    const showFilterBar = ["dashboard", "tasks"].includes(view);
    const peopleForAssign = ((_a = state.people) == null ? void 0 : _a.length) ? state.people : ((_b = state.admin) == null ? void 0 : _b.staff) || [];
    const pageTitle = view === "dashboard" ? user.role === "Manager" ? "Executive Dashboard" : user.role === "Lead" ? "Team Command Center" : user.role === "Admin" ? "System Control Center" : "My Work Dashboard" : view === "tasks" ? "Task Center" : view === "create" ? "Create Task" : view === "assign" ? "Assignment Center" : view === "people" ? "People Overview" : view === "tracker" ? "Job Tracker" : view === "admin" ? "Admin Studio" : "MAXIWA KPI";
    const pageSubtitle = view === "dashboard" ? "KPI, SLA, \u0E07\u0E32\u0E19\u0E04\u0E49\u0E32\u0E07 \u0E41\u0E25\u0E30\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01" : view === "tasks" ? "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19 \u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E2A\u0E16\u0E32\u0E19\u0E30 \u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A SLA" : view === "tracker" ? "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E07\u0E32\u0E19\u0E08\u0E32\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E07\u0E32\u0E19" : view === "admin" ? "\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E17\u0E35\u0E21 KPI \u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14 \u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E30\u0E1A\u0E1A" : "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E02\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E1A\u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13";
    const activePeriodLabel = showFilterBar ? `${filterMonth === 0 ? "\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19" : MONTH_NAMES[filterMonth - 1]} ${filterYear}` : user.team;
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen p-4 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[1640px] mx-auto grid xl:grid-cols-[320px_1fr] gap-5 items-start" }, /* @__PURE__ */ React.createElement(Sidebar, { user, view, setView, onLogout: logout, notifCount: notifications.length }), /* @__PURE__ */ React.createElement("main", { className: "grid content-start gap-5" }, /* @__PURE__ */ React.createElement("header", { className: "mx-shell-card overflow-visible" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-5 md:px-6 md:py-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "mx-brand-pill inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-[0.16em]" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-gauge-high" }), " MAXIWA KPI"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-user" }), user.role), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-building-user" }), user.team)), /* @__PURE__ */ React.createElement("h1", { className: "mt-4 mb-0 text-[30px] md:text-[38px] leading-tight font-extrabold tracking-normal" }, pageTitle), /* @__PURE__ */ React.createElement("p", { className: "mt-2 mb-0 max-w-[64ch] text-sm md:text-[15px] leading-6 text-[var(--mx-muted)]" }, pageSubtitle)), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center xl:justify-end gap-2" }, /* @__PURE__ */ React.createElement(ThemeToggle, { theme, onToggle: toggleTheme }), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3 relative", onClick: () => setShowNotif((v) => !v), title: "Notifications", "aria-label": "Notifications" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-bell" }), notifications.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center" }, notifications.length > 9 ? "9+" : notifications.length)), showNotif && /* @__PURE__ */ React.createElement("div", { className: "absolute right-0 top-12 z-40 w-80 mx-shell-card rounded-[20px] p-4 shadow-2xl border border-[rgba(255,255,255,0.08)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold mb-3 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", null, "\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19"), /* @__PURE__ */ React.createElement("button", { className: "text-[var(--mx-muted)] hover:text-[var(--mx-text)]", onClick: () => setShowNotif(false) }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-xmark" }))), notifications.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-2 max-h-72 overflow-y-auto" }, notifications.slice(0, 10).map((n) => /* @__PURE__ */ React.createElement("div", { key: n.id, className: "rounded-[14px] p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-2 text-sm" }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${n.icon} mt-0.5 flex-shrink-0`, style: { color: n.color } }), /* @__PURE__ */ React.createElement("span", null, n.message))))))), view === "tasks" && state.tasks.length > 0 && /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2", onClick: downloadCSV, title: "Export CSV" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-file-csv mr-1" }), "CSV"), (state.loading || actionLoading) && /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-pending" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate-right fa-spin" }), "Loading")))), /* @__PURE__ */ React.createElement("div", { className: "border-t border-[var(--mx-line)] bg-[var(--mx-surface)] px-5 py-3 md:px-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 text-sm text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-lg mx-brand-mark grid place-items-center" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-calendar-check text-[var(--mx-accent)]" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.14em] font-extrabold" }, "Current Scope"), /* @__PURE__ */ React.createElement("div", { className: "mt-0.5 text-[var(--mx-text)] font-bold" }, activePeriodLabel))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, showFilterBar && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "mx-select !w-[160px] !py-2 !text-sm",
        value: filterMonth,
        onChange: (e) => setFilterMonth(Number(e.target.value))
      },
      /* @__PURE__ */ React.createElement("option", { value: 0 }, "\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19"),
      MONTH_NAMES.map((name, i) => /* @__PURE__ */ React.createElement("option", { key: i + 1, value: i + 1 }, name))
    ), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "mx-select !w-[116px] !py-2 !text-sm",
        value: filterYear,
        onChange: (e) => setFilterYear(Number(e.target.value))
      },
      availableYears.map((y) => /* @__PURE__ */ React.createElement("option", { key: y, value: y }, y))
    ))))), state.error && /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-4 md:px-6 text-sm text-[#ffb7b7] font-bold" }, state.error)), showDashboardCreate && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(15, 23, 42, 0.56)" } }, /* @__PURE__ */ React.createElement("div", { className: "relative w-full max-w-3xl max-h-[92vh] overflow-y-auto" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !p-0 absolute right-4 top-4 z-10 w-10 h-10 grid place-items-center",
        onClick: () => setShowDashboardCreate(false),
        "aria-label": "Close create task popup",
        title: "Close"
      },
      /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-xmark" })
    ), /* @__PURE__ */ React.createElement(
      QuickCreateView,
      {
        user,
        people: peopleForAssign,
        onSaved: () => {
          reloadTasks();
          reloadDashboard();
          setShowDashboardCreate(false);
        }
      }
    ))), view === "dashboard" && /* @__PURE__ */ React.createElement(
      DashboardView,
      {
        user,
        data: state.dashboard,
        filterMonth,
        filterYear,
        onAccept: handleAccept,
        onStatusChange: handleStatusChange,
        onNavigate: handleNavigate
      }
    ), view === "tasks" && /* @__PURE__ */ React.createElement(
      TaskCenterView,
      {
        user,
        tasks: state.tasks,
        onAccept: handleAccept,
        onStatusChange: handleStatusChange,
        onDelete: handleDelete,
        onRefresh: reloadTasks
      }
    ), view === "create" && /* @__PURE__ */ React.createElement(QuickCreateView, { user, people: peopleForAssign, onSaved: () => {
      reloadTasks();
      reloadDashboard();
    } }), view === "assign" && /* @__PURE__ */ React.createElement(QuickCreateView, { user, people: peopleForAssign, onSaved: () => {
      reloadTasks();
      reloadDashboard();
      reloadPeople();
    } }), view === "people" && /* @__PURE__ */ React.createElement(PeopleView, { user, people: state.people, onRefresh: reloadPeople }), view === "tracker" && /* @__PURE__ */ React.createElement(TrackerViewNew, null), view === "admin" && /* @__PURE__ */ React.createElement(AdminStudio, { user, adminData: state.admin, onRefresh: reloadAdmin }))));
  }
  const _root = ReactDOM.createRoot(document.getElementById("root"));
  _root.render(/* @__PURE__ */ React.createElement(App, null));
})();
