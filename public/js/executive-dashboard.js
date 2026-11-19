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
  return String(user?.empId || user?.empid || user?.emp_id || '').trim();
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

function riskAsOfLabel(value) {
  return `Risk as of ${fmtDate(value)}`;
}

function normalizeStatus(task) {
  return String(task?.status || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
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
  const extra = normalizeExtraData(task?.extra_data);
  const raw = extra.kpi_effective_weight ?? task?.kpi_effective_weight ?? task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight ?? 1;
  const weight = typeof raw === 'string' ? Number.parseFloat(raw.replace('%', '').trim()) : Number(raw);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function teamTaskWeightInfo(task, catalog = []) {
  const kpi = resolvePersonalTaskKpi(task, catalog);
  const standard = readKpiWeight(kpi?.main_weight ?? kpi?.mainWeight ?? kpi?.weight, null);
  if (standard !== null) return { value: standard, known: true, source: 'มาตรฐานทีมจากทะเบียน KPI' };
  const extra = normalizeExtraData(task?.extra_data);
  const snapshot = readKpiWeight(extra.kpi_base_weight ?? task?.kpi_base_weight, null);
  if (snapshot !== null) return { value: snapshot, known: true, source: 'น้ำหนักมาตรฐานทีมที่บันทึกกับงาน' };
  return { value: 1, known: false, source: 'ไม่พบน้ำหนักมาตรฐานทีม ใช้ค่าสำรอง 1' };
}

function createTeamWeightResolver(catalog = []) {
  const cache = new Map();
  const info = (task) => {
    if (!cache.has(task)) cache.set(task, teamTaskWeightInfo(task, catalog));
    return cache.get(task);
  };
  const resolve = (task) => info(task).value;
  resolve.info = info;
  resolve.basis = 'team';
  return resolve;
}

function hasExplicitWeight(task) {
  const extra = normalizeExtraData(task?.extra_data);
  const raw = extra.kpi_effective_weight ?? task?.kpi_effective_weight ?? task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight;
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

function kpiMainValue(item = {}) {
  return item.main || item.mainkpi || item.mainKpi || '';
}

function kpiSubValue(item = {}) {
  return item.sub || item.subkpi || item.subKpi || '';
}

function kpiCompositeKey(item = {}) {
  const team = String(item.team || '').trim().toLowerCase();
  const main = String(kpiMainValue(item) || '').trim().toLowerCase();
  const sub = String(kpiSubValue(item) || '').trim().toLowerCase();
  return `${team}::${main}::${sub}`;
}

function kpiRuleKey(item = {}) {
  return String(item.id || kpiCompositeKey(item));
}

function kpiOverrideKeys(item = {}) {
  return [item.id ? String(item.id) : '', kpiCompositeKey(item)].filter(Boolean);
}

function readKpiWeight(value, fallback = '') {
  const raw = typeof value === 'object' && value !== null
    ? (value.weight ?? value.main_weight ?? value.mainWeight)
    : value;
  const number = typeof raw === 'string' ? Number.parseFloat(raw.replace('%', '').trim()) : Number(raw);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function kpiBaseWeight(kpi) {
  return readKpiWeight(kpi?.main_weight ?? kpi?.mainWeight ?? kpi?.weight, 1);
}

function personalKpiOverride(user, kpi) {
  const overrides = userPermissions(user).kpiOverrides || user?.kpiOverrides || {};
  for (const key of kpiOverrideKeys(kpi)) {
    const weight = readKpiWeight(overrides[key], '');
    if (weight) return weight;
  }
  return '';
}

function kpiAssignments(user) {
  return userPermissions(user).kpiAssignments || user?.kpiAssignments || {};
}

function isKpiAssignedToPerson(user, kpi) {
  const assignments = kpiAssignments(user);
  if (Object.keys(assignments).length === 0) return true;
  return kpiOverrideKeys(kpi).some((key) => assignments[key] === true);
}

function taskKpiCatalog(tasks = []) {
  const map = new Map();
  (tasks || []).forEach((task) => {
    if (!hasExplicitSubKpi(task)) return;
    const item = {
      id: task.kpi_id || task.kpiId || '',
      team: teamName(task),
      main: mainKpi(task),
      sub: subKpi(task),
      weight: taskWeight(task),
    };
    const key = kpiCompositeKey(item);
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
}

function assignedSubKpisForPerson(person, kpis = []) {
  const profile = person?.profile || person || {};
  const personTeam = String(person?.team || profile.team || '').trim().toLowerCase();
  const catalogRows = (kpis || []).filter((kpi) => {
    const kpiTeam = String(kpi?.team || '').trim().toLowerCase();
    return !personTeam || !kpiTeam || kpiTeam === personTeam;
  });
  const sourceRows = catalogRows.length ? catalogRows : taskKpiCatalog(person?.items || []);
  const seen = new Set();
  return sourceRows
    .filter((kpi) => isKpiAssignedToPerson(profile, kpi))
    .map((kpi) => {
      const key = kpiRuleKey(kpi);
      if (seen.has(key)) return null;
      seen.add(key);
      const override = personalKpiOverride(profile, kpi);
      return {
        key,
        main: kpiMainValue(kpi) || '-',
        sub: kpiSubValue(kpi) || '-',
        team: kpi.team || person?.team || '-',
        baseWeight: kpiBaseWeight(kpi),
        effectiveWeight: override || kpiBaseWeight(kpi),
        overridden: Boolean(override),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (Number(b.effectiveWeight || 0) - Number(a.effectiveWeight || 0))
      || String(a.main).localeCompare(String(b.main), 'th')
      || String(a.sub).localeCompare(String(b.sub), 'th'));
}

function personName(task) {
  return String(task?.name || task?.fullname || task?.assignee || task?.owner || task?.empName || task?.empId || task?.empid || 'Unassigned').trim();
}

function taskPersonId(task) {
  return String(task?.empId || task?.empid || task?.emp_id || task?.assignedToEmpId || '').trim();
}

function personGroupKey(task) {
  const emp = taskPersonId(task);
  if (emp) return `emp:${emp.toLowerCase()}`;
  return `name:${personName(task).toLowerCase()}|team:${teamName(task).toLowerCase()}`;
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

function scopeTasksForUser(user, tasks = []) {
  return filterByAllowedTeams(user, tasks).filter((task) => {
    if (isTeamScopedRole(user?.role)) return teamName(task) === user.team;
    if (!isSelfScopedRole(user?.role)) return true;
    const emp = taskPersonId(task);
    return emp ? emp.toLowerCase() === userEmpId(user).toLowerCase()
      : personName(task).toLowerCase() === personName(user).toLowerCase() && teamName(task) === user.team;
  });
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
  if (!value) return null;
  const date = new Date(value);
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
    try { const parsed = JSON.parse(extraData); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
  }
  return typeof extraData === 'object' ? extraData : {};
}

function getTaskHoldDays(task, holidays = [], endValue = new Date()) {
  const start = getActiveHoldStart(task);
  if (!start) return 0;
  const days = businessDaysBetween(start, endValue, holidays);
  return Math.max(0, Number(days || 0));
}

function getEffectiveDeadline(task, holidays = [], asOfDate = new Date()) {
  if (!task?.deadline) return null;
  const activeHoldDays = normalizeStatus(task) === 'on hold' ? getTaskHoldDays(task, holidays, asOfDate) : 0;
  return activeHoldDays > 0 ? addBusinessDays(task.deadline, activeHoldDays, holidays) : normalizeDateOnly(task.deadline);
}

function daysUntil(task, holidays = [], asOfDate = new Date()) {
  if (!task?.deadline) return null;
  return businessDaysBetween(asOfDate, getEffectiveDeadline(task, holidays, asOfDate), holidays);
}

function getPerformanceRiskAsOfDate(month, year) {
  const selectedMonth = Number(month || 0);
  const selectedYear = Number(year || 0);
  const today = normalizeDateOnly(new Date()) || new Date();
  if (!selectedMonth || !selectedYear) return today;
  const periodEnd = normalizeDateOnly(new Date(selectedYear, selectedMonth, 0));
  if (!periodEnd) return today;
  return periodEnd < today ? periodEnd : today;
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
  return 'ยังประเมินไม่ได้';
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
  const aNum = a === null || a === undefined ? NaN : Number(a);
  const bNum = b === null || b === undefined ? NaN : Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  return String(a ?? '').localeCompare(String(b ?? ''), 'th');
}

function sortRows(rows, sortConfig) {
  if (!sortConfig?.key) return rows;
  const direction = sortConfig.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a?.[sortConfig.key], bv = b?.[sortConfig.key];
    if (av == null || Number.isNaN(av)) return bv == null || Number.isNaN(bv) ? 0 : 1;
    if (bv == null || Number.isNaN(bv)) return -1;
    return compareSortValues(av, bv) * direction;
  });
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
  const map = Object.create(null);
  (items || []).forEach((item) => {
    const key = getKey(item) || 'Unassigned';
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
}

function calcWeightedScores(tasks, weightForTask = taskWeight) {
  if (weightForTask === taskWeight && window.calcWeightedScores) return window.calcWeightedScores(tasks || []);

  let totalWeight = 0;
  let completedWeight = 0;
  let onTimeWeight = 0;
  let cancelledWeight = 0;
  (tasks || []).forEach((task) => {
    const weight = weightForTask(task);
    if (isCancelled(task)) {
      cancelledWeight += weight;
      return;
    }
    totalWeight += weight;
    if (isCompleted(task)) {
      completedWeight += weight;
      if (isCompletedOnTime(task)) onTimeWeight += weight;
    }
  });

  return {
    sla: completedWeight > 0 ? Math.round((onTimeWeight / completedWeight) * 100) : null,
    completion: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : null,
    totalWeight,
    completedWeight,
    onTimeWeight,
    slaWeight: completedWeight,
    cancelledWeight,
  };
}

function roundMetric(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** digits;
  return Math.round(num * factor) / factor;
}

function fmtWeight(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function fmtWorkUnits(value) {
  return roundMetric(value, 2).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function weightShare(value, total) {
  const numerator = Number(value);
  const denominator = Number(total);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return roundMetric((numerator / denominator) * 100, 1);
}

function fmtWeightShare(value, total) {
  return Number(total) > 0 ? fmtPct(weightShare(value, total)) : '—';
}

function taskWorkUnits(task, weightForTask = taskWeight) {
  return weightForTask(task) / 100;
}

function sumWeight(items = [], weightForTask = taskWeight) {
  return (items || []).reduce((sum, task) => sum + taskWorkUnits(task, weightForTask), 0);
}

function avgBusinessCloseDays(tasks = [], holidays = []) {
  const days = (tasks || [])
    .filter(isCompleted)
    .map((task) => businessDaysBetween(task.startdate || task.created_at, task.completiondate, holidays))
    .filter((value) => value !== null && Number.isFinite(value) && value >= 0);
  return days.length ? roundMetric(days.reduce((sum, value) => sum + value, 0) / days.length, 1) : null;
}

function buildAgingBuckets(activeTasks = [], holidays = [], asOfDate = new Date(), weightForTask = taskWeight) {
  const buckets = {
    dueSoon: { label: 'Due <=3bd', total: 0, weight: 0, items: [] },
    overdue1to3: { label: 'Overdue 1-3bd', total: 0, weight: 0, items: [] },
    overdue4to7: { label: 'Overdue 4-7bd', total: 0, weight: 0, items: [] },
    overdue8plus: { label: 'Overdue >7bd', total: 0, weight: 0, items: [] },
    noDeadline: { label: 'ไม่มีวันครบกำหนด', total: 0, weight: 0, items: [] },
    future: { label: 'ครบกำหนดเกิน 3 วันทำการ', total: 0, weight: 0, items: [] },
  };
  (activeTasks || []).forEach((task) => {
    const days = daysUntil(task, holidays, asOfDate);
    let key = days === null ? 'noDeadline' : 'future';
    if (days !== null && days >= 0 && days <= 3) key = 'dueSoon';
    else if (days !== null && days < 0 && Math.abs(days) <= 3) key = 'overdue1to3';
    else if (days !== null && days < 0 && Math.abs(days) <= 7) key = 'overdue4to7';
    else if (days !== null && days < 0) key = 'overdue8plus';
    buckets[key].total += 1;
    buckets[key].weight += taskWorkUnits(task, weightForTask);
    buckets[key].items.push(task);
  });
  return buckets;
}

function buildDataQuality(tasks = [], weightForTask = taskWeight) {
  const checks = [
    { key: 'missingSubKpi', label: 'ไม่มี Sub KPI', items: tasks.filter((task) => !hasExplicitSubKpi(task)) },
    { key: 'missingWeight', label: weightForTask.basis === 'team' ? 'ไม่มีน้ำหนักมาตรฐานทีม (ใช้ค่าสำรอง 1)' : 'ไม่มีน้ำหนัก (ใช้ค่าสำรอง 1)', items: tasks.filter((task) => weightForTask.basis === 'team' ? !weightForTask.info(task).known : !hasExplicitWeight(task)) },
    { key: 'missingDeadline', label: 'ไม่มีวันครบกำหนด', items: tasks.filter((task) => !task.deadline) },
    { key: 'completedNoDate', label: 'เสร็จแต่ไม่มีวันปิดงาน', items: tasks.filter((task) => isCompleted(task) && !task.completiondate) },
    { key: 'statusUnknown', label: 'สถานะไม่รู้จัก', items: tasks.filter((task) => !['pending', 'on process', 'on hold', 'completed', 'cancelled'].includes(normalizeStatus(task))) },
    { key: 'invalidDate', label: 'วันที่ไม่ถูกต้อง', items: tasks.filter((task) => ['deadline', 'completiondate', 'startdate'].some((key) => task[key] && !normalizeDateOnly(task[key]))) },
  ];
  const totalIssues = checks.reduce((sum, check) => sum + check.items.length, 0);
  return { checks, totalIssues, affectedTasks: tasks.filter((task) => checks.some((check) => check.items.includes(task))).length };
}

function getTaskDate(task, fields = []) {
  const raw = fields.map((field) => task?.[field]).find(Boolean);
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function isAfterDateOnly(value, limit) {
  const date = normalizeDateOnly(value);
  const limitDate = normalizeDateOnly(limit);
  return Boolean(date && limitDate && date.getTime() > limitDate.getTime());
}

function taskDateMatchesPeriod(task, fields, year, monthIndex, day = null, maxDate = null) {
  const d = getTaskDate(task, fields);
  if (!d) return false;
  if (maxDate && isAfterDateOnly(d, maxDate)) return false;
  if (d.getFullYear() !== Number(year) || d.getMonth() !== Number(monthIndex)) return false;
  return day === null || d.getDate() === Number(day);
}

function taskDueRiskMatchesPeriod(task, year, monthIndex, day, holidays = [], maxDate = null, asOfDate = new Date()) {
  if (!isActive(task)) return false;
  const deadline = getEffectiveDeadline(task, holidays);
  if (!deadline) return false;
  if (maxDate && isAfterDateOnly(deadline, maxDate)) return false;
  if (deadline.getFullYear() !== Number(year) || deadline.getMonth() !== Number(monthIndex)) return false;
  if (day !== null && deadline.getDate() !== Number(day)) return false;
  const days = businessDaysBetween(asOfDate, deadline, holidays);
  return days !== null && days <= 3;
}

function buildPortfolio(tasks, holidays = [], asOfDate = new Date(), weightForTask = taskWeight) {
  const active = tasks.filter(isActive);
  const completed = tasks.filter(isCompleted);
  const onProcess = tasks.filter(isOnProcess);
  const overdue = active.filter((task) => {
    const days = daysUntil(task, holidays, asOfDate);
    return days !== null && days < 0;
  });
  const atRisk = active.filter((task) => {
    const days = daysUntil(task, holidays, asOfDate);
    return days !== null && days >= 0 && days <= 3;
  });
  const slaPass = tasks.filter(isCompletedOnTime);
  const slaFail = tasks.filter(isCompletedLate);
  const scores = calcWeightedScores(tasks, weightForTask);
  const completion = scores.completion;
  const cancelled = tasks.filter(isCancelled);
  const weightedScore = completion !== null && scores.sla !== null
    ? Math.round(((completion + scores.sla) / 2) * 10) / 10
    : (completion ?? scores.sla);
  const totalWeight = sumWeight(tasks.filter((task) => !isCancelled(task)), weightForTask);
  const completedWeight = sumWeight(completed, weightForTask);
  const activeWeight = sumWeight(active, weightForTask);
  const overdueWeight = sumWeight(overdue, weightForTask);
  const atRiskWeight = sumWeight(atRisk, weightForTask);
  const avgWeightPerTask = tasks.length ? roundMetric(totalWeight / tasks.length, 1) : 0;
  const avgCloseDays = avgBusinessCloseDays(tasks, holidays);
  const aging = buildAgingBuckets(active, holidays, asOfDate, weightForTask);
  const dataQuality = buildDataQuality(tasks, weightForTask);
  const riskPenalty = totalWeight ? Math.min(15, roundMetric(((overdueWeight * 1.2 + atRiskWeight * 0.45) / totalWeight) * 10, 1)) : 0;
  const riskAdjustedScore = weightedScore === null || weightedScore === undefined
    ? null
    : Math.max(0, roundMetric(weightedScore - riskPenalty, 1));

  return {
    active,
    cancelled,
    completed,
    onProcess,
    overdue,
    atRisk,
    slaPass,
    slaFail,
    scores,
    weightForTask,
    scoreBasis: weightForTask.basis === 'team' ? 'team' : 'personal',
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

function buildGroupRows(tasks, getKey, holidays = [], asOfDate = new Date(), weightForTask = taskWeight) {
  return Object.entries(groupBy(tasks, getKey)).map(([name, items]) => {
    const portfolio = buildPortfolio(items, holidays, asOfDate, weightForTask);
    const topKpiEntry = Object.entries(groupBy(items, mainKpi)).sort((a, b) => b[1].length - a[1].length)[0];
    const health = portfolio.weightedScore === null ? null : Math.round(((portfolio.scores.sla ?? portfolio.completion ?? 0) + (portfolio.completion ?? portfolio.scores.sla ?? 0)) / 2)
      - portfolio.overdue.length * 5
      - portfolio.atRisk.length * 2;
    return {
      name,
      items,
      asOfDate,
      weightForTask,
      scoreBasis: portfolio.scoreBasis,
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
      backlog: portfolio.active.length,
      cancelled: portfolio.cancelled.length,
      activeOwnShare: portfolio.totalWeight > 0 ? weightShare(portfolio.activeWeight, portfolio.totalWeight) : null,
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

function buildKpiRows(tasks, holidays = [], asOfDate = new Date(), weightForTask = taskWeight) {
  return Object.entries(groupBy(tasks, mainKpi)).map(([name, items]) => {
    const portfolio = buildPortfolio(items, holidays, asOfDate, weightForTask);
    return {
      name,
      items,
      total: items.length,
      overdue: portfolio.overdue.length,
      risk: portfolio.atRisk.length,
      riskItems: [...portfolio.overdue, ...portfolio.atRisk],
      active: portfolio.active.length,
      completed: portfolio.completed.length,
      onProcess: portfolio.onProcess.length,
      totalWeight: portfolio.totalWeight,
      completedWeight: portfolio.completedWeight,
      activeWeight: portfolio.activeWeight,
      overdueWeight: portfolio.overdueWeight,
      atRiskWeight: portfolio.atRiskWeight,
      avgCloseDays: portfolio.avgCloseDays,
      share: tasks.length ? Math.round((items.length / tasks.length) * 1000) / 10 : 0,
      weightShare: weightShare(portfolio.totalWeight, sumWeight(tasks.filter((task) => !isCancelled(task)), weightForTask)),
      sla: portfolio.scores.sla,
      completion: portfolio.completion,
      slaPass: portfolio.slaPass.length,
      slaFail: portfolio.slaFail.length,
    };
  }).sort((a, b) => b.total - a.total);
}

// Shared definitions for all five Performance View tabs. No writes to KPI/task data.
function taskWeightSource(task) {
  const extra = normalizeExtraData(task?.extra_data);
  if (readKpiWeight(extra.kpi_effective_weight, '') || readKpiWeight(task?.kpi_effective_weight, '')) return 'น้ำหนักที่บันทึกกับงาน';
  return hasExplicitWeight(task) ? 'น้ำหนักในข้อมูลงานเดิม' : 'ค่าสำรอง 1 (ข้อมูลไม่ครบ)';
}

function weightValues(items = []) {
  return [...new Set(items.map(taskWeight))].sort((a, b) => a - b);
}

function formatWeights(values = []) {
  const unique = [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
  return unique.length ? unique.map((value) => fmtPct(value)).join(' / ') : '—';
}

function resolvePersonalTaskKpi(task, catalog = []) {
  const normalize = (value) => String(value || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  const team = normalize(teamName(task));
  const candidates = catalog.filter((kpi) => !kpi.team || normalize(kpi.team) === team);
  const extra = normalizeExtraData(task?.extra_data);
  const id = task?.kpi_id || task?.kpiId || extra.kpi_id || extra.kpiId;
  if (id) {
    const byId = candidates.filter((kpi) => String(kpi.id || '') === String(id));
    if (byId.length) return byId.length === 1 ? byId[0] : null;
  }
  if (!hasExplicitSubKpi(task)) return null;
  const sub = normalize(subKpi(task));
  const exact = candidates.filter((kpi) => normalize(kpiMainValue(kpi)) === normalize(mainKpi(task)) && normalize(kpiSubValue(kpi)) === sub);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  // The recalculation backend also matches by team/Sub KPI. Only accept a unique match.
  const bySub = candidates.filter((kpi) => normalize(kpiSubValue(kpi)) === sub);
  return bySub.length === 1 ? bySub[0] : null;
}

function buildPersonalKpiRows(person, catalog = [], holidays = []) {
  const assigned = assignedSubKpisForPerson(person, catalog);
  const assignmentKnown = Boolean(person?.profile || !person?.items);
  const rows = new Map();
  assigned.forEach((row) => {
    rows.set(kpiCompositeKey(row), { ...row, settingKey: row.key, assigned: true, configured: catalog.some((kpi) => kpiRuleKey(kpi) === row.key), items: [] });
  });
  (person?.items || []).forEach((task) => {
    const entry = { team: teamName(task), main: mainKpi(task), sub: subKpi(task) };
    const key = kpiCompositeKey(entry);
    if (!rows.has(key)) {
      const configured = resolvePersonalTaskKpi(task, catalog);
      const override = configured ? personalKpiOverride(person?.profile || person, configured) : '';
      rows.set(key, { ...entry, key, settingKey: configured ? kpiRuleKey(configured) : key, assigned: configured ? isKpiAssignedToPerson(person?.profile || person, configured) : false, configured: Boolean(configured), baseWeight: configured ? kpiBaseWeight(configured) : null,
        effectiveWeight: configured ? override || kpiBaseWeight(configured) : null, overridden: Boolean(override), items: [] });
    }
    rows.get(key).items.push(task);
  });
  return [...rows.values()].map((row) => ({
    ...row, assignmentKnown, key: kpiCompositeKey(row), weights: weightValues(row.items),
    portfolio: buildPortfolio(row.items, holidays, person?.asOfDate),
  })).sort((a, b) => a.main.localeCompare(b.main, 'th') || a.sub.localeCompare(b.sub, 'th'));
}

function buildPeopleRows(tasks, directory, holidays, asOfDate) {
  const profiles = new Map(directory.filter((profile) => profile && !isResignedTask(profile)).map((profile) => [personGroupKey(profile), profile]));
  const resolveKey = (task) => {
    if (taskPersonId(task)) return personGroupKey(task);
    const matches = [...profiles.values()].filter((profile) => personName(profile).trim().toLowerCase() === personName(task).trim().toLowerCase() && teamName(profile).trim().toLowerCase() === teamName(task).trim().toLowerCase());
    return matches.length === 1 ? personGroupKey(matches[0]) : personGroupKey(task);
  };
  const groups = new Map(buildGroupRows(tasks, resolveKey, holidays, asOfDate).map((row) => [row.name, row]));
  profiles.forEach((profile, key) => {
    if (!groups.has(key)) groups.set(key, { ...emptyPersonMetrics(holidays, asOfDate), name: key });
  });
  const totals = {};
  const rows = [...groups.entries()].map(([key, row]) => {
    const profile = profiles.get(key) || null;
    const first = row.items[0] || profile || {};
    const team = teamName(first);
    const total = totals[team] ||= { weight: 0, active: 0, risk: 0 };
    total.weight += row.totalWeight; total.active += row.activeWeight; total.risk += row.overdueWeight + row.atRiskWeight;
    return { ...row, employeeKey: key, person: profile ? personName(profile) : personName(first), team, empId: taskPersonId(profile || first), profile };
  });
  return sortRows(rows.map((row) => ({ ...row,
    workloadShare: weightShare(row.totalWeight, totals[row.team].weight),
    activeWeightShare: weightShare(row.activeWeight, totals[row.team].active),
    riskWeightShare: weightShare(row.overdueWeight + row.atRiskWeight, totals[row.team].risk),
  })), { key: 'weightedScore', direction: 'desc' });
}

function emptyPersonMetrics(holidays, asOfDate) {
  const p = buildPortfolio([], holidays, asOfDate);
  return { items: [], asOfDate, total: 0, totalWeight: 0, completedWeight: 0, activeWeight: 0, overdueWeight: 0, atRiskWeight: 0,
    avgWeightPerTask: 0, avgCloseDays: null, active: 0, completed: 0, onProcess: 0, backlog: 0, cancelled: 0, activeOwnShare: null,
    overdue: 0, risk: 0, slaPass: 0, slaFail: 0, sla: null, completion: null, weightedScore: null, riskAdjustedScore: null,
    riskPenalty: 0, aging: p.aging, dataQuality: p.dataQuality, health: null, topKpi: 'ยังไม่มีงาน', topKpiCount: 0 };
}

function buildWeightCatalogRows(catalog, tasks, holidays, asOfDate) {
  const groups = new Map();
  catalog.forEach((kpi) => {
    const entry = { team: kpi.team || '-', main: kpiMainValue(kpi) || '-', sub: kpiSubValue(kpi) || '-' };
    const key = kpiCompositeKey(entry);
    const row = groups.get(key) || { ...entry, key, configured: true, baseWeights: [], items: [] };
    row.baseWeights.push(kpiBaseWeight(kpi)); groups.set(key, row);
  });
  tasks.forEach((task) => {
    const entry = { team: teamName(task), main: mainKpi(task), sub: subKpi(task) };
    const key = kpiCompositeKey(entry);
    if (!groups.has(key)) groups.set(key, { ...entry, key, configured: false, baseWeights: [], items: [] });
    groups.get(key).items.push(task);
  });
  return [...groups.values()].map((row) => ({ ...row, weights: weightValues(row.items), portfolio: buildPortfolio(row.items, holidays, asOfDate) }));
}

const PerformanceActions = React.createContext({ openTasks: () => {}, openPerson: () => {}, openTeam: () => {} });

function ReportContext() {
  const { reportContext } = React.useContext(PerformanceActions);
  return <p className="report-context text-sm text-[var(--mx-muted)]">{reportContext}</p>;
}

function TaskLink({ items, title, children }) {
  const { openTasks } = React.useContext(PerformanceActions);
  return <button type="button" className="metric-link" onClick={() => openTasks(title, items)} aria-label={title}>{children}</button>;
}

function AllItems({ rows, children, initial = 12 }) {
  const [expanded, setExpanded] = useState(false);
  return <><div className="all-items-list">{(expanded ? rows : rows.slice(0, initial)).map(children)}</div>
    {rows.length > initial && <button type="button" className="mx-btn no-print mt-3" onClick={() => setExpanded(!expanded)}>{expanded ? 'ย่อรายการ' : 'ดูทั้งหมด'} ({fmtNum(rows.length)})</button>}
    <span className="print-only">{rows.length > initial && !expanded ? 'รายงานนี้แสดงบางส่วน กรุณากดดูทั้งหมดก่อนพิมพ์' : ''}</span></>;
}

function ScoreMethod({ tasks, holidays = [] }) {
  const p = buildPortfolio(tasks, holidays);
  const scores = p.scores;
  return <details className="mx-soft p-4 score-method"><summary>นิยามตัวเลขและที่มาคะแนน • {fmtNum(tasks.length)} งาน</summary>
    <div className="mt-3 grid gap-2 text-sm">
      <p>งานทั้งหมด {tasks.length} = เสร็จ {p.completed.length} + ค้าง (Active/Backlog) {p.active.length} + ยกเลิก {p.cancelled.length} งาน งานยกเลิกไม่รวมในตัวหารคะแนนและภาระงานถ่วงน้ำหนัก</p>
      <p>W.Completion = น้ำหนักงานเสร็จ {fmtWeight(scores.completedWeight)} ÷ น้ำหนักงานที่ไม่ยกเลิก {fmtWeight(scores.totalWeight)} × 100 = {fmtPct(scores.completion)}</p>
      <p>W.SLA = น้ำหนักงานเสร็จตรงเวลา {fmtWeight(scores.onTimeWeight)} ÷ น้ำหนักงานเสร็จ {fmtWeight(scores.slaWeight)} × 100 = {fmtPct(scores.sla)}</p>
      <p>Performance = (W.Completion + W.SLA) ÷ 2 = {fmtPct(p.weightedScore)} หากมีเพียงค่าเดียว ใช้ค่านั้นตามสูตรเดิม; ไม่มีข้อมูลแสดง “ยังประเมินไม่ได้”</p>
      <p>น้ำหนัก KPI ที่ตั้งค่าเป็นค่าต่อ KPI ไม่รวมซ้ำตามจำนวนงาน ส่วนคะแนนใช้ผลรวมน้ำหนักที่บันทึกกับงานแต่ละงาน ค่าที่ตั้งปัจจุบันอาจต่างจากงานเก่า น้ำหนักไม่จำเป็นต้องรวมเป็น 100%</p>
      <p>สัดส่วนภาระงาน = น้ำหนักงานในกลุ่ม ÷ น้ำหนักงานทั้งหมดในขอบเขตเดียวกัน • Active Weight = น้ำหนักงานค้าง ÷ น้ำหนักงานที่ไม่ยกเลิกของแถวนั้น • Team Load / Risk Share ใช้ผลรวมของทีมเป็นตัวหาร</p>
      <p>ระดับ Performance: Excellent ≥90%, Good ≥75%, Monitor ≥60%, Critical &lt;60% เป็นเกณฑ์แสดงผลเดิม จำนวนงานประกอบการเปรียบเทียบ ไม่มีการเพิ่มเกณฑ์ประเมินใหม่</p>
      <p>SLA ของงานเสร็จใช้วันปิดงานเทียบ deadline; วันที่ไม่ครบยังอยู่ในตัวหารตามสูตรเดิม โปรดดูคุณภาพข้อมูลประกอบ Risk/Aging ใช้วันทำการและวันหยุด</p>
    </div></details>;
}

function visiblePersonalKpiRows(person, catalog, holidays, mode = 'actual') {
  return buildPersonalKpiRows(person, catalog, holidays).filter((row) => mode === 'current'
    ? row.configured && row.assigned
    : row.items.length > 0);
}

function summarizePersonalKpiWeights(rows = []) {
  const unique = new Map();
  let missing = 0;
  rows.forEach((row) => {
    if (!row.configured || !row.assignmentKnown || !Number.isFinite(row.effectiveWeight) || row.effectiveWeight <= 0) { missing++; return; }
    unique.set(row.settingKey || row.key, row.effectiveWeight);
  });
  const total = unique.size ? roundMetric([...unique.values()].reduce((sum, weight) => sum + weight, 0), 4) : null;
  return { total, missing, complete: rows.length > 0 && missing === 0 };
}

function sumPersonalKpiWeights(rows = []) {
  const summary = summarizePersonalKpiWeights(rows);
  return summary.complete ? summary.total : null;
}

function PersonalKpiTable({ person, catalog, holidays, mode = 'actual' }) {
  const rows = visiblePersonalKpiRows(person, catalog, holidays, mode);
  const mains = Object.entries(groupBy(rows, (row) => row.main));
  return <div className="personal-kpi-detail mt-5">
    <h3 className="m-0 text-lg font-black">Main KPI → Sub KPI และน้ำหนักรายบุคคล</h3>
    <p className="text-sm text-[var(--mx-muted)]">{mode === 'current' ? 'KPI ที่ได้รับมอบหมายตามการตั้งค่าปัจจุบัน' : 'เฉพาะ Main KPI และ Sub KPI ที่มีงานของบุคคลนี้ในช่วงที่เลือก'} • กดชื่อ KPI เพื่อดูงานต้นทาง</p>
    {!rows.length && <p>{mode === 'current' ? 'ยังไม่มี KPI ที่มอบหมายในขอบเขตนี้' : 'ยังไม่มีงานในช่วงนี้'}</p>}
    <div className="grid gap-3">{mains.map(([main, subs]) => {
      const items = subs.flatMap((row) => row.items);
      const p = buildPortfolio(items, holidays, person.asOfDate);
      const current = [...new Set(subs.filter((row) => row.configured && row.assignmentKnown).map((row) => row.effectiveWeight))];
      const weightSummary = summarizePersonalKpiWeights(subs);
      const totalWeight = weightSummary.total;
      return <details key={main} className="mx-soft p-4">
        <summary className="personal-main-summary"><span className="personal-main-caption"><strong>{main}</strong> • น้ำหนักปัจจุบัน {formatWeights(current)} {current.length > 1 ? '(ต่างกันตาม Sub KPI)' : ''} • {items.length} งาน</span><span className="personal-main-total" title={weightSummary.complete ? 'ผลรวมน้ำหนักที่ตั้งไว้ของ Sub KPI ที่แสดง อย่างละหนึ่งครั้ง' : 'ยังยืนยันน้ำหนักปัจจุบันไม่ได้ ' + weightSummary.missing + ' รายการ'}>{weightSummary.complete ? 'รวม ' : totalWeight === null ? 'รวม ' : 'รวมที่ทราบ '}{totalWeight === null ? '—' : fmtPct(totalWeight)}{!weightSummary.complete && <small className="personal-total-incomplete">ข้อมูลไม่ครบ {weightSummary.missing} รายการ</small>}</span></summary>
        <div className="flex flex-wrap gap-2 mt-3"><TaskLink items={items} title={'งาน Main KPI: ' + main}>ดูงานทั้งหมด ({items.length})</TaskLink>
          <span>W.Completion {fmtPct(p.completion)} • W.SLA {fmtPct(p.scores.sla)}</span></div>
        <DataTable minWidth={1020}><thead><tr><th>Sub KPI / การมอบหมาย</th><th>พื้นฐานปัจจุบัน</th><th>ใช้กับบุคคลปัจจุบัน</th><th>บันทึกกับงาน</th><th>ทั้งหมด / เสร็จ / ค้าง / ยกเลิก / เกิน</th><th>W.Completion</th><th>W.SLA</th></tr></thead>
          <tbody>{subs.map((row) => <tr key={row.key}><td><TaskLink items={row.items} title={main + ' / ' + row.sub}>{row.sub}</TaskLink><small className="block">{row.configured ? !row.assignmentKnown ? 'ข้อมูลการมอบหมายบุคคลไม่ครบ' : row.assigned ? 'ได้รับมอบหมาย' : 'ไม่ได้รับมอบหมายปัจจุบัน' : 'จับคู่ทะเบียนปัจจุบันไม่ได้'}{row.items.length === 0 ? ' • ยังไม่มีงานในช่วงนี้' : ''}</small></td>
            <td>{row.configured ? fmtPct(row.baseWeight) : '—'}</td><td>{row.configured ? row.assignmentKnown ? fmtPct(row.effectiveWeight) : 'ไม่ทราบ' : '—'}{row.overridden && <small className="block">ปรับเฉพาะบุคคล</small>}</td>
            <td>{formatWeights(row.weights)}{row.items.some((task) => !hasExplicitWeight(task)) && <small className="block">มีงานใช้ค่าสำรอง 1</small>}</td>
            <td>{row.items.length} / {row.portfolio.completed.length} / {row.portfolio.active.length} / {row.portfolio.cancelled.length} / {row.portfolio.overdue.length}</td><td>{fmtPct(row.portfolio.completion)}</td><td>{fmtPct(row.portfolio.scores.sla)}</td></tr>)}</tbody>
        </DataTable></details>;
    })}</div><div className="mt-4"><ScoreMethod tasks={person.items} holidays={holidays} /></div>
  </div>;
}

function TaskExplorer({ selection, holidays, asOfDate, onClose }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const { openPerson, teamWeightForTask } = React.useContext(PerformanceActions);
  const rows = selection.items.filter((task) => matchesSearch({ job: task.job, name: personName(task), main: mainKpi(task), sub: subKpi(task), id: task.id }, ['job', 'name', 'main', 'sub', 'id'], search));
  const count = Math.max(1, Math.ceil(rows.length / 50));
  const currentPage = Math.min(page, count - 1);
  useDialogAccessibility(true, onClose);
  return <div className="modal-backdrop explorer-backdrop" onClick={onClose}><div className="modal-card task-explorer" role="dialog" aria-modal="true" aria-label={selection.title} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
    <button className="modal-close no-print" onClick={onClose} aria-label="ปิดรายการงาน">×</button>
    <h2 className="section-title">{selection.title}</h2><ReportContext /><p>{rows.length} จาก {selection.items.length} งาน • ใช้ขอบเขตและช่วงเวลาจากหน้าหลัก</p>
    <label className="no-print">ค้นหางานหรือผู้รับผิดชอบ<input className="mx-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label>
    <DataTable minWidth={1000}><thead><tr><th>งาน / รายละเอียด</th><th>ผู้รับผิดชอบ</th><th>KPI</th><th>สถานะ</th><th>น้ำหนักบุคคลที่บันทึกกับงาน</th><th>น้ำหนักมาตรฐานทีม</th><th>วันที่</th></tr></thead><tbody>
      {(showAll ? rows : rows.slice(currentPage * 50, (currentPage + 1) * 50)).map((task, index) => <tr key={task.id || index}>
        <td><details><summary>{extractJobCode(task.job)} • {task.id || 'ไม่มีรหัส'}</summary><p className="task-job">{task.job || 'ไม่มีชื่องาน'}</p>{task.note && <p className="task-job">หมายเหตุ: {task.note}</p>}</details></td>
        <td><button className="metric-link" onClick={() => openPerson(task)}>{personName(task)}</button><small className="block">{teamName(task)}</small></td>
        <td>{mainKpi(task)}<small className="block">{subKpi(task)}</small></td><td>{task.status || 'ไม่ระบุ'}{isActive(task) && <small className="block">{riskBadge(daysUntil(task, holidays, asOfDate))[0]}</small>}</td><td>{fmtPct(taskWeight(task))}<small className="block">{taskWeightSource(task)}</small></td><td>{fmtPct(teamWeightForTask(task))}<small className="block">{teamWeightForTask.info(task).source}</small></td>
        <td>เริ่ม {fmtDate(task.startdate || task.created_at)}<br/>กำหนด {fmtDate(task.deadline)}<br/>ปิด {fmtDate(task.completiondate)}{isActive(task) && dateKey(getEffectiveDeadline(task, holidays, asOfDate)) !== dateKey(task.deadline) && <small className="block">กำหนดหลังชดเชย On Hold: {fmtDate(getEffectiveDeadline(task, holidays, asOfDate))}</small>}{isCompleted(task) && (!normalizeDateOnly(task.deadline) || !normalizeDateOnly(task.completiondate)) && <small className="block">ข้อมูลไม่ครบสำหรับตรวจ SLA</small>}</td>
      </tr>)}{!rows.length && <tr><td colSpan="7">ไม่มีงานตรงกับเงื่อนไข</td></tr>}</tbody></DataTable>
    <div className="flex flex-wrap gap-3 items-center mt-3 no-print"><button className="mx-btn" onClick={() => setShowAll(!showAll)}>{showAll ? 'แบ่งหน้าละ 50 งาน' : 'แสดงทั้งหมดเพื่อพิมพ์'}</button><button className="mx-btn" disabled={showAll || currentPage === 0} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button><span>หน้า {currentPage + 1} / {count} (หน้าละ 50 งาน)</span><button className="mx-btn" disabled={showAll || currentPage + 1 >= count} onClick={() => setPage(currentPage + 1)}>ถัดไป</button></div>
    <p className="print-only">{showAll ? 'รายการงานทั้งหมด' : 'รายการงานหน้า ' + (currentPage + 1) + ' / ' + count} • {rows.length} งาน</p>
  </div></div>;
}

function useDialogAccessibility(open, onClose) {
  const callback = React.useRef(onClose); callback.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    dialog.focus();
    const keydown = (event) => {
      const active = [...document.querySelectorAll('[role="dialog"]')].pop();
      if (active !== dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); callback.current(); }
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('button:not([disabled]), input, select, summary, [href], [tabindex="0"]')].filter((el) => el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [open]);
}

function Shell({ children }) {
  return (
    <>
      <a className="skip-link" href="#performance-content">ข้ามไปยังเนื้อหาหลัก</a>
      <main id="performance-content" className="max-w-[1760px] mx-auto p-4 md:p-7 grid gap-5">{children}</main>
    </>
  );
}

function Metric({ label, value, sub, icon, tone = 'status-info', items }) {
  return (
    <div className={`mx-card metric-card p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">{label}</div>
        <span className={`mx-badge ${tone}`}><i className={`fa-solid ${icon}`}></i></span>
      </div>
      <div className="mt-5 metric-number">{items ? <TaskLink title={label} items={items}>{value}</TaskLink> : value}</div>
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

const MONTH_NAMES_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function MonthPicker({ selectedMonths, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function toggleMonth(m) {
    const next = new Set(selectedMonths);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    onChange(Array.from(next).sort((a, b) => a - b));
  }

  function selectAll() { onChange([]); }
  function clearAll() { onChange([]); }

  const label = selectedMonths.length === 0
    ? 'ทุกเดือน'
    : selectedMonths.length === 1
      ? MONTH_NAMES[selectedMonths[0] - 1]
      : selectedMonths.map((m) => MONTH_NAMES_TH[m - 1]).join(', ');

  const isAll = selectedMonths.length === 0;

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        className="mx-input month-picker-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="เลือกเดือน"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
          {selectedMonths.length > 1 && (
            <span className="mx-badge status-info" style={{ fontSize: 10, padding: '2px 6px', marginRight: 5, borderRadius: 999, display: 'inline-flex', alignItems: 'center' }}>
              {selectedMonths.length}
            </span>
          )}
          {label}
        </span>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--mx-muted)', flex: '0 0 auto' }}></i>
      </button>
      {open && (
        <div className="month-picker-dropdown mx-card" role="listbox" aria-multiselectable="true" aria-label="เลือกเดือน">
          <div className="month-picker-header">
            <button type="button" className={`month-picker-all-btn ${isAll ? 'active' : ''}`} onClick={selectAll} role="option" aria-selected={isAll}>
              <i className="fa-solid fa-calendar-days" style={{ marginRight: 5, fontSize: 11 }}></i>ทุกเดือน
            </button>
          </div>
          <div className="month-picker-grid">
            {MONTH_NAMES.map((name, idx) => {
              const m = idx + 1;
              const selected = selectedMonths.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  className={`month-picker-cell ${selected ? 'active' : ''}`}
                  onClick={() => toggleMonth(m)}
                  role="option"
                  aria-selected={selected}
                  title={name}
                >
                  <span className="month-picker-abbr">{MONTH_NAMES_TH[idx]}</span>
                  {selected && <i className="fa-solid fa-check month-picker-check"></i>}
                </button>
              );
            })}
          </div>
          {selectedMonths.length > 0 && (
            <div className="month-picker-footer">
              <button type="button" className="month-picker-clear-btn" onClick={clearAll}>
                <i className="fa-solid fa-xmark" style={{ marginRight: 4, fontSize: 10 }}></i>ล้างตัวเลือก
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBar({ activeTab, setActiveTab, selectedMonths, setSelectedMonths, year, setYear, years, loading, lastUpdated, onLoad }) {
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
        <MonthPicker selectedMonths={selectedMonths} onChange={setSelectedMonths} />
        <select className="mx-input" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Filter year">
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button className="mx-btn mx-btn-primary" onClick={onLoad} disabled={loading} aria-live="polite">
          <i className={`fa-solid ${loading ? 'fa-rotate-right fa-spin' : 'fa-arrows-rotate'} mr-2`}></i>{loading ? 'กำลังโหลด' : 'รีเฟรช'}
        </button>
      </div>
      <div className="load-status" role="status">
        <span className={`load-status-dot ${loading ? 'is-loading' : ''}`}></span>
        {loading ? 'กำลังโหลดข้อมูลตามช่วงที่เลือก' : lastUpdated ? `อัปเดตล่าสุด ${new Date(lastUpdated).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : 'พร้อมโหลดข้อมูล'}
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
        <img src={photo} alt={name || 'Profile'} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
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
  const maxTotal = Math.max(...rows.map((row) => row.total - (row.cancelled || 0)), 1);
  return (
    <div className="stacked-chart">
      {rows.map((row) => {
        const eligible = row.total - (row.cancelled || 0);
        const completed = eligible ? (row.completed / eligible) * 100 : 0;
        const onProcess = eligible ? (row.onProcess / eligible) * 100 : 0;
        const backlog = eligible ? Math.max(0, 100 - completed - onProcess) : 0;
        return (
          <div key={row.team} className="stacked-row">
            <div className="stacked-name">
              <strong>{row.team}</strong>
              <span>{fmtNum(eligible)} งานที่ไม่ยกเลิก</span>
            </div>
            <div className="stacked-track" style={{ width: `${Math.max(18, (eligible / maxTotal) * 100)}%` }}>
              <span className="seg done" style={{ width: `${completed}%` }} title={`Completed ${fmtNum(row.completed)}`}></span>
              <span className="seg process" style={{ width: `${onProcess}%` }} title={`On process ${fmtNum(row.onProcess)}`}></span>
              <span className="seg backlog" style={{ width: `${backlog}%` }} title={`ค้างสถานะอื่น ${fmtNum(Math.max(0, row.backlog - row.onProcess))}`}></span>
            </div>
            <div className="stacked-meta">{fmtPct(row.completion)}</div>
          </div>
        );
      })}
      <div className="chart-legend">
        <span><i className="legend-dot done"></i>Completed</span>
        <span><i className="legend-dot process"></i>On Process</span>
        <span><i className="legend-dot backlog"></i>ค้างสถานะอื่น (ไม่รวม On Process)</span>
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
  const scored = rows.filter((row) => row.sla !== null && row.completion !== null);
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
  const teams = teamRows;
  const kpis = kpiRows;
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

function OverviewPanel({ portfolio, teamRows, kpiRows, statusRows, criticalQueue, monthlyTrend, periodLabel, riskAsOfDate, user, empId, tasks }) {
  const { openTeam } = React.useContext(PerformanceActions);
  const highestRisk = [...teamRows].filter((row) => row.overdue || row.risk).sort((a, b) => (b.overdueWeight + b.atRiskWeight) - (a.overdueWeight + a.atRiskWeight))[0];
  const highestLoad = [...teamRows].filter((row) => row.activeWeight > 0).sort((a, b) => b.activeWeight - a.activeWeight || b.totalWeight - a.totalWeight)[0];
  const strongestTeam = [...teamRows].filter((row) => row.sla !== null).sort((a, b) => (b.sla || 0) - (a.sla || 0))[0];
  const insights = [
    portfolio.overdue.length ? `${portfolio.overdue.length} overdue task(s), ${fmtWeightShare(portfolio.overdueWeight, portfolio.totalWeight)} of workload, require attention.` : 'No overdue active tasks in the current scope.',
    portfolio.atRisk.length ? `${portfolio.atRisk.length} task(s), ${fmtWeightShare(portfolio.atRiskWeight, portfolio.totalWeight)} of workload, are due within 3 business days.` : 'Short-term delivery risk is currently contained.',
    highestLoad ? `${highestLoad.team} carries the highest active workload at ${fmtPct(highestLoad.activeWeightShare)} of active work.` : 'No active workload data is available yet.',
    highestRisk ? `${highestRisk.team} carries the largest risk-weight share at ${fmtPct(highestRisk.riskWeightShare)}.` : 'No team pressure data is available yet.',
    strongestTeam ? `${strongestTeam.team} is the current SLA benchmark at ${fmtPct(strongestTeam.sla)}.` : 'No SLA benchmark is available yet.',
  ];

  return (
    <div className="grid gap-6">
      <section className="mx-card p-5 md:p-7">
        <p className="score-basis-label text-sm font-bold">{portfolio.scoreBasis === 'team' ? 'ภาพรวมคะแนนทีม • น้ำหนักมาตรฐานทีม' : 'ภาพรวมคะแนนบุคคล • น้ำหนักเฉพาะบุคคลที่บันทึกกับงาน'}</p>
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
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Workload share</span><strong>{portfolio.totalWeight > 0 ? fmtPct(100) : '—'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Active weight</span><strong>{fmtWeightShare(portfolio.activeWeight, portfolio.totalWeight)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Risk basis</span><strong>{riskAsOfLabel(riskAsOfDate)}</strong></div>
              <details><summary>ค่าช่วยติดตามความเสี่ยง (แยกจาก Performance)</summary><p>Risk adjusted {fmtPct(portfolio.riskAdjustedScore)} = Performance หักค่าความเสี่ยง {portfolio.riskPenalty} จุด ตามสูตรเดิม ใช้เพื่อติดตามงาน</p></details>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">SLA breach rate</span><strong>{portfolio.completed.length ? fmtPct(Math.round((portfolio.slaFail.length / portfolio.completed.length) * 1000) / 10) : '-'}</strong></div>
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
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">สัดส่วนน้ำหนักงานในขอบเขตนี้ ไม่ใช่น้ำหนัก KPI ที่ตั้งค่า</p>
            </div>
            <span className={`mx-badge ${portfolio.overdueWeight ? 'status-bad' : portfolio.atRiskWeight ? 'status-warn' : 'status-good'}`}>Risk Weight {fmtWeightShare(portfolio.overdueWeight + portfolio.atRiskWeight, portfolio.totalWeight)}</span>
          </div>
          <div className="metric-strip mt-5">
            <div><span>Total Weight</span><strong>{portfolio.totalWeight > 0 ? fmtPct(100) : '—'}</strong></div>
            <div><span>Completed Weight</span><strong>{fmtWeightShare(portfolio.completedWeight, portfolio.totalWeight)}</strong></div>
            <div><span>Active Weight</span><strong>{fmtWeightShare(portfolio.activeWeight, portfolio.totalWeight)}</strong></div>
            <div><span>Overdue Weight</span><strong>{fmtWeightShare(portfolio.overdueWeight, portfolio.totalWeight)}</strong></div>
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="section-title m-0">Aging Backlog</h2>
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">งานค้างแยกตามช่วงกำหนดส่ง • กดตัวเลขดูงานต้นทาง</p>
            </div>
            <span className="mx-badge status-neutral">Active {fmtNum(portfolio.active.length)}</span>
          </div>
          <div className="aging-grid mt-5">
            {Object.entries(portfolio.aging).map(([key, bucket]) => (
              <div key={key} className={`aging-card ${key.includes('overdue') ? 'risk' : key === 'dueSoon' ? 'warn' : ''}`}>
                <span>{bucket.label}</span>
                <strong><TaskLink items={bucket.items} title={bucket.label}>{fmtNum(bucket.total)}</TaskLink></strong>
                <em>{fmtWeightShare(bucket.weight, portfolio.activeWeight)} active weight</em>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <h2 className="section-title m-0">Data Quality Watch</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">ตรวจข้อมูลที่มีผลต่อความน่าเชื่อถือของคะแนน • กดตัวเลขเพื่อดูงานและผู้รับผิดชอบ</p>
          </div>
          <span className={`mx-badge ${portfolio.dataQuality.totalIssues ? 'status-warn' : 'status-good'}`}>{fmtNum(portfolio.dataQuality.totalIssues)} จุด / {portfolio.dataQuality.affectedTasks} งาน (งานเดียวอาจมีหลายจุด)</span>
        </div>
        <div className="quality-grid mt-5">
          {portfolio.dataQuality.checks.map((check) => (
            <div key={check.key} className={`quality-card ${check.items.length ? 'warn' : 'good'}`}>
              <span>{check.label}</span>
              <strong><TaskLink items={check.items} title={check.label}>{fmtNum(check.items.length)}</TaskLink></strong>
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
          <p className="text-sm mt-3">กราฟนี้แสดงจำนวนงาน ไม่ใช่ Completion % • เสร็จในช่วงนี้อาจเป็นงานเข้าจากช่วงก่อนหน้า • ความเสี่ยงใช้สถานะปัจจุบันและกำหนดส่ง ไม่ใช่ snapshot ย้อนหลัง</p>
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
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">กราฟสรุป 5 ทีมที่มีงานมากที่สุด • Health และการควบคุมความเสี่ยงเป็นค่าช่วยติดตาม ไม่ใช่คะแนนประเมินหลัก</p>
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
            <AllItems rows={teamRows} initial={8}>{(row) => (
              <div key={row.team} className="control-row">
                <div className="min-w-0">
                  <button className="metric-link font-black" onClick={() => openTeam(row)}>{row.team}</button>
                  <div className="mt-1 text-xs text-[var(--mx-muted)]">Top KPI: {row.topKpi} / workload {fmtPct(row.workloadShare)}</div>
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
                  <span className="mx-badge status-info">Active Weight {fmtWeightShare(row.activeWeight, row.totalWeight)}</span>
                  <TaskLink title={row.team + ' / งานค้าง'} items={row.items.filter(isActive)}>{fmtNum(row.backlog)} backlog</TaskLink>
                </div>
              </div>
            )}</AllItems>
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Priority Watchlist</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Active work with the highest near-term SLA exposure.</p>
          <div className="priority-watchlist-scroll grid gap-3">
            <AllItems rows={criticalQueue} initial={12}>{({ task, days, weight }) => {
              const [label, klass] = riskBadge(days);
              return (
                <div key={task.id || `${task.job}-${task.deadline}`} className="insight-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-extrabold truncate"><TaskLink items={[task]} title={task.job || 'รายละเอียดงาน'}>{extractJobCode(task.job)}</TaskLink></div>
                      <div className="mt-1 text-sm text-[var(--mx-muted)] line-clamp-2">{task.job || '-'}</div>
                    </div>
                    <span className={`mx-badge ${klass}`}>{label}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="mx-badge status-neutral">{teamName(task)}</span>
                    <span className="mx-badge status-info">Weight {fmtPct(weight)}</span>
                    <span className="mx-badge status-neutral">deadline {fmtDate(task.deadline)}</span>
                  </div>
                </div>
              );
            }}</AllItems>
            {!criticalQueue.length && <div className="mx-soft p-5 text-center text-[var(--mx-muted)]">No critical active work in this scope.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildTeamPeopleRows(people, team, holidays, asOfDate) {
  return people.flatMap((person) => {
    const items = person.items.filter((task) => teamName(task) === team);
    if (!items.length && person.team !== team) return [];
    const p = buildPortfolio(items, holidays, asOfDate);
    return [{ ...person, source: person, name: person.person, items, total: items.length,
      active: p.active.length, overdue: p.overdue.length, score: p.weightedScore }];
  });
}

function TeamDetailModal({ team, holidays = [], personRows = [], onClose }) {
  const { openPerson, openTasks } = React.useContext(PerformanceActions);
  useDialogAccessibility(Boolean(team), onClose);
  if (!team) return null;
  const riskAsOfDate = team.asOfDate || new Date();
  const members = team.members || [];
  const weightForTask = team.weightForTask;
  const kpiBreakdown = Object.entries(groupBy(team.items || [], mainKpi))
    .map(([name, items]) => ({
      name,
      total: items.length,
      active: items.filter(isActive).length,
      completed: items.filter(isCompleted).length,
      fail: items.filter(isCompletedLate).length,
      scores: calcWeightedScores(items, weightForTask),
    }))
    .sort((a, b) => b.total - a.total || b.fail - a.fail);
  const peopleBreakdown = buildTeamPeopleRows(personRows, team.team, holidays, riskAsOfDate);
  const urgent = (team.items || [])
    .filter(isActive)
    .map((task) => ({ task, days: daysUntil(task, holidays, riskAsOfDate), weight: weightForTask(task) }))
    .filter((item) => item.days !== null && item.days <= 3)
    .sort((a, b) => a.days - b.days || b.weight - a.weight);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card team-modal-card" role="dialog" aria-modal="true" aria-label="รายละเอียดทีม" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close no-print" onClick={onClose} aria-label="Close">×</button>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Team Drilldown</div>
            <h2 className="section-title mt-2 mb-1">{team.team}</h2>
            <div className="flex flex-wrap gap-2">
              <span className={`mx-badge ${healthClass(team.health)}`}>Health {team.health === null ? 'ยังประเมินไม่ได้' : team.health}</span>
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
            <div><span>SLA Fail</span><strong><TaskLink title={team.team + ' / งานเสร็จช้า'} items={team.items.filter(isCompletedLate)}>{fmtNum(team.slaFail)}</TaskLink></strong></div>
          </div>
        </div>

        <p className="score-basis-label text-sm">คะแนนทีมใช้น้ำหนักมาตรฐานทีม • คะแนนบุคคลด้านล่างใช้น้ำหนักเฉพาะบุคคล</p>
        <ReportContext />
        <div className="mt-6 team-modal-grid">
          <section className="mx-soft p-5">
            <h3 className="m-0 text-lg font-black">KPI Mix ของทีม</h3><p className="text-sm">{team.total} งาน • ยกเลิก {team.cancelled || 0} งาน • กด KPI เพื่อดูงาน</p>
            <div className="mt-4 grid gap-3 team-modal-scroll">
              {kpiBreakdown.map((row) => (
                <div key={row.name}>
                  <div className="flex justify-between gap-3 mb-2 text-sm">
                    <button className="metric-link" onClick={() => openTasks(row.name, team.items.filter((task) => mainKpi(task) === row.name))}>{row.name}</button>
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
            <h3 className="m-0 text-lg font-black">People Performance • คะแนนบุคคลในทีมนี้</h3>
            <div className="mt-4 grid gap-3 team-modal-scroll">
              {peopleBreakdown.map((person, index) => (
                <div key={person.name} className="team-person-row">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar item={person.profile || person} name={person.name} className="team-person-avatar" />
                    <div className="min-w-0">
                      <button className="metric-link font-black" onClick={() => openPerson(person.source)}>{String(index + 1).padStart(2, '0')} {person.name}</button>
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
                    <span className="mx-badge status-info">น้ำหนักทีม {fmtPct(weight)}</span>
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
  const { openTeam: setSelectedTeam } = React.useContext(PerformanceActions);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamBandFilter, setTeamBandFilter] = useState('all');
  const [teamSort, setTeamSort] = useState({ key: 'total', direction: 'desc' });
  const filteredTeams = sortRows(teamRows.filter((row) =>
    matchesSearch(row, ['team', 'topKpi'], teamSearch) && matchesBand(row.sla, teamBandFilter)
  ), teamSort);
  return (
    <div className="grid gap-6">
      <div className="detail-grid">
        <AllItems rows={filteredTeams} initial={8}>{(row, index) => (
          <button key={row.team} className="mx-card leader-card team-card-button p-5 text-left" onClick={() => setSelectedTeam(row)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">ลำดับ {String(index + 1).padStart(2, '0')} / Team</div>
                <h3 className="mt-2 mb-0 text-xl font-black truncate">{row.team}</h3>
              </div>
              <span className={`mx-badge ${healthClass(row.health)}`}>{row.health === null ? 'ยังประเมินไม่ได้' : row.health}</span>
            </div>
            <div className="mini-metric-grid mt-5">
              <div><span>Total</span><strong>{fmtNum(row.total)}</strong></div>
              <div><span>Workload</span><strong>{fmtPct(row.workloadShare)}</strong></div>
              <div><span>Done</span><strong>{fmtNum(row.completed)}</strong></div>
              <div><span>Risk Weight</span><strong>{fmtWeightShare(row.overdueWeight + row.atRiskWeight, row.totalWeight)}</strong></div>
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
        )}</AllItems>
      </div>

      <section className="mx-card p-5 md:p-7">
        <h2 className="section-title m-0">Completion Rate by Team</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">แถบแสดงจำนวนงานที่ไม่ยกเลิก • เปอร์เซ็นต์ด้านขวาเป็น Completion ถ่วงน้ำหนักมาตรฐานทีม</p>
        <StackedWorkloadChart rows={filteredTeams} />
      </section>

      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="section-title m-0">Team SLA Summary</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">คะแนนทีมใช้น้ำหนักมาตรฐานทีม คำนวณจากงานของทีมโดยตรง ไม่เฉลี่ยคะแนนบุคคล • ตัวกรองใช้กับการ์ด กราฟ และตารางนี้</p>
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
              <th className="p-4">ลำดับ</th>
              <SortHeader label="Team" sortKey="team" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Total" sortKey="total" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Workload" sortKey="workloadShare" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Completed" sortKey="completed" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
              <SortHeader label="Active Weight" sortKey="activeOwnShare" sortConfig={teamSort} onSort={(key) => setTeamSort((current) => nextSort(current, key))} />
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
                <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td><td className="p-4 font-black"><button className="metric-link" onClick={() => setSelectedTeam(row)}>{row.team}</button></td><td className="p-4">{fmtNum(row.total)}</td><td className="p-4 font-bold">{fmtPct(row.workloadShare)}</td><td className="p-4">{fmtNum(row.completed)}</td><td className="p-4 font-bold">{fmtWeightShare(row.activeWeight, row.totalWeight)}</td><td className="p-4">{fmtNum(row.backlog)}</td><td className="p-4">{fmtNum(row.onProcess)}</td><td className="p-4">{fmtNum(row.slaPass)}</td><td className="p-4"><TaskLink title={row.team + ' / งานเสร็จช้า'} items={row.items.filter(isCompletedLate)}>{fmtNum(row.slaFail)}</TaskLink></td><td className="p-4 font-bold">{fmtPct(row.sla)}</td><td className="p-4 font-bold">{fmtPct(row.completion)}</td><td className="p-4"><span className={`mx-badge ${healthClass(row.sla)}`}>{performanceLabel(row.sla)}</span></td>
              </tr>
            ))}
            {!filteredTeams.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="13">No team records match these filters.</td></tr>}
          </tbody>
        </DataTable>
      </section>

    </div>
  );
}

function EmployeeDetailModal({ person, holidays = [], kpis = [], onClose }) {
  const { openTeam } = React.useContext(PerformanceActions);
  useDialogAccessibility(Boolean(person), onClose);
  if (!person) return null;
  const riskAsOfDate = person.asOfDate || new Date();
  const kpiBreakdown = Object.entries(groupBy(person.items, mainKpi))
    .map(([name, items]) => ({ name, total: items.length, scores: calcWeightedScores(items), completed: items.filter(isCompleted).length, fail: items.filter(isCompletedLate).length }))
    .sort((a, b) => b.total - a.total);
  const statusBreakdown = Object.entries(groupBy(person.items, (task) => task.status || 'Unknown'))
    .map(([status, items]) => ({ status, total: items.length, pct: person.total ? Math.round((items.length / person.total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total);
  const completedTasks = person.items
    .filter(isCompleted)
    .sort((a, b) => new Date(b.completiondate || b.deadline || 0) - new Date(a.completiondate || a.deadline || 0));
  const slaFailTasks = person.items
    .filter(isCompletedLate)
    .map((task) => ({ task, days: businessDaysBetween(task.deadline, task.completiondate, holidays), weight: taskWeight(task) }))
    .sort((a, b) => Math.abs(b.days || 0) - Math.abs(a.days || 0) || b.weight - a.weight);
  const completionDays = completedTasks
    .map((task) => businessDaysBetween(task.startdate || task.created_at, task.completiondate, holidays))
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
    .map((task) => ({ task, days: daysUntil(task, holidays, riskAsOfDate), weight: taskWeight(task) }))
    .filter((item) => item.days !== null && item.days <= 3)
    .sort((a, b) => a.days - b.days || b.weight - a.weight);
  const topKpiRows = kpiBreakdown;
  const performedSubKpis = Object.entries(groupBy(person.items, (task) => mainKpi(task) + " / " + subKpi(task)))
    .map(([name, items]) => ({
      name,
      total: items.length,
      active: items.filter(isActive).length,
      completed: items.filter(isCompleted).length,
      weights: weightValues(items),
    }))
    .sort((a, b) => b.active - a.active || b.total - a.total);
  const topStatusRows = statusBreakdown;
  const topUrgent = urgent;
  const topRecentCompleted = completedTasks;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card employee-modal-card" role="dialog" aria-modal="true" aria-label="รายละเอียดบุคคล" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close no-print" onClick={onClose} aria-label="Close">×</button>
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
            <span>คะแนนบุคคล</span>
            <strong>{fmtPct(person.weightedScore)}</strong>
          </div>
        </div>
        <ReportContext />
        <PersonalKpiTable key={person.employeeKey} person={person} catalog={kpis} holidays={holidays} />
        <button className="mx-btn no-print mt-3" onClick={() => openTeam({ team: person.team })}>ดูทีม {person.team}</button>
        <div className="employee-summary-grid">
          <div><span>Total Work</span><strong>{fmtNum(person.total)}</strong></div>
          <div><span>Active Weight</span><strong>{fmtWeightShare(person.activeWeight, person.totalWeight)}</strong></div>
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
              <div><span>Late</span><strong><TaskLink title={person.person + ' / งานเสร็จช้า'} items={person.items.filter(isCompletedLate)}>{fmtNum(person.slaFail)}</TaskLink></strong></div>
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
          <section className="mx-soft p-5 employee-assigned-kpi-panel">
            <div className="panel-heading-row">
              <div>
                <h3 className="m-0 text-lg font-black">Sub KPI ที่บุคคลนี้ปฏิบัติ</h3>
                <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">รายการ Sub KPI จากงานจริงของบุคคลนี้ในช่วงที่เลือก</p>
              </div>
              <span className="mx-badge status-info">{fmtNum(performedSubKpis.length)} รายการ</span>
            </div>
            <div className="mt-4 grid gap-3 max-h-80 overflow-y-auto pr-1">
              {performedSubKpis.map((row) => (
                <div key={row.name} className="employee-kpi-row">
                  <div className="min-w-0">
                    <div className="flex justify-between gap-3 mb-1 text-sm">
                      <strong className="truncate">{row.name}</strong>
                      <span>{fmtNum(row.total)} jobs</span>
                    </div>
                    <div className="text-xs text-[var(--mx-muted)]">Active {fmtNum(row.active)} • Done {fmtNum(row.completed)} • Total {fmtNum(row.total)}</div>
                  </div>
                  <div className="employee-kpi-score">
                    <span>Weight</span>
                    <strong>{formatWeights(row.weights)}</strong>
                  </div>
                </div>
              ))}
              {!performedSubKpis.length && <div className="text-sm text-[var(--mx-muted)]">ยังไม่มี Sub KPI ที่บุคคลนี้ปฏิบัติในช่วงที่เลือก</div>}
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
                        <span className="mx-badge status-info">Weight {fmtPct(weight)}</span>
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
                      <span className="mx-badge status-info">Weight {fmtPct(weight)}</span>
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

function configuredWeightsForPerson(person, catalog = []) {
  // Only current assignments and the staff profile can confirm a personal setting.
  // Never turn task snapshot weights into current configuration.
  if (!person?.profile) return { state: 'missing-profile', rows: [] };
  if (!catalog.length) return { state: 'missing-catalog', rows: [] };
  const performed = new Set((person.items || []).map((task) => kpiCompositeKey({ team: teamName(task), main: mainKpi(task), sub: subKpi(task) })));
  const rows = assignedSubKpisForPerson({ ...person, items: [] }, catalog).filter((row) => performed.has(kpiCompositeKey(row)));
  return { state: rows.length ? 'ready' : 'empty', rows };
}

function PersonConfiguredWeights({ person, catalog, limit = 3 }) {
  const configured = configuredWeightsForPerson(person, catalog);
  const rows = configured.rows.slice(0, limit);
  return <span className="person-configured-weights">
    <span className="person-weight-heading">น้ำหนัก KPI ที่ตั้งไว้{configured.rows.length > 0 ? ' (' + configured.rows.length + ')' : ''}</span>
    {rows.map((kpi) => <span className="person-weight-row" key={kpi.key}>
      <span className="person-weight-name"><b>{kpi.main}</b><small>{kpi.sub}</small></span>
      <span className="person-weight-value"><strong>{fmtPct(kpi.effectiveWeight)}</strong><small>{kpi.overridden ? 'เฉพาะบุคคล' : 'ค่ามาตรฐาน'}</small></span>
    </span>)}
    {configured.state !== 'ready' && <span className="person-weight-empty">{configured.state === 'missing-profile' ? 'ยังยืนยันการตั้งค่ารายบุคคลไม่ได้' : configured.state === 'missing-catalog' ? 'ไม่มีข้อมูลทะเบียน KPI' : 'ยังไม่มี KPI จากงานในช่วงที่เลือก'}</span>}
    {configured.rows.length > limit && <span className="person-weight-more">อีก {configured.rows.length - limit} รายการ • เปิดรายละเอียดเพื่อดูทั้งหมด</span>}
  </span>;
}

function EmployeesPanel({ personRows, teams, personTeamFilter, setPersonTeamFilter, tasks, selectedPerson, setSelectedPerson, holidays = [], kpis = [] }) {
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
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">คะแนนรายบุคคลใช้น้ำหนักเฉพาะบุคคลที่บันทึกกับงาน แยกจากคะแนนทีม • ตัวกรองใช้กับการ์ดและตารางนี้</p>
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
        <AllItems rows={filtered} initial={12}>{(row, index) => (
          <button key={row.employeeKey || row.name} className="mx-card employee-card p-5 text-left" onClick={() => setSelectedPerson(row)}>
            <div className="flex items-start gap-4">
              <Avatar item={row.profile || row} name={row.person} />
              <div className="min-w-0 flex-1">
                <div className="font-black truncate">{row.person}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="mx-badge status-neutral">{row.team}</span>
                  <span className="mx-badge status-neutral">ลำดับ {index + 1}</span>
                </div>
              </div>
            </div>
            <PersonConfiguredWeights person={row} catalog={kpis} />
            <div className="mini-metric-grid mt-5">
              <div><span>Total</span><strong>{fmtNum(row.total)}</strong></div>
              <div><span>Active Weight</span><strong>{fmtWeightShare(row.activeWeight, row.totalWeight)}</strong></div>
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
        )}</AllItems>
      </div>

      <section className="mx-card p-5 md:p-7">
        <h2 className="section-title m-0">ตารางผลงานรายบุคคล</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">{fmtNum(filtered.length)} people from {fmtNum(tasks.length)} task records.</p>
        <DataTable minWidth={1220}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
              <th className="p-4">ลำดับ</th>
              <SortHeader label="Name" sortKey="person" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Team" sortKey="team" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <th className="p-4">น้ำหนัก KPI ที่ตั้งไว้</th>
              <SortHeader label="Total" sortKey="total" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
              <SortHeader label="Active Weight" sortKey="activeOwnShare" sortConfig={employeeSort} onSort={(key) => setEmployeeSort((current) => nextSort(current, key))} />
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
              <tr key={row.employeeKey || row.name}>
                <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td>
                <td className="p-4 font-black"><button className="metric-link" onClick={() => setSelectedPerson(row)}>{row.person}</button></td>
                <td className="p-4"><span className="mx-badge status-neutral">{row.team}</span></td>
                <td className="p-4 person-weight-cell"><button className="person-weight-open" onClick={() => setSelectedPerson(row)} aria-label={'ดูน้ำหนัก KPI ของ ' + row.person}><PersonConfiguredWeights person={row} catalog={kpis} /></button></td>
                <td className="p-4">{fmtNum(row.total)}</td><td className="p-4 font-bold">{fmtWeightShare(row.activeWeight, row.totalWeight)}</td><td className="p-4">{fmtPct(row.workloadShare)}</td><td className="p-4">{fmtNum(row.completed)}</td><td className="p-4">{fmtNum(row.slaPass)}</td><td className="p-4"><TaskLink title={row.team + ' / งานเสร็จช้า'} items={row.items.filter(isCompletedLate)}>{fmtNum(row.slaFail)}</TaskLink></td><td className="p-4 font-bold">{fmtPct(row.sla)}</td><td className="p-4 font-bold">{fmtPct(row.completion)}</td>
                <td className="p-4"><span className={`mx-badge ${healthClass(row.weightedScore)}`}>{fmtPct(row.weightedScore)} • {performanceLabel(row.weightedScore)}</span></td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="13">No employee records match these filters.</td></tr>}
          </tbody>
        </DataTable>
      </section>

    </div>
  );
}

function KpiAnalysisPanel({ kpiRows, personRows, teamRows }) {
  const { openPerson, overviewBasis } = React.useContext(PerformanceActions);
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
  const totalTasks = filteredKpiRows.reduce((sum, row) => sum + row.total, 0);
  const topPerformer = [...filteredPersonRows].filter((row) => row.weightedScore !== null).sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total)[0];
  const bestTeam = [...filteredTeamRows].filter((row) => row.sla !== null).sort((a, b) => (b.sla || 0) - (a.sla || 0) || b.total - a.total)[0];
  const avgTasks = filteredPersonRows.length ? Math.round(filteredPersonRows.reduce((sum, row) => sum + row.total, 0) / filteredPersonRows.length) : 0;
  const highRiskKpis = [...filteredKpiRows].filter((row) => row.overdue || row.risk).sort((a, b) => b.overdueWeight - a.overdueWeight || b.overdue - a.overdue || b.atRiskWeight - a.atRiskWeight || b.risk - a.risk);
  const employeeLeaders = [...filteredPersonRows]
    .filter((row) => row.sla !== null || row.completion !== null)
    .sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total);
  const teamKpiRows = filteredTeamRows.map((team) => {
    const groups = Object.entries(groupBy(team.items || [], mainKpi))
      .map(([name, items]) => ({
        name,
        total: items.length,
        fail: items.filter(isCompletedLate).length,
        scores: calcWeightedScores(items, team.weightForTask),
      }))
      .sort((a, b) => b.total - a.total || b.fail - a.fail);
    return { ...team, groups };
  });
  return (
    <div className="grid gap-6">
      <section className="mx-card p-5 md:p-7 kpi-intelligence">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
          <div>
            <p className="eyebrow mb-2">KPI Intelligence</p>
            <h2 className="section-title m-0">ภาพวิเคราะห์ KPI สำหรับผู้บริหาร</h2>
            <p className="mt-2 mb-0 text-sm text-[var(--mx-muted)]">ตัวกรองในแท็บนี้ใช้กับข้อมูลวิเคราะห์ด้านล่าง • KPI ในขอบเขตนี้ใช้{overviewBasis === 'team' ? 'น้ำหนักมาตรฐานทีม' : 'น้ำหนักบุคคล'} • ตารางคะแนนทีมใช้น้ำหนักมาตรฐานทีม • บุคคลใช้น้ำหนักเฉพาะบุคคล</p>
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
            <strong>{fmtNum(filteredKpiRows.length)}</strong>
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
            <em>{fmtNum(filteredPersonRows.length)} คนตามตัวกรอง</em>
          </div>
        </div>
      </section>

      <div className="kpi-analysis-grid">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">สัดส่วน KPI Portfolio</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">เรียงตามปริมาณงาน พร้อมคุณภาพการส่งมอบของแต่ละหมวด KPI</p>
          <div className="kpi-portfolio-list">
            {filteredKpiRows.map((row, index) => (
              <div key={row.name} className="kpi-row-card">
                <div className="kpi-row-rank">{String(index + 1).padStart(2, '0')}</div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="font-black break-words leading-tight"><TaskLink title={row.name} items={row.items}>{row.name}</TaskLink></div>
                    <span className={`mx-badge ${healthClass(row.sla)}`}>{fmtPct(row.sla)}</span>
                  </div>
                  <HorizontalBar value={row.share} color={row.sla >= 95 ? 'var(--mx-success)' : row.sla >= 85 ? 'var(--mx-warning)' : 'var(--mx-danger)'} />
                </div>
                <div className="kpi-row-stats">
                  <span><b>{fmtPct(row.share)}</b><em>Share</em></span>
                  <span><b>{fmtNum(row.total)}</b><em>Total</em></span>
                  <span><b>{fmtPct(row.weightShare)}</b><em>สัดส่วนภาระงาน</em></span>
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
                  <div className="font-black"><TaskLink title={row.name + ' / งานเสี่ยง'} items={row.riskItems}>{row.name}</TaskLink></div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="mx-badge status-neutral">Active {fmtNum(row.active)}</span>
                    <span className="mx-badge status-info">สัดส่วนภาระงาน {fmtPct(row.weightShare)}</span>
                    <span className={`mx-badge ${row.overdue > 0 ? 'status-bad' : 'status-warn'}`}>เกินกำหนด {fmtNum(row.overdue)} / ใกล้ครบ {fmtNum(row.risk)}</span>
                  </div>
                </div>
                <div className="watch-score">
                  <strong>{fmtPct(row.sla)}</strong>
                  <span>SLA</span>
                </div>
              </div>
            ))}
            {!highRiskKpis.length && <div className="text-sm text-[var(--mx-muted)]">ไม่มี KPI ที่มีงานเกินกำหนดหรือใกล้ครบกำหนดตามตัวกรอง</div>}
          </div>
        </section>
      </div>

      <div className="grid 2xl:grid-cols-[1fr_1fr] gap-5">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">บุคคลเรียงตาม Performance</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">อันดับบุคคลจากคะแนนถ่วงน้ำหนัก พร้อมปริมาณงานและสถานะ SLA</p>
          <DataTable minWidth={760}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
                <th className="p-4">ลำดับ</th><th className="p-4">Name</th><th className="p-4">Team</th><th className="p-4">Tasks</th><th className="p-4">W.SLA</th><th className="p-4">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--mx-line)]">
              {employeeLeaders.map((row, index) => (
                <tr key={row.name}>
                  <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td>
                  <td className="p-4 font-black max-w-[220px]"><button className="metric-link" onClick={() => openPerson(row)}>{row.person}</button></td>
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
                <th className="p-4">ลำดับ</th><th className="p-4">Team</th><th className="p-4">Total</th><th className="p-4">W.SLA</th><th className="p-4">Top KPI Mix</th>
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

function KpiWeightsPanel({ catalog, tasks, personRows, holidays, asOfDate, kpiSearch, setKpiSearch }) {
  const [mode, setMode] = useState('current');
  const [personKey, setPersonKey] = useState('all');
  const [mainFilter, setMainFilter] = useState('all');
  const [sort, setSort] = useState('main');
  const person = personRows.find((row) => row.employeeKey === personKey);
  const all = buildWeightCatalogRows(catalog, tasks, holidays, asOfDate);
  const mains = [...new Set(all.map((row) => row.main))].sort((a, b) => a.localeCompare(b, 'th'));
  const activeMainFilter = mains.includes(mainFilter) ? mainFilter : 'all';
  const rows = sortRows(all.filter((row) => (mode === 'actual' || row.configured)
    && (activeMainFilter === 'all' || row.main === activeMainFilter)
    && matchesSearch(row, ['team', 'main', 'sub'], kpiSearch)).map((row) => ({ ...row, total: row.items.length, risk: row.portfolio.overdueWeight + row.portfolio.atRiskWeight })), { key: sort, direction: sort === 'main' ? 'asc' : 'desc' });
  return <section className="mx-card p-5 md:p-7">
    <h2 className="section-title">ทะเบียน KPI และน้ำหนักที่ใช้จริง</h2>
    <p className="text-sm text-[var(--mx-muted)]">ทะเบียนปัจจุบันรวม KPI ที่ยังไม่มีงาน • น้ำหนักงานย้อนหลังและคะแนนในตารางนี้ยึดน้ำหนักบุคคลที่บันทึกกับงาน แยกจากคะแนนทีม</p>
    <div className="scope-controls no-print">
      <label>มุมมอง<select className="mx-input" aria-label="มุมมอง" value={mode} onChange={(e) => setMode(e.target.value)}><option value="current">การตั้งค่าปัจจุบัน</option><option value="actual">น้ำหนักจากงานในช่วงที่เลือก</option></select></label>
      <label>บุคคล<select className="mx-input" aria-label="บุคคล" value={person ? personKey : 'all'} onChange={(e) => setPersonKey(e.target.value)}><option value="all">ทั้งหมดในขอบเขต</option>{personRows.map((row) => <option key={row.employeeKey} value={row.employeeKey}>{row.person} / {row.team}</option>)}</select></label>
      {!person && <><label>Main KPI<select className="mx-input" aria-label="Main KPI" value={activeMainFilter} onChange={(e) => setMainFilter(e.target.value)}><option value="all">ทั้งหมด</option>{mains.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label>ค้นหา<input className="mx-input" value={kpiSearch} onChange={(e) => setKpiSearch(e.target.value)} placeholder="ทีม / Main / Sub KPI" /></label>
      <label>เรียงตาม<select className="mx-input" aria-label="เรียงตาม" value={sort} onChange={(e) => setSort(e.target.value)}><option value="main">Main KPI</option><option value="total">จำนวนงาน</option><option value="risk">น้ำหนักงานเสี่ยง</option></select></label></>}
    </div>
    <p className="text-sm">{person ? 'รายละเอียดบุคคล: ' + person.person + (mode === 'current' ? ' • KPI ที่ได้รับมอบหมายตามทะเบียนปัจจุบัน' : ' • KPI จากงานจริงในช่วงที่เลือก') : (mode === 'current' ? 'การตั้งค่าปัจจุบัน' : 'น้ำหนักจากงานในช่วงที่เลือก') + ' • ' + rows.length + ' รายการ'} • ตัวกรองหน้านี้ใช้เฉพาะตารางนี้</p>
    {person ? <PersonalKpiTable key={person.employeeKey} person={person} catalog={catalog} holidays={holidays} mode={mode} /> : <>
      <DataTable minWidth={1100}><thead><tr><th>ทีม</th><th>Main KPI</th><th>Sub KPI</th><th>น้ำหนักพื้นฐานปัจจุบัน</th><th>น้ำหนักที่บันทึกกับงาน</th><th>ทั้งหมด / เสร็จ / ค้าง / ยกเลิก</th><th>W.Completion</th><th>W.SLA</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.key}><td>{row.team}</td><td>{row.main}</td><td><TaskLink title={row.main + ' / ' + row.sub} items={row.items}>{row.sub}</TaskLink><small className="block">{row.configured ? 'มีในทะเบียนปัจจุบัน' : 'จากงานจริง / ไม่มีทะเบียนที่ตรงกัน'}</small></td>
          <td>{formatWeights(row.baseWeights)}</td><td>{formatWeights(row.weights)}{row.weights.length > 1 && <small className="block">หลายค่าน้ำหนัก ไม่ใช้ค่าสูงสุดแทนทั้งกลุ่ม</small>}{row.items.some((task) => !hasExplicitWeight(task)) && <small className="block">มีงานใช้ค่าสำรอง 1</small>}</td>
          <td><TaskLink title={'งาน: ' + row.sub} items={row.items}>{row.items.length}</TaskLink> / {row.portfolio.completed.length} / {row.portfolio.active.length} / {row.portfolio.cancelled.length}</td><td>{fmtPct(row.portfolio.completion)}</td><td>{fmtPct(row.portfolio.scores.sla)}</td></tr>)}
          {!rows.length && <tr><td colSpan="8">ไม่มีรายการตรงกับเงื่อนไข หรือยังโหลดทะเบียน KPI ไม่ได้</td></tr>}</tbody></DataTable>
      <p className="text-sm text-[var(--mx-muted)]">น้ำหนักพื้นฐานอาจถูกปรับเฉพาะบุคคล เลือกบุคคลเพื่อดูค่าที่ใช้กับคนนั้น • ไม่รวมค่าน้ำหนักจากหลาย Sub KPI เป็นน้ำหนัก Main KPI โดยอัตโนมัติ</p></>}
  </section>;
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const initialEmpId = String(params.get('empId') || '').trim().toUpperCase();
  const initialSessionId = String(params.get('sessionId') || '').trim();
  const [empId, setEmpId] = useState(initialEmpId);
  const [selectedMonths, setSelectedMonths] = useState(() => {
    // Parse months from URL: "months=1,3,5" or legacy "month=N"
    if (params.has('months')) {
      const raw = params.get('months').split(',').map(Number).filter((n) => n >= 1 && n <= 12);
      return raw;
    }
    if (params.has('month') && Number(params.get('month')) > 0) {
      return [Number(params.get('month'))];
    }
    return [];
  });
  const [year, setYear] = useState(Number(params.get('year') || new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState(() => TAB_ITEMS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'overview');
  const [personTeamFilter, setPersonTeamFilter] = useState('all');
  const [kpiSearch, setKpiSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [taskSelection, setTaskSelection] = useState(null);
  const [theme, setTheme] = useState(getInitialExecutiveTheme);
  const [state, setState] = useState({ loading: false, error: '', user: null, tasks: [], staff: [], holidays: [], kpis: [], lastUpdated: null });
  const loadRequestRef = React.useRef(0);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - 3 + i);
  }, []);

  const load = async (nextEmpId = empId) => {
    const requestId = ++loadRequestRef.current;
    const cleanEmpId = String(nextEmpId || '').trim().toUpperCase();
    if (!cleanEmpId) {
      setState((prev) => ({ ...prev, error: 'Please provide empId in the URL or the input field.' }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: '', warnings: [], tasks: [], staff: [], kpis: [], lastUpdated: null }));
    try {
      const session = readExecutiveSession(cleanEmpId, initialSessionId);
      if (session && typeof window !== 'undefined') window.MAXIWA_ACTIVE_SESSION = session;
      const initial = await API.getInitialData(cleanEmpId, session?.sessionId || initialSessionId);
      if (requestId !== loadRequestRef.current) return;
      if (initial?.error) throw new Error(initial.error);
      if (!initial?.user) throw new Error('User profile was not found.');
      const normalizedEmpId = String(initial.user.empId || initial.user.empid || cleanEmpId).trim();
      const user = { ...initial.user, empId: normalizedEmpId, empid: normalizedEmpId, kpis: initial.kpis || [] };
      const activeSessionId = String(initial.session?.sessionId || initial.sessionId || user.serverSessionId || session?.sessionId || initialSessionId || '').trim();
      if (activeSessionId && typeof window !== 'undefined') {
        window.MAXIWA_ACTIVE_SESSION = { empId: normalizedEmpId, sessionId: activeSessionId };
      }
      const taskPromise = isSelfScopedRole(user.role)
        ? API.getPerformanceEmployeeTasks(user, selectedMonths, year, userEmpId(user))
        : API.getPerformanceTasks(selectedMonths, year, isTeamScopedRole(user.role) ? user.team : 'all', userEmpId(user));

      const warnings = [];
      const staffPromise = (async () => {
        try {
          if (isSelfScopedRole(user.role)) {
            return [user];
          } else if (isTeamScopedRole(user.role)) {
            const staffRes = await API.getAllStaffInTeam(user.team, userEmpId(user));
            if (staffRes?.error) throw new Error('Staff directory unavailable');
            return staffRes.staff || [];
          } else if (isStrategicViewRole(user.role) || user.role === 'Manager' || user.role === 'Admin') {
            const staffRes = await API.getAllStaff(userEmpId(user));
            if (staffRes?.error) throw new Error('Staff directory unavailable');
            return filterByAllowedTeams(user, staffRes.staff || []);
          }
        } catch (staffError) {
          warnings.push('โหลดทะเบียนบุคลากรไม่สำเร็จ รายชื่อคนที่ไม่มีงานและน้ำหนักเฉพาะบุคคลอาจไม่ครบ');
          return [];
        }
        return [];
      })();

      const kpiPromise = (async () => {
        try {
          if (!isSelfScopedRole(user.role)) {
            const kpiTeam = isTeamScopedRole(user.role) ? user.team : '';
            const kpisRes = await API.getKPIsByTeam(kpiTeam);
            if (kpisRes?.error) throw new Error('KPI catalog unavailable');
            return kpisRes.kpis || user.kpis || [];
          }
        } catch {
          warnings.push('โหลดทะเบียน KPI ไม่สำเร็จ ใช้ข้อมูลเริ่มต้นที่มี รายการตั้งค่าอาจไม่ครบ');
        }
        return user.kpis || [];
      })();

      const adminHolidayPromise = user.role === 'Admin'
        ? API.getHolidays({ 'x-admin-empid': userEmpId(user) }).catch(() => null)
        : Promise.resolve(null);

      const [taskResult, staff, kpis, holidayResult] = await Promise.all([
        taskPromise,
        staffPromise,
        kpiPromise,
        adminHolidayPromise,
      ]);
      if (requestId !== loadRequestRef.current) return;

      if (taskResult?.error) throw new Error(taskResult.error);
      const tasks = filterPerformanceTasks(scopeTasksForUser(user, taskResult.tasks || taskResult || []));
      let holidays = taskResult.holidays || [];
      if (holidayResult) {
        holidays = holidayResult.holidays || holidays;
      }
      setState({ loading: false, error: '', warnings, user, tasks, staff, holidays, kpis, lastUpdated: Date.now() });
      const url = new URL(window.location.href);
      url.searchParams.set('empId', cleanEmpId);
      if (selectedMonths.length > 0) {
        url.searchParams.set('months', selectedMonths.join(','));
      } else {
        url.searchParams.delete('months');
      }
      url.searchParams.delete('month');
      url.searchParams.set('year', String(year));
      url.searchParams.delete('sessionId');
      window.history.replaceState(null, '', url);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Unable to load dashboard data.' }));
    }
  };

  useEffect(() => {
    if (!initialEmpId) return undefined;
    const timer = window.setTimeout(() => load(initialEmpId), 240);
    return () => window.clearTimeout(timer);
  }, [selectedMonths.join(','), year]);

  useEffect(() => {
    applyExecutiveTheme(theme);
  }, [theme]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState(null, '', url);
  }, [activeTab]);

  const allTasks = useMemo(() => filterPerformanceTasks(state.tasks || []), [state.tasks]);
  const visibleStaff = useMemo(() => filterByAllowedTeams(state.user, isSelfScopedRole(state.user?.role) ? [state.user] : state.staff || [])
    .filter((profile) => profile && !isResignedTask(profile) && (!isTeamScopedRole(state.user?.role) || teamName(profile) === state.user.team)), [state.user, state.staff]);
  const visibleCatalog = useMemo(() => filterByAllowedTeams(state.user, state.kpis || []).filter((kpi) =>
    (!isTeamScopedRole(state.user?.role) || kpi.team === state.user.team)
    && (!isSelfScopedRole(state.user?.role) || ((!kpi.team || kpi.team === state.user.team) && isKpiAssignedToPerson(state.user, kpi)))), [state.kpis, state.user]);
  const tasks = allTasks;
  const catalog = visibleCatalog;
  const staffDirectory = visibleStaff;
  const teamWeightForTask = useMemo(() => createTeamWeightResolver(catalog), [catalog]);
  const overviewWeight = isSelfScopedRole(state.user?.role) ? taskWeight : teamWeightForTask;
  useEffect(() => { setTaskSelection(null); setSelectedPerson(null); setSelectedTeam(null); }, [state.tasks, year, selectedMonths.join(',')]);
  const holidaySet = useMemo(() => buildHolidaySet(state.holidays || []), [state.holidays]);
  // riskAsOfDate: for single-month use end-of-month; for multi-month or all: use end of latest selected month or today
  const riskAsOfDate = useMemo(() => {
    if (selectedMonths.length === 0) return getPerformanceRiskAsOfDate(12, year);
    const maxMonth = Math.max(...selectedMonths);
    return getPerformanceRiskAsOfDate(maxMonth, year);
  }, [selectedMonths, year]);
  const teamPortfolio = useMemo(() => buildPortfolio(tasks, holidaySet, riskAsOfDate, teamWeightForTask), [tasks, holidaySet, riskAsOfDate, teamWeightForTask]);
  const personalPortfolio = useMemo(() => buildPortfolio(tasks, holidaySet, riskAsOfDate), [tasks, holidaySet, riskAsOfDate]);
  const portfolio = isSelfScopedRole(state.user?.role) ? personalPortfolio : teamPortfolio;
  const heroPortfolio = activeTab === 'employees' || (activeTab !== 'teams' && isSelfScopedRole(state.user?.role)) ? personalPortfolio : teamPortfolio;
  const missingTeamWeights = heroPortfolio.scoreBasis === 'team' ? heroPortfolio.dataQuality.checks.find((check) => check.key === 'missingWeight').items : [];
  const heroBasisLabel = heroPortfolio.scoreBasis === 'team' ? 'คะแนนทีม • น้ำหนักมาตรฐานทีม' : 'คะแนนบุคคล • น้ำหนักเฉพาะบุคคลที่บันทึกกับงาน';
  const periodLabel = useMemo(() => {
    if (selectedMonths.length === 0) return `ทุกเดือน ${year}`;
    if (selectedMonths.length === 1) return `${MONTH_NAMES[selectedMonths[0] - 1]} ${year}`;
    return `${selectedMonths.map((m) => MONTH_NAMES_TH[m - 1]).join(', ')} ${year}`;
  }, [selectedMonths, year]);
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

  const teamRows = useMemo(() => {
    const rows = buildGroupRows(tasks, teamName, holidaySet, riskAsOfDate, teamWeightForTask);
    [...new Set(staffDirectory.map(teamName))].forEach((team) => { if (!rows.some((row) => row.name === team)) rows.push({ ...emptyPersonMetrics(holidaySet, riskAsOfDate), name: team }); });
    return rows.map((row) => {
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
      staffDirectory.filter((profile) => teamName(profile) === row.name).forEach((profile) => { const key = personName(profile).trim().toLowerCase(); if (!memberMap[key]) memberMap[key] = { key, name: personName(profile), profile }; });
      const members = Object.values(memberMap).sort((a, b) => a.name.localeCompare(b.name));
      return {
        ...row,
        team: row.name,
        weightForTask: teamWeightForTask,
        scoreBasis: 'team',
        members,
        workloadShare: teamPortfolio.totalWeight ? roundMetric((row.totalWeight / teamPortfolio.totalWeight) * 100, 1) : 0,
        activeWeightShare: teamPortfolio.activeWeight ? roundMetric((row.activeWeight / teamPortfolio.activeWeight) * 100, 1) : 0,
        riskWeightShare: (teamPortfolio.overdueWeight + teamPortfolio.atRiskWeight) ? roundMetric(((row.overdueWeight + row.atRiskWeight) / (teamPortfolio.overdueWeight + teamPortfolio.atRiskWeight)) * 100, 1) : 0,
      };
    })
    .sort((a, b) => ((b.overdueWeight * 3 + b.atRiskWeight + b.backlog / Math.max(b.total, 1)) - (a.overdueWeight * 3 + a.atRiskWeight + a.backlog / Math.max(a.total, 1))) || (b.totalWeight - a.totalWeight)); }, [tasks, teamWeightForTask, staffDirectory, staffByName, holidaySet, riskAsOfDate, teamPortfolio.totalWeight, teamPortfolio.activeWeight, teamPortfolio.overdueWeight, teamPortfolio.atRiskWeight]);

  const personRows = useMemo(() => buildPeopleRows(tasks, staffDirectory, holidaySet, riskAsOfDate), [tasks, staffDirectory, holidaySet, riskAsOfDate]);

  const statusRows = useMemo(() => Object.entries(groupBy(tasks, (task) => task.status || 'Unknown'))
    .map(([status, items]) => ({ status, total: items.length, pct: tasks.length ? Math.round((items.length / tasks.length) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total), [tasks]);

  const kpiRows = useMemo(() => buildKpiRows(tasks, holidaySet, riskAsOfDate, overviewWeight), [tasks, holidaySet, riskAsOfDate, overviewWeight]);

  const teams = useMemo(() => [...new Set(teamRows.map((row) => row.team))], [teamRows]);

  const monthlyTrend = useMemo(() => {
    const sla = [];
    const trendCompletion = [];
    const risk = [];
    const total = [];
    const completed = [];
    const intakeFields = ['startdate', 'created_at', 'timestamp'];
    const completionFields = ['completiondate'];
    const today = normalizeDateOnly(new Date());
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth();
    const currentDay = today.getDate();
    const selectedYear = Number(year);

    // When no months are selected (all time) or multiple months → show monthly trend
    // When exactly one month is selected → show daily trend for that month
    if (selectedMonths.length !== 1) {
      const monthCount = selectedYear < currentYear ? 12 : selectedYear === currentYear ? currentMonthIndex + 1 : 0;
      // If specific months selected, show only those; otherwise all months up to current
      const months = selectedMonths.length > 0
        ? [...new Set(selectedMonths)].sort((a, b) => a - b).map((m) => m - 1).filter((idx) => idx <= (selectedYear === currentYear ? currentMonthIndex : 11))
        : Array.from({ length: monthCount }, (_, i) => i);
      months.forEach((monthIndex) => {
        const intakeTasks = tasks.filter((task) => taskDateMatchesPeriod(task, intakeFields, year, monthIndex, null, today));
        const completedTasks = tasks.filter((task) => isCompleted(task) && taskDateMatchesPeriod(task, completionFields, year, monthIndex, null, today));
        const riskTasks = tasks.filter((task) => taskDueRiskMatchesPeriod(task, year, monthIndex, null, holidaySet, today));
        const monthPortfolio = buildPortfolio(completedTasks, holidaySet, riskAsOfDate, overviewWeight);
        sla.push(completedTasks.length ? monthPortfolio.scores.sla : null);
        trendCompletion.push(null);
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

    const month = selectedMonths[0];
    const monthIndex = month - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayCount = selectedYear < currentYear || (selectedYear === currentYear && monthIndex < currentMonthIndex)
      ? daysInMonth
      : selectedYear === currentYear && monthIndex === currentMonthIndex
        ? currentDay
        : 0;
    const days = Array.from({ length: dayCount }, (_, i) => i + 1);
    days.forEach((day) => {
      const intakeTasks = tasks.filter((task) => taskDateMatchesPeriod(task, intakeFields, year, monthIndex, day, today));
      const completedTasks = tasks.filter((task) => isCompleted(task) && taskDateMatchesPeriod(task, completionFields, year, monthIndex, day, today));
      const riskTasks = tasks.filter((task) => taskDueRiskMatchesPeriod(task, year, monthIndex, day, holidaySet, today));
      const dayPortfolio = buildPortfolio(completedTasks, holidaySet, riskAsOfDate, overviewWeight);
      sla.push(completedTasks.length ? dayPortfolio.scores.sla : null);
      trendCompletion.push(null);
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
  }, [allTasks, tasks, year, selectedMonths, holidaySet, riskAsOfDate, overviewWeight]);

  const criticalQueue = useMemo(() => portfolio.active
    .map((task) => ({ task, days: daysUntil(task, holidaySet, riskAsOfDate), weight: overviewWeight(task) }))
    .filter((item) => item.days !== null && item.days <= 3)
    .sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return (riskA - riskB) || (a.days - b.days) || (b.weight - a.weight);
    }), [portfolio.active, holidaySet, riskAsOfDate, overviewWeight]);

  const activePerson = personRows.find((row) => row.employeeKey === selectedPerson?.employeeKey) || null;
  const activeTeam = teamRows.find((row) => row.team === selectedTeam?.team) || null;
  const actions = {
    teamWeightForTask,
    overviewBasis: portfolio.scoreBasis,
    reportContext: periodLabel + ' • ทีม ' + 'ทั้งหมดที่มีสิทธิ์' + ' • Main KPI ' + 'ทั้งหมด' + ' • ' + riskAsOfLabel(riskAsOfDate) + ' • อัปเดต ' + (state.lastUpdated ? new Date(state.lastUpdated).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ยังไม่มีข้อมูล') + ' (เวลาไทย) • สถานะล่าสุดที่โหลด',
    openTasks: (title, items) => { const visible = new Set(tasks); setTaskSelection({ title, items: items.filter((task) => visible.has(task)) }); },
    openPerson: (source) => {
      const row = personRows.find((person) => person.employeeKey === source?.employeeKey || person.employeeKey === personGroupKey(source) || person.items.includes(source));
      if (row) { setTaskSelection(null); setSelectedTeam(null); setSelectedPerson(row); }
    },
    openTeam: (source) => { setTaskSelection(null); setSelectedPerson(null); setSelectedTeam(source); },
  };
  return (
    <PerformanceActions.Provider value={actions}><div className={taskSelection || activePerson || activeTeam ? 'performance-root has-dialog' : 'performance-root'}><Shell>
      <header className="mx-card stage-header p-5 md:p-8">
        <div className="executive-header-grid">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              {state.user && <Avatar item={state.user} name={state.user.name || state.user.empId} className="header-avatar" />}
              <span className="mx-badge status-info"><i className="fa-solid fa-display"></i> Performance View</span>
              <span className="mx-badge status-neutral">METRIX Verity</span>
              {state.user && <span className="mx-badge status-good">{state.user.team}</span>}
            </div>
            <h1 className="display-title mt-5 mb-0 break-words">
              <span className="block">ภาพรวมผลการดำเนินงาน</span>
              <span className="display-title-sub block">SLA & KPI Command Center</span>
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
        {(state.warnings || []).map((warning) => <p key={warning} role="status" className="mt-3 text-sm text-[var(--mx-warning)]">{warning}</p>)}
      </header>

      <section className="mx-card hero-band p-5 md:p-8">
        <p className="score-basis-label mb-3 text-sm font-bold">{heroBasisLabel} • เฉพาะงานในขอบเขตที่มีสิทธิ์</p>
        {missingTeamWeights.length > 0 && <p role="status" className="mb-3 text-sm">น้ำหนักมาตรฐานทีมไม่ครบ <TaskLink items={missingTeamWeights} title="งานที่ไม่มีน้ำหนักมาตรฐานทีม">{missingTeamWeights.length} งาน</TaskLink> • ใช้ค่าสำรอง 1 แยกจากน้ำหนักบุคคล</p>}
        <div className="presentation-grid items-stretch">
          <div className="grid md:grid-cols-2 gap-5">
            <GaugeMetric label="SLA รวม" value={heroPortfolio.scores.sla} sub="น้ำหนักงานเสร็จตรงเวลา ÷ น้ำหนักงานเสร็จทั้งหมด" tone="var(--mx-info)" />
            <GaugeMetric label="Completion ถ่วงน้ำหนัก" value={heroPortfolio.completion} sub={`เสร็จ ${heroPortfolio.completed.length} / ไม่ยกเลิก ${tasks.length - heroPortfolio.cancelled.length} งาน • ยกเลิก ${heroPortfolio.cancelled.length}`} tone="var(--mx-success)" />
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            <Metric items={tasks} label="งานทั้งหมด" value={fmtNum(tasks.length)} sub={periodLabel} icon="fa-clipboard-list" tone="status-neutral" />
            <Metric items={heroPortfolio.overdue} label="เกินกำหนด" value={fmtNum(heroPortfolio.overdue.length)} sub="งานที่ยัง active และเลย deadline" icon="fa-triangle-exclamation" tone={heroPortfolio.overdue.length ? 'status-bad' : 'status-good'} />
            <Metric items={heroPortfolio.atRisk} label="เสี่ยงใกล้ครบกำหนด" value={fmtNum(heroPortfolio.atRisk.length)} sub="ครบกำหนดภายใน 3 วันทำการ" icon="fa-clock" tone={heroPortfolio.atRisk.length ? 'status-warn' : 'status-good'} />
          </div>
        </div>
      </section>

      <TabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonths={selectedMonths}
        setSelectedMonths={setSelectedMonths}
        year={year}
        setYear={setYear}
        years={years}
        loading={state.loading}
        lastUpdated={state.lastUpdated}
        onLoad={() => load(empId)}
      />

      {activeTab === 'overview' && <OverviewPanel portfolio={portfolio} teamRows={teamRows} kpiRows={kpiRows} statusRows={statusRows} criticalQueue={criticalQueue} monthlyTrend={monthlyTrend} periodLabel={periodLabel} riskAsOfDate={riskAsOfDate} user={state.user} empId={empId} tasks={tasks} />}
      {activeTab === 'teams' && <TeamsPanel teamRows={teamRows} holidays={holidaySet} />}
      {activeTab === 'employees' && <EmployeesPanel personRows={personRows} teams={teams} personTeamFilter={personTeamFilter} setPersonTeamFilter={setPersonTeamFilter} tasks={tasks} selectedPerson={selectedPerson} setSelectedPerson={actions.openPerson} holidays={holidaySet} kpis={catalog} />}
      {activeTab === 'kpi' && <KpiAnalysisPanel kpiRows={kpiRows} personRows={personRows} teamRows={teamRows} />}
      {activeTab === 'weights' && <KpiWeightsPanel catalog={catalog} tasks={tasks} personRows={personRows} holidays={holidaySet} asOfDate={riskAsOfDate} kpiSearch={kpiSearch} setKpiSearch={setKpiSearch} />}
      <TeamDetailModal team={activeTeam} holidays={holidaySet} personRows={personRows} onClose={() => setSelectedTeam(null)} />
      <EmployeeDetailModal person={activePerson} holidays={holidaySet} kpis={catalog} onClose={() => setSelectedPerson(null)} />
      {taskSelection && <TaskExplorer key={taskSelection.title} selection={taskSelection} holidays={holidaySet} asOfDate={riskAsOfDate} onClose={() => setTaskSelection(null)} />}
    </Shell></div></PerformanceActions.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
