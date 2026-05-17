const { useEffect, useMemo, useState } = React;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STRATEGIC_VIEW_ROLES = ['SrManager', 'Director', 'Executive'];
const TEAM_SCOPED_ROLES = ['Lead'];
const EXEC_THEME_KEY = 'metrix-executive-theme';
const SESSION_LOCK_KEY = 'maxiwa-kpi-active-session';

function getInitialExecutiveTheme() {
  try {
    const saved = localStorage.getItem(EXEC_THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyExecutiveTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  try {
    localStorage.setItem(EXEC_THEME_KEY, nextTheme);
  } catch {
    // Theme selection is cosmetic; keep rendering if storage is unavailable.
  }
}

function isTeamScopedRole(role) {
  return TEAM_SCOPED_ROLES.includes(role);
}

function isStrategicViewRole(role) {
  return STRATEGIC_VIEW_ROLES.includes(role);
}

function userEmpId(user) {
  return String(user?.empId || user?.empid || '').trim();
}

function readExecutiveSession(empId, sessionId) {
  const cleanEmpId = String(empId || '').trim();
  const cleanSessionId = String(sessionId || '').trim();
  if (cleanEmpId && cleanSessionId) return { empId: cleanEmpId, sessionId: cleanSessionId };
  try {
    const lock = JSON.parse(localStorage.getItem(SESSION_LOCK_KEY) || 'null');
    if (!lock?.empId || !lock?.sessionId || Number(lock.expiresAt || 0) <= Date.now()) return null;
    if (cleanEmpId && String(lock.empId).trim().toLowerCase() !== cleanEmpId.toLowerCase()) return null;
    return { empId: String(lock.empId).trim(), sessionId: String(lock.sessionId).trim() };
  } catch {
    return null;
  }
}

function isSelfScopedRole(role) {
  return role === 'Staff';
}

function userPermissions(user) {
  const raw = user?.permissions;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  return typeof raw === 'object' ? raw : {};
}

function allowedTeamsForUser(user) {
  const permissions = userPermissions(user);
  return Array.isArray(permissions.allowedTeams)
    ? permissions.allowedTeams.map((team) => String(team || '').trim()).filter(Boolean)
    : [];
}

function shouldApplyAllowedTeamFilter(user) {
  return (user?.role === 'Manager' || isStrategicViewRole(user?.role)) && allowedTeamsForUser(user).length > 0;
}

function filterByAllowedTeams(user, items, getTeam = (item) => item?.team) {
  if (!shouldApplyAllowedTeamFilter(user)) return items || [];
  const allowed = new Set(allowedTeamsForUser(user));
  return (items || []).filter((item) => allowed.has(String(getTeam(item) || '').trim()));
}

const TAB_ITEMS = [
  { id: 'overview', label: 'ภาพรวม', icon: 'fa-chart-line' },
  { id: 'teams', label: 'รายทีม', icon: 'fa-people-group' },
  { id: 'employees', label: 'รายบุคคล', icon: 'fa-id-badge' },
  { id: 'kpi', label: 'วิเคราะห์ KPI', icon: 'fa-bullseye' },
  { id: 'weights', label: 'น้ำหนัก KPI', icon: 'fa-scale-balanced' },
];

function fmtPct(value) {
  return value === null || value === undefined || Number.isNaN(value) ? '-' : `${value}%`;
}

function fmtNum(value) {
  return Number(value || 0).toLocaleString();
}

function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function normalizeStatus(task) {
  return String(task?.status || '').trim().toLowerCase();
}

function isCompleted(task) {
  return normalizeStatus(task) === 'completed';
}

function isCancelled(task) {
  return normalizeStatus(task) === 'cancelled';
}

function isActive(task) {
  return !isCompleted(task) && !isCancelled(task);
}

function isOnProcess(task) {
  const status = normalizeStatus(task);
  return status === 'on process' || status === 'on_process';
}

function taskWeight(task) {
  const raw = task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight ?? 1;
  const weight = typeof raw === 'string' ? Number.parseFloat(raw.replace('%', '').trim()) : Number(raw);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function hasExplicitWeight(task) {
  const raw = task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight;
  const weight = typeof raw === 'string' ? Number.parseFloat(raw.replace('%', '').trim()) : Number(raw);
  return Number.isFinite(weight) && weight > 0;
}

function mainKpi(task) {
  return String(task?.mainkpi ?? task?.mainKpi ?? task?.main ?? task?.subkpi ?? task?.sub ?? 'Other').trim() || 'Other';
}

function subKpi(task) {
  return String(task?.subkpi ?? task?.subKpi ?? task?.sub ?? task?.job ?? 'General').trim() || 'General';
}

function hasExplicitSubKpi(task) {
  return Boolean(String(task?.subkpi ?? task?.subKpi ?? task?.sub ?? '').trim());
}

function personName(task) {
  return String(task?.name || task?.assignee || task?.owner || task?.empName || task?.empId || task?.empid || 'Unassigned').trim();
}

function teamName(task) {
  return String(task?.team || 'Unassigned').trim();
}

function isResignedText(value) {
  const text = String(value || '').trim().toLowerCase();
  return text.includes('ลาออก') || text.includes('resign') || text.includes('inactive');
}

function isResignedTask(task = {}) {
  return isResignedText(task.team) || isResignedText(task.name) || isResignedText(task.assignee) || isResignedText(task.owner);
}

function filterPerformanceTasks(tasks = []) {
  return (tasks || []).filter((task) => !isResignedTask(task));
}

function normalizePhotoUrl(value) {
  const src = String(value || '').trim();
  if (!src) return '';
  const driveFile = src.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveFile?.[1]) return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
  const driveOpen = src.match(/[?&]id=([^&]+)/);
  if (src.includes('drive.google.com') && driveOpen?.[1]) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;
  return src;
}

function getPhotoUrl(item) {
  return normalizePhotoUrl(
    item?.pigurl || item?.pigUrl || item?.pigURL || item?.picurl || item?.picUrl ||
    item?.picture || item?.pictureUrl || item?.profilePicture || item?.profile_picture ||
    item?.avatar || item?.avatarUrl || item?.photoUrl || item?.photo_url ||
    item?.profileUrl || item?.profile_url || item?.imageUrl || item?.image_url ||
    item?.image || item?.photo || ''
  );
}

function initialsFrom(name) {
  return String(name || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'U';
}

function isCompletedOnTime(task) {
  if (!isCompleted(task)) return false;
  const deadline = task?.deadline ? new Date(task.deadline) : null;
  const completedAt = task?.completiondate ? new Date(task.completiondate) : null;
  return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt <= deadline);
}

function isCompletedLate(task) {
  if (!isCompleted(task)) return false;
  const deadline = task?.deadline ? new Date(task.deadline) : null;
  const completedAt = task?.completiondate ? new Date(task.completiondate) : null;
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
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isActiveHoliday(holiday) {
  const active = holiday?.is_active ?? holiday?.active ?? true;
  return active === true || active === 1 || String(active).toLowerCase() === 'true';
}

function buildHolidaySet(holidays = []) {
  if (holidays instanceof Set) return holidays;
  return new Set((holidays || [])
    .filter(isActiveHoliday)
    .map((holiday) => dateKey(holiday.holiday_date || holiday.date || holiday.day))
    .filter(Boolean));
}

function isWorkingDay(date, holidaySet = new Set()) {
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

function addBusinessDays(startValue, days, holidays = []) {
  const start = normalizeDateOnly(startValue);
  const amount = Math.max(0, Number(days || 0));
  if (!start || amount === 0) return start;
  const holidaySet = buildHolidaySet(holidays);
  const cursor = new Date(start);
  let remaining = amount;
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkingDay(cursor, holidaySet)) remaining -= 1;
  }
  return cursor;
}

function getActiveHoldStart(task) {
  const extra = normalizeExtraData(task?.extra_data);
  return extra.hold_started_at || extra.holdStartAt || extra.holdStart || null;
}

function normalizeExtraData(extraData) {
  if (!extraData) return {};
  if (typeof extraData === 'string') {
    try { return JSON.parse(extraData); } catch { return {}; }
  }
  return typeof extraData === 'object' ? extraData : {};
}

function getTaskHoldDays(task, holidays = [], endValue = new Date()) {
  const start = getActiveHoldStart(task);
  if (!start) return 0;
  const days = businessDaysBetween(start, endValue, holidays);
  return Math.max(0, Number(days || 0));
}

function getEffectiveDeadline(task, holidays = []) {
  if (!task?.deadline) return null;
  const activeHoldDays = normalizeStatus(task) === 'on hold' ? getTaskHoldDays(task, holidays) : 0;
  return activeHoldDays > 0 ? addBusinessDays(task.deadline, activeHoldDays, holidays) : normalizeDateOnly(task.deadline);
}

function daysUntil(task, holidays = []) {
  if (!task?.deadline) return null;
  return businessDaysBetween(new Date(), getEffectiveDeadline(task, holidays), holidays);
}

function extractJobCode(job) {
  if (!job) return '-';
  const match = String(job).match(/^([A-Za-z]+\d+_\d+)/);
  return match ? match[1].toUpperCase() : String(job).slice(0, 26);
}

function clampPercent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function healthClass(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'status-neutral';
  if (value >= 90) return 'status-good';
  if (value >= 75) return 'status-info';
  if (value >= 60) return 'status-warn';
  return 'status-bad';
}

function performanceBand(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unrated';
  if (value >= 90) return 'excellent';
  if (value >= 75) return 'good';
  if (value >= 60) return 'monitor';
  return 'critical';
}

function performanceLabel(value) {
  const band = performanceBand(value);
  if (band === 'excellent') return 'Excellent';
  if (band === 'good') return 'Good';
  if (band === 'monitor') return 'Monitor';
  if (band === 'critical') return 'Critical';
  return 'Unrated';
}

function matchesSearch(row, keys, search) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  return keys.some((key) => String(row?.[key] || '').toLowerCase().includes(q));
}

function matchesBand(value, filter) {
  return filter === 'all' || performanceBand(value) === filter;
}

function compareSortValues(a, b) {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  return String(a ?? '').localeCompare(String(b ?? ''), 'th');
}

function sortRows(rows, sortConfig) {
  if (!sortConfig?.key) return rows;
  const direction = sortConfig.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => compareSortValues(a?.[sortConfig.key], b?.[sortConfig.key]) * direction);
}

function nextSort(current, key) {
  if (current?.key === key) {
    return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
  }
  return { key, direction: 'desc' };
}

function SortHeader({ label, sortKey, sortConfig, onSort }) {
  const active = sortConfig?.key === sortKey;
  const icon = active && sortConfig.direction === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short';
  return (
    <th className="p-4">
      <button type="button" className="inline-flex items-center gap-2 font-black uppercase" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <i className={`fa-solid ${icon} ${active ? 'text-[var(--mx-brass)]' : 'text-[var(--mx-muted)]'}`}></i>
      </button>
    </th>
  );
}

function statusClass(status) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'completed') return 'status-good';
  if (raw === 'on process' || raw === 'on_process') return 'status-info';
  if (raw === 'pending') return 'status-warn';
  if (raw === 'on hold' || raw === 'on_hold') return 'status-bad';
  return 'status-neutral';
}

function riskBadge(days) {
  if (days === null) return ['No deadline', 'status-neutral'];
  if (days < 0) return [`${Math.abs(days)} bd late`, 'status-bad'];
  if (days <= 3) return [`${days} bd left`, 'status-warn'];
  return [`${days} bd left`, 'status-info'];
}

