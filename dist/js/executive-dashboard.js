var MaxiwaExecutiveDashboard = (() => {
  const { useEffect, useMemo, useState } = React;
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const STRATEGIC_VIEW_ROLES = ["SrManager", "Director", "Executive"];
  const TEAM_SCOPED_ROLES = ["Lead"];
  const EXEC_THEME_KEY = "metrix-executive-theme";
  function getInitialExecutiveTheme() {
    var _a;
    try {
      const saved = localStorage.getItem(EXEC_THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
      return ((_a = window.matchMedia) == null ? void 0 : _a.call(window, "(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    } catch {
      return "light";
    }
  }
  function applyExecutiveTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(EXEC_THEME_KEY, nextTheme);
    } catch {
    }
  }
  function isTeamScopedRole(role) {
    return TEAM_SCOPED_ROLES.includes(role);
  }
  function isStrategicViewRole(role) {
    return STRATEGIC_VIEW_ROLES.includes(role);
  }
  function isSelfScopedRole(role) {
    return role === "Staff";
  }
  const TAB_ITEMS = [
    { id: "overview", label: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21", icon: "fa-chart-line" },
    { id: "teams", label: "\u0E23\u0E32\u0E22\u0E17\u0E35\u0E21", icon: "fa-people-group" },
    { id: "employees", label: "\u0E23\u0E32\u0E22\u0E1A\u0E38\u0E04\u0E04\u0E25", icon: "fa-id-badge" },
    { id: "kpi", label: "\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C KPI", icon: "fa-bullseye" },
    { id: "weights", label: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 KPI", icon: "fa-scale-balanced" }
  ];
  function fmtPct(value) {
    return value === null || value === void 0 || Number.isNaN(value) ? "-" : `${value}%`;
  }
  function fmtNum(value) {
    return Number(value || 0).toLocaleString();
  }
  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  }
  function normalizeStatus(task) {
    return String((task == null ? void 0 : task.status) || "").trim().toLowerCase();
  }
  function isCompleted(task) {
    return normalizeStatus(task) === "completed";
  }
  function isCancelled(task) {
    return normalizeStatus(task) === "cancelled";
  }
  function isActive(task) {
    return !isCompleted(task) && !isCancelled(task);
  }
  function isOnProcess(task) {
    const status = normalizeStatus(task);
    return status === "on process" || status === "on_process";
  }
  function taskWeight(task) {
    var _a, _b, _c, _d;
    const raw = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpiweight) != null ? _a : task == null ? void 0 : task.main_weight) != null ? _b : task == null ? void 0 : task.weight) != null ? _c : task == null ? void 0 : task.kpiweight) != null ? _d : 1;
    const weight = typeof raw === "string" ? Number.parseFloat(raw.replace("%", "").trim()) : Number(raw);
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  }
  function mainKpi(task) {
    var _a, _b, _c, _d, _e;
    return String((_e = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpi) != null ? _a : task == null ? void 0 : task.mainKpi) != null ? _b : task == null ? void 0 : task.main) != null ? _c : task == null ? void 0 : task.subkpi) != null ? _d : task == null ? void 0 : task.sub) != null ? _e : "Other").trim() || "Other";
  }
  function subKpi(task) {
    var _a, _b, _c, _d;
    return String((_d = (_c = (_b = (_a = task == null ? void 0 : task.subkpi) != null ? _a : task == null ? void 0 : task.subKpi) != null ? _b : task == null ? void 0 : task.sub) != null ? _c : task == null ? void 0 : task.job) != null ? _d : "General").trim() || "General";
  }
  function personName(task) {
    return String((task == null ? void 0 : task.name) || (task == null ? void 0 : task.assignee) || (task == null ? void 0 : task.owner) || (task == null ? void 0 : task.empName) || (task == null ? void 0 : task.empId) || (task == null ? void 0 : task.empid) || "Unassigned").trim();
  }
  function teamName(task) {
    return String((task == null ? void 0 : task.team) || "Unassigned").trim();
  }
  function normalizePhotoUrl(value) {
    const src = String(value || "").trim();
    if (!src) return "";
    const driveFile = src.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveFile == null ? void 0 : driveFile[1]) return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
    const driveOpen = src.match(/[?&]id=([^&]+)/);
    if (src.includes("drive.google.com") && (driveOpen == null ? void 0 : driveOpen[1])) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;
    return src;
  }
  function getPhotoUrl(item) {
    return normalizePhotoUrl(
      (item == null ? void 0 : item.pigurl) || (item == null ? void 0 : item.pigUrl) || (item == null ? void 0 : item.pigURL) || (item == null ? void 0 : item.picurl) || (item == null ? void 0 : item.picUrl) || (item == null ? void 0 : item.picture) || (item == null ? void 0 : item.pictureUrl) || (item == null ? void 0 : item.profilePicture) || (item == null ? void 0 : item.profile_picture) || (item == null ? void 0 : item.avatar) || (item == null ? void 0 : item.avatarUrl) || (item == null ? void 0 : item.photoUrl) || (item == null ? void 0 : item.photo_url) || (item == null ? void 0 : item.profileUrl) || (item == null ? void 0 : item.profile_url) || (item == null ? void 0 : item.imageUrl) || (item == null ? void 0 : item.image_url) || (item == null ? void 0 : item.image) || (item == null ? void 0 : item.photo) || ""
    );
  }
  function initialsFrom(name) {
    return String(name || "U").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "U";
  }
  function isCompletedOnTime(task) {
    if (!isCompleted(task)) return false;
    const deadline = (task == null ? void 0 : task.deadline) ? new Date(task.deadline) : null;
    const completedAt = (task == null ? void 0 : task.completiondate) ? new Date(task.completiondate) : null;
    return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt <= deadline);
  }
  function isCompletedLate(task) {
    if (!isCompleted(task)) return false;
    const deadline = (task == null ? void 0 : task.deadline) ? new Date(task.deadline) : null;
    const completedAt = (task == null ? void 0 : task.completiondate) ? new Date(task.completiondate) : null;
    return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt > deadline);
  }
  function normalizeDateOnly(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }
  function dateKey(value) {
    const date = normalizeDateOnly(value);
    if (!date) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }
  function isActiveHoliday(holiday) {
    var _a, _b;
    const active = (_b = (_a = holiday == null ? void 0 : holiday.is_active) != null ? _a : holiday == null ? void 0 : holiday.active) != null ? _b : true;
    return active === true || active === 1 || String(active).toLowerCase() === "true";
  }
  function buildHolidaySet(holidays = []) {
    if (holidays instanceof Set) return holidays;
    return new Set((holidays || []).filter(isActiveHoliday).map((holiday) => dateKey(holiday.holiday_date || holiday.date || holiday.day)).filter(Boolean));
  }
  function isWorkingDay(date, holidaySet = /* @__PURE__ */ new Set()) {
    const day = date.getDay();
    return day !== 0 && day !== 6 && !holidaySet.has(dateKey(date));
  }
  function businessDaysBetween(startValue, endValue, holidays = []) {
    const start = normalizeDateOnly(startValue);
    const end = normalizeDateOnly(endValue);
    if (!start || !end) return null;
    if (start.getTime() === end.getTime()) return 0;
    const holidaySet = buildHolidaySet(holidays);
    const direction = end > start ? 1 : -1;
    const cursor = new Date(start);
    let count = 0;
    while (cursor.getTime() !== end.getTime()) {
      cursor.setDate(cursor.getDate() + direction);
      if (isWorkingDay(cursor, holidaySet)) count += direction;
    }
    return count;
  }
  function daysUntil(task, holidays = []) {
    if (!(task == null ? void 0 : task.deadline)) return null;
    return businessDaysBetween(/* @__PURE__ */ new Date(), task.deadline, holidays);
  }
  function extractJobCode(job) {
    if (!job) return "-";
    const match = String(job).match(/^([A-Za-z]+\d+_\d+)/);
    return match ? match[1].toUpperCase() : String(job).slice(0, 26);
  }
  function clampPercent(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, num));
  }
  function healthClass(value) {
    if (value === null || value === void 0 || Number.isNaN(value)) return "status-neutral";
    if (value >= 90) return "status-good";
    if (value >= 75) return "status-info";
    if (value >= 60) return "status-warn";
    return "status-bad";
  }
  function riskBadge(days) {
    if (days === null) return ["No deadline", "status-neutral"];
    if (days < 0) return [`${Math.abs(days)} bd late`, "status-bad"];
    if (days <= 3) return [`${days} bd left`, "status-warn"];
    return [`${days} bd left`, "status-info"];
  }
  function groupBy(items, getKey) {
    const map = {};
    (items || []).forEach((item) => {
      const key = getKey(item) || "Unassigned";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }
  function calcWeightedScores(tasks) {
    if (window.calcWeightedScores) return window.calcWeightedScores(tasks || []);
    const groups = {};
    (tasks || []).forEach((task) => {
      if (isCancelled(task)) return;
      const key = mainKpi(task);
      const weight = taskWeight(task);
      if (!groups[key]) groups[key] = { weight, total: 0, completed: 0, onTime: 0 };
      else if (groups[key].weight === 1 && weight !== 1) groups[key].weight = weight;
      groups[key].total += 1;
      if (isCompleted(task)) {
        groups[key].completed += 1;
        if (isCompletedOnTime(task)) groups[key].onTime += 1;
      }
    });
    let totalWeight = 0;
    let completedWeight = 0;
    let slaWeight = 0;
    let onTimeWeight = 0;
    Object.values(groups).forEach((group) => {
      const weight = Math.max(1, Number(group.weight || 1));
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
  function getTaskMonth(task) {
    const raw = task.completiondate || task.deadline || task.startdate || task.created_at || task.timestamp;
    const d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.getMonth();
  }
  function buildPortfolio(tasks, holidays = []) {
    var _a;
    const active = tasks.filter(isActive);
    const completed = tasks.filter(isCompleted);
    const onProcess = tasks.filter(isOnProcess);
    const overdue = active.filter((task) => {
      const days = daysUntil(task, holidays);
      return days !== null && days < 0;
    });
    const atRisk = active.filter((task) => {
      const days = daysUntil(task, holidays);
      return days !== null && days >= 0 && days <= 3;
    });
    const slaPass = tasks.filter(isCompletedOnTime);
    const slaFail = tasks.filter(isCompletedLate);
    const scores = calcWeightedScores(tasks);
    const completion = (_a = scores.completion) != null ? _a : tasks.length ? Math.round(completed.length / tasks.length * 1e3) / 10 : null;
    const weightedScore = completion !== null && scores.sla !== null ? Math.round((completion + scores.sla) / 2 * 10) / 10 : completion != null ? completion : scores.sla;
    return { active, completed, onProcess, overdue, atRisk, slaPass, slaFail, scores, completion, weightedScore };
  }
  function buildGroupRows(tasks, getKey, holidays = []) {
    return Object.entries(groupBy(tasks, getKey)).map(([name, items]) => {
      var _a, _b, _c, _d;
      const portfolio = buildPortfolio(items, holidays);
      const topKpiEntry = Object.entries(groupBy(items, mainKpi)).sort((a, b) => b[1].length - a[1].length)[0];
      const health = Math.round((((_b = (_a = portfolio.scores.sla) != null ? _a : portfolio.completion) != null ? _b : 0) + ((_d = (_c = portfolio.completion) != null ? _c : portfolio.scores.sla) != null ? _d : 0)) / 2) - portfolio.overdue.length * 5 - portfolio.atRisk.length * 2;
      return {
        name,
        items,
        total: items.length,
        active: portfolio.active.length,
        completed: portfolio.completed.length,
        onProcess: portfolio.onProcess.length,
        backlog: Math.max(0, items.length - portfolio.completed.length),
        overdue: portfolio.overdue.length,
        risk: portfolio.atRisk.length,
        slaPass: portfolio.slaPass.length,
        slaFail: portfolio.slaFail.length,
        sla: portfolio.scores.sla,
        completion: portfolio.completion,
        weightedScore: portfolio.weightedScore,
        health,
        topKpi: topKpiEntry ? topKpiEntry[0] : "-",
        topKpiCount: topKpiEntry ? topKpiEntry[1].length : 0
      };
    });
  }
  function buildKpiRows(tasks) {
    return Object.entries(groupBy(tasks, mainKpi)).map(([name, items]) => {
      const portfolio = buildPortfolio(items);
      return {
        name,
        total: items.length,
        active: portfolio.active.length,
        completed: portfolio.completed.length,
        onProcess: portfolio.onProcess.length,
        weight: Math.max(...items.map(taskWeight), 1),
        share: tasks.length ? Math.round(items.length / tasks.length * 1e3) / 10 : 0,
        sla: portfolio.scores.sla,
        completion: portfolio.completion,
        slaPass: portfolio.slaPass.length,
        slaFail: portfolio.slaFail.length
      };
    }).sort((a, b) => b.total - a.total);
  }
  function buildKpiWeightRows(tasks) {
    return Object.entries(groupBy(tasks, (task) => `${teamName(task)}|${mainKpi(task)}|${subKpi(task)}`)).map(([key, items]) => {
      const [team, main, sub] = key.split("|");
      const portfolio = buildPortfolio(items);
      return {
        team,
        main,
        sub,
        weight: Math.max(...items.map(taskWeight), 1),
        total: items.length,
        completed: portfolio.completed.length,
        pending: Math.max(0, items.length - portfolio.completed.length),
        slaPass: portfolio.slaPass.length,
        slaFail: portfolio.slaFail.length,
        sla: portfolio.scores.sla
      };
    }).sort((a, b) => a.team.localeCompare(b.team) || b.total - a.total);
  }
  function Shell({ children }) {
    return /* @__PURE__ */ React.createElement("div", { className: "max-w-[1760px] mx-auto p-4 md:p-7 grid gap-6" }, children);
  }
  function Metric({ label, value, sub, icon, tone = "status-info" }) {
    return /* @__PURE__ */ React.createElement("div", { className: `mx-card metric-card p-5 ${tone}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, label), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${tone}` }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${icon}` }))), /* @__PURE__ */ React.createElement("div", { className: "mt-5 metric-number" }, value), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, sub));
  }
  function GaugeMetric({ label, value, sub, tone = "var(--mx-indigo)" }) {
    const pct = clampPercent(value);
    const circumference = 2 * Math.PI * 42;
    const dash = pct / 100 * circumference;
    return /* @__PURE__ */ React.createElement("div", { className: "mx-card p-5 flex items-center gap-5 min-h-[176px]" }, /* @__PURE__ */ React.createElement("svg", { width: "112", height: "112", viewBox: "0 0 112 112", role: "img", "aria-label": `${label} ${fmtPct(value)}` }, /* @__PURE__ */ React.createElement("circle", { cx: "56", cy: "56", r: "42", fill: "none", stroke: "rgba(100,116,139,0.16)", strokeWidth: "12" }), /* @__PURE__ */ React.createElement("circle", { cx: "56", cy: "56", r: "42", fill: "none", stroke: tone, strokeWidth: "12", strokeLinecap: "round", strokeDasharray: `${dash} ${circumference - dash}`, transform: "rotate(-90 56 56)" }), /* @__PURE__ */ React.createElement("text", { x: "56", y: "60", textAnchor: "middle", fontSize: "22", fontWeight: "900", fill: "var(--mx-text)" }, fmtPct(value))), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, label), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)] leading-6" }, sub)));
  }
  function HorizontalBar({ value, color = "var(--mx-indigo)" }) {
    return /* @__PURE__ */ React.createElement("div", { className: "bar-track" }, /* @__PURE__ */ React.createElement("div", { className: "bar-fill", style: { width: `${clampPercent(value)}%`, background: color } }));
  }
  function LineChart({ months, series, mode = "percent" }) {
    const width = 860;
    const height = 270;
    const pad = { left: 42, right: 18, top: 24, bottom: 42 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const keys = mode === "volume" ? ["total", "completed", "risk"] : ["sla", "completion", "risk"];
    const values = keys.flatMap((key) => series[key] || []).filter((value) => value !== null && value !== void 0 && Number.isFinite(Number(value))).map(Number);
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : mode === "volume" ? 10 : 100;
    const closeRange = mode !== "volume" && values.length > 1 && maxValue - minValue <= 18 && minValue >= 60;
    const yMin = mode === "volume" ? 0 : closeRange ? Math.max(0, Math.floor((minValue - 8) / 5) * 5) : 0;
    const yMax = mode === "volume" ? Math.max(5, Math.ceil((maxValue + Math.max(2, maxValue * 0.12)) / 5) * 5) : closeRange ? Math.min(100, Math.ceil((maxValue + 6) / 5) * 5) : 100;
    const ticks = mode === "volume" ? Array.from({ length: 5 }, (_, index) => Math.round(yMin + (yMax - yMin) * index / 4)) : closeRange ? Array.from({ length: 5 }, (_, index) => Math.round((yMin + (yMax - yMin) * index / 4) * 10) / 10) : [0, 25, 50, 75, 100];
    const x = (index) => pad.left + plotW * index / Math.max(1, months.length - 1);
    const y = (value) => {
      const num = Number(value || 0);
      const range = Math.max(1, yMax - yMin);
      return pad.top + plotH - plotH * (Math.max(yMin, Math.min(yMax, num)) - yMin) / range;
    };
    const points = (values2) => values2.map((value, index) => `${x(index)},${value === null ? y(yMin) : y(value)}`).join(" ");
    return /* @__PURE__ */ React.createElement("div", { className: "w-full overflow-x-auto" }, /* @__PURE__ */ React.createElement("svg", { viewBox: `0 0 ${width} ${height}`, className: "w-full min-w-[720px]" }, ticks.map((tick) => /* @__PURE__ */ React.createElement("g", { key: tick }, /* @__PURE__ */ React.createElement("line", { className: "chart-grid", x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick) }), /* @__PURE__ */ React.createElement("text", { className: "chart-label", x: "8", y: y(tick) + 4 }, mode === "volume" ? tick : `${tick}%`))), mode !== "volume" && yMin <= 95 && yMax >= 95 && /* @__PURE__ */ React.createElement("g", null, /* @__PURE__ */ React.createElement("line", { x1: pad.left, x2: width - pad.right, y1: y(95), y2: y(95), stroke: "var(--mx-success)", opacity: ".55", strokeDasharray: "7 7", strokeWidth: "1.5" }), /* @__PURE__ */ React.createElement("text", { className: "chart-label", x: width - pad.right - 70, y: y(95) - 7 }, "Target 95%")), mode !== "volume" && closeRange && /* @__PURE__ */ React.createElement("text", { className: "chart-label", x: width - pad.right - 126, y: "16" }, "Zoomed scale ", yMin, "-", yMax, "%"), months.map((month, index) => /* @__PURE__ */ React.createElement("text", { key: month, className: "chart-label", x: x(index), y: height - 14, textAnchor: "middle" }, MONTH_NAMES[month].slice(0, 3))), /* @__PURE__ */ React.createElement("polyline", { className: "chart-line", points: points(mode === "volume" ? series.total : series.sla), stroke: mode === "volume" ? "var(--mx-chart-total)" : "var(--mx-info)" }), /* @__PURE__ */ React.createElement("polyline", { className: "chart-line", points: points(mode === "volume" ? series.completed : series.completion), stroke: mode === "volume" ? "var(--mx-chart-completed)" : "var(--mx-success)" }), /* @__PURE__ */ React.createElement("polyline", { className: "chart-line", points: points(series.risk), stroke: "var(--mx-chart-risk)" }), (mode === "volume" ? series.total : series.sla).map((value, index) => value !== null && /* @__PURE__ */ React.createElement("circle", { key: `s-${index}`, cx: x(index), cy: y(value), r: "4", fill: mode === "volume" ? "var(--mx-chart-total)" : "var(--mx-info)" })), (mode === "volume" ? series.completed : series.completion).map((value, index) => value !== null && /* @__PURE__ */ React.createElement("circle", { key: `c-${index}`, cx: x(index), cy: y(value), r: "4", fill: mode === "volume" ? "var(--mx-chart-completed)" : "var(--mx-success)" })), series.risk.map((value, index) => value !== null && /* @__PURE__ */ React.createElement("circle", { key: `r-${index}`, cx: x(index), cy: y(value), r: "4", fill: "var(--mx-chart-risk)" }))));
  }
  function TabBar({ activeTab, setActiveTab }) {
    return /* @__PURE__ */ React.createElement("nav", { className: "tab-strip no-print" }, TAB_ITEMS.map((tab) => /* @__PURE__ */ React.createElement("button", { key: tab.id, className: `tab-button ${activeTab === tab.id ? "active" : ""}`, onClick: () => setActiveTab(tab.id) }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${tab.icon}` }), /* @__PURE__ */ React.createElement("span", null, tab.label))));
  }
  function DataTable({ children, minWidth = 900 }) {
    return /* @__PURE__ */ React.createElement("div", { className: "table-shell overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-sm", style: { minWidth } }, children));
  }
  function Avatar({ item, name, className = "" }) {
    const [failed, setFailed] = useState(false);
    const photo = getPhotoUrl(item);
    const initials = initialsFrom(name || (item == null ? void 0 : item.name) || (item == null ? void 0 : item.empId) || (item == null ? void 0 : item.empid));
    return /* @__PURE__ */ React.createElement("div", { className: `avatar-ring ${className}` }, photo && !failed ? /* @__PURE__ */ React.createElement("img", { src: photo, alt: name || "Profile", referrerPolicy: "no-referrer", onError: () => setFailed(true) }) : /* @__PURE__ */ React.createElement("span", null, initials));
  }
  function DonutChart({ rows, total }) {
    const size = 190;
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const colors = ["var(--mx-chart-completed)", "var(--mx-chart-total)", "var(--mx-warning)", "var(--mx-chart-risk)", "var(--mx-brass)", "var(--mx-muted)"];
    return /* @__PURE__ */ React.createElement("div", { className: "donut-wrap" }, /* @__PURE__ */ React.createElement("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": "Status distribution" }, /* @__PURE__ */ React.createElement("circle", { cx: size / 2, cy: size / 2, r: radius, fill: "none", stroke: "var(--mx-surface-strong)", strokeWidth: "22" }), rows.map((row, index) => {
      const dash = total ? row.total / total * circumference : 0;
      const item = /* @__PURE__ */ React.createElement(
        "circle",
        {
          key: row.status,
          cx: size / 2,
          cy: size / 2,
          r: radius,
          fill: "none",
          stroke: colors[index % colors.length],
          strokeWidth: "22",
          strokeLinecap: "round",
          strokeDasharray: `${dash} ${circumference - dash}`,
          strokeDashoffset: -offset,
          transform: `rotate(-90 ${size / 2} ${size / 2})`
        }
      );
      offset += dash;
      return item;
    }), /* @__PURE__ */ React.createElement("text", { x: size / 2, y: size / 2 - 4, textAnchor: "middle", fontSize: "30", fontWeight: "900", fill: "var(--mx-text)" }, fmtNum(total)), /* @__PURE__ */ React.createElement("text", { x: size / 2, y: size / 2 + 22, textAnchor: "middle", fontSize: "11", fontWeight: "900", fill: "var(--mx-muted)" }, "TASKS")), /* @__PURE__ */ React.createElement("div", { className: "donut-legend" }, rows.map((row, index) => /* @__PURE__ */ React.createElement("div", { key: row.status, className: "donut-legend-row" }, /* @__PURE__ */ React.createElement("span", { style: { background: colors[index % colors.length] } }), /* @__PURE__ */ React.createElement("strong", null, row.status), /* @__PURE__ */ React.createElement("em", null, fmtNum(row.total), " / ", fmtPct(row.pct))))));
  }
  function StackedWorkloadChart({ rows }) {
    const maxTotal = Math.max(...rows.map((row) => row.total), 1);
    return /* @__PURE__ */ React.createElement("div", { className: "stacked-chart" }, rows.slice(0, 10).map((row) => {
      const completed = row.total ? row.completed / row.total * 100 : 0;
      const onProcess = row.total ? row.onProcess / row.total * 100 : 0;
      const backlog = Math.max(0, 100 - completed - onProcess);
      return /* @__PURE__ */ React.createElement("div", { key: row.team, className: "stacked-row" }, /* @__PURE__ */ React.createElement("div", { className: "stacked-name" }, /* @__PURE__ */ React.createElement("strong", null, row.team), /* @__PURE__ */ React.createElement("span", null, fmtNum(row.total), " tasks")), /* @__PURE__ */ React.createElement("div", { className: "stacked-track", style: { width: `${Math.max(18, row.total / maxTotal * 100)}%` } }, /* @__PURE__ */ React.createElement("span", { className: "seg done", style: { width: `${completed}%` }, title: `Completed ${fmtNum(row.completed)}` }), /* @__PURE__ */ React.createElement("span", { className: "seg process", style: { width: `${onProcess}%` }, title: `On process ${fmtNum(row.onProcess)}` }), /* @__PURE__ */ React.createElement("span", { className: "seg backlog", style: { width: `${backlog}%` }, title: `Backlog ${fmtNum(row.backlog)}` })), /* @__PURE__ */ React.createElement("div", { className: "stacked-meta" }, fmtPct(row.completion)));
    }), /* @__PURE__ */ React.createElement("div", { className: "chart-legend" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot done" }), "Completed"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot process" }), "On Process"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot backlog" }), "Backlog")));
  }
  function RadarChart({ teamRows }) {
    const top = [...teamRows].sort((a, b) => b.total - a.total).slice(0, 5);
    const axes = ["SLA", "Completion", "Health", "Low Risk", "Capacity"];
    const size = 330;
    const center = size / 2;
    const radius = 118;
    const maxTotal = Math.max(...top.map((row) => row.total), 1);
    const point = (axisIndex, value) => {
      const angle = (-90 + axisIndex * (360 / axes.length)) * Math.PI / 180;
      const r = radius * clampPercent(value) / 100;
      return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
    };
    const values = axes.map((_, axisIndex) => {
      if (!top.length) return 0;
      const avg = top.reduce((sum, row) => {
        if (axisIndex === 0) return sum + clampPercent(row.sla);
        if (axisIndex === 1) return sum + clampPercent(row.completion);
        if (axisIndex === 2) return sum + clampPercent(row.health);
        if (axisIndex === 3) return sum + clampPercent(100 - (row.overdue + row.risk) / Math.max(row.total, 1) * 100);
        return sum + clampPercent(row.total / maxTotal * 100);
      }, 0) / top.length;
      return Math.round(avg);
    });
    const polygon = values.map((value, index) => point(index, value).join(",")).join(" ");
    return /* @__PURE__ */ React.createElement("div", { className: "radar-wrap" }, /* @__PURE__ */ React.createElement("svg", { viewBox: `0 0 ${size} ${size}`, className: "w-full max-w-[360px]", role: "img", "aria-label": "Performance balance radar" }, [25, 50, 75, 100].map((ring) => /* @__PURE__ */ React.createElement("polygon", { key: ring, points: axes.map((_, index) => point(index, ring).join(",")).join(" "), fill: "none", stroke: "var(--mx-line-strong)", opacity: ".72" })), axes.map((axis, index) => {
      const [x2, y2] = point(index, 100);
      const [lx, ly] = point(index, 116);
      return /* @__PURE__ */ React.createElement("g", { key: axis }, /* @__PURE__ */ React.createElement("line", { x1: center, y1: center, x2, y2, stroke: "var(--mx-line-strong)", opacity: ".72" }), /* @__PURE__ */ React.createElement("text", { className: "chart-label", x: lx, y: ly, textAnchor: "middle" }, axis));
    }), /* @__PURE__ */ React.createElement("polygon", { points: polygon, fill: "var(--mx-info)", fillOpacity: ".18", stroke: "var(--mx-info)", strokeWidth: "3" }), values.map((value, index) => {
      const [cx, cy] = point(index, value);
      return /* @__PURE__ */ React.createElement("circle", { key: index, cx, cy, r: "4", fill: "var(--mx-info)" });
    })), /* @__PURE__ */ React.createElement("div", { className: "radar-score" }, /* @__PURE__ */ React.createElement("strong", null, fmtPct(Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)))), /* @__PURE__ */ React.createElement("span", null, "Balance Index")));
  }
  function OverviewPanel({ portfolio, teamRows, kpiRows, statusRows, criticalQueue, monthlyTrend, periodLabel, user, empId, tasks }) {
    const highestRisk = [...teamRows].sort((a, b) => b.overdue * 3 + b.risk + b.backlog / Math.max(b.total, 1) - (a.overdue * 3 + a.risk + a.backlog / Math.max(a.total, 1)))[0];
    const strongestTeam = [...teamRows].sort((a, b) => (b.sla || 0) - (a.sla || 0))[0];
    const insights = [
      portfolio.overdue.length ? `${portfolio.overdue.length} overdue task(s) require executive attention.` : "No overdue active tasks in the current scope.",
      portfolio.atRisk.length ? `${portfolio.atRisk.length} task(s) are due within 3 business days and may affect SLA confidence.` : "Short-term delivery risk is currently contained.",
      highestRisk ? `${highestRisk.team} carries the most visible operational pressure.` : "No team pressure data is available yet.",
      strongestTeam ? `${strongestTeam.team} is the current SLA benchmark at ${fmtPct(strongestTeam.sla)}.` : "No SLA benchmark is available yet."
    ];
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-6" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Executive Intelligence"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, periodLabel, " / ", (user == null ? void 0 : user.name) || empId || "No employee selected")), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(portfolio.weightedScore)}` }, "Weighted Score ", fmtPct(portfolio.weightedScore))), /* @__PURE__ */ React.createElement("div", { className: "grid xl:grid-cols-[1.15fr_0.85fr] gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, insights.map((insight, index) => /* @__PURE__ */ React.createElement("div", { key: insight, className: "insight-card p-5 flex items-start gap-4" }, /* @__PURE__ */ React.createElement("span", { className: "rank-chip" }, index + 1), /* @__PURE__ */ React.createElement("div", { className: "font-bold leading-6" }, insight)))), /* @__PURE__ */ React.createElement("div", { className: "mx-soft p-5 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Decision Lens"), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3 text-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Total portfolio"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(tasks.length))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Active workload"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(portfolio.active.length))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "SLA breach rate"), /* @__PURE__ */ React.createElement("strong", null, tasks.length ? fmtPct(Math.round(portfolio.slaFail.length / Math.max(1, portfolio.completed.length) * 1e3) / 10) : "-")), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Teams monitored"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(teamRows.length))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Presentation URL"), /* @__PURE__ */ React.createElement("strong", null, "/dashboard?empId=", empId || "EMPID")))))), /* @__PURE__ */ React.createElement("div", { className: "presentation-grid" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Execution Trend"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, "\u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E07\u0E32\u0E19\u0E23\u0E32\u0E22\u0E40\u0E14\u0E37\u0E2D\u0E19 \u0E41\u0E22\u0E01\u0E07\u0E32\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 \u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27 \u0E41\u0E25\u0E30\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07/\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, "\u0E07\u0E32\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-good" }, "\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-bad" }, "\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07/\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14"))), /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, /* @__PURE__ */ React.createElement(LineChart, { months: monthlyTrend.months, series: monthlyTrend.series, mode: "volume" }))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Portfolio Composition"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "Status distribution and executive workload proportions."), /* @__PURE__ */ React.createElement(DonutChart, { rows: statusRows, total: tasks.length }))), /* @__PURE__ */ React.createElement("div", { className: "grid 2xl:grid-cols-[0.9fr_1.1fr] gap-5" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Performance Balance"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "A blended radar of SLA, completion, health, risk control, and capacity."), /* @__PURE__ */ React.createElement(RadarChart, { teamRows })), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Team Workload Mix"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "Completed, on-process, and backlog by team."), /* @__PURE__ */ React.createElement(StackedWorkloadChart, { rows: teamRows }))), /* @__PURE__ */ React.createElement("div", { className: "grid 2xl:grid-cols-[1.15fr_0.85fr] gap-5 items-start" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Unified SLA + KPI Control Board"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "Team-level control view for SLA, completion, backlog, and risk."), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, teamRows.slice(0, 8).map((row) => /* @__PURE__ */ React.createElement("div", { key: row.team, className: "control-row" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-black truncate" }, row.team), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-xs text-[var(--mx-muted)]" }, "Top KPI: ", row.topKpi)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs font-black mb-2" }, /* @__PURE__ */ React.createElement("span", null, "SLA"), /* @__PURE__ */ React.createElement("span", null, fmtPct(row.sla))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.sla, color: "var(--mx-info)" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs font-black mb-2" }, /* @__PURE__ */ React.createElement("span", null, "Completion"), /* @__PURE__ */ React.createElement("span", null, fmtPct(row.completion))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.completion, color: "var(--mx-success)" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 justify-end" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${row.overdue ? "status-bad" : row.risk ? "status-warn" : "status-good"}` }, row.overdue, " late / ", row.risk, " risk"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, fmtNum(row.backlog), " backlog")))))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Priority Watchlist"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "Active work with the highest near-term SLA exposure."), /* @__PURE__ */ React.createElement("div", { className: "priority-watchlist-scroll grid gap-3" }, criticalQueue.map(({ task, days, weight }) => {
      const [label, klass] = riskBadge(days);
      return /* @__PURE__ */ React.createElement("div", { key: task.id || `${task.job}-${task.deadline}`, className: "insight-card p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold truncate" }, extractJobCode(task.job)), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)] line-clamp-2" }, task.job || "-")), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${klass}` }, label)), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, teamName(task)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, "weight ", weight), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "deadline ", fmtDate(task.deadline))));
    }), !criticalQueue.length && /* @__PURE__ */ React.createElement("div", { className: "mx-soft p-5 text-center text-[var(--mx-muted)]" }, "No critical active work in this scope.")))));
  }
  function TeamDetailModal({ team, holidays = [], onClose }) {
    if (!team) return null;
    const members = team.members || [];
    const kpiBreakdown = Object.entries(groupBy(team.items || [], mainKpi)).map(([name, items]) => ({
      name,
      total: items.length,
      active: items.filter(isActive).length,
      completed: items.filter(isCompleted).length,
      fail: items.filter(isCompletedLate).length,
      scores: calcWeightedScores(items)
    })).sort((a, b) => b.total - a.total || b.fail - a.fail).slice(0, 12);
    const peopleBreakdown = Object.entries(groupBy(team.items || [], personName)).map(([name, items]) => {
      const portfolio = buildPortfolio(items, holidays);
      const member = members.find((item) => item.name === name);
      return {
        name,
        profile: (member == null ? void 0 : member.profile) || items.find((task) => getPhotoUrl(task)) || null,
        total: items.length,
        active: portfolio.active.length,
        completed: portfolio.completed.length,
        overdue: portfolio.overdue.length,
        slaFail: portfolio.slaFail.length,
        score: portfolio.weightedScore
      };
    }).sort((a, b) => (b.score || 0) - (a.score || 0) || b.total - a.total).slice(0, 10);
    const urgent = (team.items || []).filter(isActive).map((task) => ({ task, days: daysUntil(task, holidays), weight: taskWeight(task) })).filter((item) => item.days !== null).sort((a, b) => a.days - b.days || b.weight - a.weight).slice(0, 10);
    return /* @__PURE__ */ React.createElement("div", { className: "modal-backdrop", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal-card team-modal-card", onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement("button", { className: "modal-close no-print", onClick: onClose, "aria-label": "Close" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-xmark" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Team Drilldown"), /* @__PURE__ */ React.createElement("h2", { className: "section-title mt-2 mb-1" }, team.team), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(team.health)}` }, "Health ", team.health), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "Top KPI: ", team.topKpi)), /* @__PURE__ */ React.createElement("div", { className: "team-member-strip mt-5", "aria-label": `${team.team} members` }, /* @__PURE__ */ React.createElement("div", { className: "team-member-avatars" }, members.slice(0, 9).map((member) => /* @__PURE__ */ React.createElement(Avatar, { key: member.key || member.name, item: member.profile || member, name: member.name, className: "team-member-avatar" })), members.length > 9 && /* @__PURE__ */ React.createElement("span", { className: "team-member-more" }, "+", members.length - 9)), /* @__PURE__ */ React.createElement("div", { className: "team-member-copy" }, /* @__PURE__ */ React.createElement("strong", null, fmtNum(members.length), " team member", members.length === 1 ? "" : "s"), /* @__PURE__ */ React.createElement("span", null, members.slice(0, 4).map((member) => member.name).join(", ") || "No member profile found")))), /* @__PURE__ */ React.createElement("div", { className: "mini-metric-grid modal-metrics" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Total"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(team.total))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Backlog"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(team.backlog))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "W.SLA"), /* @__PURE__ */ React.createElement("strong", null, fmtPct(team.sla))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "SLA Fail"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(team.slaFail))))), /* @__PURE__ */ React.createElement("div", { className: "mt-6 team-modal-grid" }, /* @__PURE__ */ React.createElement("section", { className: "mx-soft p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "m-0 text-lg font-black" }, "KPI Mix \u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21"), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3 team-modal-scroll" }, kpiBreakdown.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.name }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3 mb-2 text-sm" }, /* @__PURE__ */ React.createElement("strong", { className: "truncate" }, row.name), /* @__PURE__ */ React.createElement("span", null, fmtNum(row.total), " \u0E07\u0E32\u0E19 / SLA ", fmtPct(row.scores.sla))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: team.total ? Math.round(row.total / team.total * 1e3) / 10 : 0, color: row.fail ? "var(--mx-warning)" : "var(--mx-info)" }), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "Active ", fmtNum(row.active)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-good" }, "Done ", fmtNum(row.completed)), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${row.fail ? "status-bad" : "status-good"}` }, "Fail ", fmtNum(row.fail))))), !kpiBreakdown.length && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 KPI \u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21\u0E19\u0E35\u0E49"))), /* @__PURE__ */ React.createElement("section", { className: "mx-soft p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "m-0 text-lg font-black" }, "People Performance"), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3 team-modal-scroll" }, peopleBreakdown.map((person, index) => /* @__PURE__ */ React.createElement("div", { key: person.name, className: "team-person-row" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 min-w-0" }, /* @__PURE__ */ React.createElement(Avatar, { item: person.profile || person, name: person.name, className: "team-person-avatar" }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-black truncate" }, String(index + 1).padStart(2, "0"), " ", person.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-xs text-[var(--mx-muted)]" }, fmtNum(person.active), " active / ", fmtNum(person.overdue), " overdue"))), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(person.score)}` }, fmtPct(person.score)))), !peopleBreakdown.length && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E32\u0E22\u0E1A\u0E38\u0E04\u0E04\u0E25\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21\u0E19\u0E35\u0E49")))), /* @__PURE__ */ React.createElement("section", { className: "mt-5 mx-soft p-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-end md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "m-0 text-lg font-black" }, "Urgent Team Queue"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, "\u0E07\u0E32\u0E19 active \u0E17\u0E35\u0E48\u0E43\u0E01\u0E25\u0E49\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E2B\u0E23\u0E37\u0E2D\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07 SLA \u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21\u0E19\u0E35\u0E49")), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, fmtNum(urgent.length), " items")), /* @__PURE__ */ React.createElement("div", { className: "mt-4 team-urgent-grid" }, urgent.map(({ task, days, weight }) => {
      const [label, klass] = riskBadge(days);
      return /* @__PURE__ */ React.createElement("div", { key: task.id || `${task.job}-${task.deadline}`, className: "insight-card p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("strong", { className: "truncate" }, extractJobCode(task.job)), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${klass}` }, label)), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)] line-clamp-2" }, task.job || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, personName(task)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, fmtDate(task.deadline)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, "weight ", weight)));
    }), !urgent.length && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E07\u0E32\u0E19\u0E40\u0E23\u0E48\u0E07\u0E14\u0E48\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21\u0E19\u0E35\u0E49")))));
  }
  function TeamsPanel({ teamRows, holidays = [] }) {
    const [selectedTeam, setSelectedTeam] = useState(null);
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "detail-grid" }, teamRows.slice(0, 8).map((row) => /* @__PURE__ */ React.createElement("button", { key: row.team, className: "mx-card leader-card team-card-button p-5 text-left", onClick: () => setSelectedTeam(row) }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Team"), /* @__PURE__ */ React.createElement("h3", { className: "mt-2 mb-0 text-xl font-black truncate" }, row.team)), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.health)}` }, row.health)), /* @__PURE__ */ React.createElement("div", { className: "mini-metric-grid mt-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Total"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.total))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Done"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.completed))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Backlog"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.backlog))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "SLA Fail"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.slaFail)))), /* @__PURE__ */ React.createElement("div", { className: "mt-5 grid gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs font-black mb-2" }, /* @__PURE__ */ React.createElement("span", null, "W.SLA"), /* @__PURE__ */ React.createElement("span", null, fmtPct(row.sla))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.sla, color: "var(--mx-info)" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs font-black mb-2" }, /* @__PURE__ */ React.createElement("span", null, "W.Completion"), /* @__PURE__ */ React.createElement("span", null, fmtPct(row.completion))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.completion, color: "var(--mx-success)" }))), /* @__PURE__ */ React.createElement("div", { className: "team-card-cta mt-5" }, /* @__PURE__ */ React.createElement("span", null, "\u0E40\u0E1B\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E0A\u0E34\u0E07\u0E25\u0E36\u0E01"), /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-arrow-up-right-from-square" }))))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Completion Rate by Team"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "Operational workload stack with completion proportion and remaining backlog."), /* @__PURE__ */ React.createElement(StackedWorkloadChart, { rows: teamRows })), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Team SLA Summary"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "Detailed team matrix aligned with the SPDS executive dashboard structure."), /* @__PURE__ */ React.createElement(DataTable, { minWidth: 980 }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Team"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Total"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Completed"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Backlog"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "On Process"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "SLA Pass"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "SLA Fail"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "W.SLA"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "W.Completion"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, teamRows.map((row) => /* @__PURE__ */ React.createElement("tr", { key: row.team }, /* @__PURE__ */ React.createElement("td", { className: "p-4 font-black" }, row.team), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.total)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.completed)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.backlog)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.onProcess)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.slaPass)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.slaFail)), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-bold" }, fmtPct(row.sla)), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-bold" }, fmtPct(row.completion))))))), /* @__PURE__ */ React.createElement(TeamDetailModal, { team: selectedTeam, holidays, onClose: () => setSelectedTeam(null) }));
  }
  function EmployeeDetailModal({ person, holidays = [], onClose }) {
    if (!person) return null;
    const kpiBreakdown = Object.entries(groupBy(person.items, mainKpi)).map(([name, items]) => ({ name, total: items.length, scores: calcWeightedScores(items), completed: items.filter(isCompleted).length, fail: items.filter(isCompletedLate).length })).sort((a, b) => b.total - a.total);
    const urgent = person.items.filter(isActive).map((task) => ({ task, days: daysUntil(task, holidays), weight: taskWeight(task) })).filter((item) => item.days !== null).sort((a, b) => a.days - b.days || b.weight - a.weight).slice(0, 8);
    return /* @__PURE__ */ React.createElement("div", { className: "modal-backdrop", onClick: onClose }, /* @__PURE__ */ React.createElement("div", { className: "modal-card", onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement("button", { className: "modal-close no-print", onClick: onClose, "aria-label": "Close" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-xmark" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-4" }, /* @__PURE__ */ React.createElement(Avatar, { item: person.profile || person, name: person.person, className: "modal-avatar" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Employee Drilldown"), /* @__PURE__ */ React.createElement("h2", { className: "section-title mt-2 mb-1" }, person.person), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, person.team), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(person.weightedScore)}` }, "Score ", fmtPct(person.weightedScore))))), /* @__PURE__ */ React.createElement("div", { className: "mini-metric-grid modal-metrics" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Total"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(person.total))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Completed"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(person.completed))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "W.SLA"), /* @__PURE__ */ React.createElement("strong", null, fmtPct(person.sla))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "SLA Fail"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(person.slaFail))))), /* @__PURE__ */ React.createElement("div", { className: "mt-6 grid xl:grid-cols-[1fr_1fr] gap-5" }, /* @__PURE__ */ React.createElement("section", { className: "mx-soft p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "m-0 text-lg font-black" }, "KPI Ownership Mix"), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3" }, kpiBreakdown.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.name }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3 mb-2 text-sm" }, /* @__PURE__ */ React.createElement("strong", { className: "truncate" }, row.name), /* @__PURE__ */ React.createElement("span", null, fmtNum(row.total), " / SLA ", fmtPct(row.scores.sla))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: person.total ? Math.round(row.total / person.total * 1e3) / 10 : 0, color: row.fail ? "var(--mx-warning)" : "var(--mx-info)" }))))), /* @__PURE__ */ React.createElement("section", { className: "mx-soft p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "m-0 text-lg font-black" }, "Urgent Work Queue"), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3 max-h-[420px] overflow-auto pr-1" }, urgent.map(({ task, days, weight }) => {
      const [label, klass] = riskBadge(days);
      return /* @__PURE__ */ React.createElement("div", { key: task.id || `${task.job}-${task.deadline}`, className: "insight-card p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("strong", { className: "truncate" }, extractJobCode(task.job)), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${klass}` }, label)), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)] line-clamp-2" }, task.job || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, fmtDate(task.deadline)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, "weight ", weight)));
    }), !urgent.length && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "No urgent active work for this person."))))));
  }
  function EmployeesPanel({ personRows, teams, personTeamFilter, setPersonTeamFilter, tasks, selectedPerson, setSelectedPerson, holidays = [] }) {
    const filtered = personTeamFilter === "all" ? personRows : personRows.filter((row) => row.team === personTeamFilter);
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-6" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Employee Performance Deep Dive"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, "Filter by team, inspect workload, SLA, backlog, and top KPI ownership.")), /* @__PURE__ */ React.createElement("div", { className: "filter-pills no-print" }, /* @__PURE__ */ React.createElement("button", { className: `pill ${personTeamFilter === "all" ? "active" : ""}`, onClick: () => setPersonTeamFilter("all") }, "All Teams"), teams.map((team) => /* @__PURE__ */ React.createElement("button", { key: team, className: `pill ${personTeamFilter === team ? "active" : ""}`, onClick: () => setPersonTeamFilter(team) }, team))))), /* @__PURE__ */ React.createElement("div", { className: "employee-grid" }, filtered.slice(0, 36).map((row, index) => /* @__PURE__ */ React.createElement("button", { key: row.name, className: "mx-card employee-card p-5 text-left", onClick: () => setSelectedPerson(row) }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-4" }, /* @__PURE__ */ React.createElement(Avatar, { item: row.profile || row, name: row.person }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-black truncate" }, row.person), /* @__PURE__ */ React.createElement("div", { className: "mt-1 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, row.team), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.sla)}` }, "Rank ", index + 1)))), /* @__PURE__ */ React.createElement("div", { className: "mini-metric-grid mt-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Total"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.total))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "Done"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.completed))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "On Process"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.onProcess))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "SLA Fail"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(row.slaFail)))), /* @__PURE__ */ React.createElement("div", { className: "mt-5 grid gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs font-black mb-2" }, /* @__PURE__ */ React.createElement("span", null, "W.SLA"), /* @__PURE__ */ React.createElement("span", null, fmtPct(row.sla))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.sla, color: "var(--mx-info)" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs font-black mb-2" }, /* @__PURE__ */ React.createElement("span", null, "W.Completion"), /* @__PURE__ */ React.createElement("span", null, fmtPct(row.completion))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.completion, color: "var(--mx-success)" }))), /* @__PURE__ */ React.createElement("div", { className: "mt-5 mx-soft p-3 text-xs" }, /* @__PURE__ */ React.createElement("div", { className: "font-black" }, "Top KPI"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[var(--mx-muted)]" }, row.topKpi, " / ", fmtNum(row.topKpiCount), " task(s)"))))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Employee Leaderboard Matrix"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, fmtNum(filtered.length), " people from ", fmtNum(tasks.length), " task records."), /* @__PURE__ */ React.createElement(DataTable, { minWidth: 1040 }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Rank"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Name"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Team"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Total"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Completed"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "SLA Pass"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "SLA Fail"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "W.SLA"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "W.Completion"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Performance"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, filtered.map((row, index) => /* @__PURE__ */ React.createElement("tr", { key: row.name }, /* @__PURE__ */ React.createElement("td", { className: "p-4 font-black text-[var(--mx-brass)]" }, String(index + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-black" }, row.person), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, row.team)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.total)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.completed)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.slaPass)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.slaFail)), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-bold" }, fmtPct(row.sla)), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-bold" }, fmtPct(row.completion)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.weightedScore)}` }, row.weightedScore >= 90 ? "Excellent" : row.weightedScore >= 75 ? "Good" : row.weightedScore >= 60 ? "Monitor" : "Critical"))))))), /* @__PURE__ */ React.createElement(EmployeeDetailModal, { person: selectedPerson, holidays, onClose: () => setSelectedPerson(null) }));
  }
  function KpiAnalysisPanel({ kpiRows, personRows, teamRows }) {
    const totalTasks = kpiRows.reduce((sum, row) => sum + row.total, 0);
    const topPerformer = [...personRows].filter((row) => row.weightedScore !== null).sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total)[0];
    const bestTeam = [...teamRows].filter((row) => row.sla !== null).sort((a, b) => (b.sla || 0) - (a.sla || 0) || b.total - a.total)[0];
    const avgTasks = personRows.length ? Math.round(personRows.reduce((sum, row) => sum + row.total, 0) / personRows.length) : 0;
    const highRiskKpis = [...kpiRows].sort((a, b) => b.slaFail - a.slaFail || b.active - a.active || b.total - a.total).slice(0, 8);
    const employeeLeaders = [...personRows].filter((row) => row.sla !== null || row.completion !== null).sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total).slice(0, 12);
    const teamKpiRows = teamRows.slice(0, 10).map((team) => {
      const groups = Object.entries(groupBy(team.items || [], mainKpi)).map(([name, items]) => ({
        name,
        total: items.length,
        fail: items.filter(isCompletedLate).length,
        scores: calcWeightedScores(items)
      })).sort((a, b) => b.total - a.total || b.fail - a.fail).slice(0, 3);
      return { ...team, groups };
    });
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-6" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7 kpi-intelligence" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "eyebrow mb-2" }, "KPI Intelligence"), /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "\u0E20\u0E32\u0E1E\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C KPI \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23"), /* @__PURE__ */ React.createElement("p", { className: "mt-2 mb-0 text-sm text-[var(--mx-muted)]" }, "\u0E23\u0E27\u0E21\u0E2A\u0E31\u0E14\u0E2A\u0E48\u0E27\u0E19\u0E07\u0E32\u0E19 \u0E08\u0E38\u0E14\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07 \u0E1C\u0E25\u0E07\u0E32\u0E19\u0E23\u0E32\u0E22\u0E1A\u0E38\u0E04\u0E04\u0E25 \u0E41\u0E25\u0E30\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E21\u0E02\u0E49\u0E19\u0E02\u0E2D\u0E07 KPI \u0E23\u0E32\u0E22\u0E17\u0E35\u0E21\u0E43\u0E19\u0E21\u0E38\u0E21\u0E40\u0E14\u0E35\u0E22\u0E27")), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, "Portfolio ", fmtNum(totalTasks), " tasks")), /* @__PURE__ */ React.createElement("div", { className: "kpi-insight-grid" }, /* @__PURE__ */ React.createElement("div", { className: "kpi-insight-card" }, /* @__PURE__ */ React.createElement("span", null, "\u0E2B\u0E21\u0E27\u0E14 KPI"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(kpiRows.length)), /* @__PURE__ */ React.createElement("em", null, "Main categories")), /* @__PURE__ */ React.createElement("div", { className: "kpi-insight-card" }, /* @__PURE__ */ React.createElement("span", null, "\u0E1C\u0E39\u0E49\u0E17\u0E33\u0E04\u0E30\u0E41\u0E19\u0E19\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14"), /* @__PURE__ */ React.createElement("strong", null, (topPerformer == null ? void 0 : topPerformer.person) || "-"), /* @__PURE__ */ React.createElement("em", null, topPerformer ? `Performance ${fmtPct(topPerformer.weightedScore)}` : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19")), /* @__PURE__ */ React.createElement("div", { className: "kpi-insight-card" }, /* @__PURE__ */ React.createElement("span", null, "\u0E17\u0E35\u0E21 SLA \u0E14\u0E35\u0E2A\u0E38\u0E14"), /* @__PURE__ */ React.createElement("strong", null, (bestTeam == null ? void 0 : bestTeam.team) || "-"), /* @__PURE__ */ React.createElement("em", null, bestTeam ? `W.SLA ${fmtPct(bestTeam.sla)}` : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E30\u0E41\u0E19\u0E19\u0E17\u0E35\u0E21")), /* @__PURE__ */ React.createElement("div", { className: "kpi-insight-card" }, /* @__PURE__ */ React.createElement("span", null, "\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22\u0E07\u0E32\u0E19/\u0E04\u0E19"), /* @__PURE__ */ React.createElement("strong", null, fmtNum(avgTasks)), /* @__PURE__ */ React.createElement("em", null, fmtNum(personRows.length), " \u0E04\u0E19\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01")))), /* @__PURE__ */ React.createElement("div", { className: "kpi-analysis-grid" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "\u0E2A\u0E31\u0E14\u0E2A\u0E48\u0E27\u0E19 KPI Portfolio"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "\u0E40\u0E23\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21\u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E07\u0E32\u0E19 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E21\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E2B\u0E21\u0E27\u0E14 KPI"), /* @__PURE__ */ React.createElement("div", { className: "kpi-portfolio-list" }, kpiRows.slice(0, 10).map((row, index) => /* @__PURE__ */ React.createElement("div", { key: row.name, className: "kpi-row-card" }, /* @__PURE__ */ React.createElement("div", { className: "kpi-row-rank" }, String(index + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-black break-words leading-tight" }, row.name), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.sla)}` }, fmtPct(row.sla))), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.share, color: row.sla >= 95 ? "var(--mx-success)" : row.sla >= 85 ? "var(--mx-warning)" : "var(--mx-danger)" })), /* @__PURE__ */ React.createElement("div", { className: "kpi-row-stats" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, fmtPct(row.share)), /* @__PURE__ */ React.createElement("em", null, "Share")), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, fmtNum(row.total)), /* @__PURE__ */ React.createElement("em", null, "Total")), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, fmtPct(row.completion)), /* @__PURE__ */ React.createElement("em", null, "Done")), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, fmtNum(row.slaFail)), /* @__PURE__ */ React.createElement("em", null, "Fail"))))))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "KPI Watchlist"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "\u0E2B\u0E21\u0E27\u0E14 KPI \u0E17\u0E35\u0E48\u0E21\u0E35\u0E07\u0E32\u0E19\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E31\u0E07 active \u0E2A\u0E39\u0E07 \u0E04\u0E27\u0E23\u0E16\u0E39\u0E01\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E01\u0E48\u0E2D\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, highRiskKpis.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.name, className: "watch-row" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-black line-clamp-2" }, row.name), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "Active ", fmtNum(row.active)), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${row.slaFail > 0 ? "status-bad" : "status-good"}` }, "Fail ", fmtNum(row.slaFail)))), /* @__PURE__ */ React.createElement("div", { className: "watch-score" }, /* @__PURE__ */ React.createElement("strong", null, fmtPct(row.sla)), /* @__PURE__ */ React.createElement("span", null, "SLA")))), !highRiskKpis.length && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 KPI \u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01")))), /* @__PURE__ */ React.createElement("div", { className: "grid 2xl:grid-cols-[1fr_1fr] gap-5" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Employee SLA Leaderboard"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A\u0E1A\u0E38\u0E04\u0E04\u0E25\u0E08\u0E32\u0E01\u0E04\u0E30\u0E41\u0E19\u0E19\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E2A\u0E16\u0E32\u0E19\u0E30 SLA"), /* @__PURE__ */ React.createElement(DataTable, { minWidth: 760 }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Rank"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Name"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Team"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Tasks"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "W.SLA"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Performance"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, employeeLeaders.map((row, index) => /* @__PURE__ */ React.createElement("tr", { key: row.name }, /* @__PURE__ */ React.createElement("td", { className: "p-4 font-black text-[var(--mx-brass)]" }, String(index + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-black max-w-[220px]" }, row.person), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, row.team)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.total)), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-bold" }, fmtPct(row.sla)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.weightedScore)}` }, fmtPct(row.weightedScore))))), !employeeLeaders.length && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { className: "p-8 text-center text-[var(--mx-muted)]", colSpan: "6" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1A\u0E38\u0E04\u0E04\u0E25\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01"))))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Team x KPI Concentration"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "KPI \u0E2B\u0E25\u0E31\u0E01\u0E17\u0E35\u0E48\u0E01\u0E34\u0E19\u0E2A\u0E31\u0E14\u0E2A\u0E48\u0E27\u0E19\u0E07\u0E32\u0E19\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E17\u0E35\u0E21 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E21\u0E2D\u0E07\u0E42\u0E2B\u0E25\u0E14\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07"), /* @__PURE__ */ React.createElement(DataTable, { minWidth: 900 }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Team"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Total"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "W.SLA"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Top KPI Mix"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, teamKpiRows.map((row) => /* @__PURE__ */ React.createElement("tr", { key: row.team }, /* @__PURE__ */ React.createElement("td", { className: "p-4 font-black" }, row.team), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.total)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.sla)}` }, fmtPct(row.sla))), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-2" }, row.groups.map((group) => /* @__PURE__ */ React.createElement("div", { key: `${row.team}-${group.name}`, className: "team-kpi-chip" }, /* @__PURE__ */ React.createElement("span", { className: "line-clamp-2" }, group.name), /* @__PURE__ */ React.createElement("strong", null, fmtNum(group.total), " \u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("em", null, fmtPct(group.scores.sla)))), !row.groups.length && /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 KPI"))))))))));
  }
  function KpiWeightsPanel({ kpiWeightRows, kpiSearch, setKpiSearch }) {
    const search = kpiSearch.trim().toLowerCase();
    const filtered = search ? kpiWeightRows.filter((row) => [row.team, row.main, row.sub].join(" ").toLowerCase().includes(search)) : kpiWeightRows;
    return /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "KPI Configurations & Weights"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, "Searchable KPI weight detail by team, main KPI, and sub KPI.")), /* @__PURE__ */ React.createElement("input", { className: "mx-input max-w-[420px]", value: kpiSearch, onChange: (e) => setKpiSearch(e.target.value), placeholder: "Search team, main KPI, or sub KPI" })), /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, /* @__PURE__ */ React.createElement(DataTable, { minWidth: 1120 }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Team"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Main KPI"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Sub KPI"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Weight"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Total"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Completed"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "Pending"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "SLA Pass"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "SLA Fail"), /* @__PURE__ */ React.createElement("th", { className: "p-4" }, "SLA %"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, filtered.map((row) => /* @__PURE__ */ React.createElement("tr", { key: `${row.team}-${row.main}-${row.sub}` }, /* @__PURE__ */ React.createElement("td", { className: "p-4" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, row.team)), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-black max-w-[280px]" }, row.main), /* @__PURE__ */ React.createElement("td", { className: "p-4 max-w-[360px]" }, row.sub), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-bold" }, row.weight), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.total)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.completed)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.pending)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.slaPass)), /* @__PURE__ */ React.createElement("td", { className: "p-4" }, fmtNum(row.slaFail)), /* @__PURE__ */ React.createElement("td", { className: "p-4 font-bold" }, fmtPct(row.sla)))), !filtered.length && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { className: "p-8 text-center text-[var(--mx-muted)]", colSpan: "10" }, "No KPI weight records match this search."))))));
  }
  function App() {
    const params = new URLSearchParams(window.location.search);
    const initialEmpId = String(params.get("empId") || "").trim().toUpperCase();
    const [empId, setEmpId] = useState(initialEmpId);
    const [month, setMonth] = useState(params.has("month") ? Number(params.get("month")) : 0);
    const [year, setYear] = useState(Number(params.get("year") || (/* @__PURE__ */ new Date()).getFullYear()));
    const [activeTab, setActiveTab] = useState("overview");
    const [personTeamFilter, setPersonTeamFilter] = useState("all");
    const [kpiSearch, setKpiSearch] = useState("");
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [theme, setTheme] = useState(getInitialExecutiveTheme);
    const [state, setState] = useState({ loading: false, error: "", user: null, tasks: [], staff: [], holidays: [] });
    const years = useMemo(() => {
      const now = (/* @__PURE__ */ new Date()).getFullYear();
      return Array.from({ length: 6 }, (_, i) => now - 3 + i);
    }, []);
    const load = async (nextEmpId = empId) => {
      const cleanEmpId = String(nextEmpId || "").trim().toUpperCase();
      if (!cleanEmpId) {
        setState((prev) => ({ ...prev, error: "Please provide empId in the URL or the input field." }));
        return;
      }
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const initial = await API.getInitialData(cleanEmpId);
        if (initial == null ? void 0 : initial.error) throw new Error(initial.error);
        if (!(initial == null ? void 0 : initial.user)) throw new Error("User profile was not found.");
        const user = { ...initial.user, kpis: initial.kpis || [] };
        const monthParam = month === 0 ? null : month;
        let tasks2 = [];
        let taskHolidays = [];
        if (isSelfScopedRole(user.role)) {
          const res = await API.getEmployeeTasks(user, monthParam, year, month === 0, user.empId);
          tasks2 = res.tasks || res || [];
          taskHolidays = res.holidays || [];
        } else {
          const team = isTeamScopedRole(user.role) ? user.team : "all";
          const res = await API.getAllTasks(monthParam, year, team, user.empId);
          tasks2 = res.tasks || [];
          taskHolidays = res.holidays || [];
        }
        let staff = [];
        try {
          if (isSelfScopedRole(user.role)) {
            staff = [user];
          } else if (isTeamScopedRole(user.role)) {
            const staffRes = await API.getAllStaffInTeam(user.team, user.empId);
            staff = staffRes.staff || [];
          } else if (isStrategicViewRole(user.role) || user.role === "Manager" || user.role === "Admin") {
            const staffRes = await API.getAllStaff(user.empId);
            staff = staffRes.staff || [];
          } else {
            staff = [];
          }
        } catch (staffError) {
          console.warn("Executive View staff image load failed:", staffError);
          staff = [];
        }
        let holidays = taskHolidays;
        try {
          const holidayRes = await API.getHolidays({ "x-admin-empid": user.empId || "" });
          holidays = holidayRes.holidays || holidays;
        } catch {
        }
        setState({ loading: false, error: "", user, tasks: tasks2, staff, holidays });
        const url = new URL(window.location.href);
        url.searchParams.set("empId", cleanEmpId);
        url.searchParams.set("month", String(month));
        url.searchParams.set("year", String(year));
        window.history.replaceState(null, "", url);
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message || "Unable to load dashboard data." }));
      }
    };
    useEffect(() => {
      if (initialEmpId) load(initialEmpId);
    }, [month, year]);
    useEffect(() => {
      applyExecutiveTheme(theme);
    }, [theme]);
    const tasks = state.tasks || [];
    const staffDirectory = state.staff || [];
    const holidaySet = useMemo(() => buildHolidaySet(state.holidays || []), [state.holidays]);
    const portfolio = useMemo(() => buildPortfolio(tasks, holidaySet), [tasks, holidaySet]);
    const periodLabel = `${month === 0 ? "\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19" : MONTH_NAMES[month - 1]} ${year}`;
    const staffByName = useMemo(() => {
      const map = {};
      staffDirectory.forEach((person) => {
        const name = String(person.name || person.fullname || "").trim().toLowerCase();
        const emp = String(person.empId || person.empid || person.emp_id || "").trim().toLowerCase();
        if (name) map[name] = person;
        if (emp) map[emp] = person;
      });
      if (state.user) {
        const name = String(state.user.name || "").trim().toLowerCase();
        const emp = String(state.user.empId || state.user.empid || "").trim().toLowerCase();
        if (name && !map[name]) map[name] = state.user;
        if (emp && !map[emp]) map[emp] = state.user;
      }
      return map;
    }, [staffDirectory, state.user]);
    const teamRows = useMemo(() => buildGroupRows(tasks, teamName, holidaySet).map((row) => {
      const memberMap = {};
      (row.items || []).forEach((task) => {
        const name = personName(task);
        const key = String(name || "").trim().toLowerCase();
        if (!key || memberMap[key]) return;
        const profile = staffByName[key] || staffByName[String(task.empId || task.empid || task.assignedToEmpId || "").trim().toLowerCase()] || (getPhotoUrl(task) ? task : null);
        memberMap[key] = { key, name, profile };
      });
      const members = Object.values(memberMap).sort((a, b) => a.name.localeCompare(b.name));
      return { ...row, team: row.name, members };
    }).sort((a, b) => b.overdue * 3 + b.risk + b.backlog / Math.max(b.total, 1) - (a.overdue * 3 + a.risk + a.backlog / Math.max(a.total, 1)) || b.total - a.total), [tasks, staffByName, holidaySet]);
    const personRows = useMemo(() => buildGroupRows(tasks, (task) => `${personName(task)}|${teamName(task)}`, holidaySet).map((row) => {
      const [person, team] = row.name.split("|");
      const profile = staffByName[String(person || "").trim().toLowerCase()] || row.items.map((task) => task).find((task) => getPhotoUrl(task)) || null;
      return { ...row, person, team, profile };
    }).sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total), [tasks, staffByName, holidaySet]);
    const statusRows = useMemo(() => Object.entries(groupBy(tasks, (task) => task.status || "Unknown")).map(([status, items]) => ({ status, total: items.length, pct: tasks.length ? Math.round(items.length / tasks.length * 1e3) / 10 : 0 })).sort((a, b) => b.total - a.total), [tasks]);
    const kpiRows = useMemo(() => buildKpiRows(tasks), [tasks]);
    const kpiWeightRows = useMemo(() => buildKpiWeightRows(tasks), [tasks]);
    const teams = useMemo(() => [...new Set(teamRows.map((row) => row.team))], [teamRows]);
    const monthlyTrend = useMemo(() => {
      const months = month === 0 ? Array.from({ length: 12 }, (_, i) => i) : [month - 1];
      const sla = [];
      const trendCompletion = [];
      const risk = [];
      const total = [];
      const completed = [];
      months.forEach((monthIndex) => {
        const monthTasks = tasks.filter((task) => getTaskMonth(task) === monthIndex);
        const monthPortfolio = buildPortfolio(monthTasks, holidaySet);
        sla.push(monthTasks.length ? monthPortfolio.scores.sla : null);
        trendCompletion.push(monthTasks.length ? monthPortfolio.completion : null);
        risk.push(monthTasks.length ? monthPortfolio.overdue.length + monthPortfolio.atRisk.length : 0);
        total.push(monthTasks.length);
        completed.push(monthPortfolio.completed.length);
      });
      return { months, series: { sla, completion: trendCompletion, risk, total, completed } };
    }, [tasks, month, holidaySet]);
    const criticalQueue = useMemo(() => portfolio.active.map((task) => ({ task, days: daysUntil(task, holidaySet), weight: taskWeight(task) })).filter((item) => item.days !== null).sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return riskA - riskB || a.days - b.days || b.weight - a.weight;
    }).slice(0, 12), [portfolio.active, holidaySet]);
    return /* @__PURE__ */ React.createElement(Shell, null, /* @__PURE__ */ React.createElement("header", { className: "mx-card stage-header p-5 md:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "executive-header-grid" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-3" }, state.user && /* @__PURE__ */ React.createElement(Avatar, { item: state.user, name: state.user.name || state.user.empId, className: "header-avatar" }), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-display" }), " Executive View"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "METRIX Verity"), state.user && /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-good" }, state.user.role, " / ", state.user.team)), /* @__PURE__ */ React.createElement("h1", { className: "display-title mt-6 mb-0 break-words" }, /* @__PURE__ */ React.createElement("span", { className: "block" }, "Executive Performance"), /* @__PURE__ */ React.createElement("span", { className: "block" }, "SLA & KPI Command Center")), /* @__PURE__ */ React.createElement("p", { className: "mt-4 mb-0 max-w-[84ch] text-base md:text-[18px] leading-8 text-[var(--mx-muted)]" }, "\u0E2A\u0E23\u0E38\u0E1B SLA, \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 KPI, \u0E20\u0E32\u0E23\u0E30\u0E07\u0E32\u0E19\u0E23\u0E32\u0E22\u0E17\u0E35\u0E21, \u0E1C\u0E25\u0E07\u0E32\u0E19\u0E23\u0E32\u0E22\u0E1A\u0E38\u0E04\u0E04\u0E25 \u0E41\u0E25\u0E30\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E40\u0E1B\u0E34\u0E14\u0E19\u0E33\u0E40\u0E2A\u0E19\u0E2D\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35")), /* @__PURE__ */ React.createElement("div", { className: "no-print control-panel executive-controls" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input !w-36", value: empId, onChange: (e) => setEmpId(e.target.value.toUpperCase()), placeholder: "empId" }), /* @__PURE__ */ React.createElement("select", { className: "mx-input !w-40", value: month, onChange: (e) => setMonth(Number(e.target.value)) }, /* @__PURE__ */ React.createElement("option", { value: 0 }, "\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19"), MONTH_NAMES.map((name, index) => /* @__PURE__ */ React.createElement("option", { key: name, value: index + 1 }, name))), /* @__PURE__ */ React.createElement("select", { className: "mx-input !w-28", value: year, onChange: (e) => setYear(Number(e.target.value)) }, years.map((item) => /* @__PURE__ */ React.createElement("option", { key: item, value: item }, item))), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: () => load(empId), disabled: state.loading }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${state.loading ? "fa-rotate-right fa-spin" : "fa-arrows-rotate"} mr-2` }), "\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn theme-toggle",
        type: "button",
        onClick: () => setTheme((current) => current === "dark" ? "light" : "dark"),
        "aria-label": "Toggle Executive View theme",
        title: theme === "dark" ? "Light mode" : "Dark mode"
      },
      /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}` }),
      /* @__PURE__ */ React.createElement("span", null, theme === "dark" ? "Light" : "Dark")
    ), /* @__PURE__ */ React.createElement("button", { className: "mx-btn print-btn", onClick: () => window.print() }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-print mr-2" }), "\u0E1E\u0E34\u0E21\u0E1E\u0E4C"))), state.error && /* @__PURE__ */ React.createElement("div", { className: "mt-4 mx-soft p-4 text-sm font-bold text-[var(--mx-danger)]" }, state.error)), /* @__PURE__ */ React.createElement("section", { className: "mx-card hero-band p-5 md:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "presentation-grid items-stretch" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-5" }, /* @__PURE__ */ React.createElement(GaugeMetric, { label: "SLA \u0E23\u0E27\u0E21", value: portfolio.scores.sla, sub: "\u0E04\u0E30\u0E41\u0E19\u0E19\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E15\u0E32\u0E21\u0E01\u0E25\u0E38\u0E48\u0E21 KPI", tone: "var(--mx-info)" }), /* @__PURE__ */ React.createElement(GaugeMetric, { label: "Completion \u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01", value: portfolio.completion, sub: `\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27 ${fmtNum(portfolio.completed.length)} \u0E08\u0E32\u0E01 ${fmtNum(tasks.length)} \u0E07\u0E32\u0E19`, tone: "var(--mx-success)" })), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-3 gap-5" }, /* @__PURE__ */ React.createElement(Metric, { label: "\u0E07\u0E32\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", value: fmtNum(tasks.length), sub: periodLabel, icon: "fa-clipboard-list", tone: "status-neutral" }), /* @__PURE__ */ React.createElement(Metric, { label: "\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14", value: fmtNum(portfolio.overdue.length), sub: "\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07 active \u0E41\u0E25\u0E30\u0E40\u0E25\u0E22 deadline", icon: "fa-triangle-exclamation", tone: portfolio.overdue.length ? "status-bad" : "status-good" }), /* @__PURE__ */ React.createElement(Metric, { label: "\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E43\u0E01\u0E25\u0E49\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14", value: fmtNum(portfolio.atRisk.length), sub: "\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E20\u0E32\u0E22\u0E43\u0E19 3 \u0E27\u0E31\u0E19\u0E17\u0E33\u0E01\u0E32\u0E23", icon: "fa-clock", tone: portfolio.atRisk.length ? "status-warn" : "status-good" })))), /* @__PURE__ */ React.createElement(TabBar, { activeTab, setActiveTab }), activeTab === "overview" && /* @__PURE__ */ React.createElement(OverviewPanel, { portfolio, teamRows, kpiRows, statusRows, criticalQueue, monthlyTrend, periodLabel, user: state.user, empId, tasks }), activeTab === "teams" && /* @__PURE__ */ React.createElement(TeamsPanel, { teamRows, holidays: holidaySet }), activeTab === "employees" && /* @__PURE__ */ React.createElement(EmployeesPanel, { personRows, teams, personTeamFilter, setPersonTeamFilter, tasks, selectedPerson, setSelectedPerson, holidays: holidaySet }), activeTab === "kpi" && /* @__PURE__ */ React.createElement(KpiAnalysisPanel, { kpiRows, personRows, teamRows }), activeTab === "weights" && /* @__PURE__ */ React.createElement(KpiWeightsPanel, { kpiWeightRows, kpiSearch, setKpiSearch }));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
})();
