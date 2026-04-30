var MaxiwaExecutiveDashboard = (() => {
  const { useEffect, useMemo, useState } = React;
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
  function fmtPct(value) {
    return value === null || value === void 0 ? "-" : `${value}%`;
  }
  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  }
  function taskWeight(task) {
    var _a, _b, _c, _d;
    const raw = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpiweight) != null ? _a : task == null ? void 0 : task.main_weight) != null ? _b : task == null ? void 0 : task.weight) != null ? _c : task == null ? void 0 : task.kpiweight) != null ? _d : 1;
    const weight = typeof raw === "string" ? Number.parseFloat(raw.replace("%", "").trim()) : Number(raw);
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  }
  function kpiKey(task) {
    var _a, _b, _c, _d, _e;
    return String((_e = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpi) != null ? _a : task == null ? void 0 : task.mainKpi) != null ? _b : task == null ? void 0 : task.main) != null ? _c : task == null ? void 0 : task.subkpi) != null ? _d : task == null ? void 0 : task.sub) != null ? _e : "Other").trim() || "Other";
  }
  function isCompletedOnTime(task) {
    const deadline = (task == null ? void 0 : task.deadline) ? new Date(task.deadline) : null;
    const completedAt = (task == null ? void 0 : task.completiondate) ? new Date(task.completiondate) : null;
    return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt <= deadline);
  }
  function calcWeightedScores(tasks) {
    const groups = {};
    (tasks || []).forEach((task) => {
      const key = kpiKey(task);
      const weight = taskWeight(task);
      const status = String((task == null ? void 0 : task.status) || "").toLowerCase();
      if (!groups[key]) groups[key] = { weight, total: 0, completed: 0, onTime: 0 };
      else if (groups[key].weight === 1 && weight !== 1) groups[key].weight = weight;
      if (status === "cancelled") return;
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
      const weight = taskWeight({ weight: group.weight });
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
      slaWeight,
      onTimeWeight
    };
  }
  function isActive(task) {
    return !["completed", "cancelled"].includes(String((task == null ? void 0 : task.status) || "").toLowerCase());
  }
  function daysUntil(task) {
    if (!(task == null ? void 0 : task.deadline)) return null;
    const d = new Date(task.deadline);
    if (Number.isNaN(d.getTime())) return null;
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / 864e5);
  }
  function extractJobCode(job) {
    if (!job) return "-";
    const match = String(job).match(/^([A-Za-z]+\d+_\d+)/);
    return match ? match[1].toUpperCase() : String(job).slice(0, 22);
  }
  function healthClass(value) {
    if (value === null || value === void 0) return "status-neutral";
    if (value >= 90) return "status-good";
    if (value >= 75) return "status-info";
    if (value >= 60) return "status-warn";
    return "status-bad";
  }
  function statusClass(status) {
    const raw = String(status || "").toLowerCase();
    if (raw === "completed") return "status-good";
    if (raw === "on process") return "status-info";
    if (raw === "pending") return "status-warn";
    if (raw === "on hold") return "status-bad";
    return "status-neutral";
  }
  function riskBadge(days) {
    if (days === null) return ["No deadline", "status-neutral"];
    if (days < 0) return [`${Math.abs(days)}d late`, "status-bad"];
    if (days <= 3) return [`${days}d left`, "status-warn"];
    return [`${days}d left`, "status-info"];
  }
  function clampPercent(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, num));
  }
  function getTaskMonth(task) {
    const raw = task.completiondate || task.deadline || task.startdate || task.created_at || task.timestamp;
    const d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.getMonth();
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
  function calcGroupRows(map) {
    return Object.entries(map).map(([name, items]) => {
      var _a, _b, _c, _d;
      const scores = calcWeightedScores(items);
      const active = items.filter(isActive);
      const overdue = active.filter((task) => {
        const days = daysUntil(task);
        return days !== null && days < 0;
      }).length;
      const risk = active.filter((task) => {
        const days = daysUntil(task);
        return days !== null && days >= 0 && days <= 3;
      }).length;
      const completed = items.filter((task) => String(task.status || "").toLowerCase() === "completed").length;
      const completion = (_a = scores.completion) != null ? _a : items.length ? Math.round(completed / items.length * 100) : null;
      const health = Math.round((((_c = (_b = scores.sla) != null ? _b : completion) != null ? _c : 0) + ((_d = completion != null ? completion : scores.sla) != null ? _d : 0)) / 2) - overdue * 5 - risk * 2;
      return { name, items, total: items.length, active: active.length, completed, overdue, risk, sla: scores.sla, completion, health };
    });
  }
  function Metric({ label, value, sub, icon, tone = "status-info" }) {
    return /* @__PURE__ */ React.createElement("div", { className: `mx-card metric-card p-5 ${tone}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, label), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${tone}` }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${icon}` }))), /* @__PURE__ */ React.createElement("div", { className: "mt-5 metric-number" }, value), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, sub));
  }
  function GaugeMetric({ label, value, sub, tone = "var(--mx-indigo)" }) {
    const pct = clampPercent(value);
    const circumference = 2 * Math.PI * 42;
    const dash = pct / 100 * circumference;
    return /* @__PURE__ */ React.createElement("div", { className: "mx-card p-5 flex items-center gap-5 min-h-[176px]" }, /* @__PURE__ */ React.createElement("svg", { width: "112", height: "112", viewBox: "0 0 112 112", role: "img", "aria-label": `${label} ${fmtPct(value)}` }, /* @__PURE__ */ React.createElement("circle", { cx: "56", cy: "56", r: "42", fill: "none", stroke: "rgba(100,116,139,0.16)", strokeWidth: "12" }), /* @__PURE__ */ React.createElement(
      "circle",
      {
        cx: "56",
        cy: "56",
        r: "42",
        fill: "none",
        stroke: tone,
        strokeWidth: "12",
        strokeLinecap: "round",
        strokeDasharray: `${dash} ${circumference - dash}`,
        transform: "rotate(-90 56 56)"
      }
    ), /* @__PURE__ */ React.createElement("text", { x: "56", y: "60", textAnchor: "middle", fontSize: "22", fontWeight: "900", fill: "var(--mx-text)" }, fmtPct(value))), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, label), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)] leading-6" }, sub)));
  }
  function LineChart({ months, series }) {
    const width = 860;
    const height = 270;
    const pad = { left: 42, right: 18, top: 24, bottom: 42 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const x = (index) => pad.left + plotW * index / Math.max(1, months.length - 1);
    const y = (value) => pad.top + plotH - plotH * clampPercent(value) / 100;
    const points = (values) => values.map((value, index) => `${x(index)},${value === null ? y(0) : y(value)}`).join(" ");
    return /* @__PURE__ */ React.createElement("div", { className: "w-full overflow-x-auto" }, /* @__PURE__ */ React.createElement("svg", { viewBox: `0 0 ${width} ${height}`, className: "w-full min-w-[720px]" }, [0, 25, 50, 75, 100].map((tick) => /* @__PURE__ */ React.createElement("g", { key: tick }, /* @__PURE__ */ React.createElement("line", { className: "chart-grid", x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick) }), /* @__PURE__ */ React.createElement("text", { className: "chart-label", x: "8", y: y(tick) + 4 }, tick, "%"))), months.map((month, index) => /* @__PURE__ */ React.createElement("text", { key: month, className: "chart-label", x: x(index), y: height - 14, textAnchor: "middle" }, MONTH_NAMES[month].slice(0, 3))), /* @__PURE__ */ React.createElement("polyline", { className: "chart-line", points: points(series.sla), stroke: "var(--mx-info)" }), /* @__PURE__ */ React.createElement("polyline", { className: "chart-line", points: points(series.completion), stroke: "var(--mx-success)" }), /* @__PURE__ */ React.createElement("polyline", { className: "chart-line", points: points(series.risk), stroke: "var(--mx-danger)" }), series.sla.map((value, index) => value !== null && /* @__PURE__ */ React.createElement("circle", { key: `s-${index}`, cx: x(index), cy: y(value), r: "4", fill: "var(--mx-info)" })), series.completion.map((value, index) => value !== null && /* @__PURE__ */ React.createElement("circle", { key: `c-${index}`, cx: x(index), cy: y(value), r: "4", fill: "var(--mx-success)" })), series.risk.map((value, index) => value !== null && /* @__PURE__ */ React.createElement("circle", { key: `r-${index}`, cx: x(index), cy: y(value), r: "4", fill: "var(--mx-danger)" }))));
  }
  function HorizontalBar({ value, color = "var(--mx-indigo)" }) {
    return /* @__PURE__ */ React.createElement("div", { className: "bar-track" }, /* @__PURE__ */ React.createElement("div", { className: "bar-fill", style: { width: `${clampPercent(value)}%`, background: color } }));
  }
  function Shell({ children }) {
    return /* @__PURE__ */ React.createElement("div", { className: "max-w-[1760px] mx-auto p-4 md:p-7 grid gap-6" }, children);
  }
  function App() {
    var _a, _b;
    const params = new URLSearchParams(window.location.search);
    const initialEmpId = String(params.get("empId") || "").trim().toUpperCase();
    const [empId, setEmpId] = useState(initialEmpId);
    const [month, setMonth] = useState(params.has("month") ? Number(params.get("month")) : 0);
    const [year, setYear] = useState(Number(params.get("year") || (/* @__PURE__ */ new Date()).getFullYear()));
    const [state, setState] = useState({ loading: false, error: "", user: null, tasks: [] });
    const years = useMemo(() => {
      const now = (/* @__PURE__ */ new Date()).getFullYear();
      return Array.from({ length: 6 }, (_, i) => now - 3 + i);
    }, []);
    const load = async (nextEmpId = empId) => {
      const cleanEmpId = String(nextEmpId || "").trim().toUpperCase();
      if (!cleanEmpId) {
        setState((prev) => ({ ...prev, error: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38 empId \u0E43\u0E19 URL \u0E2B\u0E23\u0E37\u0E2D\u0E0A\u0E48\u0E2D\u0E07\u0E14\u0E49\u0E32\u0E19\u0E1A\u0E19" }));
        return;
      }
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const initial = await API.getInitialData(cleanEmpId);
        if (initial == null ? void 0 : initial.error) throw new Error(initial.error);
        if (!(initial == null ? void 0 : initial.user)) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19");
        const user = { ...initial.user, kpis: initial.kpis || [] };
        const monthParam = month === 0 ? null : month;
        let tasks2 = [];
        if (user.role === "Staff") {
          const res = await API.getEmployeeTasks(user, monthParam, year, month === 0, user.empId);
          tasks2 = res.tasks || res || [];
        } else {
          const team = user.role === "Lead" ? user.team : "all";
          const res = await API.getAllTasks(monthParam, year, team, user.empId);
          tasks2 = res.tasks || [];
        }
        setState({ loading: false, error: "", user, tasks: tasks2 });
        const url = new URL(window.location.href);
        url.searchParams.set("empId", cleanEmpId);
        url.searchParams.set("month", String(month));
        url.searchParams.set("year", String(year));
        window.history.replaceState(null, "", url);
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message || "\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" }));
      }
    };
    useEffect(() => {
      if (initialEmpId) load(initialEmpId);
    }, [month, year]);
    const tasks = state.tasks || [];
    const activeTasks = tasks.filter(isActive);
    const completedTasks = tasks.filter((task) => String(task.status || "").toLowerCase() === "completed");
    const overdueTasks = activeTasks.filter((task) => {
      const days = daysUntil(task);
      return days !== null && days < 0;
    });
    const atRiskTasks = activeTasks.filter((task) => {
      const days = daysUntil(task);
      return days !== null && days >= 0 && days <= 3;
    });
    const scores = calcWeightedScores(tasks);
    const completion = (_a = scores.completion) != null ? _a : tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : null;
    const sla = scores.sla;
    const weightedScore = completion !== null && sla !== null ? Math.round((completion + sla) / 2) : completion != null ? completion : sla;
    const periodLabel = `${month === 0 ? "All Months" : MONTH_NAMES[month - 1]} ${year}`;
    const teamRows = useMemo(() => calcGroupRows(groupBy(tasks, (task) => task.team || "Unassigned")).map((row) => ({ ...row, team: row.name })).sort((a, b) => a.overdue - b.overdue || a.risk - b.risk || b.health - a.health), [tasks]);
    const personRows = useMemo(() => calcGroupRows(groupBy(tasks, (task) => {
      const name = task.name || task.assignee || task.owner || task.empId || task.empid;
      const team = task.team || "-";
      return `${name || "Unassigned"} \xB7 ${team}`;
    })).sort((a, b) => b.total - a.total || a.overdue - b.overdue || b.health - a.health), [tasks]);
    const statusRows = useMemo(() => {
      const map = groupBy(tasks, (task) => task.status || "Unknown");
      return Object.entries(map).map(([status, items]) => ({ status, total: items.length, pct: tasks.length ? Math.round(items.length / tasks.length * 100) : 0 })).sort((a, b) => b.total - a.total);
    }, [tasks]);
    const kpiRows = useMemo(() => {
      const map = groupBy(tasks, kpiKey);
      return Object.entries(map).map(([name, items]) => {
        const scores2 = calcWeightedScores(items);
        const active = items.filter(isActive);
        return {
          name,
          total: items.length,
          active: active.length,
          weight: Math.max(...items.map(taskWeight), 1),
          sla: scores2.sla,
          completion: scores2.completion
        };
      }).sort((a, b) => b.total - a.total).slice(0, 8);
    }, [tasks]);
    const monthlyTrend = useMemo(() => {
      const months = month === 0 ? Array.from({ length: 12 }, (_, i) => i) : [month - 1];
      const sla2 = [];
      const trendCompletion = [];
      const risk = [];
      months.forEach((monthIndex) => {
        var _a2;
        const monthTasks = tasks.filter((task) => getTaskMonth(task) === monthIndex);
        const monthScores = calcWeightedScores(monthTasks);
        const active = monthTasks.filter(isActive);
        const riskCount = active.filter((task) => {
          const days = daysUntil(task);
          return days !== null && days <= 3;
        }).length;
        sla2.push(monthTasks.length ? monthScores.sla : null);
        trendCompletion.push(monthTasks.length ? (_a2 = monthScores.completion) != null ? _a2 : Math.round(monthTasks.filter((task) => String(task.status || "").toLowerCase() === "completed").length / monthTasks.length * 100) : null);
        risk.push(monthTasks.length ? Math.round(riskCount / monthTasks.length * 100) : null);
      });
      return { months, series: { sla: sla2, completion: trendCompletion, risk } };
    }, [tasks, month]);
    const criticalQueue = useMemo(() => activeTasks.map((task) => ({ task, days: daysUntil(task), weight: taskWeight(task) })).filter((item) => item.days !== null).sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return riskA - riskB || a.days - b.days || b.weight - a.weight;
    }).slice(0, 10), [activeTasks]);
    const insights = [];
    if (overdueTasks.length) insights.push(`${overdueTasks.length} overdue task(s) require attention before the next SLA review.`);
    if (atRiskTasks.length) insights.push(`${atRiskTasks.length} task(s) are due within 3 days and may affect the monthly SLA score.`);
    if (teamRows[0]) insights.push(`${teamRows[0].team} is the current highest-risk team in this scope.`);
    if (sla !== null) insights.push(`Weighted SLA is ${sla}% and weighted completion is ${completion != null ? completion : "-"}%.`);
    if (!insights.length) insights.push("No critical SLA risk is visible in this scope.");
    return /* @__PURE__ */ React.createElement(Shell, null, /* @__PURE__ */ React.createElement("header", { className: "mx-card stage-header p-5 md:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-display" }), " Executive View"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "MAXIWA KPI"), state.user && /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-good" }, state.user.role, " \xB7 ", state.user.team)), /* @__PURE__ */ React.createElement("h1", { className: "display-title mt-6 mb-0 break-words" }, /* @__PURE__ */ React.createElement("span", { className: "block" }, "Executive Performance"), /* @__PURE__ */ React.createElement("span", { className: "block" }, "Command Center")), /* @__PURE__ */ React.createElement("p", { className: "mt-4 mb-0 max-w-[84ch] text-base md:text-[18px] leading-8 text-[var(--mx-muted)]" }, "A boardroom-ready readout for SLA exposure, KPI weight, team capacity, and individual performance depth.")), /* @__PURE__ */ React.createElement("div", { className: "no-print control-panel flex flex-wrap gap-2 xl:justify-end xl:max-w-[640px]" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input !w-36", value: empId, onChange: (e) => setEmpId(e.target.value.toUpperCase()), placeholder: "empId" }), /* @__PURE__ */ React.createElement("select", { className: "mx-input !w-40", value: month, onChange: (e) => setMonth(Number(e.target.value)) }, /* @__PURE__ */ React.createElement("option", { value: 0 }, "\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19"), MONTH_NAMES.map((name, index) => /* @__PURE__ */ React.createElement("option", { key: name, value: index + 1 }, name))), /* @__PURE__ */ React.createElement("select", { className: "mx-input !w-28", value: year, onChange: (e) => setYear(Number(e.target.value)) }, years.map((item) => /* @__PURE__ */ React.createElement("option", { key: item, value: item }, item))), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: () => load(empId), disabled: state.loading }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${state.loading ? "fa-rotate-right fa-spin" : "fa-arrows-rotate"} mr-2` }), "Load"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn", onClick: () => window.print() }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-print mr-2" }), "Print"))), state.error && /* @__PURE__ */ React.createElement("div", { className: "mt-4 mx-soft p-4 text-sm font-bold text-[var(--mx-danger)]" }, state.error)), /* @__PURE__ */ React.createElement("section", { className: "mx-card hero-band p-5 md:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "presentation-grid items-stretch" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-5" }, /* @__PURE__ */ React.createElement(GaugeMetric, { label: "Overall SLA", value: sla, sub: "\u0E04\u0E30\u0E41\u0E19\u0E19\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E15\u0E32\u0E21 KPI", tone: "var(--mx-info)" }), /* @__PURE__ */ React.createElement(GaugeMetric, { label: "Completion", value: completion, sub: `${completedTasks.length}/${tasks.length} \u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C`, tone: "var(--mx-success)" })), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-3 gap-5" }, /* @__PURE__ */ React.createElement(Metric, { label: "Overdue", value: overdueTasks.length, sub: "\u0E07\u0E32\u0E19 active \u0E17\u0E35\u0E48\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14", icon: "fa-triangle-exclamation", tone: overdueTasks.length ? "status-bad" : "status-good" }), /* @__PURE__ */ React.createElement(Metric, { label: "At Risk", value: atRiskTasks.length, sub: "\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E43\u0E19 3 \u0E27\u0E31\u0E19", icon: "fa-clock", tone: atRiskTasks.length ? "status-warn" : "status-good" }), /* @__PURE__ */ React.createElement(Metric, { label: "Weighted Score", value: fmtPct(weightedScore), sub: "SLA + Completion", icon: "fa-ranking-star", tone: healthClass(weightedScore) })))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Management Summary"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, periodLabel, " \xB7 ", ((_b = state.user) == null ? void 0 : _b.name) || empId || "No employee selected")), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "Updated ", (/* @__PURE__ */ new Date()).toLocaleString("th-TH"))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-[1.15fr_0.85fr] gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, insights.map((insight, index) => /* @__PURE__ */ React.createElement("div", { key: insight, className: "insight-card p-5 flex items-start gap-4" }, /* @__PURE__ */ React.createElement("span", { className: "rank-chip" }, index + 1), /* @__PURE__ */ React.createElement("div", { className: "font-bold leading-6" }, insight)))), /* @__PURE__ */ React.createElement("div", { className: "mx-soft p-5 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Decision Lens"), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3 text-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Scope"), /* @__PURE__ */ React.createElement("strong", null, periodLabel)), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Active workload"), /* @__PURE__ */ React.createElement("strong", null, activeTasks.length)), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Teams monitored"), /* @__PURE__ */ React.createElement("strong", null, teamRows.length)), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-muted)]" }, "Presentation URL"), /* @__PURE__ */ React.createElement("strong", null, "/dashboard?empId=", empId || "EMPID")))))), /* @__PURE__ */ React.createElement("div", { className: "presentation-grid" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Monthly Performance Trend"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, "\u0E40\u0E2A\u0E49\u0E19\u0E41\u0E19\u0E27\u0E42\u0E19\u0E49\u0E21 SLA, completion \u0E41\u0E25\u0E30 risk rate \u0E15\u0E32\u0E21\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E07\u0E32\u0E19\u0E43\u0E19 scope \u0E19\u0E35\u0E49")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, "SLA"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-good" }, "Completion"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-bad" }, "Risk"))), /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, /* @__PURE__ */ React.createElement(LineChart, { months: monthlyTrend.months, series: monthlyTrend.series }))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Workload Mix"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E01\u0E25\u0E38\u0E48\u0E21 KPI \u0E17\u0E35\u0E48\u0E01\u0E34\u0E19 workload \u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black mb-3" }, "Status Distribution"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, statusRows.map((row) => /* @__PURE__ */ React.createElement("div", { key: row.status }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${statusClass(row.status)}` }, row.status), /* @__PURE__ */ React.createElement("strong", null, row.total, " \xB7 ", row.pct, "%")), /* @__PURE__ */ React.createElement(HorizontalBar, { value: row.pct, color: row.status === "Completed" ? "var(--mx-success)" : row.status === "On Hold" ? "var(--mx-danger)" : row.status === "Pending" ? "var(--mx-warning)" : "var(--mx-info)" }))))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black mb-3" }, "Top KPI Groups"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, kpiRows.map((row, index) => /* @__PURE__ */ React.createElement("div", { key: row.name, className: "mx-soft p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold leading-5 min-w-0 break-words" }, /* @__PURE__ */ React.createElement("span", { className: "text-[var(--mx-brass)] mr-2" }, "#", index + 1), row.name), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, row.total)), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("span", null, "SLA ", /* @__PURE__ */ React.createElement("strong", { className: "text-[var(--mx-text)]" }, fmtPct(row.sla))), /* @__PURE__ */ React.createElement("span", null, "Done ", /* @__PURE__ */ React.createElement("strong", { className: "text-[var(--mx-text)]" }, fmtPct(row.completion))), /* @__PURE__ */ React.createElement("span", null, "Weight ", /* @__PURE__ */ React.createElement("strong", { className: "text-[var(--mx-text)]" }, row.weight)))))))))), /* @__PURE__ */ React.createElement("div", { className: "grid 2xl:grid-cols-[1.15fr_0.85fr] gap-5" }, /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Team Performance Matrix"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "\u0E40\u0E08\u0E32\u0E30\u0E25\u0E36\u0E01\u0E23\u0E32\u0E22\u0E17\u0E35\u0E21 \u0E40\u0E23\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21 overdue, risk \u0E41\u0E25\u0E30 weighted health"), /* @__PURE__ */ React.createElement("div", { className: "table-shell overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full min-w-[760px] text-sm" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Team"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Tasks"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "SLA"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Completion"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Risk"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Status"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, teamRows.map((row) => /* @__PURE__ */ React.createElement("tr", { key: row.team }, /* @__PURE__ */ React.createElement("td", { className: "py-4 font-extrabold" }, row.team), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, row.total), /* @__PURE__ */ React.createElement("td", { className: "py-4 font-bold" }, fmtPct(row.sla)), /* @__PURE__ */ React.createElement("td", { className: "py-4 font-bold" }, fmtPct(row.completion)), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${row.overdue ? "status-bad" : row.risk ? "status-warn" : "status-good"}` }, row.overdue, " overdue / ", row.risk, " risk")), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.health)}` }, row.health >= 90 ? "Healthy" : row.health >= 75 ? "Watch" : row.health >= 60 ? "Pressure" : "Critical")))), !teamRows.length && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { className: "py-8 text-center text-[var(--mx-muted)]", colSpan: "6" }, "No team data in this scope.")))))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Critical Work Queue"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07\u0E01\u0E23\u0E30\u0E17\u0E1A SLA/KPI \u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E43\u0E19 scope \u0E19\u0E35\u0E49"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, criticalQueue.map(({ task, days, weight }) => {
      const [label, klass] = riskBadge(days);
      return /* @__PURE__ */ React.createElement("div", { key: task.id || `${task.job}-${task.deadline}`, className: "insight-card p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold truncate" }, extractJobCode(task.job)), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)] line-clamp-2" }, task.job || "-")), /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${klass}` }, label)), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, task.team || "-"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-info" }, "weight ", weight), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, "deadline ", fmtDate(task.deadline))));
    }), !criticalQueue.length && /* @__PURE__ */ React.createElement("div", { className: "mx-soft p-5 text-center text-[var(--mx-muted)]" }, "No critical active work in this scope.")))), /* @__PURE__ */ React.createElement("section", { className: "mx-card p-5 md:p-7" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "section-title m-0" }, "Individual Performance Deep Dive"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-5 text-sm text-[var(--mx-muted)]" }, "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E23\u0E32\u0E22\u0E1A\u0E38\u0E04\u0E04\u0E25\u0E08\u0E32\u0E01 workload, SLA, completion \u0E41\u0E25\u0E30\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07")), /* @__PURE__ */ React.createElement("span", { className: "mx-badge status-neutral" }, personRows.length, " people")), /* @__PURE__ */ React.createElement("div", { className: "table-shell overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full min-w-[920px] text-sm" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Person"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Tasks"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Active"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "SLA"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Completion"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Risk"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Health"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, personRows.slice(0, 24).map((row) => /* @__PURE__ */ React.createElement("tr", { key: row.name }, /* @__PURE__ */ React.createElement("td", { className: "py-4 font-extrabold max-w-[280px]" }, /* @__PURE__ */ React.createElement("div", { className: "truncate" }, row.name)), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold w-10" }, row.total), /* @__PURE__ */ React.createElement("div", { className: "w-28" }, /* @__PURE__ */ React.createElement(HorizontalBar, { value: tasks.length ? Math.round(row.total / tasks.length * 100) : 0 })))), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, row.active), /* @__PURE__ */ React.createElement("td", { className: "py-4 font-bold" }, fmtPct(row.sla)), /* @__PURE__ */ React.createElement("td", { className: "py-4 font-bold" }, fmtPct(row.completion)), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${row.overdue ? "status-bad" : row.risk ? "status-warn" : "status-good"}` }, row.overdue, " overdue / ", row.risk, " risk")), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("span", { className: `mx-badge ${healthClass(row.health)}` }, row.health)))), !personRows.length && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { className: "py-8 text-center text-[var(--mx-muted)]", colSpan: "7" }, "No individual data in this scope.")))))));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
})();