function groupBy(items, getKey) {
  const map = {};
  (items || []).forEach((item) => {
    const key = getKey(item) || 'Unassigned';
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
    sla: slaWeight > 0 ? Math.round((onTimeWeight / slaWeight) * 100) : null,
    completion: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : null,
    totalWeight,
    completedWeight,
    onTimeWeight,
    slaWeight,
  };
}

function roundMetric(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** digits;
  return Math.round(num * factor) / factor;
}

function fmtWeight(value) {
  return roundMetric(value, 1).toLocaleString();
}

function fmtWorkUnits(value) {
  return roundMetric(value, 2).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function taskWorkUnits(task) {
  return roundMetric(taskWeight(task) / 100, 4);
}

function sumWeight(items = []) {
  return roundMetric((items || []).reduce((sum, task) => sum + taskWorkUnits(task), 0), 2);
}

function avgBusinessCloseDays(tasks = [], holidays = []) {
  const days = (tasks || [])
    .filter(isCompleted)
    .map((task) => businessDaysBetween(task.startdate || task.created_at || task.deadline, task.completiondate || task.deadline, holidays))
    .filter((value) => value !== null && Number.isFinite(value) && value >= 0);
  return days.length ? roundMetric(days.reduce((sum, value) => sum + value, 0) / days.length, 1) : null;
}

function buildAgingBuckets(activeTasks = [], holidays = []) {
  const buckets = {
    dueSoon: { label: 'Due <=3bd', total: 0, weight: 0, items: [] },
    overdue1to3: { label: 'Overdue 1-3bd', total: 0, weight: 0, items: [] },
    overdue4to7: { label: 'Overdue 4-7bd', total: 0, weight: 0, items: [] },
    overdue8plus: { label: 'Overdue >7bd', total: 0, weight: 0, items: [] },
    noDeadline: { label: 'No deadline', total: 0, weight: 0, items: [] },
  };
  (activeTasks || []).forEach((task) => {
    const days = daysUntil(task, holidays);
    let key = 'noDeadline';
    if (days !== null && days >= 0 && days <= 3) key = 'dueSoon';
    else if (days !== null && days < 0 && Math.abs(days) <= 3) key = 'overdue1to3';
    else if (days !== null && days < 0 && Math.abs(days) <= 7) key = 'overdue4to7';
    else if (days !== null && days < 0) key = 'overdue8plus';
    buckets[key].total += 1;
    buckets[key].weight = roundMetric(buckets[key].weight + taskWorkUnits(task), 2);
    buckets[key].items.push(task);
  });
  return buckets;
}

function buildDataQuality(tasks = []) {
  const checks = [
    { key: 'missingSubKpi', label: 'Missing SubKPI', items: tasks.filter((task) => !hasExplicitSubKpi(task)) },
    { key: 'missingWeight', label: 'Missing Weight', items: tasks.filter((task) => !hasExplicitWeight(task)) },
    { key: 'missingDeadline', label: 'Missing Deadline', items: tasks.filter((task) => !task.deadline) },
    { key: 'completedNoDate', label: 'Completed No Date', items: tasks.filter((task) => isCompleted(task) && !task.completiondate) },
    { key: 'statusUnknown', label: 'Unknown Status', items: tasks.filter((task) => !normalizeStatus(task)) },
  ];
  const totalIssues = checks.reduce((sum, check) => sum + check.items.length, 0);
  return { checks, totalIssues };
}

function getTaskDate(task, fields = []) {
  const raw = fields.map((field) => task?.[field]).find(Boolean);
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function taskDateMatchesPeriod(task, fields, year, monthIndex, day = null) {
  const d = getTaskDate(task, fields);
  if (!d) return false;
  if (d.getFullYear() !== Number(year) || d.getMonth() !== Number(monthIndex)) return false;
  return day === null || d.getDate() === Number(day);
}

function taskDueRiskMatchesPeriod(task, year, monthIndex, day, holidays = []) {
  if (!isActive(task)) return false;
  const deadline = getEffectiveDeadline(task, holidays);
  if (!deadline) return false;
  if (deadline.getFullYear() !== Number(year) || deadline.getMonth() !== Number(monthIndex)) return false;
  if (day !== null && deadline.getDate() !== Number(day)) return false;
  const days = businessDaysBetween(new Date(), deadline, holidays);
  return days !== null && days <= 3;
}

function buildPortfolio(tasks, holidays = []) {
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
  const completion = scores.completion ?? (tasks.length ? Math.round((completed.length / tasks.length) * 1000) / 10 : null);
  const weightedScore = completion !== null && scores.sla !== null
    ? Math.round(((completion + scores.sla) / 2) * 10) / 10
    : (completion ?? scores.sla);
  const totalWeight = sumWeight(tasks.filter((task) => !isCancelled(task)));
  const completedWeight = sumWeight(completed);
  const activeWeight = sumWeight(active);
  const overdueWeight = sumWeight(overdue);
  const atRiskWeight = sumWeight(atRisk);
  const avgWeightPerTask = tasks.length ? roundMetric(totalWeight / tasks.length, 1) : 0;
  const avgCloseDays = avgBusinessCloseDays(tasks, holidays);
  const aging = buildAgingBuckets(active, holidays);
  const dataQuality = buildDataQuality(tasks);
  const riskPenalty = totalWeight ? Math.min(15, roundMetric(((overdueWeight * 1.2 + atRiskWeight * 0.45) / totalWeight) * 10, 1)) : 0;
  const riskAdjustedScore = weightedScore === null || weightedScore === undefined
    ? null
    : Math.max(0, roundMetric(weightedScore - riskPenalty, 1));

  return {
    active,
    completed,
    onProcess,
    overdue,
    atRisk,
    slaPass,
    slaFail,
    scores,
    completion,
    weightedScore,
    riskAdjustedScore,
    riskPenalty,
    totalWeight,
    completedWeight,
    activeWeight,
    overdueWeight,
    atRiskWeight,
    avgWeightPerTask,
    avgCloseDays,
    aging,
    dataQuality,
  };
}

function buildGroupRows(tasks, getKey, holidays = []) {
  return Object.entries(groupBy(tasks, getKey)).map(([name, items]) => {
    const portfolio = buildPortfolio(items, holidays);
    const topKpiEntry = Object.entries(groupBy(items, mainKpi)).sort((a, b) => b[1].length - a[1].length)[0];
    const health = Math.round(((portfolio.scores.sla ?? portfolio.completion ?? 0) + (portfolio.completion ?? portfolio.scores.sla ?? 0)) / 2)
      - portfolio.overdue.length * 5
      - portfolio.atRisk.length * 2;
    return {
      name,
      items,
      total: items.length,
      totalWeight: portfolio.totalWeight,
      completedWeight: portfolio.completedWeight,
      activeWeight: portfolio.activeWeight,
      overdueWeight: portfolio.overdueWeight,
      atRiskWeight: portfolio.atRiskWeight,
      avgWeightPerTask: portfolio.avgWeightPerTask,
      avgCloseDays: portfolio.avgCloseDays,
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
      riskAdjustedScore: portfolio.riskAdjustedScore,
      riskPenalty: portfolio.riskPenalty,
      aging: portfolio.aging,
      dataQuality: portfolio.dataQuality,
      health,
      topKpi: topKpiEntry ? topKpiEntry[0] : '-',
      topKpiCount: topKpiEntry ? topKpiEntry[1].length : 0,
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
      totalWeight: portfolio.totalWeight,
      completedWeight: portfolio.completedWeight,
      activeWeight: portfolio.activeWeight,
      overdueWeight: portfolio.overdueWeight,
      atRiskWeight: portfolio.atRiskWeight,
      avgCloseDays: portfolio.avgCloseDays,
      share: tasks.length ? Math.round((items.length / tasks.length) * 1000) / 10 : 0,
      weightShare: sumWeight(tasks) ? roundMetric((portfolio.totalWeight / sumWeight(tasks)) * 100, 1) : 0,
      sla: portfolio.scores.sla,
      completion: portfolio.completion,
      slaPass: portfolio.slaPass.length,
      slaFail: portfolio.slaFail.length,
    };
  }).sort((a, b) => b.total - a.total);
}

function buildKpiWeightRows(tasks) {
  return Object.entries(groupBy(tasks, (task) => `${teamName(task)}|${mainKpi(task)}|${subKpi(task)}`)).map(([key, items]) => {
    const [team, main, sub] = key.split('|');
    const portfolio = buildPortfolio(items);
    return {
      team,
      main,
      sub,
      weight: Math.max(...items.map(taskWeight), 1),
      total: items.length,
      totalWeight: portfolio.totalWeight,
      activeWeight: portfolio.activeWeight,
      overdueWeight: portfolio.overdueWeight,
      completed: portfolio.completed.length,
      pending: Math.max(0, items.length - portfolio.completed.length),
      slaPass: portfolio.slaPass.length,
      slaFail: portfolio.slaFail.length,
      sla: portfolio.scores.sla,
    };
  }).sort((a, b) => a.team.localeCompare(b.team) || b.total - a.total);
}

function Shell({ children }) {
  return <div className="max-w-[1760px] mx-auto p-4 md:p-7 grid gap-6">{children}</div>;
}

function Metric({ label, value, sub, icon, tone = 'status-info' }) {
  return (
    <div className={`mx-card metric-card p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">{label}</div>
        <span className={`mx-badge ${tone}`}><i className={`fa-solid ${icon}`}></i></span>
      </div>
      <div className="mt-5 metric-number">{value}</div>
      <div className="mt-2 text-sm text-[var(--mx-muted)]">{sub}</div>
    </div>
  );
}

function GaugeMetric({ label, value, sub, tone = 'var(--mx-indigo)' }) {
  const pct = clampPercent(value);
  const circumference = 2 * Math.PI * 42;
  const dash = (pct / 100) * circumference;
  return (
    <div className="mx-card p-5 flex items-center gap-5 min-h-[176px]">
      <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`${label} ${fmtPct(value)}`}>
        <circle cx="56" cy="56" r="42" fill="none" stroke="rgba(100,116,139,0.16)" strokeWidth="12" />
        <circle cx="56" cy="56" r="42" fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} transform="rotate(-90 56 56)" />
        <text x="56" y="60" textAnchor="middle" fontSize="22" fontWeight="900" fill="var(--mx-text)">{fmtPct(value)}</text>
      </svg>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">{label}</div>
        <div className="mt-2 text-sm text-[var(--mx-muted)] leading-6">{sub}</div>
      </div>
    </div>
  );
}

function HorizontalBar({ value, color = 'var(--mx-indigo)' }) {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${clampPercent(value)}%`, background: color }}></div>
    </div>
  );
}

function LineChart({ labels = [], months = [], series, mode = 'percent' }) {
  const width = 860;
  const height = 270;
  const pad = { left: 42, right: 18, top: 24, bottom: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const keys = mode === 'volume' ? ['total', 'completed', 'risk'] : ['sla', 'completion', 'risk'];
  const values = keys.flatMap((key) => series[key] || [])
    .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : (mode === 'volume' ? 10 : 100);
  const closeRange = mode !== 'volume' && values.length > 1 && maxValue - minValue <= 18 && minValue >= 60;
  const yMin = mode === 'volume' ? 0 : (closeRange ? Math.max(0, Math.floor((minValue - 8) / 5) * 5) : 0);
  const yMax = mode === 'volume'
    ? Math.max(5, Math.ceil((maxValue + Math.max(2, maxValue * 0.12)) / 5) * 5)
    : (closeRange ? Math.min(100, Math.ceil((maxValue + 6) / 5) * 5) : 100);
  const ticks = mode === 'volume'
    ? Array.from({ length: 5 }, (_, index) => Math.round(yMin + ((yMax - yMin) * index) / 4))
    : (closeRange
      ? Array.from({ length: 5 }, (_, index) => Math.round((yMin + ((yMax - yMin) * index) / 4) * 10) / 10)
      : [0, 25, 50, 75, 100]);
  const axisLabels = labels.length ? labels : months.map((month) => MONTH_NAMES[month].slice(0, 3));
  const pointCount = Math.max(axisLabels.length, ...keys.map((key) => (series[key] || []).length));
  const x = (index) => pad.left + (plotW * index) / Math.max(1, pointCount - 1);
  const y = (value) => {
    const num = Number(value || 0);
    const range = Math.max(1, yMax - yMin);
    return pad.top + plotH - (plotH * (Math.max(yMin, Math.min(yMax, num)) - yMin)) / range;
  };
  const points = (values) => values.map((value, index) => `${x(index)},${value === null ? y(yMin) : y(value)}`).join(' ');
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[720px]">
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-label" x="8" y={y(tick) + 4}>{mode === 'volume' ? tick : `${tick}%`}</text>
          </g>
        ))}
        {mode !== 'volume' && yMin <= 95 && yMax >= 95 && (
          <g>
            <line x1={pad.left} x2={width - pad.right} y1={y(95)} y2={y(95)} stroke="var(--mx-success)" opacity=".55" strokeDasharray="7 7" strokeWidth="1.5" />
            <text className="chart-label" x={width - pad.right - 70} y={y(95) - 7}>Target 95%</text>
          </g>
        )}
        {mode !== 'volume' && closeRange && (
          <text className="chart-label" x={width - pad.right - 126} y="16">Zoomed scale {yMin}-{yMax}%</text>
        )}
        {axisLabels.map((label, index) => (
          <text key={`${label}-${index}`} className="chart-label" x={x(index)} y={height - 14} textAnchor="middle">{label}</text>
        ))}
        <polyline className="chart-line" points={points(mode === 'volume' ? series.total : series.sla)} stroke={mode === 'volume' ? 'var(--mx-chart-total)' : 'var(--mx-info)'} />
        <polyline className="chart-line" points={points(mode === 'volume' ? series.completed : series.completion)} stroke={mode === 'volume' ? 'var(--mx-chart-completed)' : 'var(--mx-success)'} />
        <polyline className="chart-line" points={points(series.risk)} stroke="var(--mx-chart-risk)" />
        {(mode === 'volume' ? series.total : series.sla).map((value, index) => value !== null && <circle key={`s-${index}`} cx={x(index)} cy={y(value)} r="4" fill={mode === 'volume' ? 'var(--mx-chart-total)' : 'var(--mx-info)'} />)}
        {(mode === 'volume' ? series.completed : series.completion).map((value, index) => value !== null && <circle key={`c-${index}`} cx={x(index)} cy={y(value)} r="4" fill={mode === 'volume' ? 'var(--mx-chart-completed)' : 'var(--mx-success)'} />)}
        {series.risk.map((value, index) => value !== null && <circle key={`r-${index}`} cx={x(index)} cy={y(value)} r="4" fill="var(--mx-chart-risk)" />)}
      </svg>
    </div>
  );
}

function TabBar({ activeTab, setActiveTab, month, setMonth, year, setYear, years, loading, onLoad }) {
  return (
    <nav className="tab-strip no-print">
      <div className="tab-button-group">
        {TAB_ITEMS.map((tab) => (
          <button key={tab.id} className={`tab-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <i className={`fa-solid ${tab.icon}`}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="tab-filter-controls">
        <select className="mx-input" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Filter month">
          <option value={0}>ทุกเดือน</option>
          {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
        <select className="mx-input" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Filter year">
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="mx-btn mx-btn-primary" onClick={onLoad} disabled={loading}>
          <i className={`fa-solid ${loading ? 'fa-rotate-right fa-spin' : 'fa-arrows-rotate'} mr-2`}></i>โหลดข้อมูล
        </button>
      </div>
    </nav>
  );
}

function DataTable({ children, minWidth = 900 }) {
  return (
    <div className="table-shell overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>{children}</table>
    </div>
  );
}

function Avatar({ item, name, className = '' }) {
  const [failed, setFailed] = useState(false);
  const photo = getPhotoUrl(item);
  const initials = initialsFrom(name || item?.name || item?.empId || item?.empid);
  return (
    <div className={`avatar-ring ${className}`}>
      {photo && !failed ? (
        <img src={photo} alt={name || 'Profile'} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function DonutChart({ rows, total }) {
  const size = 190;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ['var(--mx-chart-completed)', 'var(--mx-chart-total)', 'var(--mx-warning)', 'var(--mx-chart-risk)', 'var(--mx-brass)', 'var(--mx-muted)'];
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Status distribution">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--mx-surface-strong)" strokeWidth="22" />
        {rows.map((row, index) => {
          const dash = total ? (row.total / total) * circumference : 0;
          const item = (
            <circle
              key={row.status}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += dash;
          return item;
        })}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="30" fontWeight="900" fill="var(--mx-text)">{fmtNum(total)}</text>
        <text x={size / 2} y={size / 2 + 22} textAnchor="middle" fontSize="11" fontWeight="900" fill="var(--mx-muted)">TASKS</text>
      </svg>
      <div className="donut-legend">
        {rows.map((row, index) => (
          <div key={row.status} className="donut-legend-row">
            <span style={{ background: colors[index % colors.length] }}></span>
            <strong>{row.status}</strong>
            <em>{fmtNum(row.total)} / {fmtPct(row.pct)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedWorkloadChart({ rows }) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  return (
    <div className="stacked-chart">
      {rows.slice(0, 10).map((row) => {
        const completed = row.total ? (row.completed / row.total) * 100 : 0;
        const onProcess = row.total ? (row.onProcess / row.total) * 100 : 0;
        const backlog = Math.max(0, 100 - completed - onProcess);
        return (
          <div key={row.team} className="stacked-row">
            <div className="stacked-name">
              <strong>{row.team}</strong>
              <span>{fmtNum(row.total)} tasks</span>
            </div>
            <div className="stacked-track" style={{ width: `${Math.max(18, (row.total / maxTotal) * 100)}%` }}>
              <span className="seg done" style={{ width: `${completed}%` }} title={`Completed ${fmtNum(row.completed)}`}></span>
              <span className="seg process" style={{ width: `${onProcess}%` }} title={`On process ${fmtNum(row.onProcess)}`}></span>
              <span className="seg backlog" style={{ width: `${backlog}%` }} title={`Backlog ${fmtNum(row.backlog)}`}></span>
            </div>
            <div className="stacked-meta">{fmtPct(row.completion)}</div>
          </div>
        );
      })}
      <div className="chart-legend">
        <span><i className="legend-dot done"></i>Completed</span>
        <span><i className="legend-dot process"></i>On Process</span>
        <span><i className="legend-dot backlog"></i>Backlog</span>
      </div>
    </div>
  );
}

function PerformanceScatter({ rows }) {
  const width = 720;
  const height = 380;
  const pad = { left: 54, right: 26, top: 28, bottom: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);
  const x = (value) => pad.left + (plotW * clampPercent(value)) / 100;
  const y = (value) => pad.top + plotH - (plotH * clampPercent(value)) / 100;
  const scored = rows.filter((row) => row.sla !== null && row.completion !== null).slice(0, 30);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[680px]" role="img" aria-label="SLA and completion performance scatter">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={x(tick)} x2={x(tick)} y1={pad.top} y2={height - pad.bottom} />
            <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-label" x={x(tick)} y={height - 18} textAnchor="middle">{tick}</text>
            <text className="chart-label" x="12" y={y(tick) + 4}>{tick}</text>
          </g>
        ))}
        <rect x={x(85)} y={pad.top} width={width - pad.right - x(85)} height={y(85) - pad.top} fill="var(--mx-success)" opacity=".08" />
        <line x1={x(95)} x2={x(95)} y1={pad.top} y2={height - pad.bottom} stroke="var(--mx-success)" opacity=".55" strokeDasharray="6 6" />
        <line x1={pad.left} x2={width - pad.right} y1={y(95)} y2={y(95)} stroke="var(--mx-success)" opacity=".55" strokeDasharray="6 6" />
        {scored.map((row, index) => {
          const tone = row.weightedScore >= 90 ? 'var(--mx-success)' : row.weightedScore >= 75 ? 'var(--mx-info)' : row.weightedScore >= 60 ? 'var(--mx-warning)' : 'var(--mx-danger)';
          return (
            <g key={row.name}>
              <circle cx={x(row.completion)} cy={y(row.sla)} r={6 + (row.total / maxTotal) * 16} fill={tone} opacity=".78" />
              {index < 8 && <text className="chart-label" x={x(row.completion) + 10} y={y(row.sla) - 8}>{row.person || row.team}</text>}
            </g>
          );
        })}
        <text className="axis-title" x={width / 2} y={height - 2} textAnchor="middle">Weighted Completion</text>
        <text className="axis-title" x="18" y={height / 2} textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`}>Weighted SLA</text>
      </svg>
    </div>
  );
}

function RadarChart({ teamRows }) {
  const top = [...teamRows].sort((a, b) => b.total - a.total).slice(0, 5);
  const axes = ['SLA', 'Completion', 'Health', 'Low Risk', 'Capacity'];
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
      if (axisIndex === 3) return sum + clampPercent(100 - ((row.overdue + row.risk) / Math.max(row.total, 1)) * 100);
      return sum + clampPercent((row.total / maxTotal) * 100);
    }, 0) / top.length;
    return Math.round(avg);
  });
  const polygon = values.map((value, index) => point(index, value).join(',')).join(' ');
  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[360px]" role="img" aria-label="Performance balance radar">
        {[25, 50, 75, 100].map((ring) => (
          <polygon key={ring} points={axes.map((_, index) => point(index, ring).join(',')).join(' ')} fill="none" stroke="var(--mx-line-strong)" opacity=".72" />
        ))}
        {axes.map((axis, index) => {
          const [x2, y2] = point(index, 100);
          const [lx, ly] = point(index, 116);
          return (
            <g key={axis}>
              <line x1={center} y1={center} x2={x2} y2={y2} stroke="var(--mx-line-strong)" opacity=".72" />
              <text className="chart-label" x={lx} y={ly} textAnchor="middle">{axis}</text>
            </g>
          );
        })}
        <polygon points={polygon} fill="var(--mx-info)" fillOpacity=".18" stroke="var(--mx-info)" strokeWidth="3" />
        {values.map((value, index) => {
          const [cx, cy] = point(index, value);
          return <circle key={index} cx={cx} cy={cy} r="4" fill="var(--mx-info)" />;
        })}
      </svg>
      <div className="radar-score">
        <strong>{fmtPct(Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)))}</strong>
        <span>Balance Index</span>
      </div>
    </div>
  );
}

function KpiHeatmap({ teamRows, kpiRows }) {
  const teams = teamRows.slice(0, 8);
  const kpis = kpiRows.slice(0, 8);
  const maxValue = Math.max(...teams.flatMap((team) => kpis.map((kpi) => team.items.filter((task) => mainKpi(task) === kpi.name).length)), 1);
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid" style={{ gridTemplateColumns: `180px repeat(${kpis.length}, minmax(78px, 1fr))` }}>
        <div className="heat-head">Team / KPI</div>
        {kpis.map((kpi) => <div key={kpi.name} className="heat-head vertical" title={kpi.name}>{kpi.name}</div>)}
        {teams.map((team) => (
          <React.Fragment key={team.team}>
            <div className="heat-team">{team.team}</div>
            {kpis.map((kpi) => {
              const value = team.items.filter((task) => mainKpi(task) === kpi.name).length;
              const intensity = value / maxValue;
              return (
                <div key={`${team.team}-${kpi.name}`} className="heat-cell" style={{ background: `rgba(17,109,143,${0.08 + intensity * 0.72})` }} title={`${team.team} / ${kpi.name}: ${value}`}>
                  {value || ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function OverviewPanel({ portfolio, teamRows, kpiRows, statusRows, criticalQueue, monthlyTrend, periodLabel, user, empId, tasks }) {
  const highestRisk = [...teamRows].sort((a, b) => ((b.overdueWeight * 3 + b.atRiskWeight + b.riskWeightShare) - (a.overdueWeight * 3 + a.atRiskWeight + a.riskWeightShare)))[0];
  const highestLoad = [...teamRows].sort((a, b) => b.activeWeight - a.activeWeight || b.totalWeight - a.totalWeight)[0];
  const strongestTeam = [...teamRows].sort((a, b) => (b.sla || 0) - (a.sla || 0))[0];
  const insights = [
    portfolio.overdue.length ? `${portfolio.overdue.length} overdue task(s), ${fmtWorkUnits(portfolio.overdueWeight)} work units, require attention.` : 'No overdue active tasks in the current scope.',
    portfolio.atRisk.length ? `${portfolio.atRisk.length} task(s), ${fmtWorkUnits(portfolio.atRiskWeight)} work units, are due within 3 business days.` : 'Short-term delivery risk is currently contained.',
    highestLoad ? `${highestLoad.team} carries the highest active workload at ${fmtWorkUnits(highestLoad.activeWeight)} units.` : 'No active workload data is available yet.',
    highestRisk ? `${highestRisk.team} carries the largest risk-weight share at ${fmtPct(highestRisk.riskWeightShare)}.` : 'No team pressure data is available yet.',
    strongestTeam ? `${strongestTeam.team} is the current SLA benchmark at ${fmtPct(strongestTeam.sla)}.` : 'No SLA benchmark is available yet.',
  ];

  return (
    <div className="grid gap-6">
      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <h2 className="section-title m-0">Performance Intelligence</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">{periodLabel} / {user?.name || empId || 'No employee selected'}</p>
          </div>
          <span className={`mx-badge ${healthClass(portfolio.weightedScore)}`}>Weighted Score {fmtPct(portfolio.weightedScore)}</span>
        </div>
        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="grid gap-3">
            {insights.map((insight, index) => (
              <div key={insight} className="insight-card p-5 flex items-start gap-4">
                <span className="rank-chip">{index + 1}</span>
                <div className="font-bold leading-6">{insight}</div>
              </div>
            ))}
          </div>
          <div className="mx-soft p-5 md:p-6">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Decision Lens</div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Total portfolio</span><strong>{fmtNum(tasks.length)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Work units</span><strong>{fmtWorkUnits(portfolio.totalWeight)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Active units</span><strong>{fmtWorkUnits(portfolio.activeWeight)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Risk adjusted score</span><strong>{fmtPct(portfolio.riskAdjustedScore)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">SLA breach rate</span><strong>{tasks.length ? fmtPct(Math.round((portfolio.slaFail.length / Math.max(1, portfolio.completed.length)) * 1000) / 10) : '-'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Teams monitored</span><strong>{fmtNum(teamRows.length)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Presentation URL</span><strong>/dashboard?empId={empId || 'EMPID'}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-[1fr_1fr] gap-5">
        <section className="mx-card p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="section-title m-0">Weighted Workload</h2>
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">Workload uses SubKPI percentage weight as work units, alongside task count.</p>
            </div>
            <span className={`mx-badge ${portfolio.overdueWeight ? 'status-bad' : portfolio.atRiskWeight ? 'status-warn' : 'status-good'}`}>Risk units {fmtWorkUnits(portfolio.overdueWeight + portfolio.atRiskWeight)}</span>
          </div>
          <div className="metric-strip mt-5">
            <div><span>Total Units</span><strong>{fmtWorkUnits(portfolio.totalWeight)}</strong></div>
            <div><span>Completed Units</span><strong>{fmtWorkUnits(portfolio.completedWeight)}</strong></div>
            <div><span>Active Units</span><strong>{fmtWorkUnits(portfolio.activeWeight)}</strong></div>
            <div><span>Overdue Units</span><strong>{fmtWorkUnits(portfolio.overdueWeight)}</strong></div>
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="section-title m-0">Aging Backlog</h2>
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">Active work grouped by risk age and work-unit exposure.</p>
            </div>
            <span className="mx-badge status-neutral">Active {fmtNum(portfolio.active.length)}</span>
          </div>
          <div className="aging-grid mt-5">
            {Object.entries(portfolio.aging).map(([key, bucket]) => (
              <div key={key} className={`aging-card ${key.includes('overdue') ? 'risk' : key === 'dueSoon' ? 'warn' : ''}`}>
                <span>{bucket.label}</span>
                <strong>{fmtNum(bucket.total)}</strong>
                <em>{fmtWorkUnits(bucket.weight)} units</em>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <h2 className="section-title m-0">Data Quality Watch</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">Checks missing fields that can make score and reporting less reliable.</p>
          </div>
          <span className={`mx-badge ${portfolio.dataQuality.totalIssues ? 'status-warn' : 'status-good'}`}>{fmtNum(portfolio.dataQuality.totalIssues)} issue(s)</span>
        </div>
        <div className="quality-grid mt-5">
          {portfolio.dataQuality.checks.map((check) => (
            <div key={check.key} className={`quality-card ${check.items.length ? 'warn' : 'good'}`}>
              <span>{check.label}</span>
              <strong>{fmtNum(check.items.length)}</strong>
              <em>{check.items.length ? 'Needs review' : 'Ready'}</em>
            </div>
          ))}
        </div>
      </section>

      <div className="presentation-grid">
        <section className="mx-card p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="section-title m-0">Execution Trend</h2>
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">{monthlyTrend.granularity === 'day' ? 'ผลงานจริงรายวันในเดือนและปีที่เลือก แยกงานเข้า/เริ่ม งานเสร็จจริง และงานเสี่ยง/เกินกำหนด' : 'ผลงานจริงรายเดือนในปีที่เลือก แยกงานเข้า/เริ่ม งานเสร็จจริง และงานเสี่ยง/เกินกำหนด'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="mx-badge status-info">งานเข้า/เริ่ม</span>
              <span className="mx-badge status-good">เสร็จจริง</span>
              <span className="mx-badge status-bad">เสี่ยง/เกินกำหนด</span>
            </div>
          </div>
          <div className="mt-5"><LineChart labels={monthlyTrend.labels} months={monthlyTrend.months} series={monthlyTrend.series} mode="volume" /></div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Portfolio Composition</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Status distribution and workload proportions.</p>
          <DonutChart rows={statusRows} total={tasks.length} />
        </section>
      </div>

      <div className="grid 2xl:grid-cols-[0.9fr_1.1fr] gap-5">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Performance Balance</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">A blended radar of SLA, completion, health, risk control, and capacity.</p>
          <RadarChart teamRows={teamRows} />
        </section>
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Team Workload Mix</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Completed, on-process, and backlog by team.</p>
          <StackedWorkloadChart rows={teamRows} />
        </section>
      </div>

      <div className="grid 2xl:grid-cols-[1.15fr_0.85fr] gap-5 items-start">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Unified SLA + KPI Control Board</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Team-level control view for SLA, completion, backlog, and risk.</p>
          <div className="grid gap-4">
            {teamRows.slice(0, 8).map((row) => (
              <div key={row.team} className="control-row">
                <div className="min-w-0">
                  <div className="font-black truncate">{row.team}</div>
                  <div className="mt-1 text-xs text-[var(--mx-muted)]">Top KPI: {row.topKpi} / units {fmtWorkUnits(row.totalWeight)}</div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-black mb-2"><span>SLA</span><span>{fmtPct(row.sla)}</span></div>
                  <HorizontalBar value={row.sla} color="var(--mx-info)" />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-black mb-2"><span>Completion</span><span>{fmtPct(row.completion)}</span></div>
                  <HorizontalBar value={row.completion} color="var(--mx-success)" />
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <span className={`mx-badge ${row.overdue ? 'status-bad' : row.risk ? 'status-warn' : 'status-good'}`}>{row.overdue} late / {row.risk} risk</span>
                  <span className="mx-badge status-info">active units {fmtWorkUnits(row.activeWeight)}</span>
                  <span className="mx-badge status-neutral">{fmtNum(row.backlog)} backlog</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Priority Watchlist</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Active work with the highest near-term SLA exposure.</p>
          <div className="priority-watchlist-scroll grid gap-3">
            {criticalQueue.map(({ task, days, weight }) => {
              const [label, klass] = riskBadge(days);
              return (
                <div key={task.id || `${task.job}-${task.deadline}`} className="insight-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-extrabold truncate">{extractJobCode(task.job)}</div>
                      <div className="mt-1 text-sm text-[var(--mx-muted)] line-clamp-2">{task.job || '-'}</div>
                    </div>
                    <span className={`mx-badge ${klass}`}>{label}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="mx-badge status-neutral">{teamName(task)}</span>
                    <span className="mx-badge status-info">weight {weight}</span>
                    <span className="mx-badge status-neutral">deadline {fmtDate(task.deadline)}</span>
                  </div>
                </div>
              );
            })}
            {!criticalQueue.length && <div className="mx-soft p-5 text-center text-[var(--mx-muted)]">No critical active work in this scope.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function TeamDetailModal({ team, holidays = [], onClose }) {
  if (!team) return null;
  const members = team.members || [];
  const kpiBreakdown = Object.entries(groupBy(team.items || [], mainKpi))
    .map(([name, items]) => ({
      name,
      total: items.length,
      active: items.filter(isActive).length,
      completed: items.filter(isCompleted).length,
      fail: items.filter(isCompletedLate).length,
      scores: calcWeightedScores(items),
    }))
    .sort((a, b) => b.total - a.total || b.fail - a.fail)
    .slice(0, 12);
  const peopleBreakdown = Object.entries(groupBy(team.items || [], personName))
    .map(([name, items]) => {
      const portfolio = buildPortfolio(items, holidays);
      const member = members.find((item) => item.name === name);
      return {
        name,
        profile: member?.profile || items.find((task) => getPhotoUrl(task)) || null,
        total: items.length,
        active: portfolio.active.length,
        completed: portfolio.completed.length,
        overdue: portfolio.overdue.length,
        slaFail: portfolio.slaFail.length,
        score: portfolio.weightedScore,
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0) || b.total - a.total)
    .slice(0, 10);
  const urgent = (team.items || [])
    .filter(isActive)
    .map((task) => ({ task, days: daysUntil(task, holidays), weight: taskWeight(task) }))
    .filter((item) => item.days !== null)
    .sort((a, b) => a.days - b.days || b.weight - a.weight)
    .slice(0, 10);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card team-modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close no-print" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Team Drilldown</div>
            <h2 className="section-title mt-2 mb-1">{team.team}</h2>
            <div className="flex flex-wrap gap-2">
              <span className={`mx-badge ${healthClass(team.health)}`}>Health {team.health}</span>
              <span className="mx-badge status-neutral">Top KPI: {team.topKpi}</span>
            </div>
            <div className="team-member-strip mt-5" aria-label={`${team.team} members`}>
              <div className="team-member-avatars">
                {members.slice(0, 9).map((member) => (
                  <Avatar key={member.key || member.name} item={member.profile || member} name={member.name} className="team-member-avatar" />
                ))}
                {members.length > 9 && <span className="team-member-more">+{members.length - 9}</span>}
              </div>
              <div className="team-member-copy">
                <strong>{fmtNum(members.length)} team member{members.length === 1 ? '' : 's'}</strong>
                <span>{members.slice(0, 4).map((member) => member.name).join(', ') || 'No member profile found'}</span>
              </div>
            </div>
          </div>
          <div className="mini-metric-grid modal-metrics">
            <div><span>Total</span><strong>{fmtNum(team.total)}</strong></div>
            <div><span>Backlog</span><strong>{fmtNum(team.backlog)}</strong></div>
            <div><span>W.SLA</span><strong>{fmtPct(team.sla)}</strong></div>
            <div><span>SLA Fail</span><strong>{fmtNum(team.slaFail)}</strong></div>
          </div>
        </div>

        <div className="mt-6 team-modal-grid">
          <section className="mx-soft p-5">
            <h3 className="m-0 text-lg font-black">KPI Mix ของทีม</h3>
            <div className="mt-4 grid gap-3 team-modal-scroll">
              {kpiBreakdown.map((row) => (
                <div key={row.name}>
                  <div className="flex justify-between gap-3 mb-2 text-sm">
                    <strong className="truncate">{row.name}</strong>
                    <span>{fmtNum(row.total)} งาน / SLA {fmtPct(row.scores.sla)}</span>
                  </div>
                  <HorizontalBar value={team.total ? Math.round((row.total / team.total) * 1000) / 10 : 0} color={row.fail ? 'var(--mx-warning)' : 'var(--mx-info)'} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="mx-badge status-neutral">Active {fmtNum(row.active)}</span>
                    <span className="mx-badge status-good">Done {fmtNum(row.completed)}</span>
                    <span className={`mx-badge ${row.fail ? 'status-bad' : 'status-good'}`}>Fail {fmtNum(row.fail)}</span>
                  </div>
                </div>
              ))}
              {!kpiBreakdown.length && <div className="text-sm text-[var(--mx-muted)]">ไม่มีข้อมูล KPI ของทีมนี้</div>}
            </div>
          </section>

          <section className="mx-soft p-5">
            <h3 className="m-0 text-lg font-black">People Performance</h3>
            <div className="mt-4 grid gap-3 team-modal-scroll">
              {peopleBreakdown.map((person, index) => (
                <div key={person.name} className="team-person-row">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar item={person.profile || person} name={person.name} className="team-person-avatar" />
                    <div className="min-w-0">
                      <div className="font-black truncate">{String(index + 1).padStart(2, '0')} {person.name}</div>
                      <div className="mt-1 text-xs text-[var(--mx-muted)]">{fmtNum(person.active)} active / {fmtNum(person.overdue)} overdue</div>
                    </div>
                  </div>
                  <span className={`mx-badge ${healthClass(person.score)}`}>{fmtPct(person.score)}</span>
                </div>
              ))}
              {!peopleBreakdown.length && <div className="text-sm text-[var(--mx-muted)]">ไม่มีข้อมูลรายบุคคลของทีมนี้</div>}
            </div>
          </section>
        </div>

        <section className="mt-5 mx-soft p-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h3 className="m-0 text-lg font-black">Urgent Team Queue</h3>
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">งาน active ที่ใกล้ครบกำหนดหรือมีความเสี่ยง SLA ของทีมนี้</p>
            </div>
            <span className="mx-badge status-info">{fmtNum(urgent.length)} items</span>
          </div>
          <div className="mt-4 team-urgent-grid">
            {urgent.map(({ task, days, weight }) => {
              const [label, klass] = riskBadge(days);
              return (
                <div key={task.id || `${task.job}-${task.deadline}`} className="insight-card p-3">
                  <div className="flex justify-between gap-3">
                    <strong className="truncate">{extractJobCode(task.job)}</strong>
                    <span className={`mx-badge ${klass}`}>{label}</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--mx-muted)] line-clamp-2">{task.job || '-'}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="mx-badge status-neutral">{personName(task)}</span>
                    <span className="mx-badge status-neutral">{fmtDate(task.deadline)}</span>
                    <span className="mx-badge status-info">weight {weight}</span>
                  </div>
                </div>
              );
            })}
            {!urgent.length && <div className="text-sm text-[var(--mx-muted)]">ไม่มีงานเร่งด่วนของทีมนี้</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function TeamsPanel({ teamRows, holidays = [] }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamBandFilter, setTeamBandFilter] = useState('all');
  const [teamSort, setTeamSort] = useState({ key: 'total', direction: 'desc' });
  const filteredTeams = sortRows(teamRows.filter((row) =>
    matchesSearch(row, ['team', 'topKpi'], teamSearch) && matchesBand(row.sla, teamBandFilter)
  ), teamSort);
  return (
    <div className="grid gap-6">
      <div className="detail-grid">
        {filteredTeams.slice(0, 8).map((row, index) => (
          <button key={row.team} className="mx-card leader-card team-card-button p-5 text-left" onClick={() => setSelectedTeam(row)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Rank {String(index + 1).padStart(2, '0')} / Team</div>
                <h3 className="mt-2 mb-0 text-xl font-black truncate">{row.team}</h3>
              </div>
              <span className={`mx-badge ${healthClass(row.health)}`}>{row.health}</span>
            </div>
            <div className="mini-metric-grid mt-5">
              <div><span>Total</span><strong>{fmtNum(row.total)}</strong></div>
              <div><span>Units</span><strong>{fmtWorkUnits(row.totalWeight)}</strong></div>
              <div><span>Done</span><strong>{fmtNum(row.completed)}</strong></div>
              <div><span>Risk Units</span><strong>{fmtWorkUnits(row.overdueWeight + row.atRiskWeight)}</strong></div>
            </div>
            <div className="mt-5 grid gap-3">
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.SLA</span><span>{fmtPct(row.sla)}</span></div><HorizontalBar value={row.sla} color="var(--mx-info)" /></div>
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.Completion</span><span>{fmtPct(row.completion)}</span></div><HorizontalBar value={row.completion} color="var(--mx-success)" /></div>
            </div>
            <div className="team-card-cta mt-5">
              <span>เปิดข้อมูลเชิงลึก</span>
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
            </div>
          </button>
        ))}
      </div>

      <section className="mx-card p-5 md:p-7">
        <h2 className="section-title m-0">Completion Rate by Team</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Operational workload stack with completion proportion and remaining backlog.</p>
        <StackedWorkloadChart rows={teamRows} />
      </section>

      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="section-title m-0">Team SLA Summary</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">Detailed team matrix aligned with the SPDS performance dashboard structure.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 no-print">
            <input className="mx-input sm:!w-72" value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} placeholder="Search team or top KPI" />
            <select className="mx-input sm:!w-44" value={teamBandFilter} onChange={(e) => setTeamBandFilter(e.target.value)}>
              <option value="all">All bands</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="monitor">Monitor</option>
              <option value="critical">Critical</option>
              <option value="unrated">Unrated</option>
            </select>
          </div>
        </div>
        <p className="mt-4 mb-5 text-sm text-[var(--mx-muted)]">Showing {fmtNum(filteredTeams.length)} of {fmtNum(teamRows.length)} teams.</p>
        <DataTable minWidth={1220}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
              <th className="p-4">Rank</th>
              <SortHeader label="Team" sortKey="team" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Total" sortKey="total" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Units" sortKey="totalWeight" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Completed" sortKey="completed" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Active Units" sortKey="activeWeight" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Backlog" sortKey="backlog" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="On Process" sortKey="onProcess" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="SLA Pass" sortKey="slaPass" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="SLA Fail" sortKey="slaFail" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="W.SLA" sortKey="sla" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="W.Completion" sortKey="completion" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <th className="p-4">Band</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mx-line)]">
            {filteredTeams.map((row, index) => (
              <tr key={row.team}>
                <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td><td className="p-4 font-black">{row.team}</td><td className="p-4">{fmtNum(row.total)}</td><td className="p-4 font-bold">{fmtWorkUnits(row.totalWeight)}</td><td className="p-4">{fmtNum(row.completed)}</td><td className="p-4 font-bold">{fmtWorkUnits(row.activeWeight)}</td><td className="p-4">{fmtNum(row.backlog)}</td><td className="p-4">{fmtNum(row.onProcess)}</td><td className="p-4">{fmtNum(row.slaPass)}</td><td className="p-4">{fmtNum(row.slaFail)}</td><td className="p-4 font-bold">{fmtPct(row.sla)}</td><td className="p-4 font-bold">{fmtPct(row.completion)}</td><td className="p-4"><span className={`mx-badge ${healthClass(row.sla)}`}>{performanceLabel(row.sla)}</span></td>
              </tr>
            ))}
            {!filteredTeams.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="13">No team records match these filters.</td></tr>}
          </tbody>
        </DataTable>
      </section>
      <TeamDetailModal team={selectedTeam} holidays={holidays} onClose={() => setSelectedTeam(null)} />
    </div>
  );
}

function EmployeeDetailModal({ person, holidays = [], onClose }) {
  if (!person) return null;
  const kpiBreakdown = Object.entries(groupBy(person.items, mainKpi))
    .map(([name, items]) => ({ name, total: items.length, scores: calcWeightedScores(items), completed: items.filter(isCompleted).length, fail: items.filter(isCompletedLate).length }))
    .sort((a, b) => b.total - a.total);
  const statusBreakdown = Object.entries(groupBy(person.items, (task) => task.status || 'Unknown'))
    .map(([status, items]) => ({ status, total: items.length, pct: person.total ? Math.round((items.length / person.total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);
  const completedTasks = person.items
    .filter(isCompleted)
    .sort((a, b) => new Date(b.completiondate || b.deadline || 0) - new Date(a.completiondate || a.deadline || 0));
  const recentCompleted = completedTasks.slice(0, 6);
  const slaFailTasks = person.items
    .filter(isCompletedLate)
    .map((task) => ({ task, days: businessDaysBetween(task.deadline, task.completiondate, holidays), weight: taskWeight(task) }))
    .sort((a, b) => Math.abs(b.days || 0) - Math.abs(a.days || 0) || b.weight - a.weight)
    .slice(0, 6);
  const completionDays = completedTasks
    .map((task) => businessDaysBetween(task.startdate || task.created_at || task.deadline, task.completiondate || task.deadline, holidays))
    .filter((value) => value !== null && Number.isFinite(value) && value >= 0);
  const avgCompletionDays = completionDays.length
    ? Math.round((completionDays.reduce((sum, value) => sum + value, 0) / completionDays.length) * 10) / 10
    : null;
  const maxCompletionDays = completionDays.length ? Math.max(...completionDays) : null;
  const activeCount = person.items.filter(isActive).length;
  const pendingCount = person.items.filter((task) => normalizeStatus(task) === 'pending').length;
  const onHoldCount = person.items.filter((task) => normalizeStatus(task) === 'on hold' || normalizeStatus(task) === 'on_hold').length;
  const urgent = person.items
    .filter(isActive)
    .map((task) => ({ task, days: daysUntil(task, holidays), weight: taskWeight(task) }))
    .filter((item) => item.days !== null)
    .sort((a, b) => a.days - b.days || b.weight - a.weight)
    .slice(0, 8);
  const topKpiRows = kpiBreakdown.slice(0, 6);
  const topStatusRows = statusBreakdown.slice(0, 4);
  const topUrgent = urgent.slice(0, 4);
  const topRecentCompleted = recentCompleted.slice(0, 4);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card employee-modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close no-print" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
        <div className="employee-modal-header">
          <div className="employee-profile-strip">
            <Avatar item={person.profile || person} name={person.person} className="modal-avatar" />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Employee Drilldown</div>
              <h2 className="section-title mt-2 mb-1">{person.person}</h2>
              <div className="flex flex-wrap gap-2">
                <span className="mx-badge status-neutral">{person.team}</span>
                <span className={`mx-badge ${healthClass(person.weightedScore)}`}>Score {fmtPct(person.weightedScore)}</span>
              </div>
            </div>
          </div>
          <div className="employee-score-panel">
            <span>Weighted Score</span>
            <strong>{fmtPct(person.weightedScore)}</strong>
          </div>
        </div>
        <div className="employee-summary-grid">
          <div><span>Total Work</span><strong>{fmtNum(person.total)}</strong></div>
          <div><span>Total Units</span><strong>{fmtWorkUnits(person.totalWeight)}</strong></div>
          <div><span>Completed</span><strong>{fmtNum(person.completed)}</strong></div>
          <div><span>Active</span><strong>{fmtNum(activeCount)}</strong></div>
          <div><span>Team Load</span><strong>{fmtPct(person.workloadShare)}</strong></div>
          <div><span>Risk Share</span><strong>{fmtPct(person.riskWeightShare)}</strong></div>
          <div><span>Avg Close</span><strong>{avgCompletionDays === null ? '-' : `${avgCompletionDays}d`}</strong></div>
        </div>
        <div className="employee-detail-layout">
          <section className="mx-soft p-5 employee-status-panel">
            <div className="panel-heading-row">
              <div>
                <h3 className="m-0 text-lg font-black">Status Breakdown</h3>
                <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">งานของคนนี้กระจายตามสถานะอะไรบ้าง</p>
              </div>
              <span className="mx-badge status-neutral">{fmtNum(pendingCount)} pending / {fmtNum(onHoldCount)} hold</span>
            </div>
            <div className="mt-4 grid gap-3">
              {topStatusRows.map((row) => (
                <div key={row.status}>
                  <div className="flex justify-between gap-3 mb-2 text-sm">
                    <strong className="truncate">{row.status}</strong>
                    <span>{fmtNum(row.total)} / {fmtPct(row.pct)}</span>
                  </div>
                  <HorizontalBar value={row.pct} color={statusClass(row.status).includes('good') ? 'var(--mx-success)' : statusClass(row.status).includes('warn') ? 'var(--mx-warning)' : statusClass(row.status).includes('bad') ? 'var(--mx-danger)' : 'var(--mx-info)'} />
                </div>
              ))}
            </div>
          </section>
          <section className="mx-soft p-5 employee-speed-panel">
            <h3 className="m-0 text-lg font-black">Completion Health</h3>
            <p className="mt-1 mb-4 text-sm text-[var(--mx-muted)]">วัดจากวันเริ่มงานถึงวันปิดงาน เฉพาะงานที่เสร็จแล้ว</p>
            <div className="employee-compact-metrics">
              <div><span>Avg Days</span><strong>{avgCompletionDays === null ? '-' : avgCompletionDays}</strong></div>
              <div><span>Slowest</span><strong>{maxCompletionDays === null ? '-' : maxCompletionDays}</strong></div>
              <div><span>On-Time</span><strong>{fmtNum(person.slaPass)}</strong></div>
              <div><span>Late</span><strong>{fmtNum(person.slaFail)}</strong></div>
            </div>
          </section>
          <section className="mx-soft p-5 employee-main-panel">
            <div className="panel-heading-row">
              <div>
                <h3 className="m-0 text-lg font-black">KPI Ownership Mix</h3>
                <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">สัดส่วนงานหลักที่คนนี้รับผิดชอบและ SLA ของแต่ละกลุ่ม</p>
              </div>
              <span className="mx-badge status-neutral">{fmtNum(kpiBreakdown.length)} groups</span>
            </div>
            <div className="mt-4 grid gap-3">
              {topKpiRows.map((row) => (
                <div key={row.name} className="employee-kpi-row">
                  <div className="min-w-0">
                    <div className="flex justify-between gap-3 mb-2 text-sm">
                      <strong className="truncate">{row.name}</strong>
                      <span>{fmtNum(row.total)} jobs</span>
                    </div>
                    <HorizontalBar value={person.total ? Math.round((row.total / person.total) * 1000) / 10 : 0} color={row.fail ? 'var(--mx-warning)' : 'var(--mx-info)'} />
                  </div>
                  <div className={`employee-kpi-score ${row.fail ? 'warn' : ''}`}>
                    <span>SLA</span>
                    <strong>{fmtPct(row.scores.sla)}</strong>
                  </div>
                </div>
              ))}
              {!topKpiRows.length && <div className="text-sm text-[var(--mx-muted)]">No KPI ownership records for this person.</div>}
            </div>
          </section>
          <section className="mx-soft p-5 employee-attention-panel">
            <div className="panel-heading-row">
              <div>
                <h3 className="m-0 text-lg font-black">Attention Queue</h3>
                <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">งานที่ยัง active และใกล้ถึงกำหนดที่สุด</p>
              </div>
              <span className={`mx-badge ${activeCount ? 'status-warn' : 'status-good'}`}>{fmtNum(activeCount)} active</span>
            </div>
            <div className="employee-work-list mt-4">
              {topUrgent.map(({ task, days, weight }) => {
                const [label, klass] = riskBadge(days);
                return (
                  <div key={task.id || `${task.job}-${task.deadline}`} className="employee-work-row">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <strong className="truncate">{extractJobCode(task.job)}</strong>
                        <span className={`mx-badge ${klass}`}>{label}</span>
                      </div>
                      <div className="mt-2 text-xs text-[var(--mx-muted)] line-clamp-2">{task.job || '-'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="mx-badge status-neutral">{fmtDate(task.deadline)}</span>
                        <span className="mx-badge status-info">weight {weight}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!topUrgent.length && <div className="employee-empty-state">No urgent active work for this person.</div>}
            </div>
          </section>
          <section className="mx-soft p-5 employee-recent-panel">
            <div className="panel-heading-row">
              <h3 className="m-0 text-lg font-black">Recent Completed Work</h3>
              <span className="mx-badge status-good">{fmtNum(person.completed)} done</span>
            </div>
            <div className="employee-work-list mt-4">
              {topRecentCompleted.map((task) => (
                <div key={task.id || `${task.job}-${task.completiondate}`} className="employee-work-row compact">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="truncate">{extractJobCode(task.job)}</strong>
                      <span className={`mx-badge ${isCompletedLate(task) ? 'status-bad' : 'status-good'}`}>{isCompletedLate(task) ? 'late' : 'on time'}</span>
                    </div>
                    <div className="mt-2 text-xs text-[var(--mx-muted)] line-clamp-2">{task.job || '-'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="mx-badge status-neutral">done {fmtDate(task.completiondate)}</span>
                      <span className="mx-badge status-info">{subKpi(task)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!topRecentCompleted.length && <div className="employee-empty-state">No completed work in this period.</div>}
            </div>
          </section>
          <section className="mx-soft p-5 employee-fail-panel">
            <div className="panel-heading-row">
              <h3 className="m-0 text-lg font-black">SLA Fail Detail</h3>
              <span className={`mx-badge ${slaFailTasks.length ? 'status-bad' : 'status-good'}`}>{fmtNum(slaFailTasks.length)} records</span>
            </div>
            <div className="employee-work-list mt-4">
              {slaFailTasks.map(({ task, days, weight }) => (
                <div key={task.id || `${task.job}-${task.completiondate}-fail`} className="employee-work-row compact">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="truncate">{extractJobCode(task.job)}</strong>
                      <span className="mx-badge status-bad">{Math.abs(days || 0)} bd late</span>
                    </div>
                    <div className="mt-2 text-xs text-[var(--mx-muted)] line-clamp-2">{task.job || '-'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="mx-badge status-neutral">deadline {fmtDate(task.deadline)}</span>
                      <span className="mx-badge status-neutral">done {fmtDate(task.completiondate)}</span>
                      <span className="mx-badge status-info">weight {weight}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!slaFailTasks.length && <div className="employee-empty-state success">No SLA fail records for this person.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function EmployeesPanel({ personRows, teams, personTeamFilter, setPersonTeamFilter, tasks, selectedPerson, setSelectedPerson, holidays = [] }) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeBandFilter, setEmployeeBandFilter] = useState('all');
  const [employeeSort, setEmployeeSort] = useState({ key: 'weightedScore', direction: 'desc' });
  const filtered = sortRows((personTeamFilter === 'all' ? personRows : personRows.filter((row) => row.team === personTeamFilter))
    .filter((row) => matchesSearch(row, ['person', 'team', 'topKpi'], employeeSearch))
    .filter((row) => matchesBand(row.weightedScore, employeeBandFilter)), employeeSort);
  return (
    <div className="grid gap-6">
      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="section-title m-0">Employee Performance Deep Dive</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">Filter by team, inspect workload, SLA, backlog, and top KPI ownership.</p>
          </div>
          <div className="filter-pills no-print">
            <button className={`pill ${personTeamFilter === 'all' ? 'active' : ''}`} onClick={() => setPersonTeamFilter('all')}>All Teams</button>
            {teams.map((team) => <button key={team} className={`pill ${personTeamFilter === team ? 'active' : ''}`} onClick={() => setPersonTeamFilter(team)}>{team}</button>)}
          </div>
        </div>
        <div className="mt-4 grid md:grid-cols-[1fr_220px] gap-2 no-print">
          <input className="mx-input" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Search employee, team, or top KPI" />
          <select className="mx-input" value={employeeBandFilter} onChange={(e) => setEmployeeBandFilter(e.target.value)}>
            <option value="all">All bands</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="monitor">Monitor</option>
            <option value="critical">Critical</option>
            <option value="unrated">Unrated</option>
          </select>
        </div>
      </section>

      <div className="employee-grid">
        {filtered.slice(0, 36).map((row, index) => (
          <button key={row.name} className="mx-card employee-card p-5 text-left" onClick={() => setSelectedPerson(row)}>
            <div className="flex items-start gap-4">
              <Avatar item={row.profile || row} name={row.person} />
              <div className="min-w-0 flex-1">
                <div className="font-black truncate">{row.person}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="mx-badge status-neutral">{row.team}</span>
                  <span className={`mx-badge ${healthClass(row.sla)}`}>Rank {index + 1}</span>
                </div>
              </div>
            </div>
            <div className="mini-metric-grid mt-5">
              <div><span>Total</span><strong>{fmtNum(row.total)}</strong></div>
              <div><span>Units</span><strong>{fmtWorkUnits(row.totalWeight)}</strong></div>
              <div><span>Done</span><strong>{fmtNum(row.completed)}</strong></div>
              <div><span>Risk Share</span><strong>{fmtPct(row.riskWeightShare)}</strong></div>
            </div>
            <div className="mt-5 grid gap-3">
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.SLA</span><span>{fmtPct(row.sla)}</span></div><HorizontalBar value={row.sla} color="var(--mx-info)" /></div>
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.Completion</span><span>{fmtPct(row.completion)}</span></div><HorizontalBar value={row.completion} color="var(--mx-success)" /></div>
            </div>
            <div className="mt-5 mx-soft p-3 text-xs">
              <div className="font-black">Top KPI</div>
              <div className="mt-1 text-[var(--mx-muted)]">{row.topKpi} / {fmtNum(row.topKpiCount)} task(s) / team load {fmtPct(row.workloadShare)}</div>
            </div>
          </button>
        ))}
      </div>

      <section className="mx-card p-5 md:p-7">
        <h2 className="section-title m-0">Employee Leaderboard Matrix</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">{fmtNum(filtered.length)} people from {fmtNum(tasks.length)} task records.</p>
        <DataTable minWidth={1220}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
              <th className="p-4">Rank</th>
              <SortHeader label="Name" sortKey="person" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Team" sortKey="team" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Total" sortKey="total" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Units" sortKey="totalWeight" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Team Load" sortKey="workloadShare" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Completed" sortKey="completed" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="SLA Pass" sortKey="slaPass" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="SLA Fail" sortKey="slaFail" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="W.SLA" sortKey="sla" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="W.Completion" sortKey="completion" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Performance" sortKey="weightedScore" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mx-line)]">
            {filtered.map((row, index) => (
              <tr key={row.name}>
                <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td>
                <td className="p-4 font-black">{row.person}</td>
                <td className="p-4"><span className="mx-badge status-neutral">{row.team}</span></td>
                <td className="p-4">{fmtNum(row.total)}</td><td className="p-4 font-bold">{fmtWorkUnits(row.totalWeight)}</td><td className="p-4">{fmtPct(row.workloadShare)}</td><td className="p-4">{fmtNum(row.completed)}</td><td className="p-4">{fmtNum(row.slaPass)}</td><td className="p-4">{fmtNum(row.slaFail)}</td><td className="p-4 font-bold">{fmtPct(row.sla)}</td><td className="p-4 font-bold">{fmtPct(row.completion)}</td>
                <td className="p-4"><span className={`mx-badge ${healthClass(row.weightedScore)}`}>{row.weightedScore >= 90 ? 'Excellent' : row.weightedScore >= 75 ? 'Good' : row.weightedScore >= 60 ? 'Monitor' : 'Critical'}</span></td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="12">No employee records match these filters.</td></tr>}
          </tbody>
        </DataTable>
      </section>
      <EmployeeDetailModal person={selectedPerson} holidays={holidays} onClose={() => setSelectedPerson(null)} />
    </div>
  );
}

function KpiAnalysisPanel({ kpiRows, personRows, teamRows }) {
  const [analysisSearch, setAnalysisSearch] = useState('');
  const [analysisBandFilter, setAnalysisBandFilter] = useState('all');
  const filteredKpiRows = kpiRows
    .filter((row) => matchesSearch(row, ['name'], analysisSearch))
    .filter((row) => matchesBand(row.sla, analysisBandFilter));
  const filteredPersonRows = personRows
    .filter((row) => matchesSearch(row, ['person', 'team', 'topKpi'], analysisSearch))
    .filter((row) => matchesBand(row.weightedScore, analysisBandFilter));
  const filteredTeamRows = teamRows
    .filter((row) => matchesSearch(row, ['team', 'topKpi'], analysisSearch))
    .filter((row) => matchesBand(row.sla, analysisBandFilter));
  const totalTasks = kpiRows.reduce((sum, row) => sum + row.total, 0);
  const topPerformer = [...personRows].filter((row) => row.weightedScore !== null).sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total)[0];
  const bestTeam = [...teamRows].filter((row) => row.sla !== null).sort((a, b) => (b.sla || 0) - (a.sla || 0) || b.total - a.total)[0];
  const avgTasks = personRows.length ? Math.round(personRows.reduce((sum, row) => sum + row.total, 0) / personRows.length) : 0;
  const highRiskKpis = [...filteredKpiRows].sort((a, b) => (b.slaFail - a.slaFail) || (b.active - a.active) || b.total - a.total).slice(0, 8);
  const employeeLeaders = [...filteredPersonRows]
    .filter((row) => row.sla !== null || row.completion !== null)
    .sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total)
    .slice(0, 12);
  const teamKpiRows = filteredTeamRows.slice(0, 10).map((team) => {
    const groups = Object.entries(groupBy(team.items || [], mainKpi))
      .map(([name, items]) => ({
        name,
        total: items.length,
        fail: items.filter(isCompletedLate).length,
        scores: calcWeightedScores(items),
      }))
      .sort((a, b) => b.total - a.total || b.fail - a.fail)
      .slice(0, 3);
    return { ...team, groups };
  });
  return (
    <div className="grid gap-6">
      <section className="mx-card p-5 md:p-7 kpi-intelligence">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
          <div>
            <p className="eyebrow mb-2">KPI Intelligence</p>
            <h2 className="section-title m-0">ภาพวิเคราะห์ KPI สำหรับผู้บริหาร</h2>
            <p className="mt-2 mb-0 text-sm text-[var(--mx-muted)]">รวมสัดส่วนงาน จุดเสี่ยง ผลงานรายบุคคล และความเข้มข้นของ KPI รายทีมในมุมเดียว</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 no-print">
            <input className="mx-input sm:!w-80" value={analysisSearch} onChange={(e) => setAnalysisSearch(e.target.value)} placeholder="Search KPI, team, employee" />
            <select className="mx-input sm:!w-44" value={analysisBandFilter} onChange={(e) => setAnalysisBandFilter(e.target.value)}>
              <option value="all">All bands</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="monitor">Monitor</option>
              <option value="critical">Critical</option>
              <option value="unrated">Unrated</option>
            </select>
            <span className="mx-badge status-info">Portfolio {fmtNum(totalTasks)} tasks</span>
          </div>
        </div>
        <div className="kpi-insight-grid">
          <div className="kpi-insight-card">
            <span>หมวด KPI</span>
            <strong>{fmtNum(kpiRows.length)}</strong>
            <em>Main categories</em>
          </div>
          <div className="kpi-insight-card">
            <span>ผู้ทำคะแนนสูงสุด</span>
            <strong>{topPerformer?.person || '-'}</strong>
            <em>{topPerformer ? `Performance ${fmtPct(topPerformer.weightedScore)}` : 'ยังไม่มีคะแนน'}</em>
          </div>
          <div className="kpi-insight-card">
            <span>ทีม SLA ดีสุด</span>
            <strong>{bestTeam?.team || '-'}</strong>
            <em>{bestTeam ? `W.SLA ${fmtPct(bestTeam.sla)}` : 'ยังไม่มีคะแนนทีม'}</em>
          </div>
          <div className="kpi-insight-card">
            <span>เฉลี่ยงาน/คน</span>
            <strong>{fmtNum(avgTasks)}</strong>
            <em>{fmtNum(personRows.length)} คนในช่วงที่เลือก</em>
          </div>
        </div>
      </section>

      <div className="kpi-analysis-grid">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">สัดส่วน KPI Portfolio</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">เรียงตามปริมาณงาน พร้อมคุณภาพการส่งมอบของแต่ละหมวด KPI</p>
          <div className="kpi-portfolio-list">
            {filteredKpiRows.slice(0, 10).map((row, index) => (
              <div key={row.name} className="kpi-row-card">
                <div className="kpi-row-rank">{String(index + 1).padStart(2, '0')}</div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="font-black break-words leading-tight">{row.name}</div>
                    <span className={`mx-badge ${healthClass(row.sla)}`}>{fmtPct(row.sla)}</span>
                  </div>
                  <HorizontalBar value={row.share} color={row.sla >= 95 ? 'var(--mx-success)' : row.sla >= 85 ? 'var(--mx-warning)' : 'var(--mx-danger)'} />
                </div>
                <div className="kpi-row-stats">
                  <span><b>{fmtPct(row.share)}</b><em>Share</em></span>
                  <span><b>{fmtNum(row.total)}</b><em>Total</em></span>
                  <span><b>{fmtWorkUnits(row.totalWeight)}</b><em>Units</em></span>
                  <span><b>{fmtPct(row.completion)}</b><em>Done</em></span>
                  <span><b>{fmtNum(row.slaFail)}</b><em>Fail</em></span>
                </div>
              </div>
            ))}
            {!filteredKpiRows.length && <div className="text-sm text-[var(--mx-muted)]">No KPI portfolio records match these filters.</div>}
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">KPI Watchlist</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">หมวด KPI ที่มีงานเกินกำหนดหรือยัง active สูง ควรถูกติดตามก่อน</p>
          <div className="grid gap-3">
            {highRiskKpis.map((row) => (
              <div key={row.name} className="watch-row">
                <div className="min-w-0">
                  <div className="font-black line-clamp-2">{row.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="mx-badge status-neutral">Active {fmtNum(row.active)}</span>
                    <span className="mx-badge status-info">Units {fmtWorkUnits(row.totalWeight)}</span>
                    <span className={`mx-badge ${row.slaFail > 0 ? 'status-bad' : 'status-good'}`}>Fail {fmtNum(row.slaFail)}</span>
                  </div>
                </div>
                <div className="watch-score">
                  <strong>{fmtPct(row.sla)}</strong>
                  <span>SLA</span>
                </div>
              </div>
            ))}
            {!highRiskKpis.length && <div className="text-sm text-[var(--mx-muted)]">ไม่มีข้อมูล KPI ในช่วงที่เลือก</div>}
          </div>
        </section>
      </div>

      <div className="grid 2xl:grid-cols-[1fr_1fr] gap-5">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Employee SLA Leaderboard</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">อันดับบุคคลจากคะแนนถ่วงน้ำหนัก พร้อมปริมาณงานและสถานะ SLA</p>
          <DataTable minWidth={760}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
                <th className="p-4">Rank</th><th className="p-4">Name</th><th className="p-4">Team</th><th className="p-4">Tasks</th><th className="p-4">W.SLA</th><th className="p-4">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--mx-line)]">
              {employeeLeaders.map((row, index) => (
                <tr key={row.name}>
                  <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td>
                  <td className="p-4 font-black max-w-[220px]">{row.person}</td>
                  <td className="p-4"><span className="mx-badge status-neutral">{row.team}</span></td>
                  <td className="p-4">{fmtNum(row.total)}</td>
                  <td className="p-4 font-bold">{fmtPct(row.sla)}</td>
                  <td className="p-4"><span className={`mx-badge ${healthClass(row.weightedScore)}`}>{fmtPct(row.weightedScore)}</span></td>
                </tr>
              ))}
              {!employeeLeaders.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="6">ไม่มีข้อมูลบุคคลในช่วงที่เลือก</td></tr>}
            </tbody>
          </DataTable>
        </section>
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Team x KPI Concentration</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">KPI หลักที่กินสัดส่วนงานสูงสุดของแต่ละทีม เพื่อมองโหลดงานและความเสี่ยง</p>
          <DataTable minWidth={900}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
                <th className="p-4">Rank</th><th className="p-4">Team</th><th className="p-4">Total</th><th className="p-4">W.SLA</th><th className="p-4">Top KPI Mix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--mx-line)]">
              {teamKpiRows.map((row, index) => (
                <tr key={row.team}>
                  <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td>
                  <td className="p-4 font-black">{row.team}</td>
                  <td className="p-4">{fmtNum(row.total)}</td>
                  <td className="p-4"><span className={`mx-badge ${healthClass(row.sla)}`}>{fmtPct(row.sla)}</span></td>
                  <td className="p-4">
                    <div className="grid gap-2">
                      {row.groups.map((group) => (
                        <div key={`${row.team}-${group.name}`} className="team-kpi-chip">
                          <span className="line-clamp-2">{group.name}</span>
                          <strong>{fmtNum(group.total)} งาน</strong>
                          <em>{fmtPct(group.scores.sla)}</em>
                        </div>
                      ))}
                      {!row.groups.length && <span className="text-[var(--mx-muted)]">ไม่มีข้อมูล KPI</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!teamKpiRows.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="5">No team KPI records match these filters.</td></tr>}
            </tbody>
          </DataTable>
        </section>
      </div>
    </div>
  );
}

function KpiWeightsPanel({ kpiWeightRows, kpiSearch, setKpiSearch }) {
  const [weightTeamFilter, setWeightTeamFilter] = useState('all');
  const [weightBandFilter, setWeightBandFilter] = useState('all');
  const [weightSort, setWeightSort] = useState({ key: 'weight', direction: 'desc' });
  const search = kpiSearch.trim().toLowerCase();
  const teams = [...new Set(kpiWeightRows.map((row) => row.team))].sort((a, b) => a.localeCompare(b));
  const filtered = sortRows(kpiWeightRows
    .filter((row) => !search || [row.team, row.main, row.sub].join(' ').toLowerCase().includes(search))
    .filter((row) => weightTeamFilter === 'all' || row.team === weightTeamFilter)
    .filter((row) => matchesBand(row.sla, weightBandFilter)), weightSort);
  return (
    <section className="mx-card p-5 md:p-7">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="section-title m-0">KPI Configurations & Weights</h2>
          <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">Searchable KPI weight detail by team, main KPI category, and Sub KPI weight.</p>
        </div>
        <div className="grid sm:grid-cols-[minmax(260px,420px)_180px_160px] gap-2 no-print">
          <input className="mx-input" value={kpiSearch} onChange={(e) => setKpiSearch(e.target.value)} placeholder="Search team, main KPI, or sub KPI" />
          <select className="mx-input" value={weightTeamFilter} onChange={(e) => setWeightTeamFilter(e.target.value)}>
            <option value="all">All teams</option>
            {teams.map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
          <select className="mx-input" value={weightBandFilter} onChange={(e) => setWeightBandFilter(e.target.value)}>
            <option value="all">All bands</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="monitor">Monitor</option>
            <option value="critical">Critical</option>
            <option value="unrated">Unrated</option>
          </select>
        </div>
      </div>
      <p className="mt-4 mb-0 text-sm text-[var(--mx-muted)]">Showing {fmtNum(filtered.length)} of {fmtNum(kpiWeightRows.length)} KPI configurations.</p>
      <div className="mt-5">
        <DataTable minWidth={1300}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
              <th className="p-4">Rank</th>
              <SortHeader label="Team" sortKey="team" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Main KPI" sortKey="main" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Sub KPI" sortKey="sub" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Weight" sortKey="weight" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Total Units" sortKey="totalWeight" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Active Units" sortKey="activeWeight" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Total" sortKey="total" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Completed" sortKey="completed" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="Pending" sortKey="pending" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="SLA Pass" sortKey="slaPass" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="SLA Fail" sortKey="slaFail" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <SortHeader label="SLA %" sortKey="sla" sortConfig={weightSort} onSort={(key) => setWeightSort((current) => nextSort(current, key))} />
              <th className="p-4">Band</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mx-line)]">
            {filtered.map((row, index) => (
              <tr key={`${row.team}-${row.main}-${row.sub}`}>
                <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td>
                <td className="p-4"><span className="mx-badge status-neutral">{row.team}</span></td>
                <td className="p-4 font-black max-w-[280px]">{row.main}</td>
                <td className="p-4 max-w-[360px]">{row.sub}</td>
                <td className="p-4 font-bold">{row.weight}</td>
                <td className="p-4 font-bold">{fmtWorkUnits(row.totalWeight)}</td>
                <td className="p-4 font-bold">{fmtWorkUnits(row.activeWeight)}</td>
                <td className="p-4">{fmtNum(row.total)}</td>
                <td className="p-4">{fmtNum(row.completed)}</td>
                <td className="p-4">{fmtNum(row.pending)}</td>
                <td className="p-4">{fmtNum(row.slaPass)}</td>
                <td className="p-4">{fmtNum(row.slaFail)}</td>
                <td className="p-4 font-bold">{fmtPct(row.sla)}</td>
                <td className="p-4"><span className={`mx-badge ${healthClass(row.sla)}`}>{performanceLabel(row.sla)}</span></td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="14">No KPI weight records match these filters.</td></tr>}
          </tbody>
        </DataTable>
      </div>
    </section>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const initialEmpId = String(params.get('empId') || '').trim().toUpperCase();
  const initialSessionId = String(params.get('sessionId') || '').trim();
  const [empId, setEmpId] = useState(initialEmpId);
  const [month, setMonth] = useState(params.has('month') ? Number(params.get('month')) : 0);
  const [year, setYear] = useState(Number(params.get('year') || new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState('overview');
  const [personTeamFilter, setPersonTeamFilter] = useState('all');
  const [kpiSearch, setKpiSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [theme, setTheme] = useState(getInitialExecutiveTheme);
  const [state, setState] = useState({ loading: false, error: '', user: null, tasks: [], staff: [], holidays: [] });

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - 3 + i);
  }, []);

  const load = async (nextEmpId = empId) => {
    const cleanEmpId = String(nextEmpId || '').trim().toUpperCase();
    if (!cleanEmpId) {
      setState((prev) => ({ ...prev, error: 'Please provide empId in the URL or the input field.' }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const session = readExecutiveSession(cleanEmpId, initialSessionId);
      if (session && typeof window !== 'undefined') window.MAXIWA_ACTIVE_SESSION = session;
      const initial = await API.getInitialData(cleanEmpId, session?.sessionId || initialSessionId);
      if (initial?.error) throw new Error(initial.error);
      if (!initial?.user) throw new Error('User profile was not found.');
      const normalizedEmpId = String(initial.user.empId || initial.user.empid || cleanEmpId).trim();
      const user = { ...initial.user, empId: normalizedEmpId, empid: normalizedEmpId, kpis: initial.kpis || [] };
      const activeSessionId = String(initial.session?.sessionId || initial.sessionId || user.serverSessionId || session?.sessionId || initialSessionId || '').trim();
      if (activeSessionId && typeof window !== 'undefined') {
        window.MAXIWA_ACTIVE_SESSION = { empId: normalizedEmpId, sessionId: activeSessionId };
      }
      const monthParam = month === 0 ? null : month;
      let tasks = [];
      let taskHolidays = [];
      if (isSelfScopedRole(user.role)) {
        const res = await API.getEmployeeTasks(user, monthParam, year, month === 0, userEmpId(user));
          tasks = filterPerformanceTasks(res.tasks || res || []);
        taskHolidays = res.holidays || [];
      } else {
        const team = isTeamScopedRole(user.role) ? user.team : 'all';
        const res = await API.getAllTasks(monthParam, year, team, userEmpId(user));
          tasks = filterPerformanceTasks(filterByAllowedTeams(user, res.tasks || []));
        taskHolidays = res.holidays || [];
      }
      let staff = [];
      try {
        if (isSelfScopedRole(user.role)) {
          staff = [user];
        } else if (isTeamScopedRole(user.role)) {
          const staffRes = await API.getAllStaffInTeam(user.team, userEmpId(user));
          staff = staffRes.staff || [];
        } else if (isStrategicViewRole(user.role) || user.role === 'Manager' || user.role === 'Admin') {
          const staffRes = await API.getAllStaff(userEmpId(user));
          staff = filterByAllowedTeams(user, staffRes.staff || []);
        } else {
          staff = [];
        }
      } catch (staffError) {
        console.warn('Performance View staff image load failed:', staffError);
        staff = [];
      }
      let holidays = taskHolidays;
      try {
        if (user.role === 'Admin') {
          const holidayRes = await API.getHolidays({ 'x-admin-empid': userEmpId(user) });
          holidays = holidayRes.holidays || holidays;
        }
      } catch {
        // If holiday access is restricted, risk displays still use weekend-aware business days.
      }
      setState({ loading: false, error: '', user, tasks, staff, holidays });
      const url = new URL(window.location.href);
      url.searchParams.set('empId', cleanEmpId);
      url.searchParams.set('month', String(month));
      url.searchParams.set('year', String(year));
      url.searchParams.delete('sessionId');
      window.history.replaceState(null, '', url);
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Unable to load dashboard data.' }));
    }
  };

  useEffect(() => {
    if (initialEmpId) load(initialEmpId);
  }, [month, year]);

  useEffect(() => {
    applyExecutiveTheme(theme);
  }, [theme]);

  const tasks = filterPerformanceTasks(state.tasks || []);
  const staffDirectory = state.staff || [];
  const holidaySet = useMemo(() => buildHolidaySet(state.holidays || []), [state.holidays]);
  const portfolio = useMemo(() => buildPortfolio(tasks, holidaySet), [tasks, holidaySet]);
  const periodLabel = `${month === 0 ? 'ทุกเดือน' : MONTH_NAMES[month - 1]} ${year}`;
  const staffByName = useMemo(() => {
    const map = {};
    staffDirectory.forEach((person) => {
      const name = String(person.name || person.fullname || '').trim().toLowerCase();
      const emp = String(person.empId || person.empid || person.emp_id || '').trim().toLowerCase();
      if (name) map[name] = person;
      if (emp) map[emp] = person;
    });
    if (state.user) {
      const name = String(state.user.name || '').trim().toLowerCase();
      const emp = String(state.user.empId || state.user.empid || '').trim().toLowerCase();
      if (name && !map[name]) map[name] = state.user;
      if (emp && !map[emp]) map[emp] = state.user;
    }
    return map;
  }, [staffDirectory, state.user]);

  const teamRows = useMemo(() => buildGroupRows(tasks, teamName, holidaySet)
    .map((row) => {
      const memberMap = {};
      (row.items || []).forEach((task) => {
        const name = personName(task);
        const key = String(name || '').trim().toLowerCase();
        if (!key || memberMap[key]) return;
        const profile = staffByName[key]
          || staffByName[String(task.empId || task.empid || task.assignedToEmpId || '').trim().toLowerCase()]
          || (getPhotoUrl(task) ? task : null);
        memberMap[key] = { key, name, profile };
      });
      const members = Object.values(memberMap).sort((a, b) => a.name.localeCompare(b.name));
      return {
        ...row,
        team: row.name,
        members,
        workloadShare: portfolio.totalWeight ? roundMetric((row.totalWeight / portfolio.totalWeight) * 100, 1) : 0,
        activeWeightShare: portfolio.activeWeight ? roundMetric((row.activeWeight / portfolio.activeWeight) * 100, 1) : 0,
        riskWeightShare: (portfolio.overdueWeight + portfolio.atRiskWeight) ? roundMetric(((row.overdueWeight + row.atRiskWeight) / (portfolio.overdueWeight + portfolio.atRiskWeight)) * 100, 1) : 0,
      };
    })
    .sort((a, b) => ((b.overdueWeight * 3 + b.atRiskWeight + b.backlog / Math.max(b.total, 1)) - (a.overdueWeight * 3 + a.atRiskWeight + a.backlog / Math.max(a.total, 1))) || (b.totalWeight - a.totalWeight)), [tasks, staffByName, holidaySet, portfolio.totalWeight, portfolio.activeWeight, portfolio.overdueWeight, portfolio.atRiskWeight]);

  const personRows = useMemo(() => {
    const rows = buildGroupRows(tasks, (task) => `${personName(task)}|${teamName(task)}`, holidaySet);
    const teamWeightTotals = {};
    const teamActiveTotals = {};
    const teamRiskTotals = {};
    rows.forEach((row) => {
      const [, team] = row.name.split('|');
      teamWeightTotals[team] = (teamWeightTotals[team] || 0) + row.totalWeight;
      teamActiveTotals[team] = (teamActiveTotals[team] || 0) + row.activeWeight;
      teamRiskTotals[team] = (teamRiskTotals[team] || 0) + row.overdueWeight + row.atRiskWeight;
    });
    return rows.map((row) => {
      const [person, team] = row.name.split('|');
      const profile = staffByName[String(person || '').trim().toLowerCase()]
        || row.items.map((task) => task).find((task) => getPhotoUrl(task))
        || null;
      return {
        ...row,
        person,
        team,
        profile,
        workloadShare: teamWeightTotals[team] ? roundMetric((row.totalWeight / teamWeightTotals[team]) * 100, 1) : 0,
        activeWeightShare: teamActiveTotals[team] ? roundMetric((row.activeWeight / teamActiveTotals[team]) * 100, 1) : 0,
        riskWeightShare: teamRiskTotals[team] ? roundMetric(((row.overdueWeight + row.atRiskWeight) / teamRiskTotals[team]) * 100, 1) : 0,
      };
    })
    .sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.totalWeight - a.totalWeight);
  }, [tasks, staffByName, holidaySet]);

  const statusRows = useMemo(() => Object.entries(groupBy(tasks, (task) => task.status || 'Unknown'))
    .map(([status, items]) => ({ status, total: items.length, pct: tasks.length ? Math.round((items.length / tasks.length) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total), [tasks]);

  const kpiRows = useMemo(() => buildKpiRows(tasks), [tasks]);
  const kpiWeightRows = useMemo(() => buildKpiWeightRows(tasks), [tasks]);
  const teams = useMemo(() => [...new Set(teamRows.map((row) => row.team))], [teamRows]);

  const monthlyTrend = useMemo(() => {
    const sla = [];
    const trendCompletion = [];
    const risk = [];
    const total = [];
    const completed = [];
    const intakeFields = ['startdate', 'created_at', 'timestamp'];
    const completionFields = ['completiondate'];

    if (month === 0) {
      const months = Array.from({ length: 12 }, (_, i) => i);
      months.forEach((monthIndex) => {
        const intakeTasks = tasks.filter((task) => taskDateMatchesPeriod(task, intakeFields, year, monthIndex));
        const completedTasks = tasks.filter((task) => isCompleted(task) && taskDateMatchesPeriod(task, completionFields, year, monthIndex));
        const riskTasks = tasks.filter((task) => taskDueRiskMatchesPeriod(task, year, monthIndex, null, holidaySet));
        const monthPortfolio = buildPortfolio(completedTasks, holidaySet);
        sla.push(completedTasks.length ? monthPortfolio.scores.sla : null);
        trendCompletion.push(intakeTasks.length ? roundMetric((completedTasks.length / intakeTasks.length) * 100, 1) : null);
        risk.push(riskTasks.length);
        total.push(intakeTasks.length);
        completed.push(completedTasks.length);
      });
      return {
        granularity: 'month',
        months,
        labels: months.map((monthIndex) => MONTH_NAMES[monthIndex].slice(0, 3)),
        series: { sla, completion: trendCompletion, risk, total, completed },
      };
    }

    const monthIndex = month - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    days.forEach((day) => {
      const intakeTasks = tasks.filter((task) => taskDateMatchesPeriod(task, intakeFields, year, monthIndex, day));
      const completedTasks = tasks.filter((task) => isCompleted(task) && taskDateMatchesPeriod(task, completionFields, year, monthIndex, day));
      const riskTasks = tasks.filter((task) => taskDueRiskMatchesPeriod(task, year, monthIndex, day, holidaySet));
      const dayPortfolio = buildPortfolio(completedTasks, holidaySet);
      sla.push(completedTasks.length ? dayPortfolio.scores.sla : null);
      trendCompletion.push(intakeTasks.length ? roundMetric((completedTasks.length / intakeTasks.length) * 100, 1) : null);
      risk.push(riskTasks.length);
      total.push(intakeTasks.length);
      completed.push(completedTasks.length);
    });
    return {
      granularity: 'day',
      months: days,
      labels: days.map((day) => (day === 1 || day === daysInMonth || day % 5 === 0 ? String(day) : '')),
      series: { sla, completion: trendCompletion, risk, total, completed },
    };
  }, [tasks, year, month, holidaySet]);

  const criticalQueue = useMemo(() => portfolio.active
    .map((task) => ({ task, days: daysUntil(task, holidaySet), weight: taskWeight(task) }))
    .filter((item) => item.days !== null)
    .sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return (riskA - riskB) || (a.days - b.days) || (b.weight - a.weight);
    })
    .slice(0, 12), [portfolio.active, holidaySet]);

  return (
    <Shell>
      <header className="mx-card stage-header p-5 md:p-8">
        <div className="executive-header-grid">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              {state.user && <Avatar item={state.user} name={state.user.name || state.user.empId} className="header-avatar" />}
              <span className="mx-badge status-info"><i className="fa-solid fa-display"></i> Performance View</span>
              <span className="mx-badge status-neutral">METRIX Verity</span>
              {state.user && <span className="mx-badge status-good">{state.user.team}</span>}
            </div>
            <h1 className="display-title mt-6 mb-0 break-words">
              <span className="block">Performance Overview</span>
              <span className="block">SLA & KPI Command Center</span>
            </h1>
            <p className="mt-4 mb-0 max-w-[84ch] text-base md:text-[18px] leading-8 text-[var(--mx-muted)]">
              สรุป SLA, น้ำหนัก KPI, ภาระงานรายทีม, ผลงานรายบุคคล และความเสี่ยงสำคัญสำหรับเปิดนำเสนอผู้บริหารได้ทันที
            </p>
          </div>
          <div className="no-print control-panel executive-controls">
            <button
              className="mx-btn theme-toggle"
              type="button"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle Performance View theme"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <button className="mx-btn print-btn" onClick={() => window.print()}><i className="fa-solid fa-print mr-2"></i>พิมพ์</button>
          </div>
        </div>
        {state.error && <div className="mt-4 mx-soft p-4 text-sm font-bold text-[var(--mx-danger)]">{state.error}</div>}
      </header>

      <section className="mx-card hero-band p-5 md:p-8">
        <div className="presentation-grid items-stretch">
          <div className="grid md:grid-cols-2 gap-5">
            <GaugeMetric label="SLA รวม" value={portfolio.scores.sla} sub="คะแนนงานเสร็จตรงเวลาถ่วงน้ำหนักตามกลุ่ม KPI" tone="var(--mx-info)" />
            <GaugeMetric label="Completion ถ่วงน้ำหนัก" value={portfolio.completion} sub={`เสร็จแล้ว ${fmtNum(portfolio.completed.length)} จาก ${fmtNum(tasks.length)} งาน`} tone="var(--mx-success)" />
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            <Metric label="งานทั้งหมด" value={fmtNum(tasks.length)} sub={periodLabel} icon="fa-clipboard-list" tone="status-neutral" />
            <Metric label="เกินกำหนด" value={fmtNum(portfolio.overdue.length)} sub="งานที่ยัง active และเลย deadline" icon="fa-triangle-exclamation" tone={portfolio.overdue.length ? 'status-bad' : 'status-good'} />
            <Metric label="เสี่ยงใกล้ครบกำหนด" value={fmtNum(portfolio.atRisk.length)} sub="ครบกำหนดภายใน 3 วันทำการ" icon="fa-clock" tone={portfolio.atRisk.length ? 'status-warn' : 'status-good'} />
          </div>
        </div>
      </section>

      <TabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        years={years}
        loading={state.loading}
        onLoad={() => load(empId)}
      />

      {activeTab === 'overview' && <OverviewPanel portfolio={portfolio} teamRows={teamRows} kpiRows={kpiRows} statusRows={statusRows} criticalQueue={criticalQueue} monthlyTrend={monthlyTrend} periodLabel={periodLabel} user={state.user} empId={empId} tasks={tasks} />}
      {activeTab === 'teams' && <TeamsPanel teamRows={teamRows} holidays={holidaySet} />}
      {activeTab === 'employees' && <EmployeesPanel personRows={personRows} teams={teams} personTeamFilter={personTeamFilter} setPersonTeamFilter={setPersonTeamFilter} tasks={tasks} selectedPerson={selectedPerson} setSelectedPerson={setSelectedPerson} holidays={holidaySet} />}
      {activeTab === 'kpi' && <KpiAnalysisPanel kpiRows={kpiRows} personRows={personRows} teamRows={teamRows} />}
      {activeTab === 'weights' && <KpiWeightsPanel kpiWeightRows={kpiWeightRows} kpiSearch={kpiSearch} setKpiSearch={setKpiSearch} />}
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
