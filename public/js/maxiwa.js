const { useEffect, useMemo, useState, useCallback } = React;

const SESSION_KEY = 'maxiwa-kpi-session';
const SESSION_ID_KEY = 'maxiwa-kpi-session-id';
const SESSION_LOCK_KEY = 'maxiwa-kpi-active-session';
const SESSION_LOCK_TTL = 45000;
const THEME_KEY = 'maxiwa-kpi-theme';
const SYSTEM_LINKS_KEY = 'maxiwa-system-links';
const RUNTIME_SESSION_ID = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const APP_NAME = 'METRIX Verity';
const APP_TAGLINE = 'Executive Performance System';
const APP_LOGO_URL = 'https://img2.pic.in.th/Logo40f6c473c9a46acd.png';
const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const ROLE_DEFINITIONS = {
  Staff: { scope: 'Self', level: 10, label: 'Staff' },
  Lead: { scope: 'Team', level: 20, label: 'Lead' },
  Manager: { scope: 'Department', level: 30, label: 'Manager' },
  SrManager: { scope: 'Division', level: 40, label: 'Sr. Manager' },
  Director: { scope: 'Division', level: 50, label: 'Director' },
  Executive: { scope: 'Organization', level: 60, label: 'Executive' },
  Admin: { scope: 'System', level: 90, label: 'System Admin' },
};

const ROLE_OPTIONS = Object.entries(ROLE_DEFINITIONS).map(([value, config]) => ({ value, label: config.label }));
const SCOPE_OPTIONS = ['Self', 'Team', 'Department', 'Division', 'Organization', 'System'];
const ADMIN_ROLES = ['Admin'];
const TEAM_MANAGER_ROLES = ['Lead'];
const DEPARTMENT_MANAGER_ROLES = ['Manager'];
const STRATEGIC_VIEW_ROLES = ['SrManager', 'Director', 'Executive'];
const EXECUTIVE_VIEW_ROLES = ['Manager', 'SrManager', 'Director', 'Executive', 'Admin'];

const DEFAULT_SYSTEM_LINKS = [
  {
    id: 'maxiwa-kpi',
    name: 'METRIX Verity',
    description: 'KPI, SLA, task tracking, and executive performance dashboard',
    url: './maxiwa.html',
    icon: 'fa-chart-line',
    status: 'Active',
    visibleToAll: true,
    allowedRoles: [],
    allowedTeams: [],
    allowedEmpIds: [],
    isActive: true,
  },
  {
    id: 'executive-view',
    name: 'Executive Dashboard',
    description: 'Portfolio, risk, SLA, and weighted KPI view for management',
    url: './dashboard.html',
    icon: 'fa-display',
    status: 'Active',
    visibleToAll: false,
    allowedRoles: EXECUTIVE_VIEW_ROLES,
    allowedTeams: [],
    allowedEmpIds: [],
    isActive: true,
  },
  {
    id: 'pr-system',
    name: 'PR System',
    description: 'Create and track purchase request work outside MAXIWA',
    url: '',
    icon: 'fa-file-invoice',
    status: 'Coming Soon',
    visibleToAll: false,
    allowedRoles: ['Staff', 'Lead', 'Manager', 'Admin'],
    allowedTeams: [],
    allowedEmpIds: [],
    isActive: true,
  },
];

function roleConfig(role) {
  return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.Staff;
}

function roleLabel(role) {
  return roleConfig(role).label || role || '-';
}

function roleScope(user) {
  const role = typeof user === 'string' ? user : user?.role;
  const permissions = userPermissions(user);
  return user?.accessScope || user?.scope || permissions.scope || roleConfig(role).scope;
}

function userPermissions(user) {
  const raw = user?.permissions;
  if (!raw) return {};
  if (typeof raw === 'string') return parseJsonSafe(raw, {}) || {};
  return typeof raw === 'object' ? raw : {};
}

function allowedTeamsForUser(user) {
  const permissions = userPermissions(user);
  return Array.isArray(permissions.allowedTeams)
    ? permissions.allowedTeams.map((team) => String(team || '').trim()).filter(Boolean)
    : [];
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function userEmpId(user) {
  return String(user?.empId || user?.empid || '').trim();
}

function normalizeAppUser(user, fallbackEmpId = '') {
  if (!user) return null;
  const normalizedEmpId = String(user.empId || user.empid || fallbackEmpId).trim();
  return { ...user, empId: normalizedEmpId, empid: normalizedEmpId };
}

function isTeamManagerRole(role) {
  return TEAM_MANAGER_ROLES.includes(role);
}

function isDepartmentManagerRole(role) {
  return DEPARTMENT_MANAGER_ROLES.includes(role);
}

function isStrategicViewRole(role) {
  return STRATEGIC_VIEW_ROLES.includes(role);
}

function canOpenExecutiveView(role) {
  return EXECUTIVE_VIEW_ROLES.includes(role);
}

function roleRequiresTeam(role) {
  return ['Staff', 'Lead'].includes(role);
}

function roleRequiresDepartment(role) {
  return ['Manager', 'SrManager', 'Director', 'Executive'].includes(role);
}

function shouldUsePersonalWork(user, view) {
  return user?.role === 'Staff' || ['my-dashboard', 'my-tasks'].includes(view);
}

function taskScopeForUser(user) {
  if (isTeamManagerRole(user?.role)) return user?.team || 'all';
  return 'all';
}

function shouldApplyAllowedTeamFilter(user) {
  return (isDepartmentManagerRole(user?.role) || isStrategicViewRole(user?.role)) && allowedTeamsForUser(user).length > 0;
}

function filterByAllowedTeams(user, items, getTeam = (item) => item?.team) {
  if (!shouldApplyAllowedTeamFilter(user)) return items || [];
  const allowed = new Set(allowedTeamsForUser(user));
  return (items || []).filter((item) => allowed.has(String(getTeam(item) || '').trim()));
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function createSystemLinkId(value) {
  const slug = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug) return slug;
  const randomPart = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `system-${Date.now().toString(36)}-${randomPart}`;
}

function normalizeSystemLink(item = {}) {
  const id = createSystemLinkId(item.id || item.name);
  return {
    id,
    name: String(item.name || '').trim(),
    description: String(item.description || '').trim(),
    url: String(item.url || '').trim(),
    icon: String(item.icon || 'fa-up-right-from-square').trim(),
    status: item.status || 'Active',
    visibleToAll: item.visibleToAll === true || item.visible_to_all === true || String(item.visibleToAll ?? item.visible_to_all).toLowerCase() === 'true',
    allowedRoles: normalizeList(item.allowedRoles ?? item.allowed_roles),
    allowedTeams: normalizeList(item.allowedTeams ?? item.allowed_team_names),
    allowedEmpIds: normalizeList(item.allowedEmpIds ?? item.allowed_emp_ids).map((empId) => empId.toUpperCase()),
    isActive: item.isActive !== false && item.is_active !== false,
  };
}

function normalizeSystemLinks(links, fallback = DEFAULT_SYSTEM_LINKS) {
  const source = Array.isArray(links) ? links : fallback;
  return source.map(normalizeSystemLink).filter((item) => item.name);
}

function loadSystemLinks() {
  return normalizeSystemLinks(parseJsonSafe(safeLocalGet(SYSTEM_LINKS_KEY), DEFAULT_SYSTEM_LINKS));
}

function cacheSystemLinks(links) {
  const normalized = normalizeSystemLinks(links);
  safeLocalSet(SYSTEM_LINKS_KEY, JSON.stringify(normalized));
  return normalized;
}

async function fetchSystemLinksFromApi(user) {
  if (window.getSupabaseSystemLinks) {
    try {
      const links = await window.getSupabaseSystemLinks();
      return normalizeSystemLinks(Array.isArray(links) ? links : [], []);
    } catch (supabaseError) {
      console.error('Supabase system links are not available.', supabaseError);
      throw supabaseError;
    }
  }
  throw new Error('Supabase system links helper is not available');
}

async function saveSystemLinksToApi(links, empId) {
  const normalized = normalizeSystemLinks(links);
  if (window.saveSupabaseSystemLinks) return window.saveSupabaseSystemLinks(normalized);
  throw new Error('Supabase system links save helper is not available');
}

function systemVisibleToUser(system, user) {
  const item = normalizeSystemLink(system);
  if (!item.isActive || item.status === 'Hidden') return false;
  if (isAdminRole(user?.role)) return true;
  const empId = String(user?.empId || user?.empid || '').trim().toUpperCase();
  if (item.visibleToAll) return true;
  if (item.allowedEmpIds.includes(empId)) return true;
  if (item.allowedRoles.includes(user?.role)) return true;
  if (item.allowedTeams.includes(String(user?.team || '').trim())) return true;
  return false;
}

function visibleSystemLinksForUser(links, user) {
  return normalizeSystemLinks(links).filter((item) => systemVisibleToUser(item, user));
}

const NAV_BY_ROLE = {
  Staff: [
    { id: 'dashboard', label: 'My Dashboard', icon: 'fa-chart-line', group: 'งานของฉัน' },
    { id: 'tasks', label: 'My Tasks', icon: 'fa-list-check', group: 'งานของฉัน' },
    { id: 'create', label: 'Create Task', icon: 'fa-square-plus', group: 'งานของฉัน' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project', group: 'เครื่องมือ' },
  ],
  Lead: [
    { id: 'my-dashboard', label: 'My Dashboard', icon: 'fa-chart-line', group: 'งานของฉัน' },
    { id: 'my-tasks', label: 'My Tasks', icon: 'fa-list-check', group: 'งานของฉัน' },
    { id: 'create', label: 'Create Task', icon: 'fa-square-plus', group: 'งานของฉัน' },
    { id: 'dashboard', label: 'Team Command', icon: 'fa-people-roof', group: 'บริหารทีม' },
    { id: 'tasks', label: 'Team Tasks', icon: 'fa-list-check', group: 'บริหารทีม' },
    { id: 'assign', label: 'Assign Task', icon: 'fa-user-plus', group: 'บริหารทีม' },
    { id: 'people', label: 'Team People', icon: 'fa-users', group: 'บริหารทีม' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project', group: 'เครื่องมือ' },
  ],
  Manager: [
    { id: 'dashboard', label: 'Operations Dashboard', icon: 'fa-chart-line', group: 'บริหารองค์กร' },
    { id: 'tasks', label: 'Task Center', icon: 'fa-list-check', group: 'บริหารองค์กร' },
    { id: 'assign', label: 'Assign Task', icon: 'fa-user-plus', group: 'บริหารองค์กร' },
    { id: 'people', label: 'People', icon: 'fa-users-viewfinder', group: 'บริหารองค์กร' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project', group: 'เครื่องมือ' },
    { id: 'admin', label: 'System Control', icon: 'fa-shield-halved', group: 'ระบบ' },
  ],
  SrManager: [
    { id: 'executive', label: 'Executive View', icon: 'fa-display', group: 'มุมมองผู้บริหาร' },
    { id: 'dashboard', label: 'Division Dashboard', icon: 'fa-chart-line', group: 'มุมมองผู้บริหาร' },
    { id: 'tasks', label: 'Work Portfolio', icon: 'fa-list-check', group: 'มุมมองผู้บริหาร' },
    { id: 'people', label: 'People Overview', icon: 'fa-users-viewfinder', group: 'มุมมองผู้บริหาร' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project', group: 'เครื่องมือ' },
  ],
  Director: [
    { id: 'executive', label: 'Executive View', icon: 'fa-display', group: 'มุมมองผู้บริหาร' },
    { id: 'dashboard', label: 'Director Dashboard', icon: 'fa-chart-line', group: 'มุมมองผู้บริหาร' },
    { id: 'tasks', label: 'Work Portfolio', icon: 'fa-list-check', group: 'มุมมองผู้บริหาร' },
    { id: 'people', label: 'People Overview', icon: 'fa-users-viewfinder', group: 'มุมมองผู้บริหาร' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project', group: 'เครื่องมือ' },
  ],
  Executive: [
    { id: 'executive', label: 'Executive View', icon: 'fa-display', group: 'มุมมองผู้บริหาร' },
    { id: 'dashboard', label: 'Organization Dashboard', icon: 'fa-chart-line', group: 'มุมมองผู้บริหาร' },
    { id: 'tasks', label: 'Work Portfolio', icon: 'fa-list-check', group: 'มุมมองผู้บริหาร' },
    { id: 'people', label: 'People Overview', icon: 'fa-users-viewfinder', group: 'มุมมองผู้บริหาร' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project', group: 'เครื่องมือ' },
  ],
  Admin: [
    { id: 'dashboard', label: 'System Dashboard', icon: 'fa-chart-line', group: 'ระบบ' },
    { id: 'admin', label: 'System Control', icon: 'fa-shield-halved', group: 'ระบบ' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project', group: 'เครื่องมือ' },
  ],
};

const ROLE_HOME = {
  Staff: 'dashboard',
  Lead: 'my-dashboard',
  Manager: 'dashboard',
  SrManager: 'executive',
  Director: 'executive',
  Executive: 'executive',
  Admin: 'dashboard',
};

function navItemsForUser(user) {
  const base = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.Staff;
  if (base.some((item) => item.id === 'systems')) return base;
  const systemsItem = { id: 'systems', label: 'Systems', icon: 'fa-table-cells-large', group: 'Tools' };
  const adminIndex = base.findIndex((item) => item.id === 'admin');
  if (adminIndex < 0) return [...base, systemsItem];
  return [...base.slice(0, adminIndex), systemsItem, ...base.slice(adminIndex)];
}

function cn(...values) {
  return values.filter(Boolean).join(' ');
}

function BrandLogo({ className = 'w-14 h-14', imgClassName = '' }) {
  return (
    <div className={cn('mx-brand-mark rounded-lg overflow-hidden grid place-items-center flex-shrink-0 bg-white', className)}>
      <img
        src={APP_LOGO_URL}
        alt={`${APP_NAME} logo`}
        className={cn('w-full h-full object-contain p-1.5', imgClassName)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function BrandPill({ className = '' }) {
  return (
    <div className={cn('mx-brand-pill inline-flex items-center gap-2 rounded-lg font-extrabold', className)}>
      <img src={APP_LOGO_URL} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
      {APP_NAME}
    </div>
  );
}

// ─── URL Helpers ───────────────────────────────────────────────────────────────
function apiBase() {
  return (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '/api';
}

function adminHeaders(empId) {
  return { 'Content-Type': 'application/json', 'x-admin-empid': String(empId || '').trim() };
}

async function adminGet(path, empId) {
  const res = await fetch(`${apiBase()}/${path}`, { headers: adminHeaders(empId) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function adminPost(path, payload, empId) {
  const res = await fetch(`${apiBase()}/${path}`, {
    method: 'POST',
    headers: adminHeaders(empId),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function adminDelete(path, empId) {
  const res = await fetch(`${apiBase()}/${path}`, {
    method: 'DELETE',
    headers: adminHeaders(empId),
  });
  return res.json();
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
function formatDate(value, withTime = false) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('th-TH', withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
}

function parseJsonSafe(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function safeSessionGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function safeSessionSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}

function safeSessionRemove(key) {
  try { sessionStorage.removeItem(key); } catch {}
}

function safeLocalGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeLocalSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function safeLocalRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

function getBrowserSessionId() {
  safeSessionSet(SESSION_ID_KEY, RUNTIME_SESSION_ID);
  return RUNTIME_SESSION_ID;
}

function getActiveSessionLock() {
  const lock = parseJsonSafe(safeLocalGet(SESSION_LOCK_KEY), null);
  if (!lock?.empId || !lock?.sessionId || !lock?.expiresAt) return null;
  if (Number(lock.expiresAt) <= Date.now()) {
    safeLocalRemove(SESSION_LOCK_KEY);
    return null;
  }
  return lock;
}

function writeActiveSessionLock(user) {
  if (!user?.empId && !user?.empid) return;
  safeLocalSet(SESSION_LOCK_KEY, JSON.stringify({
    empId: String(user.empId || user.empid).trim(),
    name: user.name || '',
    sessionId: getBrowserSessionId(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + SESSION_LOCK_TTL,
  }));
}

function clearActiveSessionLock() {
  const lock = getActiveSessionLock();
  if (!lock || lock.sessionId === getBrowserSessionId()) safeLocalRemove(SESSION_LOCK_KEY);
}

function isSessionSuperseded(userOrEmpId) {
  const lock = getActiveSessionLock();
  if (!lock) return false;
  const empId = typeof userOrEmpId === 'string' ? userOrEmpId : (userOrEmpId?.empId || userOrEmpId?.empid);
  return String(lock.empId).toLowerCase() === String(empId || '').trim().toLowerCase()
    && lock.sessionId !== getBrowserSessionId();
}

function getStatusClass(status) {
  if (status === 'Completed') return 'mx-status-completed';
  if (status === 'On Process') return 'mx-status-process';
  if (status === 'Pending') return 'mx-status-pending';
  if (status === 'On Hold') return 'mx-status-hold';
  return 'mx-status-cancelled';
}

function extractJobCode(jobStr) {
  if (!jobStr) return 'ไม่มีรหัส';
  const match = jobStr.match(/^([A-Za-z]+\d+_\d+)/);
  return match ? match[1].toUpperCase() : jobStr.substring(0, 20);
}

function getTimestamp() {
  const now = new Date();
  return `[${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
}

function renderExtraData(extraData) {
  const ed = extraData || {};
  const entries = [
    ['Building', ed.building],
    ['Client', ed.client],
    ['Contractor', ed.contractor],
    ['Contractor Name', ed.contractorName],
    ['Type', ed.contractorType],
    ['SSR', ed.ssrNumber],
    ['OSP', ed.ospNumber],
    ['Fund', ed.fundNumber],
    ['Amount', ed.amount ? Number(ed.amount).toLocaleString('th-TH') : ''],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([label, value]) => (
        <span key={label} className="mx-badge mx-status-process">{label}: {value}</span>
      ))}
    </div>
  );
}

function getTaskWeight(task) {
  const raw = task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight ?? 1;
  const weight = typeof raw === 'string'
    ? Number.parseFloat(raw.replace('%', '').trim())
    : Number(raw);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function formatWeight(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatWeightPercent(value) {
  return `${formatWeight(value)}%`;
}

function getKpiGroupKey(task) {
  return String(task?.mainkpi ?? task?.mainKpi ?? task?.main ?? task?.subkpi ?? task?.sub ?? 'Other').trim() || 'Other';
}

function isCompletedOnTime(task) {
  const deadline = task?.deadline ? new Date(task.deadline) : null;
  const completedAt = task?.completiondate ? new Date(task.completiondate) : null;
  return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt <= deadline);
}

function getSlaWeight(scores) {
  return scores?.slaWeight ?? scores?.completedWeight ?? 0;
}

function formatScorePercent(value) {
  return value !== null && value !== undefined ? `${value}%` : '-';
}

function completionMetricSub(scores) {
  if (!scores || scores.completion === null || scores.completion === undefined) return 'คำนวณจากน้ำหนักงาน';
  return `สำเร็จ ${scores.completion}% จากน้ำหนักรวม ${formatWeightPercent(scores.totalWeight)}`;
}

function slaMetricSub(scores, score = scores?.sla) {
  if (!scores || score === null || score === undefined) return 'คำนวณจากฐาน SLA';
  return `ตรงเวลา ${score}% จากฐาน SLA ${formatWeightPercent(getSlaWeight(scores))}`;
}

function calcTaskWeightedScores(tasks) {
  if (window.calcWeightedScores) return window.calcWeightedScores(tasks || []);
  const groups = {};
  (tasks || []).forEach((task) => {
    const key = getKpiGroupKey(task);
    const weight = getTaskWeight(task);
    const status = String(task?.status || '').toLowerCase();
    if (!groups[key]) groups[key] = { weight, total: 0, completed: 0, onTime: 0, cancelled: 0 };
    else if (groups[key].weight === 1 && weight !== 1) groups[key].weight = weight;
    if (status === 'cancelled') {
      groups[key].cancelled += 1;
      return;
    }
    groups[key].total += 1;
    if (status === 'completed') {
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
    sla: slaWeight > 0 ? Math.round((onTimeWeight / slaWeight) * 100) : null,
    completion: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : null,
    totalWeight,
    completedWeight,
    onTimeWeight,
    slaWeight,
  };
}

function WeightFormulaStrip({ scores }) {
  if (!scores) return null;
  return (
    <div className="mx-muted-card rounded-lg p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold">สูตรคำนวณแบบถ่วงน้ำหนัก</div>
          <div className="mt-1 text-sm text-[var(--mx-muted)]">
            SLA = น้ำหนักงานที่เสร็จตรงเวลา / น้ำหนักงานที่เสร็จทั้งหมด และ Completion = น้ำหนักงานที่เสร็จ / น้ำหนักงานทั้งหมด
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="mx-badge mx-status-completed">น้ำหนักตรงเวลา {formatWeightPercent(scores.onTimeWeight)}</span>
          <span className="mx-badge mx-status-process">น้ำหนักเสร็จ {formatWeightPercent(scores.completedWeight)}</span>
          <span className="mx-badge mx-status-process">ฐาน SLA {formatWeightPercent(getSlaWeight(scores))}</span>
          <span className="mx-badge mx-status-cancelled">รวม {formatWeightPercent(scores.totalWeight)}</span>
        </div>
      </div>
    </div>
  );
}

function personKey(value) {
  return String(value || '').trim().toLowerCase();
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
      completedTasks: personTasks.filter((task) => String(task.status || '').toLowerCase() === 'completed').length,
      weightedSlaScore: weighted.sla,
      weightedCompletionScore: weighted.completion,
      totalWeight: weighted.totalWeight,
      completedWeight: weighted.completedWeight,
      onTimeWeight: weighted.onTimeWeight,
      slaWeight: weighted.slaWeight,
    };
  });
}

function summarizeLeadPersonTasks(person, tasks = [], holidays = []) {
  const personTasks = (tasks || []).filter((task) => taskMatchesPerson(task, person));
  const activeTasks = personTasks.filter(isActiveTask);
  const completedTasks = personTasks.filter((task) => String(task.status || '').toLowerCase() === 'completed');
  const statusCounts = personTasks.reduce((acc, task) => {
    const status = task.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const riskItems = activeTasks
    .map((task) => ({ task, days: getDaysUntilDeadline(task, holidays), weight: getTaskWeight(task) }))
    .filter((item) => item.days !== null)
    .sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return (riskA - riskB) || (a.days - b.days) || (b.weight - a.weight);
    });
  const overdue = riskItems.filter((item) => item.days < 0).length;
  const dueSoon = riskItems.filter((item) => item.days >= 0 && item.days <= 3).length;
  const kpiMap = {};
  personTasks.forEach((task) => {
    if (String(task.status || '').toLowerCase() === 'cancelled') return;
    const key = getKpiGroupKey(task);
    if (!kpiMap[key]) kpiMap[key] = { name: key, tasks: 0, active: 0, completed: 0, weight: getTaskWeight(task) };
    kpiMap[key].tasks += 1;
    if (isActiveTask(task)) kpiMap[key].active += 1;
    if (String(task.status || '').toLowerCase() === 'completed') kpiMap[key].completed += 1;
    kpiMap[key].weight = Math.max(kpiMap[key].weight, getTaskWeight(task));
  });
  const kpiMix = Object.values(kpiMap).sort((a, b) => (b.weight - a.weight) || (b.active - a.active)).slice(0, 3);
  const weighted = calcTaskWeightedScores(personTasks);
  return {
    tasks: personTasks,
    active: activeTasks.length,
    completed: completedTasks.length,
    pending: statusCounts.Pending || 0,
    inProcess: statusCounts['On Process'] || 0,
    onHold: statusCounts['On Hold'] || 0,
    cancelled: statusCounts.Cancelled || 0,
    overdue,
    dueSoon,
    riskItems,
    kpiMix,
    scores: weighted,
  };
}

function leadFocusClass(detail, sla) {
  if (detail.overdue > 0 || Number(sla || 0) < 60) return 'mx-status-hold';
  if (detail.dueSoon > 0 || detail.onHold > 0 || Number(sla || 0) < 75) return 'mx-status-pending';
  if (detail.active > 0) return 'mx-status-process';
  return 'mx-status-completed';
}

function leadFocusLabel(detail, sla) {
  if (detail.overdue > 0) return `เกินกำหนด ${detail.overdue}`;
  if (detail.dueSoon > 0) return `ใกล้กำหนด ${detail.dueSoon}`;
  if (detail.onHold > 0) return `พักงาน ${detail.onHold}`;
  if (Number(sla || 0) < 75) return 'SLA ต้องดูแล';
  if (detail.active > 0) return `กำลังทำ ${detail.active}`;
  return 'เรียบร้อย';
}

function leadQuickRead(detail, sla, completion) {
  if (detail.overdue > 0) return `ควรช่วยเคลียร์งานเกินกำหนด ${detail.overdue} รายการก่อน`;
  if (detail.dueSoon > 0) return `ควรติดตามงานใกล้กำหนด ${detail.dueSoon} รายการในรอบนี้`;
  if (detail.onHold > 0) return `มีงานพักอยู่ ${detail.onHold} รายการ ควรดูเหตุผลและวันที่กลับมาทำต่อ`;
  if (Number(sla || 0) < 75) return 'SLA ยังต่ำกว่าระดับที่ควรวางใจ ควรดู pattern งานที่เสร็จช้า';
  if (Number(completion || 0) < 75 && detail.active > 0) return 'งานยัง active เยอะ ควรดูโหลดและลำดับความสำคัญ';
  return 'ภาพรวมดี ไม่มีสัญญาณเสี่ยงเร่งด่วนในช่วงที่เลือก';
}

function LeadPersonDetailModal({ row, dialogId }) {
  if (!row) return null;
  const { person, detail } = row;
  const slaScore = person.weightedSlaScore ?? detail.scores.sla;
  const completionScore = person.weightedCompletionScore ?? detail.scores.completion;
  const totalWeight = person.totalWeight ?? detail.scores.totalWeight;
  const riskList = detail.riskItems.slice(0, 5);
  const statusItems = [
    ['Pending', detail.pending, 'mx-status-pending'],
    ['On Process', detail.inProcess, 'mx-status-process'],
    ['On Hold', detail.onHold, 'mx-status-hold'],
    ['Completed', detail.completed, 'mx-status-completed'],
    ['Cancelled', detail.cancelled, 'mx-status-cancelled'],
  ];

  return (
    <dialog
      id={dialogId}
      className="m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[92vh] overflow-y-auto bg-transparent p-0 text-[var(--mx-text)] backdrop:bg-[rgba(15,23,42,0.72)]"
      onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
    >
      <div className="mx-shell-card rounded-[24px] w-full shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--mx-line)] bg-[var(--mx-panel)] p-5 md:p-6">
          <div className="flex items-start gap-4 min-w-0">
            <UserAvatar user={person} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-2xl font-extrabold tracking-normal break-words">{person.name}</h3>
                <span className={cn('mx-badge', leadFocusClass(detail, slaScore))}>{leadFocusLabel(detail, slaScore)}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team || '-'} • {person.empId || person.empid || 'ไม่พบรหัสพนักงาน'}</div>
              <div className="mt-3 text-sm font-bold leading-6">{leadQuickRead(detail, slaScore, completionScore)}</div>
            </div>
          </div>
          <button className="mx-btn mx-btn-soft !p-0 w-10 h-10 flex-shrink-0" onClick={(e) => e.currentTarget.closest('dialog')?.close()} aria-label="ปิดรายละเอียด">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 md:p-6 grid gap-5">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--mx-muted)] font-black">Weighted SLA</div>
              <div className="mt-2 text-3xl font-extrabold">{formatScorePercent(slaScore)}</div>
              <div className="mt-1 text-xs text-[var(--mx-muted)]">ฐาน SLA {formatWeightPercent(detail.scores.slaWeight)}</div>
            </div>
            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--mx-muted)] font-black">Completion</div>
              <div className="mt-2 text-3xl font-extrabold">{formatScorePercent(completionScore)}</div>
              <div className="mt-1 text-xs text-[var(--mx-muted)]">Done {detail.completed}/{detail.tasks.length}</div>
            </div>
            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--mx-muted)] font-black">Total Weight</div>
              <div className="mt-2 text-3xl font-extrabold">{formatWeightPercent(totalWeight)}</div>
              <div className="mt-1 text-xs text-[var(--mx-muted)]">น้ำหนักงานในช่วงที่เลือก</div>
            </div>
            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--mx-muted)] font-black">Risk</div>
              <div className="mt-2 text-3xl font-extrabold">{detail.overdue + detail.dueSoon}</div>
              <div className="mt-1 text-xs text-[var(--mx-muted)]">{detail.overdue} overdue / {detail.dueSoon} ใกล้กำหนด</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-5">
            <div className="grid gap-5">
              <div className="mx-muted-card rounded-lg p-4">
                <div className="text-sm font-extrabold">สถานะงานทั้งหมด</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {statusItems.map(([label, value, klass]) => (
                    <div key={label} className="rounded-lg border border-[var(--mx-line)] bg-[var(--mx-surface)] p-3">
                      <span className={cn('mx-badge', klass)}>{label}</span>
                      <div className="mt-2 text-2xl font-extrabold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mx-muted-card rounded-lg p-4">
                <div className="text-sm font-extrabold">KPI Mix ที่กินโหลด</div>
                <div className="mt-3 grid gap-2">
                  {detail.kpiMix.map((item) => (
                    <div key={item.name} className="rounded-lg border border-[var(--mx-line)] bg-[var(--mx-surface)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold leading-5 break-words">{item.name}</div>
                          <div className="mt-1 text-xs text-[var(--mx-muted)]">Active {item.active} • Done {item.completed} • Total {item.tasks}</div>
                        </div>
                        <span className="mx-badge mx-status-cancelled flex-shrink-0">{formatWeightPercent(item.weight)}</span>
                      </div>
                    </div>
                  ))}
                  {detail.kpiMix.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่มี KPI active สำหรับคนนี้</div>}
                </div>
              </div>
            </div>

            <div className="mx-muted-card rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold">รายการที่ควรติดตามก่อน</div>
                  <div className="mt-1 text-xs text-[var(--mx-muted)]">เรียงจากเกินกำหนด ใกล้กำหนด และน้ำหนักงานสูง</div>
                </div>
                <span className="mx-badge mx-status-process">{riskList.length} รายการ</span>
              </div>
              <div className="mt-4 grid gap-3">
                {riskList.map(({ task, days, weight }) => (
                  <div key={task.id || `${task.job}-${task.deadline}`} className="rounded-lg border border-[var(--mx-line)] bg-[var(--mx-surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-extrabold leading-6 break-words">{extractJobCode(task.job)}</div>
                        <div className="mt-1 text-sm text-[var(--mx-muted)] leading-6 break-words">{task.job || '-'}</div>
                      </div>
                      <span className={cn('mx-badge', days < 0 ? 'mx-status-hold' : days <= 3 ? 'mx-status-pending' : 'mx-status-process')}>
                        {days < 0 ? `เกิน ${Math.abs(days)} วันทำการ` : `อีก ${days} วันทำการ`}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status || '-'}</span>
                      <span className="mx-badge mx-status-cancelled">Weight {formatWeightPercent(weight)}</span>
                      <span className="mx-badge mx-status-process">{task.mainkpi || '-'}</span>
                      <span className="mx-badge mx-status-process">{task.subkpi || '-'}</span>
                    </div>
                    <div className="mt-3 text-xs text-[var(--mx-muted)]">Deadline {formatDate(task.deadline)}</div>
                  </div>
                ))}
                {riskList.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่มีงานเสี่ยงในช่วงที่เลือก</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

// ─── UI Primitives ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, accent = 'var(--mx-blue)' }) {
  return (
    <div className="mx-shell-card rounded-[20px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] uppercase tracking-[0.14em] text-[var(--mx-muted)] font-extrabold">{label}</div>
        <div className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}>
          <i className={`fa-solid ${icon}`} style={{ color: accent }}></i>
        </div>
      </div>
      <div className="mt-5 text-[34px] font-extrabold tracking-normal">{value}</div>
      <div className="mt-2 text-sm text-[var(--mx-muted)]">{sub}</div>
    </div>
  );
}

function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="mx-shell-card rounded-[28px] p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[22px] font-extrabold tracking-normal m-0">{title}</h3>
          {subtitle && <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      className="mx-btn mx-btn-soft !py-2 !px-3 inline-flex items-center gap-2"
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
      <span className="text-sm font-extrabold">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}

function UserAvatar({ user, size = 'lg' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const rawPhoto = user?.pigurl || user?.pigUrl || user?.pigURL || user?.picurl || user?.picUrl || user?.picture || user?.pictureUrl || user?.profilePicture || user?.profile_picture || user?.avatar || user?.avatarUrl || user?.photoUrl || user?.photo_url || user?.profileUrl || user?.profile_url || user?.imageUrl || user?.image_url || user?.image || user?.photo || '';
  const normalizePhotoUrl = (value) => {
    const src = String(value || '').trim();
    if (!src) return '';
    const driveMatch = src.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w240`;
    const driveOpenMatch = src.match(/[?&]id=([^&]+)/);
    if (src.includes('drive.google.com') && driveOpenMatch) return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w240`;
    if (/^[A-Za-z0-9_-]{20,}$/.test(src)) return `https://drive.google.com/thumbnail?id=${src}&sz=w240`;
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) {
      const base = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE.replace(/\/api\/?$/, '') : '';
      return `${base}${src}`;
    }
    return src;
  };
  const photo = normalizePhotoUrl(rawPhoto);
  const initials = String(user?.name || user?.empId || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
  const box = size === 'xl' ? 'w-20 h-20 text-2xl' : 'w-14 h-14 text-lg';

  return (
    <div className={cn('relative rounded-lg overflow-hidden mx-brand-mark grid place-items-center font-black flex-shrink-0', box)}>
      {photo && !imgFailed ? (
        <img
          src={photo}
          alt="User profile"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

// ─── Action Modal (confirm / prompt) ──────────────────────────────────────────
function ActionModal({ config, onClose }) {
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    if (config.show) setInputVal(config.inputValue || '');
  }, [config.show, config.inputValue]);

  if (!config.show) return null;

  const colorMap = {
    blue: 'mx-btn-primary',
    rose: 'mx-action-danger',
    emerald: 'mx-action-success',
    amber: 'mx-action-warning',
    slate: 'mx-action-muted',
  };
  const btnClass = colorMap[config.color] || colorMap.blue;

  const handleConfirm = () => {
    if (config.type === 'prompt') {
      if (config.action) config.action(inputVal);
    } else {
      if (config.action) config.action();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="mx-shell-card rounded-[24px] p-7 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-extrabold mb-2">{config.title}</h3>
        <p className="text-sm text-[var(--mx-muted)] mb-4">{config.message}</p>
        {config.type === 'prompt' && (
          <textarea
            className="mx-textarea min-h-[80px] mb-4"
            placeholder="ระบุรายละเอียด..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex gap-3">
          {config.type !== 'alert' && (
            <button className="mx-btn mx-btn-soft flex-1" onClick={onClose}>ยกเลิก</button>
          )}
          <button className={`mx-btn flex-1 ${btnClass}`} onClick={handleConfirm}>
            {config.type === 'alert' ? 'รับทราบ' : 'ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Change Modal (Lead / Manager) ─────────────────────────────────────
function StatusChangeModal({ task, onSave, onClose }) {
  const [newStatus, setNewStatus] = useState(task.status || 'On Process');
  const [reason, setReason] = useState('');
  const needsReason = newStatus !== 'Completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl">
        <h3 className="text-xl font-extrabold mb-1">เปลี่ยนสถานะงาน</h3>
        <p className="text-sm text-[var(--mx-muted)] mb-5 break-all">{(task.job || '').substring(0, 60)}{task.job?.length > 60 ? '...' : ''}</p>
        <div className="grid gap-4">
          <div>
            <label className="block mb-2 text-sm font-bold">สถานะใหม่</label>
            <select className="mx-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="On Process">On Process</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          {needsReason && (
            <div>
              <label className="block mb-2 text-sm font-bold">เหตุผล / บันทึก</label>
              <textarea
                className="mx-textarea min-h-[80px]"
                placeholder="ระบุเหตุผลหรือบันทึกเพิ่มเติม..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button className="mx-btn mx-btn-soft flex-1" onClick={onClose}>ยกเลิก</button>
          <button
            className="mx-btn mx-btn-primary flex-1"
            onClick={() => { onSave(newStatus, needsReason ? reason : ''); onClose(); }}
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
const SYSTEM_CONTROL_SECTIONS = [
  { id: 'overview', label: 'ภาพรวมระบบ', icon: 'fa-gauge-high' },
  { id: 'users', label: 'ผู้ใช้และสิทธิ์', icon: 'fa-users-gear' },
  { id: 'systems', label: 'Systems', icon: 'fa-table-cells-large' },
  { id: 'teams', label: 'ทีมงาน', icon: 'fa-people-group' },
  { id: 'kpi', label: 'กฎ KPI/SLA', icon: 'fa-scale-balanced' },
  { id: 'calendar', label: 'ปฏิทิน SLA', icon: 'fa-calendar-days' },
  { id: 'audit', label: 'ประวัติการแก้ไข', icon: 'fa-shield-halved' },
];

function Sidebar({ user, view, setView, onLogout, notifCount = 0, adminSection = 'overview', setAdminSection = () => {} }) {
  const navItems = navItemsForUser(user);
  const [expanded, setExpanded] = useState(() => view === 'admin');

  useEffect(() => {
    if (view === 'admin') setExpanded(true);
  }, [view]);

  return (
    <aside className="mx-shell-card rounded-[28px] p-5 md:p-6 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
      <div className="flex items-center gap-4 mb-7">
        <BrandLogo className="w-14 h-14" />
        <div>
          <div className="text-xl font-extrabold tracking-[0.02em]">{APP_NAME}</div>
          <div className="text-sm text-[var(--mx-muted)]">{APP_TAGLINE}</div>
        </div>
      </div>

      <div className="mx-muted-card rounded-lg p-4">
        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="xl" />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Signed In</div>
            <div className="mt-2 font-extrabold text-base truncate">{user?.name}</div>
            <div className="mt-1 text-sm text-[var(--mx-muted)] truncate">{roleLabel(user?.role)} • {user?.team}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="mx-badge mx-status-process">{roleLabel(user?.role)}</span>
          <span className="mx-badge mx-status-pending">Scope: {roleScope(user)}</span>
          <span className="mx-badge mx-status-cancelled">Emp ID: {user?.empId}</span>
        </div>
      </div>

      <div className="mt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Navigation</div>
      <div className="mt-3 grid gap-2">
        {navItems.map((item, index) => {
          const isSystemControl = item.id === 'admin';
          const showGroup = item.group && item.group !== navItems[index - 1]?.group;
          const groupLabel = showGroup ? (
            <div className="pt-3 first:pt-0 text-[10px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">
              {item.group}
            </div>
          ) : null;
          if (isSystemControl) {
            return (
              <React.Fragment key={item.id}>
                {groupLabel}
                <div className="grid gap-2">
                  <button
                    onClick={() => {
                      setExpanded((current) => !current);
                      setView('admin');
                    }}
                    className={cn(
                      'mx-btn text-left flex items-center gap-3 px-4 py-4 rounded-[18px]',
                      view === item.id ? 'mx-nav-active' : 'bg-transparent border border-transparent'
                    )}
                  >
                    <i className={`fa-solid ${item.icon} w-5 text-center text-[var(--mx-accent-2)]`}></i>
                    <span className="flex-1">{item.label}</span>
                    <i className={cn('fa-solid fa-chevron-right text-xs transition-transform', expanded ? 'rotate-90' : '')}></i>
                  </button>
                  {expanded && (
                    <div className="ml-4 pl-3 border-l border-[var(--mx-line)] grid gap-1">
                      {SYSTEM_CONTROL_SECTIONS.map((section) => (
                        <button
                          key={section.id}
                          onClick={() => {
                            setView('admin');
                            setAdminSection(section.id);
                          }}
                          className={cn(
                            'mx-btn text-left flex items-center gap-3 px-3 py-3 rounded-[14px] text-sm',
                            view === 'admin' && adminSection === section.id
                              ? 'mx-nav-active'
                              : 'bg-transparent border border-transparent'
                          )}
                        >
                          <i className={`fa-solid ${section.icon} w-4 text-center text-[var(--mx-accent-2)]`}></i>
                          <span className="truncate">{section.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          }
          return (
            <React.Fragment key={item.id}>
              {groupLabel}
              <button
                onClick={() => setView(item.id)}
                className={cn(
                  'mx-btn text-left flex items-center gap-3 px-4 py-4 rounded-[18px]',
                  view === item.id
                    ? 'mx-nav-active'
                    : 'bg-transparent border border-transparent'
                )}
              >
                <i className={`fa-solid ${item.icon} w-5 text-center text-[var(--mx-accent-2)]`}></i>
                <span>{item.label}</span>
                {['tasks', 'my-tasks'].includes(item.id) && notifCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {notifCount}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <button onClick={onLogout} className="mx-btn mx-btn-soft w-full mt-6">
        <i className="fa-solid fa-right-from-bracket mr-2"></i>ออกจากระบบ
      </button>
    </aside>
  );
}

// ─── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, loading, error, theme, onToggleTheme }) {
  const [empId, setEmpId] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center p-5 md:p-8">
      <div className="w-full max-w-[1120px] grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="mx-shell-card rounded-[34px] p-8 md:p-10">
          <div className="flex items-center justify-between gap-3">
            <BrandPill className="px-4 py-2 text-xs tracking-[0.12em]" />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
          <h1 className="mt-6 text-[42px] md:text-[58px] leading-[1.02] tracking-normal font-extrabold mb-0">
            ระบบใหม่ที่ดูดี ใช้ง่าย และต่อของเดิมได้ทันที
          </h1>
          <p className="mt-5 mb-0 text-[15px] leading-8 text-[var(--mx-muted)] max-w-[60ch]">
            {APP_NAME} ถูกออกแบบใหม่สำหรับผู้บริหารและทีมปฏิบัติการยุคใหม่ โดยยังเชื่อมต่อกับฐานข้อมูลและ backend เดิมโดยตรง
            ไม่ต้องแก้หลังบ้าน และไม่ต้องให้ใครไปแตะ database เพื่อใช้งานประจำวัน
          </p>
        </div>

        <div className="mx-shell-card rounded-[34px] p-8 md:p-10 flex flex-col justify-center">
          <BrandLogo className="w-16 h-16" />
          <h2 className="mt-6 text-[30px] tracking-normal font-extrabold mb-0">Sign in to {APP_NAME}</h2>
          <p className="mt-3 mb-0 text-[var(--mx-muted)]">กรอกรหัสพนักงานเพื่อเข้าสู่ระบบใหม่</p>
          <div className="mt-7">
            <label className="block mb-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--mx-muted)]">Employee ID</label>
            <input
              className="mx-input text-center text-[22px] font-black tracking-[0.18em]"
              placeholder="EMP ID"
              value={empId}
              onChange={(e) => setEmpId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && onLogin(empId)}
            />
            {error && <div className="mt-3 text-sm text-[#ffb7b7] font-bold">{error}</div>}
          </div>
          <button className="mx-btn mx-btn-primary mt-6" disabled={loading} onClick={() => onLogin(empId)}>
            {loading ? 'กำลังตรวจสอบข้อมูล...' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginScreenPro({ onLogin, loading, error, theme, onToggleTheme }) {
  const [empId, setEmpId] = useState('');
  const accessHighlights = [
    ['fa-chart-line', 'Weighted KPI', 'คำนวณคะแนนตามน้ำหนัก KPI ของแต่ละงาน'],
    ['fa-clock', 'SLA Monitoring', 'เห็นงานเสี่ยง งานค้าง และ deadline ที่ต้องติดตาม'],
    ['fa-building-user', 'Role Based View', 'แสดงข้อมูลตามสิทธิ์'],
  ];

  return (
    <div className="min-h-screen grid place-items-center p-4 md:p-8">
      <div className="w-full max-w-[1180px] mx-shell-card overflow-hidden">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <section className="p-6 md:p-9 border-b lg:border-b-0 lg:border-r border-[var(--mx-line)] bg-[var(--mx-surface)]">
            <div className="flex items-center justify-between gap-3">
              <BrandPill className="px-4 py-2 text-xs tracking-[0.14em]" />
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            </div>

            <div className="mt-10 max-w-[520px]">
              <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--mx-muted)] font-extrabold">Performance Portal</div>
              <h1 className="mt-4 mb-0 text-[34px] md:text-[46px] leading-tight font-extrabold tracking-normal">
                เข้าสู่ระบบติดตาม KPI และ SLA
              </h1>
              <p className="mt-5 mb-0 text-[15px] leading-7 text-[var(--mx-muted)]">
                ศูนย์กลางสำหรับติดตามงาน คะแนนถ่วงน้ำหนัก สถานะ SLA และภาพรวมผลงานของทีมในที่เดียว
              </p>
            </div>

            <div className="mt-9 grid gap-3 max-w-[560px]">
              {accessHighlights.map(([icon, title, desc]) => (
                <div key={title} className="flex items-start gap-3 rounded-lg border border-[var(--mx-line)] bg-[var(--mx-panel)] p-4">
                  <span className="w-10 h-10 rounded-lg mx-brand-mark grid place-items-center flex-shrink-0">
                    <i className={`fa-solid ${icon} text-[var(--mx-accent)]`}></i>
                  </span>
                  <div>
                    <div className="font-extrabold">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--mx-muted)]">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="p-6 md:p-10 lg:p-12 flex items-center">
            <div className="w-full max-w-[460px] mx-auto">
              <div className="flex items-center gap-4">
                <BrandLogo className="w-14 h-14" />
                <div>
                  <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--mx-muted)] font-extrabold">Secure Access</div>
                  <h2 className="mt-1 mb-0 text-[28px] md:text-[34px] tracking-normal font-extrabold">เข้าสู่ระบบ</h2>
                </div>
              </div>

              <p className="mt-5 mb-0 text-[var(--mx-muted)] leading-7">
                กรอกรหัสพนักงานเพื่อเข้าสู่ {APP_NAME} ระบบจะโหลดข้อมูลและสิทธิ์ของคุณโดยอัตโนมัติ
              </p>

              <div className="mt-8">
                <label className="block mb-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--mx-muted)]">Employee ID</label>
                <div className="relative">
                  <i className="fa-solid fa-id-badge absolute left-4 top-1/2 -translate-y-1/2 text-[var(--mx-muted)]"></i>
                  <input
                    className="mx-input !pl-11 !py-4 text-[18px] font-extrabold tracking-[0.08em]"
                    placeholder="เช่น EMP001"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && onLogin(empId)}
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="mt-3 rounded-lg border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm text-[#ffb7b7] font-bold">
                    <i className="fa-solid fa-circle-exclamation mr-2"></i>{error}
                  </div>
                )}
              </div>

              <button className="mx-btn mx-btn-primary mt-6 w-full !py-4 flex items-center justify-center gap-2" disabled={loading} onClick={() => onLogin(empId)}>
                {loading ? (
                  <>
                    <i className="fa-solid fa-rotate-right fa-spin"></i>
                    <span>กำลังตรวจสอบข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </>
                )}
              </button>

              <div className="mt-6 flex items-center gap-3 text-xs text-[var(--mx-muted)]">
                <i className="fa-solid fa-shield-halved"></i>
                <span>ใช้รหัสพนักงานที่ลงทะเบียนไว้ในระบบเท่านั้น</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Data Hook ─────────────────────────────────────────────────────────────────
function useAppData(user, view) {
  const [state, setState] = useState({
    loading: false, error: '', dashboard: null, tasks: [], people: [], admin: null, holidays: [],
  });
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1); // 0 = ทุกเดือน
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const safeSet = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const loadHolidays = useCallback(async () => {
    if (!user) return;
    if (!isAdminRole(user.role)) return;
    try {
      const res = await adminGet('admin/getHolidays', userEmpId(user));
      safeSet({ holidays: res.holidays || [] });
    } catch {
      // Some deployments restrict this endpoint to Admin only. Deadline displays still exclude weekends.
    }
  }, [user]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    const monthParam = filterMonth === 0 ? null : filterMonth;
    try {
      if (shouldUsePersonalWork(user, view)) {
        const res = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
        safeSet({ dashboard: { tasks: res.tasks || res || [], holidays: res.holidays || [] }, loading: false });
        return;
      }
      if (isTeamManagerRole(user.role)) {
        const [summaryRes, tasksRes] = await Promise.all([
          API.getTeamSummaryReport(user.team, monthParam, filterYear, user.empId),
          API.getAllTasks(monthParam, filterYear, user.team, user.empId),
        ]);
        safeSet({ dashboard: { summary: summaryRes.summary || [], tasks: tasksRes.tasks || [], period: summaryRes.period, holidays: tasksRes.holidays || summaryRes.holidays || [] }, loading: false });
        return;
      }
      if (isDepartmentManagerRole(user.role) || isStrategicViewRole(user.role)) {
        const [summaryRes, tasksRes] = await Promise.all([
          API.getSummaryReport(monthParam, filterYear, user.empId),
          API.getAllTasks(monthParam, filterYear, 'all', user.empId),
        ]);
        safeSet({
          dashboard: {
            summary: filterByAllowedTeams(user, summaryRes.summary || []),
            tasks: filterByAllowedTeams(user, tasksRes.tasks || []),
            period: summaryRes.period,
            holidays: tasksRes.holidays || summaryRes.holidays || [],
          },
          loading: false,
        });
        return;
      }
      const [dashboardRes, staffRes] = await Promise.all([
        API.getDashboardData(),
        API.getAllStaff(user.empId),
      ]);
      safeSet({
        dashboard: { summary: dashboardRes.tasks || [], staff: staffRes.staff || [], kpis: dashboardRes.kpis || [], holidays: dashboardRes.holidays || [] },
        loading: false,
      });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลด dashboard ไม่สำเร็จ' });
    }
  }, [user, view, filterMonth, filterYear]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    const monthParam = filterMonth === 0 ? null : filterMonth;
    try {
      if (shouldUsePersonalWork(user, view)) {
        const res = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
        safeSet({ tasks: res.tasks || res || [], loading: false });
        return;
      }
      const team = taskScopeForUser(user);
      const res = await API.getAllTasks(monthParam, filterYear, team, user.empId);
      safeSet({ tasks: filterByAllowedTeams(user, res.tasks || []), loading: false });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลด tasks ไม่สำเร็จ' });
    }
  }, [user, view, filterMonth, filterYear]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      let res;
      if (isTeamManagerRole(user.role)) res = await API.getAllStaffInTeam(user.team, user.empId);
      else if (user.role === 'Staff') res = { staff: [user] };
      else res = await API.getAllStaff(user.empId);
      safeSet({ people: filterByAllowedTeams(user, res.staff || []), loading: false });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลดรายชื่อไม่สำเร็จ' });
    }
  }, [user]);

  const loadAdmin = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      const [logs, teams, holidays, staff, dashboardRes] = await Promise.all([
        adminGet('admin/getAuditLogs', userEmpId(user)),
        adminGet('admin/getTeams', userEmpId(user)),
        adminGet('admin/getHolidays', userEmpId(user)),
        API.getAllStaff(userEmpId(user)),
        API.getDashboardData(),
      ]);
      safeSet({
        admin: {
          logs: logs.logs || [],
          teams: teams.teams || [],
          holidays: holidays.holidays || [],
          staff: staff.staff || [],
          kpis: dashboardRes.kpis || [],
          tasks: dashboardRes.tasks || [],
        },
        holidays: holidays.holidays || [],
        loading: false,
      });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลด admin data ไม่สำเร็จ' });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadHolidays();
    if (view === 'executive') loadDashboard();
    if (['dashboard', 'my-dashboard'].includes(view)) loadDashboard();
    if (['tasks', 'my-tasks'].includes(view)) loadTasks();
    if (view === 'people') loadPeople();
    if (view === 'assign') loadPeople();
    if (view === 'admin') loadAdmin();
  }, [user, view, loadDashboard, loadTasks, loadPeople, loadAdmin, loadHolidays]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !window.subscribeToRealtime) return;
    window.subscribeToRealtime('tasks', () => {
      if (view === 'executive') loadDashboard();
      if (['dashboard', 'my-dashboard'].includes(view)) loadDashboard();
      if (['tasks', 'my-tasks'].includes(view)) loadTasks();
    });
    return () => { if (window.unsubscribeFromRealtime) window.unsubscribeFromRealtime('tasks'); };
  }, [user, view]);

  return {
    state, filterMonth, setFilterMonth, filterYear, setFilterYear,
    reloadDashboard: loadDashboard, reloadTasks: loadTasks,
    reloadPeople: loadPeople, reloadAdmin: loadAdmin,
  };
}

// ─── Dashboard View ─────────────────────────────────────────────────────────────
function getExecutiveTasks(data) {
  if (!data) return [];
  if (Array.isArray(data.tasks)) return data.tasks;
  if (Array.isArray(data.summary) && data.summary.some((item) => item.job || item.status || item.deadline)) return data.summary;
  return [];
}

function isActiveTask(task) {
  return !['completed', 'cancelled'].includes(String(task?.status || '').toLowerCase());
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

function toDateInputValue(value) {
  const date = normalizeDateOnly(value);
  return date ? dateKey(date) : '';
}

function getActiveHoldStart(task) {
  const extra = normalizeExtraData(task?.extra_data);
  return extra.hold_started_at || extra.holdStartAt || extra.holdStart || null;
}

function normalizeExtraData(extraData) {
  if (!extraData) return {};
  if (typeof extraData === 'string') return parseJsonSafe(extraData, {});
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
  const activeHoldDays = String(task?.status || '').toLowerCase() === 'on hold'
    ? getTaskHoldDays(task, holidays)
    : 0;
  return activeHoldDays > 0 ? addBusinessDays(task.deadline, activeHoldDays, holidays) : normalizeDateOnly(task.deadline);
}

function getHoldSummary(task, holidays = []) {
  const extra = normalizeExtraData(task?.extra_data);
  const activeDays = getTaskHoldDays(task, holidays);
  const totalDays = Number(extra.hold_days_total || extra.holdDaysTotal || 0) + activeDays;
  return {
    activeStart: getActiveHoldStart(task),
    activeDays,
    totalDays: Number.isFinite(totalDays) ? totalDays : activeDays,
    effectiveDeadline: getEffectiveDeadline(task, holidays),
  };
}

function buildHoldExtraData(task, nextStatus, holidays = [], changedBy = '') {
  const currentStatus = String(task?.status || '').toLowerCase();
  const targetStatus = String(nextStatus || '').toLowerCase();
  const extra = { ...normalizeExtraData(task?.extra_data) };
  const now = new Date().toISOString();
  const activeStart = getActiveHoldStart(task);

  if (targetStatus === 'on hold') {
    if (!activeStart) {
      extra.hold_started_at = now;
      extra.hold_started_by = changedBy || extra.hold_started_by || '';
      extra.hold_deadline_before = task?.deadline || '';
    }
    return { extraData: extra, deadline: task?.deadline || '', holdDays: 0, changed: !activeStart };
  }

  if (currentStatus !== 'on hold' || !activeStart) {
    return { extraData: extra, deadline: task?.deadline || '', holdDays: 0, changed: false };
  }

  const holdDays = getTaskHoldDays(task, holidays);
  const nextDeadline = holdDays > 0 ? toDateInputValue(addBusinessDays(task.deadline, holdDays, holidays)) : (task?.deadline || '');
  const history = Array.isArray(extra.hold_history) ? [...extra.hold_history] : [];
  history.push({
    start: activeStart,
    end: now,
    businessDays: holdDays,
    deadlineBefore: extra.hold_deadline_before || task?.deadline || '',
    deadlineAfter: nextDeadline || task?.deadline || '',
    changedBy: changedBy || '',
  });

  delete extra.hold_started_at;
  delete extra.hold_started_by;
  delete extra.hold_deadline_before;
  extra.hold_days_total = Number(extra.hold_days_total || 0) + holdDays;
  extra.hold_history = history.slice(-20);

  return {
    extraData: extra,
    deadline: nextDeadline || task?.deadline || '',
    holdDays,
    changed: true,
  };
}

function getDaysUntilDeadline(task, holidays = []) {
  if (!task?.deadline) return null;
  return businessDaysBetween(new Date(), getEffectiveDeadline(task, holidays), holidays);
}

function getExecutiveHealthClass(value) {
  if (value === null || value === undefined) return 'mx-status-cancelled';
  if (value >= 90) return 'mx-status-completed';
  if (value >= 75) return 'mx-status-process';
  if (value >= 60) return 'mx-status-pending';
  return 'mx-status-hold';
}

function ExecutiveView({ data, filterMonth, filterYear, holidays = [], onNavigate }) {
  if (!data) {
    return (
      <Panel title="Executive View" subtitle="Preparing executive summary...">
        <div className="text-[var(--mx-muted)]">Loading...</div>
      </Panel>
    );
  }

  const tasks = getExecutiveTasks(data);
  const holidaySet = useMemo(() => buildHolidaySet([...(holidays || []), ...((data && data.holidays) || [])]), [holidays, data]);
  const activeTasks = tasks.filter(isActiveTask);
  const completedTasks = tasks.filter((task) => String(task.status || '').toLowerCase() === 'completed');
  const overdueTasks = activeTasks.filter((task) => {
    const days = getDaysUntilDeadline(task, holidaySet);
    return days !== null && days < 0;
  });
  const atRiskTasks = activeTasks.filter((task) => {
    const days = getDaysUntilDeadline(task, holidaySet);
    return days !== null && days >= 0 && days <= 3;
  });
  const scores = calcTaskWeightedScores(tasks);
  const completion = scores.completion ?? (tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : null);
  const sla = scores.sla;
  const periodLabel = `${filterMonth === 0 ? 'All Months' : MONTH_NAMES[filterMonth - 1]} ${filterYear}`;
  const weightedScore = completion !== null && sla !== null ? Math.round((completion + sla) / 2) : (completion ?? sla);

  const teamMap = {};
  tasks.forEach((task) => {
    const team = task.team || 'Unassigned';
    if (!teamMap[team]) teamMap[team] = [];
    teamMap[team].push(task);
  });
  const teamRows = Object.entries(teamMap).map(([team, teamTasks]) => {
    const teamScores = calcTaskWeightedScores(teamTasks);
    const active = teamTasks.filter(isActiveTask);
    const overdue = active.filter((task) => {
      const days = getDaysUntilDeadline(task, holidaySet);
      return days !== null && days < 0;
    }).length;
    const atRisk = active.filter((task) => {
      const days = getDaysUntilDeadline(task, holidaySet);
      return days !== null && days >= 0 && days <= 3;
    }).length;
    const teamCompletion = teamScores.completion ?? (teamTasks.length ? Math.round((teamTasks.filter((task) => String(task.status || '').toLowerCase() === 'completed').length / teamTasks.length) * 100) : null);
    const health = Math.round(((teamScores.sla ?? teamCompletion ?? 0) + (teamCompletion ?? teamScores.sla ?? 0)) / 2) - overdue * 5 - atRisk * 2;
    return { team, total: teamTasks.length, active: active.length, overdue, atRisk, sla: teamScores.sla, completion: teamCompletion, health };
  }).sort((a, b) => (a.overdue - b.overdue) || (a.atRisk - b.atRisk) || (b.health - a.health));

  const criticalQueue = activeTasks
    .map((task) => ({ task, days: getDaysUntilDeadline(task, holidaySet), weight: getTaskWeight(task) }))
    .filter((item) => item.days !== null)
    .sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return (riskA - riskB) || (a.days - b.days) || (b.weight - a.weight);
    })
    .slice(0, 8);

  const insights = [];
  if (overdueTasks.length > 0) insights.push(`${overdueTasks.length} overdue task(s) need executive attention before status review.`);
  if (atRiskTasks.length > 0) insights.push(`${atRiskTasks.length} task(s) are due within 3 business days and may affect SLA.`);
  if (teamRows[0]) insights.push(`${teamRows[0].team} is the highest risk team in the current scope.`);
  if (sla !== null) insights.push(`Current weighted SLA is ${sla}%, with completion at ${completion ?? '-'}%.`);
  if (insights.length === 0) insights.push('No critical SLA risk is visible in the current scope.');

  const maxTeamTotal = Math.max(...teamRows.map((row) => row.total), 1);

  return (
    <div className="grid gap-5">
      <div className="grid md:grid-cols-2 2xl:grid-cols-5 gap-4">
        <MetricCard label="Overall SLA" value={formatScorePercent(sla)} sub="Weighted on-time performance" icon="fa-stopwatch" accent="var(--mx-info)" />
        <MetricCard label="Completion" value={formatScorePercent(completion)} sub={`${completedTasks.length}/${tasks.length} task(s) completed`} icon="fa-circle-check" accent="var(--mx-success)" />
        <MetricCard label="Overdue" value={overdueTasks.length} sub="Active tasks past deadline (business days)" icon="fa-triangle-exclamation" accent="var(--mx-danger)" />
        <MetricCard label="At Risk" value={atRiskTasks.length} sub="Due within 3 business days" icon="fa-clock" accent="var(--mx-warning)" />
        <MetricCard label="Weighted Score" value={formatScorePercent(weightedScore)} sub="SLA and completion blend" icon="fa-ranking-star" accent="var(--mx-accent-2)" />
      </div>

      <Panel
        title="Management Summary"
        subtitle={`Executive readout for ${periodLabel}`}
        actions={<button className="mx-btn mx-btn-soft !py-2" onClick={() => window.print()}><i className="fa-solid fa-print mr-2"></i>Presentation</button>}
      >
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
          <div className="grid gap-3">
            {insights.slice(0, 5).map((insight, index) => (
              <div key={insight} className="mx-data-card flex items-start gap-3">
                <span className={cn('mx-badge flex-shrink-0', index === 0 && overdueTasks.length > 0 ? 'mx-status-hold' : 'mx-status-process')}>
                  {index + 1}
                </span>
                <div className="font-bold leading-6">{insight}</div>
              </div>
            ))}
          </div>
          <div className="mx-muted-card rounded-lg p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Decision Lens</div>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--mx-muted)]">Scope</span>
                <span className="font-extrabold">{periodLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--mx-muted)]">Active workload</span>
                <span className="font-extrabold">{activeTasks.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--mx-muted)]">Teams monitored</span>
                <span className="font-extrabold">{teamRows.length}</span>
              </div>
              <button className="mx-btn mx-btn-primary mt-2" onClick={() => onNavigate('tasks')}>
                <i className="fa-solid fa-list-check mr-2"></i>Open Task Center
              </button>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid 2xl:grid-cols-[1.1fr_0.9fr] gap-5">
        <Panel title="Team Performance Matrix" subtitle="Ranked by overdue, near-deadline risk, and weighted health">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
                  <th className="pb-3">Team</th>
                  <th className="pb-3">Workload</th>
                  <th className="pb-3">SLA</th>
                  <th className="pb-3">Completion</th>
                  <th className="pb-3">Risk</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--mx-line)]">
                {teamRows.map((row) => (
                  <tr key={row.team}>
                    <td className="py-4 font-extrabold">{row.team}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-28 h-2 rounded-full mx-progress-track overflow-hidden">
                          <div className="h-full mx-progress-fill" style={{ width: `${Math.max(6, (row.total / maxTeamTotal) * 100)}%` }}></div>
                        </div>
                        <span>{row.total}</span>
                      </div>
                    </td>
                    <td className="py-4 font-bold">{formatScorePercent(row.sla)}</td>
                    <td className="py-4 font-bold">{formatScorePercent(row.completion)}</td>
                    <td className="py-4">
                      <span className={cn('mx-badge', row.overdue > 0 ? 'mx-status-hold' : row.atRisk > 0 ? 'mx-status-pending' : 'mx-status-completed')}>
                        {row.overdue} overdue / {row.atRisk} risk
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={cn('mx-badge', getExecutiveHealthClass(row.health))}>
                        {row.health >= 90 ? 'Healthy' : row.health >= 75 ? 'Watch' : row.health >= 60 ? 'Pressure' : 'Critical'}
                      </span>
                    </td>
                  </tr>
                ))}
                {teamRows.length === 0 && (
                  <tr><td className="py-8 text-center text-[var(--mx-muted)]" colSpan="6">No team data in this scope.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Critical Work Queue" subtitle="Highest SLA and KPI exposure">
          <div className="grid gap-3">
            {criticalQueue.map(({ task, days, weight }) => (
              <div key={task.id || `${task.job}-${task.deadline}`} className="mx-data-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold truncate">{extractJobCode(task.job)}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)] line-clamp-2">{task.job || '-'}</div>
                  </div>
                  <span className={cn('mx-badge flex-shrink-0', days < 0 ? 'mx-status-hold' : days <= 3 ? 'mx-status-pending' : 'mx-status-process')}>
                    {days < 0 ? `${Math.abs(days)} bd late` : `${days} bd left`}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="mx-badge mx-status-cancelled">{task.team || '-'}</span>
                  <span className="mx-badge mx-status-process">weight {formatWeight(weight)}</span>
                  <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status || '-'}</span>
                </div>
              </div>
            ))}
            {criticalQueue.length === 0 && (
              <div className="mx-data-card text-center text-[var(--mx-muted)]">No critical active work in this scope.</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function DashboardView({ user, data, filterMonth, filterYear, holidays = [], onAccept, onStatusChange, onNavigate }) {
  if (!data) {
    return (
      <Panel title="Executive Overview" subtitle="กำลังเตรียมข้อมูล...">
        <div className="text-[var(--mx-muted)]">Loading...</div>
      </Panel>
    );
  }

  if (user.role === 'Staff') {
    const tasks = data.tasks || [];
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    const active = tasks.filter((t) => ['On Process', 'Pending', 'On Hold'].includes(t.status)).length;
    const holidaySet = buildHolidaySet([...(holidays || []), ...((data && data.holidays) || [])]);

    const scores = calcTaskWeightedScores(tasks);

    // KPI distribution bar
    const kpiDist = {};
    tasks.forEach((t) => {
      if (String(t.status || '').toLowerCase() === 'cancelled') return;
      const k = t.mainkpi || 'Other';
      const weight = getTaskWeight(t);
      if (!kpiDist[k] || (kpiDist[k] === 1 && weight !== 1)) kpiDist[k] = weight;
    });
    const kpiEntries = Object.entries(kpiDist).sort((a, b) => b[1] - a[1]);
    const maxKpi = kpiEntries.length > 0 ? kpiEntries[0][1] : 1;

    // All active tasks (not completed/cancelled)
    const activeTasks = tasks.filter((t) => !['Completed', 'Cancelled'].includes(t.status));

    const periodLabel = filterMonth === 0 ? `ทุกเดือน ${filterYear}` : `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`;

    const [dashModal, setDashModal] = useState({ show: false });
    const [dashNotePopup, setDashNotePopup] = useState({ show: false, note: '' });

    const handleDashAction = (task, action) => {
      const ts = getTimestamp();
      if (action === 'accept') {
        setDashModal({ show: true, title: 'ยืนยันรับงาน', message: 'ต้องการเริ่มดำเนินการงานนี้ใช่หรือไม่?', color: 'blue', type: 'confirm', action: () => onAccept(task) });
      } else if (action === 'complete') {
        setDashModal({ show: true, title: 'งานเสร็จสิ้น', message: 'ยืนยันว่างานนี้เสร็จสมบูรณ์แล้วใช่หรือไม่?', color: 'emerald', type: 'confirm', action: () => onStatusChange(task, 'Completed', '') });
      } else if (action === 'hold') {
        setDashModal({ show: true, title: 'พักงาน', message: 'ระบุรายละเอียดการพักงาน:', color: 'amber', type: 'prompt', action: (reason) => { if (reason?.trim()) onStatusChange(task, 'On Hold', `${ts} [On Hold] ${reason}`); } });
      } else if (action === 'resume') {
        onStatusChange(task, 'On Process', `${ts} ดำเนินการต่อ`);
      } else if (action === 'cancel') {
        setDashModal({ show: true, title: 'ยกเลิกงาน', message: 'ระบุเหตุผลที่ยกเลิกงาน:', color: 'rose', type: 'prompt', action: (reason) => { if (reason?.trim()) onStatusChange(task, 'Cancelled', `${ts} [Cancelled] ${reason}`); } });
      } else if (action === 'note') {
        setDashModal({ show: true, title: 'เพิ่ม Note', message: 'ระบุรายละเอียดเพิ่มเติม:', color: 'blue', type: 'prompt', action: (note) => { if (note?.trim()) onStatusChange(task, task.status, `${ts} ${note}`, 'note_only'); } });
      }
    };

    const ActionBtn = ({ icon, color, onClick, label }) => {
      const variants = {
        emerald: 'mx-action-success',
        amber: 'mx-action-warning',
        rose: 'mx-action-danger',
        blue: 'mx-action-info',
        indigo: 'mx-action-muted',
      };
      return (
        <div className="relative group">
          <button onClick={onClick} className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors duration-200 ${variants[color] || ''}`}>
            <i className={`fas ${icon} text-sm`}></i>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {label}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
          </div>
        </div>
      );
    };

    return (
      <div className="grid gap-5">
        <ActionModal config={dashModal} onClose={() => setDashModal({ show: false })} />
        {dashNotePopup.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
            <div className="mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl">
              <h3 className="text-xl font-extrabold mb-4"><i className="fas fa-sticky-note mr-2 text-[var(--mx-info)]"></i>บันทึกงาน</h3>
              <div className="max-h-80 overflow-y-auto rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                <div className="text-sm leading-7 whitespace-pre-wrap">{dashNotePopup.note}</div>
              </div>
              <button className="mx-btn mx-btn-soft w-full mt-5" onClick={() => setDashNotePopup({ show: false, note: '' })}>ปิด</button>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="mx-grid-auto">
          <MetricCard label="Total Tasks" value={tasks.length} sub={`งานใน${periodLabel}`} icon="fa-list-check" />
          <MetricCard label="Total Weight" value={formatWeightPercent(scores.totalWeight)} sub="น้ำหนักงานที่ใช้คำนวณ KPI" icon="fa-scale-balanced" accent="var(--mx-blue)" />
          <MetricCard label="Weighted Completion" value={formatScorePercent(scores.completion)} sub={completionMetricSub(scores)} icon="fa-check-double" accent="var(--mx-green)" />
          <MetricCard label="Weighted SLA" value={formatScorePercent(scores.sla)} sub={slaMetricSub(scores)} icon="fa-chart-line" accent="var(--mx-amber)" />
        </div>

        <WeightFormulaStrip scores={scores} />

        {/* KPI Distribution */}
        {kpiEntries.length > 0 && (
          <Panel title="KPI Weight Distribution" subtitle="สัดส่วนน้ำหนักงานแยกตาม Main KPI">
            <div className="grid gap-3">
              {kpiEntries.map(([kpi, count]) => (
                <div key={kpi} className="flex items-center gap-3">
                  <div className="text-sm font-bold w-44 truncate flex-shrink-0">{kpi}</div>
                  <div className="flex-1 h-3 rounded-full mx-progress-track overflow-hidden">
                    <div className="h-full rounded-full mx-progress-fill" style={{ width: `${(count / maxKpi) * 100}%` }} />
                  </div>
                  <div className="text-sm text-[var(--mx-muted)] w-20 text-right flex-shrink-0">{formatWeightPercent(count)}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Active Tasks with action buttons */}
        <Panel
          title="งานที่ต้องดำเนินการ"
          subtitle="งาน Pending / On Process / On Hold ที่ต้องติดตาม"
          actions={[
            <button key="add" className="mx-btn mx-btn-primary" onClick={() => onNavigate('create')}>
              <i className="fa-solid fa-plus mr-2"></i>เพิ่มงานใหม่
            </button>
          ]}
        >
          <div className="grid gap-3">
            {activeTasks.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่มีงานที่ต้องดำเนินการ</div>}
            {activeTasks.map((task) => {
              const daysLeft = getDaysUntilDeadline(task, holidaySet);
              const isOverdue = daysLeft !== null && daysLeft < 0;
              const holdSummary = getHoldSummary(task, holidaySet);
              return (
                <div key={task.id} className="mx-data-card">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold break-all">{task.job}</span>
                        <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status}</span>
                        <span className="mx-badge mx-status-cancelled">Weight {formatWeightPercent(getTaskWeight(task))}</span>
                        {task.note && (
                          <button onClick={() => setDashNotePopup({ show: true, note: task.note })} className="mx-note-btn text-xs px-3 py-1.5 rounded-lg font-bold">
                            <i className="fas fa-sticky-note mr-1"></i>ดูบันทึก
                          </button>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-[var(--mx-muted)]">
                        {task.mainkpi || '-'} • {task.subkpi || '-'}
                      </div>
                      <div className="mt-1 text-sm text-[var(--mx-muted)]">
                        Deadline {formatDate(task.deadline)}
                        {holdSummary.activeStart && holdSummary.activeDays > 0 && (
                          <span className="ml-2 text-[var(--mx-info)] font-bold">Effective {formatDate(holdSummary.effectiveDeadline)}</span>
                        )}
                        {isOverdue && <span className="ml-2 text-red-400 font-bold">เกิน {Math.abs(daysLeft)} วันทำการ</span>}
                        {!isOverdue && daysLeft !== null && daysLeft <= 3 && <span className="ml-2 text-[var(--mx-warning)] font-bold">อีก {daysLeft} วันทำการ</span>}
                      </div>
                      {holdSummary.activeStart && (
                        <div className="mt-1 text-sm text-[var(--mx-warning)] font-bold">
                          SLA paused since {formatDate(holdSummary.activeStart)} - {holdSummary.activeDays} business day(s) will be added on resume
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 flex-shrink-0 items-start">
                      {task.status === 'Pending' && (
                        <ActionBtn icon="fa-play" color="blue" onClick={() => handleDashAction(task, 'accept')} label="เริ่มงาน" />
                      )}
                      {task.status === 'On Process' && (
                        <>
                          <ActionBtn icon="fa-check" color="emerald" onClick={() => handleDashAction(task, 'complete')} label="เสร็จสิ้น" />
                          <ActionBtn icon="fa-pause" color="amber" onClick={() => handleDashAction(task, 'hold')} label="พักงาน" />
                          <ActionBtn icon="fa-comment-dots" color="blue" onClick={() => handleDashAction(task, 'note')} label="เพิ่มบันทึก" />
                        </>
                      )}
                      {task.status === 'On Hold' && (
                        <>
                          <ActionBtn icon="fa-play" color="blue" onClick={() => handleDashAction(task, 'resume')} label="ดำเนินการต่อ" />
                          <ActionBtn icon="fa-comment-dots" color="blue" onClick={() => handleDashAction(task, 'note')} label="เพิ่มบันทึก" />
                        </>
                      )}
                      {!['Completed', 'Cancelled'].includes(task.status) && (
                        <ActionBtn icon="fa-trash" color="rose" onClick={() => handleDashAction(task, 'cancel')} label="ยกเลิก" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  if (user.role === 'Lead') {
    const tasks = data.tasks || [];
    const holidaySet = buildHolidaySet([...(holidays || []), ...((data && data.holidays) || [])]);
    const summary = enrichSummaryWithTaskWeights(data.summary || [], tasks);
    const teamScores = tasks.length > 0 ? calcTaskWeightedScores(tasks) : null;
    const avgSla = teamScores && teamScores.sla !== null
      ? teamScores.sla
      : (summary.length ? Math.round(summary.reduce((s, p) => s + (Number(p.weightedSlaScore) || 0), 0) / summary.length) : 0);
    const leadRows = summary.map((person) => ({ person, detail: summarizeLeadPersonTasks(person, tasks, holidaySet) }));
    return (
      <div className="grid gap-5">
        <div className="mx-grid-auto">
          <MetricCard label="Team Members" value={summary.length} sub="กำลังแสดงตามสิทธิ์ของ Lead" icon="fa-users" />
          <MetricCard label="Team Weight" value={teamScores ? formatWeightPercent(teamScores.totalWeight) : '-'} sub="น้ำหนักงานรวมของทีม" icon="fa-scale-balanced" accent="var(--mx-blue)" />
          <MetricCard label="Weighted Completion" value={teamScores ? formatScorePercent(teamScores.completion) : '-'} sub={completionMetricSub(teamScores)} icon="fa-check-double" accent="var(--mx-green)" />
          <MetricCard label="Avg SLA" value={`${avgSla}%`} sub={teamScores ? slaMetricSub(teamScores, avgSla) : 'ค่าเฉลี่ย weighted SLA score'} icon="fa-chart-line" accent="var(--mx-teal)" />
          <MetricCard label="Period" value={data.period || '-'} sub="ช่วงเวลาที่กำลังดู" icon="fa-calendar-days" accent="var(--mx-amber)" />
        </div>
        {teamScores && <WeightFormulaStrip scores={teamScores} />}
        <Panel title="Team Performance Pulse" subtitle="ภาพรวมทีมในหน้าที่อ่านง่ายขึ้น">
          <div className="grid gap-4">
            {leadRows.map(({ person, detail }, index) => {
              const slaScore = person.weightedSlaScore ?? detail.scores.sla;
              const completionScore = person.weightedCompletionScore ?? detail.scores.completion;
              const totalWeight = person.totalWeight ?? detail.scores.totalWeight;
              const primaryRisk = detail.riskItems[0];
              const dialogId = `lead-person-detail-${String(person.empId || person.empid || person.name || index).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              return (
                <React.Fragment key={person.empId || person.name}>
                  <button
                    type="button"
                    className="mx-data-card text-left w-full cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--mx-info)]"
                    onClick={() => document.getElementById(dialogId)?.showModal()}
                  >
                    <div className="grid xl:grid-cols-[minmax(240px,0.85fr)_minmax(360px,1.15fr)] gap-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold text-lg leading-tight break-words">{person.name}</div>
                            <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team || '-'} • {person.empId || person.empid || 'ไม่พบรหัสพนักงาน'}</div>
                          </div>
                          <span className={cn('mx-badge', leadFocusClass(detail, slaScore))}>{leadFocusLabel(detail, slaScore)}</span>
                        </div>
                        <div className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-[var(--mx-info)]">
                          <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
                          คลิกเพื่อดูรายละเอียด
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="mx-muted-card rounded-lg p-3">
                            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--mx-muted)] font-black">SLA</div>
                            <div className="mt-1 text-xl font-extrabold">{formatScorePercent(slaScore)}</div>
                          </div>
                          <div className="mx-muted-card rounded-lg p-3">
                            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--mx-muted)] font-black">Complete</div>
                            <div className="mt-1 text-xl font-extrabold">{formatScorePercent(completionScore)}</div>
                          </div>
                          <div className="mx-muted-card rounded-lg p-3">
                            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--mx-muted)] font-black">Weight</div>
                            <div className="mt-1 text-xl font-extrabold">{formatWeightPercent(totalWeight)}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="mx-badge mx-status-process">Active {detail.active}</span>
                          <span className="mx-badge mx-status-pending">Pending {detail.pending}</span>
                          <span className="mx-badge mx-status-hold">On Hold {detail.onHold}</span>
                          <span className="mx-badge mx-status-completed">Done {detail.completed}</span>
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
                        <div className="mx-muted-card rounded-lg p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-extrabold">งานที่ควรดูต่อ</div>
                            <span className={cn('mx-badge', detail.overdue > 0 ? 'mx-status-hold' : detail.dueSoon > 0 ? 'mx-status-pending' : 'mx-status-process')}>
                              {detail.overdue} overdue / {detail.dueSoon} risk
                            </span>
                          </div>
                          {primaryRisk ? (
                            <div className="mt-3">
                              <div className="font-bold leading-6 break-words">{extractJobCode(primaryRisk.task.job)}</div>
                              <div className="mt-1 text-sm text-[var(--mx-muted)] line-clamp-2">{primaryRisk.task.job || '-'}</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className={cn('mx-badge', primaryRisk.days < 0 ? 'mx-status-hold' : primaryRisk.days <= 3 ? 'mx-status-pending' : 'mx-status-process')}>
                                  {primaryRisk.days < 0 ? `เกิน ${Math.abs(primaryRisk.days)} วันทำการ` : `อีก ${primaryRisk.days} วันทำการ`}
                                </span>
                                <span className="mx-badge mx-status-cancelled">Weight {formatWeightPercent(primaryRisk.weight)}</span>
                                <span className={cn('mx-badge', getStatusClass(primaryRisk.task.status))}>{primaryRisk.task.status || '-'}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-[var(--mx-muted)]">ไม่มีงานเสี่ยงในช่วงที่เลือก</div>
                          )}
                        </div>

                        <div className="mx-muted-card rounded-lg p-4">
                          <div className="text-sm font-extrabold">KPI Mix หลัก</div>
                          <div className="mt-3 grid gap-2">
                            {detail.kpiMix.map((item) => (
                              <div key={item.name} className="rounded-lg border border-[var(--mx-line)] bg-[var(--mx-surface)] p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-bold leading-5 break-words">{item.name}</div>
                                    <div className="mt-1 text-xs text-[var(--mx-muted)]">Active {item.active} • Done {item.completed} • Total {item.tasks}</div>
                                  </div>
                                  <span className="mx-badge mx-status-cancelled flex-shrink-0">{formatWeightPercent(item.weight)}</span>
                                </div>
                              </div>
                            ))}
                            {detail.kpiMix.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่มี KPI active สำหรับคนนี้</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                  <LeadPersonDetailModal row={{ person, detail }} dialogId={dialogId} />
                </React.Fragment>
              );
            })}
            {leadRows.length === 0 && <div className="mx-data-card text-center text-[var(--mx-muted)]">ไม่มีข้อมูลทีมในช่วงที่เลือก</div>}
          </div>
        </Panel>
      </div>
    );
  }

  if (user.role === 'Manager') {
    const tasks = data.tasks || [];
    const summary = enrichSummaryWithTaskWeights(data.summary || [], tasks);
    const risky = tasks.filter((t) => ['Pending', 'On Hold'].includes(t.status)).length;
    const orgScores = tasks.length > 0 ? calcTaskWeightedScores(tasks) : null;
    const avgSla = orgScores && orgScores.sla !== null
      ? orgScores.sla
      : (summary.length ? Math.round(summary.reduce((s, p) => s + (Number(p.weightedSlaScore) || 0), 0) / summary.length) : 0);
    const topPeople = [...summary].sort((a, b) => (b.weightedSlaScore || 0) - (a.weightedSlaScore || 0)).slice(0, 6);
    return (
      <div className="grid gap-5">
        <div className="mx-grid-auto">
          <MetricCard label="Active Tasks" value={tasks.length} sub="โหลดจากระบบเดิมแบบตรง ๆ" icon="fa-briefcase" />
          <MetricCard label="Risk Queue" value={risky} sub="Pending / On Hold ต้องติดตาม" icon="fa-triangle-exclamation" accent="var(--mx-amber)" />
          <MetricCard label="Total Weight" value={orgScores ? formatWeightPercent(orgScores.totalWeight) : '-'} sub="น้ำหนักงานรวมที่ใช้คำนวณ" icon="fa-scale-balanced" accent="var(--mx-blue)" />
          <MetricCard label="Completion" value={orgScores ? formatScorePercent(orgScores.completion) : '-'} sub={completionMetricSub(orgScores)} icon="fa-check-double" accent="var(--mx-green)" />
          <MetricCard label="Avg SLA" value={`${avgSla}%`} sub={orgScores ? slaMetricSub(orgScores, avgSla) : 'weighted SLA across visible staff'} icon="fa-chart-line" accent="var(--mx-teal)" />
          <MetricCard label="People" value={summary.length} sub="จำนวนคนในมุมผู้จัดการ" icon="fa-users-viewfinder" accent="var(--mx-blue)" />
        </div>
        {orgScores && <WeightFormulaStrip scores={orgScores} />}
        <Panel title="Executive Scoreboard" subtitle="ผู้บริหารเห็นคะแนน, ปริมาณงาน, และจุดที่ควร intervene ทันที">
          <div className="grid md:grid-cols-2 gap-3">
            {topPeople.map((person) => (
              <div key={person.empId || person.name} className="mx-data-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{person.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team} • Total {person.totalTasks}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="mx-badge mx-status-cancelled">Weight {formatWeightPercent(person.totalWeight)}</span>
                      <span className="mx-badge mx-status-completed">Completion {person.weightedCompletionScore ?? '-'}%</span>
                    </div>
                  </div>
                  <span className="mx-badge mx-status-process">{person.weightedSlaScore ?? '-'}%</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  // Admin
  const tasks = data.summary || [];
  const staff = data.staff || [];
  const kpis = data.kpis || [];
  return (
    <div className="grid gap-5">
      <div className="mx-grid-auto">
        <MetricCard label="Tasks" value={tasks.length} sub="ข้อมูลรวมจากระบบเดิม" icon="fa-briefcase" />
        <MetricCard label="Users" value={staff.length} sub="ผู้ใช้งานในระบบ" icon="fa-users" accent="var(--mx-teal)" />
        <MetricCard label="KPI Items" value={kpis.length} sub="รายการ KPI ปัจจุบัน" icon="fa-sliders" accent="var(--mx-amber)" />
      </div>
      <Panel title="System Overview" subtitle="ภาพรวมสำหรับผู้ดูแลระบบ">
        <div className="text-sm text-[var(--mx-muted)]">
          {APP_NAME} ใช้ backend เดิมและฐานข้อมูลเดิมโดยตรง แต่เปลี่ยนประสบการณ์การใช้งานให้ชัดเจนและเป็นระบบมากขึ้น
        </div>
      </Panel>
    </div>
  );
}

// ─── Task Center View ──────────────────────────────────────────────────────────
function TaskCenterView({ user, tasks, holidays = [], onAccept, onStatusChange, onDelete, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // ActionModal for Staff quick actions
  const [modal, setModal] = useState({ show: false });
  const closeModal = () => setModal({ show: false });
  const showModal = (cfg) => setModal({ show: true, ...cfg });

  // StatusChangeModal for Lead/Manager
  const [statusTarget, setStatusTarget] = useState(null);

  // Note viewer popup
  const [notePopup, setNotePopup] = useState({ show: false, note: '' });

  // Edit task modal
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ job: '', subkpi: '', extra_data: {} });
  const [savingEdit, setSavingEdit] = useState(false);

  // PR completion modal
  const [prModal, setPrModal] = useState({ show: false, task: null, fundNumber: '', amount: '' });
  const [savingPr, setSavingPr] = useState(false);

  // Icon action button with tooltip (matches original ActionButton)
  const ActionButton = ({ icon, color, onClick, label }) => {
    const variants = {
      emerald: 'mx-action-success',
      amber: 'mx-action-warning',
      rose: 'mx-action-danger',
      slate: 'mx-action-muted',
      blue: 'mx-action-info',
      indigo: 'mx-action-muted',
    };
    return (
      <div className="relative group">
        <button
          onClick={onClick}
          className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors duration-200 ${variants[color] || variants.slate}`}
        >
          <i className={`fas ${icon} text-sm`}></i>
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      </div>
    );
  };

  const filtered = useMemo(() => {
    return (tasks || []).filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [task.job, task.name, task.team, task.subkpi, task.status]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [tasks, statusFilter, search]);

  const taskSummary = useMemo(() => ({
    total: (tasks || []).length,
    active: (tasks || []).filter((t) => ['On Process', 'Pending', 'On Hold'].includes(t.status)).length,
    completed: (tasks || []).filter((t) => t.status === 'Completed').length,
    risk: (tasks || []).filter((t) => ['Pending', 'On Hold'].includes(t.status)).length,
  }), [tasks]);
  const taskScores = useMemo(() => calcTaskWeightedScores(tasks || []), [tasks]);
  const holidaySet = useMemo(() => buildHolidaySet(holidays || []), [holidays]);

  // Staff quick actions
  const handleStaffAction = (task, action) => {
    const ts = getTimestamp();
    if (action === 'accept') {
      showModal({
        title: 'ยืนยันรับงาน', message: 'ต้องการเริ่มดำเนินการงานนี้ใช่หรือไม่?',
        color: 'blue', type: 'confirm',
        action: () => onAccept(task),
      });
    } else if (action === 'complete') {
      if ((task.subkpi || '').toLowerCase().includes('open pr')) {
        setPrModal({ show: true, task, fundNumber: task.extra_data?.fundNumber || '', amount: task.extra_data?.amount || '' });
      } else {
        showModal({
          title: 'งานเสร็จสิ้น', message: 'ยืนยันว่างานนี้เสร็จสมบูรณ์แล้วใช่หรือไม่?',
          color: 'emerald', type: 'confirm',
          action: () => onStatusChange(task, 'Completed', ''),
        });
      }
    } else if (action === 'hold') {
      showModal({
        title: 'พักงาน', message: 'ระบุรายละเอียดการพักงาน:',
        color: 'amber', type: 'prompt',
        action: (reason) => { if (reason?.trim()) onStatusChange(task, 'On Hold', `${ts} [On Hold] ${reason}`); },
      });
    } else if (action === 'resume') {
      onStatusChange(task, 'On Process', `${ts} ดำเนินการต่อ`);
    } else if (action === 'cancel') {
      showModal({
        title: 'ยกเลิกงาน', message: 'ระบุเหตุผลที่ยกเลิกงาน:',
        color: 'rose', type: 'prompt',
        action: (reason) => { if (reason?.trim()) onStatusChange(task, 'Cancelled', `${ts} [Cancelled] ${reason}`); },
      });
    } else if (action === 'note') {
      showModal({
        title: 'เพิ่ม Note', message: 'ระบุรายละเอียดเพิ่มเติม:',
        color: 'blue', type: 'prompt',
        action: (note) => { if (note?.trim()) onStatusChange(task, task.status, `${ts} ${note}`, 'note_only'); },
      });
    }
  };

  const handleEditOpen = (task) => {
    setEditForm({ job: task.job || '', subkpi: task.subkpi || '', extra_data: task.extra_data || {} });
    setEditingTask(task);
  };

  const handleEditSave = async () => {
    if (!editForm.job.trim() || !editForm.subkpi.trim()) {
      alert('กรุณากรอก Job และ Sub KPI');
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
        extra_data: editForm.extra_data || {},
      });
      setEditingTask(null);
      onRefresh();
    } catch (e) {
      alert(e.message || 'แก้ไขไม่สำเร็จ');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePrComplete = async () => {
    if (!prModal.task) return;
    setSavingPr(true);
    const ts = getTimestamp();
    try {
      const newExtra = { ...(prModal.task.extra_data || {}), fundNumber: prModal.fundNumber, amount: prModal.amount };
      await Promise.all([
        API.updateTaskStatus(prModal.task.id, prModal.task.team, 'Completed'),
        API.updateTaskDetails({
          id: prModal.task.id, team: prModal.task.team, job: prModal.task.job,
          subkpi: prModal.task.subkpi, mainkpi: prModal.task.mainkpi,
          deadline: prModal.task.deadline, extra_data: newExtra,
        }),
      ]);
      setPrModal({ show: false, task: null, fundNumber: '', amount: '' });
      onRefresh();
    } catch (e) {
      alert(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingPr(false);
    }
  };

  const canEdit = (task) => !['Completed', 'Cancelled'].includes(task.status);
  const canCancel = (task) => !['Completed', 'Cancelled'].includes(task.status);

  return (
    <div className="grid gap-5">
      <ActionModal config={modal} onClose={closeModal} />

      {/* Note Viewer Popup */}
      {notePopup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-extrabold mb-4">
              <i className="fas fa-sticky-note mr-2 text-[var(--mx-info)]"></i>บันทึกงาน
            </h3>
            <div className="max-h-80 overflow-y-auto rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
              <div className="text-sm leading-7 whitespace-pre-wrap">{notePopup.note || '-'}</div>
            </div>
            <button className="mx-btn mx-btn-soft w-full mt-5" onClick={() => setNotePopup({ show: false, note: '' })}>
              ปิด
            </button>
          </div>
        </div>
      )}

      {statusTarget && (
        <StatusChangeModal
          task={statusTarget}
          onSave={(status, reason) => onStatusChange(statusTarget, status, reason)}
          onClose={() => setStatusTarget(null)}
        />
      )}

      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-extrabold mb-5">แก้ไขงาน</h3>
            <div className="grid gap-4">
              <div>
                <label className="block mb-2 text-sm font-bold">Job / รายละเอียดงาน</label>
                <textarea
                  className="mx-textarea min-h-[100px]"
                  value={editForm.job}
                  onChange={(e) => setEditForm((p) => ({ ...p, job: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-bold">Sub KPI</label>
                <input
                  className="mx-input"
                  value={editForm.subkpi}
                  onChange={(e) => setEditForm((p) => ({ ...p, subkpi: e.target.value }))}
                />
              </div>
              <ExtraDataFields
                subkpi={editForm.subkpi}
                extraData={editForm.extra_data}
                onChange={(ed) => setEditForm((p) => ({ ...p, extra_data: ed }))}
              />
              <div className="text-sm text-[var(--mx-muted)]">
                Main KPI: {editingTask.mainkpi || '-'} • Deadline: {formatDate(editingTask.deadline)}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="mx-btn mx-btn-soft flex-1" onClick={() => setEditingTask(null)}>ยกเลิก</button>
              <button className="mx-btn mx-btn-primary flex-1" disabled={savingEdit} onClick={handleEditSave}>
                {savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {prModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-extrabold mb-2">Complete Open PR</h3>
            <p className="text-sm text-[var(--mx-muted)] mb-5">กรอกข้อมูลก่อนปิดงาน PR</p>
            <div className="grid gap-4">
              <div>
                <label className="block mb-2 text-sm font-bold">Fund Number</label>
                <input
                  className="mx-input"
                  placeholder="เลขกองทุน"
                  value={prModal.fundNumber}
                  onChange={(e) => setPrModal((p) => ({ ...p, fundNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-bold">Amount (บาท)</label>
                <input
                  className="mx-input"
                  type="number"
                  placeholder="จำนวนเงิน"
                  value={prModal.amount}
                  onChange={(e) => setPrModal((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="mx-btn mx-btn-soft flex-1" onClick={() => setPrModal({ show: false, task: null, fundNumber: '', amount: '' })}>
                ยกเลิก
              </button>
              <button
                className="mx-btn flex-1 mx-action-success"
                disabled={savingPr}
                onClick={handlePrComplete}
              >
                {savingPr ? 'กำลังบันทึก...' : 'ปิดงาน PR'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-grid-auto">
        <MetricCard label="Total Tasks" value={taskSummary.total} sub="ทั้งหมดในมุมมองนี้" icon="fa-list-check" />
        <MetricCard label="Total Weight" value={formatWeightPercent(taskScores.totalWeight)} sub="น้ำหนักงานที่ใช้คำนวณ" icon="fa-scale-balanced" accent="var(--mx-blue)" />
        <MetricCard label="Completion" value={formatScorePercent(taskScores.completion)} sub={completionMetricSub(taskScores)} icon="fa-check-double" accent="var(--mx-green)" />
        <MetricCard label="Weighted SLA" value={formatScorePercent(taskScores.sla)} sub={slaMetricSub(taskScores)} icon="fa-chart-line" accent="var(--mx-teal)" />
        <MetricCard label="Need Attention" value={taskSummary.risk} sub="Pending / On Hold" icon="fa-triangle-exclamation" accent="var(--mx-amber)" />
      </div>
      <WeightFormulaStrip scores={taskScores} />

      <Panel
        title="Task Center"
        subtitle="มุมมองงานแบบใหม่ที่อ่านเร็วและจัดการง่ายกว่าเดิม"
        actions={[
          <button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh}>
            <i className="fa-solid fa-rotate-right mr-2"></i>Refresh
          </button>,
        ]}
      >
        <div className="grid md:grid-cols-[1fr_220px] gap-3 mb-5">
          <input
            className="mx-input"
            placeholder="ค้นหา job / คน / team / status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="mx-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">ทุกสถานะ</option>
            <option value="Pending">Pending</option>
            <option value="On Process">On Process</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="grid gap-3">
          {filtered.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบรายการงาน</div>}
          {filtered.map((task) => {
            const holdSummary = getHoldSummary(task, holidaySet);
            return (
            <div key={task.id} className="mx-data-card">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-base break-all">{task.job}</div>
                    <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status}</span>
                    <span className="mx-badge mx-status-cancelled">Weight {formatWeightPercent(getTaskWeight(task))}</span>
                    <button
                      className="mx-btn mx-btn-soft !py-2 !px-3"
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    >
                      {expandedTaskId === task.id ? 'ซ่อน' : 'รายละเอียด'}
                    </button>
                    {task.note && (
                      <button
                        onClick={() => setNotePopup({ show: true, note: task.note })}
                        className="mx-note-btn text-xs px-3 py-1.5 rounded-lg transition-colors font-bold"
                      >
                        <i className="fas fa-sticky-note mr-1"></i>ดูบันทึก
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">
                    {task.name || '-'} • {task.team || '-'} • {task.subkpi || 'ไม่ระบุ Sub KPI'}
                  </div>
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">
                    Start {formatDate(task.startdate)} • Deadline {formatDate(task.deadline)}
                    {task.completiondate ? ` • เสร็จ ${formatDate(task.completiondate)}` : ''}
                  </div>
                  {holdSummary.activeStart && (
                    <div className="mt-2 text-sm text-[var(--mx-warning)] font-bold">
                      SLA paused since {formatDate(holdSummary.activeStart)} - effective deadline {formatDate(holdSummary.effectiveDeadline)}
                    </div>
                  )}
                  {expandedTaskId === task.id && (
                    <div className="mt-4 rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="text-xs text-[var(--mx-muted)]">Task ID: {task.id}</div>
                      <div className="mt-2 text-xs text-[var(--mx-muted)]">Weight: {formatWeightPercent(getTaskWeight(task))}</div>
                      {holdSummary.totalDays > 0 && (
                        <div className="mt-2 text-xs text-[var(--mx-muted)]">Total hold: {holdSummary.totalDays} business day(s)</div>
                      )}
                      {task.note
                        ? <div className="mt-3 text-sm leading-7 whitespace-pre-wrap">{task.note}</div>
                        : <div className="mt-3 text-sm text-[var(--mx-muted)]">ไม่มี note</div>
                      }
                      {renderExtraData(task.extra_data)}
                    </div>
                  )}
                </div>

                {/* ─── Action Buttons (icon + tooltip แบบต้นฉบับ) ─── */}
                <div className="flex flex-wrap gap-2 flex-shrink-0 items-start">
                  {/* Staff actions */}
                  {user.role === 'Staff' && (
                    <>
                      {task.status === 'Pending' && (
                        <ActionButton icon="fa-play" color="blue" onClick={() => handleStaffAction(task, 'accept')} label="เริ่มงาน" />
                      )}
                      {task.status === 'On Process' && (
                        <>
                          <ActionButton icon="fa-check" color="emerald" onClick={() => handleStaffAction(task, 'complete')} label="เสร็จสิ้น" />
                          <ActionButton icon="fa-pause" color="amber" onClick={() => handleStaffAction(task, 'hold')} label="พักงาน" />
                          <ActionButton icon="fa-comment-dots" color="blue" onClick={() => handleStaffAction(task, 'note')} label="เพิ่มบันทึก" />
                        </>
                      )}
                      {task.status === 'On Hold' && (
                        <>
                          <ActionButton icon="fa-play" color="blue" onClick={() => handleStaffAction(task, 'resume')} label="ดำเนินการต่อ" />
                          <ActionButton icon="fa-comment-dots" color="blue" onClick={() => handleStaffAction(task, 'note')} label="เพิ่มบันทึก" />
                        </>
                      )}
                      {canCancel(task) && (
                        <ActionButton icon="fa-trash" color="rose" onClick={() => handleStaffAction(task, 'cancel')} label="ยกเลิก" />
                      )}
                      {canEdit(task) && (
                        <ActionButton icon="fa-edit" color="indigo" onClick={() => handleEditOpen(task)} label="แก้ไข" />
                      )}
                    </>
                  )}

                  {/* Lead / Manager / Admin actions */}
                  {['Lead', 'Manager', 'Admin'].includes(user.role) && (
                    <>
                      <ActionButton icon="fa-arrow-right-arrow-left" color="blue" onClick={() => setStatusTarget(task)} label="เปลี่ยนสถานะ" />
                      {canEdit(task) && (
                        <ActionButton icon="fa-edit" color="indigo" onClick={() => handleEditOpen(task)} label="แก้ไข" />
                      )}
                      {['Manager', 'Admin'].includes(user.role) && (
                        <ActionButton icon="fa-trash" color="rose" onClick={() => onDelete(task)} label="ลบงาน" />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ─── Job Tracker View ──────────────────────────────────────────────────────────
function TrackerViewNew() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [logsByTask, setLogsByTask] = useState({});
  const [expandedJob, setExpandedJob] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const handleSearch = async () => {
    if (query.trim().length < 3) { setError('กรุณาค้นหาอย่างน้อย 3 ตัวอักษร'); return; }
    setLoading(true);
    setError('');
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
          } catch { return [task.id, []]; }
        })
      );
      setLogsByTask(Object.fromEntries(logPairs));
    } catch (e) {
      setError(e.message || 'ค้นหาไม่สำเร็จ');
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

  return (
    <div className="grid gap-5">
      <Panel title="Job Tracker" subtitle="แยกให้ชัดว่า Job หนึ่งอาจมีหลาย Task ย่อย">
        <div className="grid md:grid-cols-[1fr_180px] gap-3 mb-5">
          <input
            className="mx-input"
            placeholder="ค้นหา job code หรือชื่องาน"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="mx-btn mx-btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? 'กำลังค้นหา...' : 'Search'}
          </button>
        </div>
        {error && <div className="mb-4 text-sm text-[#ffb7b7] font-bold">{error}</div>}
        <div className="grid gap-4">
          {grouped.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ยังไม่มีผลการค้นหา</div>}
          {grouped.map(([code, tasks]) => (
            <div key={code} className="mx-data-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-lg">{code}</div>
                  <div className="mt-1 text-sm text-[var(--mx-muted)]">{tasks.length} task(s) under this job</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mx-badge mx-status-process">
                    {[...new Set(tasks.map((t) => t.name).filter(Boolean))].length} owner(s)
                  </span>
                  <button
                    className="mx-btn mx-btn-soft !py-2 !px-3"
                    onClick={() => setExpandedJob(expandedJob === code ? null : code)}
                  >
                    {expandedJob === code ? 'Collapse' : 'Open Timeline'}
                  </button>
                </div>
              </div>
              {expandedJob === code && (
                <div className="mt-4 grid gap-3">
                  {tasks.map((task, idx) => (
                    <div key={task.id} className="rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-bold">Task {idx + 1} • {task.name || '-'}</div>
                          <div className="mt-2 text-sm text-[var(--mx-muted)]">
                            {task.team || '-'} • {task.subkpi || 'ไม่ระบุ Sub KPI'} • Start {formatDate(task.startdate)}
                          </div>
                          <div className="mt-1 text-sm text-[var(--mx-muted)]">
                            Deadline {formatDate(task.deadline)} • Completed {formatDate(task.completiondate)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status}</span>
                          <button
                            className="mx-btn mx-btn-soft !py-2 !px-3"
                            onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          >
                            {expandedTaskId === task.id ? 'Hide Detail' : 'View Detail'}
                          </button>
                        </div>
                      </div>
                      {expandedTaskId === task.id && (
                        <div className="mt-4 rounded-[18px] p-4 bg-[rgba(0,0,0,0.16)] border border-[rgba(255,255,255,0.06)]">
                          {task.note
                            ? <div className="text-sm leading-7 whitespace-pre-wrap">{task.note}</div>
                            : <div className="text-sm text-[var(--mx-muted)]">ไม่มี note ของ task นี้</div>
                          }
                          {renderExtraData(task.extra_data)}
                          <div className="mt-4">
                            <div className="text-sm font-bold mb-3">Audit Timeline</div>
                            <div className="grid gap-3">
                              {(logsByTask[task.id] || []).length === 0 && (
                                <div className="text-sm text-[var(--mx-muted)]">ยังไม่มี audit log</div>
                              )}
                              {(logsByTask[task.id] || []).map((log) => (
                                <div key={log.id} className="rounded-[14px] p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="font-bold text-sm">{log.action || 'Activity'}</div>
                                    <div className="text-xs text-[var(--mx-muted)]">{formatDate(log.timestamp, true)}</div>
                                  </div>
                                  <div className="mt-2 text-sm text-[var(--mx-muted)]">{log.details || '-'}</div>
                                  <div className="mt-2 text-xs text-[var(--mx-muted)]">By {log.by_user || '-'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── Extra Data Fields (conditional per Sub KPI) ──────────────────────────────
function ExtraDataFields({ subkpi, extraData, onChange, hideSsr = false }) {
  if (!subkpi) return null;
  const sub = subkpi;
  const isCoord  = sub.includes('ประสานงานอาคาร');
  const isNotify = sub.includes('แจ้ง Job ให้ผู้รับเหมา');
  const isSAP    = sub.toLowerCase().includes('open job sap');
  const isOWF    = sub.toLowerCase().includes('open job owf');
  if (!isCoord && !isNotify && !isSAP && !isOWF) return null;

  const ed = extraData || {};
  const upd = (k, v) => onChange({ ...ed, [k]: v });

  return (
    <div className="md:col-span-2 rounded-[18px] p-4 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.25)]">
      <p className="text-xs font-extrabold text-[var(--mx-warning)] uppercase tracking-widest mb-3 flex items-center gap-2">
        <i className="fas fa-clipboard-list"></i>ข้อมูลเพิ่มเติม
      </p>
      <div className="grid gap-3">
        {isCoord && (
          <>
            <input className="mx-input" placeholder="อาคาร" value={ed.building || ''} onChange={(e) => upd('building', e.target.value)} />
            <input className="mx-input" placeholder="ลูกค้า" value={ed.client || ''} onChange={(e) => upd('client', e.target.value)} />
            <input className="mx-input" placeholder="ผู้รับเหมา" value={ed.contractor || ''} onChange={(e) => upd('contractor', e.target.value)} />
          </>
        )}
        {isNotify && (
          <>
            <input className="mx-input" placeholder="ชื่อผู้รับเหมา" value={ed.contractorName || ''} onChange={(e) => upd('contractorName', e.target.value)} />
            <select className="mx-select" value={ed.contractorType || ''} onChange={(e) => upd('contractorType', e.target.value)}>
              <option value="">เลือก TYPE</option>
              {['B1','C1','C2','E1'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        )}
        {isSAP && !hideSsr && (
          <input className="mx-input" placeholder="SSR Number" value={ed.ssrNumber || ''} onChange={(e) => upd('ssrNumber', e.target.value)} />
        )}
        {isOWF && (
          <input className="mx-input" placeholder="OSP Number" value={ed.ospNumber || ''} onChange={(e) => upd('ospNumber', e.target.value)} />
        )}
      </div>
    </div>
  );
}

// ─── Quick Create / Assign Task ────────────────────────────────────────────────
function QuickCreateView({ user, people, onSaved, mode = 'auto' }) {
  const isPersonalTask = user.role === 'Staff' || mode === 'personal';

  // KPIs: filter by user's team for personal tasks, assignee team for assignment.
  const teamKpis = useMemo(() => {
    const kpis = user?.kpis || [];
    if (isPersonalTask) return kpis.filter((k) => !k.team || k.team === user.team);
    return kpis;
  }, [user, isPersonalTask]);

  const [loadedStaffKpis, setLoadedStaffKpis] = useState([]);
  useEffect(() => {
    if (!isPersonalTask) return;
    API.getKPIsByTeam(user.team).then((res) => {
      if (res && res.kpis && res.kpis.length > 0) setLoadedStaffKpis(res.kpis);
    }).catch(() => {});
  }, [user.team, isPersonalTask]);

  const [form, setForm] = useState({
    job: '', note: '', subkpi: '', mainkpi: '', deadline: '',
    assignedToName: isPersonalTask ? user.name : '',
    assignedToTeam: user?.team || '',
    assignedToEmpId: '',
    extra_data: {},
  });
  const [assigneeKpis, setAssigneeKpis] = useState([]);
  const [loadingDeadline, setLoadingDeadline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState('');

  // For Lead/Manager: when assignee changes, load their team's KPIs
  useEffect(() => {
    if (isPersonalTask) return;
    if (!form.assignedToEmpId) { setAssigneeKpis([]); return; }
    const person = (people || []).find((p) => p.empId === form.assignedToEmpId);
    if (!person) return;
    setForm((prev) => ({ ...prev, assignedToName: person.name, assignedToTeam: person.team, subkpi: '', mainkpi: '', deadline: '', extra_data: {} }));
    API.getKPIsByTeam(person.team)
      .then((res) => setAssigneeKpis(res.kpis || []))
      .catch(() => setAssigneeKpis([]));
  }, [form.assignedToEmpId, isPersonalTask, people]);

  const activeKpis = isPersonalTask ? (loadedStaffKpis.length > 0 ? loadedStaffKpis : teamKpis) : assigneeKpis;

  const handleSubKpiChange = async (subkpi) => {
    if (!subkpi) {
      setForm((p) => ({ ...p, subkpi: '', mainkpi: '', deadline: '', extra_data: {} }));
      return;
    }
    const kpi = activeKpis.find((k) => k.sub === subkpi);
    setForm((p) => ({ ...p, subkpi, mainkpi: kpi?.main || '', extra_data: {} }));

    setLoadingDeadline(true);
    try {
      const targetTeam = isPersonalTask ? user.team : form.assignedToTeam;
      const res = await API.calculateDeadlinePreview({
        team: targetTeam,
        subkpi,
        startDate: new Date().toISOString(),
      });
      if (res && !res.error) {
        setForm((p) => ({ ...p, mainkpi: res.mainkpi || kpi?.main || '', deadline: res.deadline || '' }));
      }
    } catch { /* deadline stays empty */ }
    setLoadingDeadline(false);
  };

  const handleSave = async () => {
    if (!form.job.trim()) return alert('กรุณาระบุ job');
    if (!form.subkpi.trim()) return alert('กรุณาเลือก Sub KPI');
    if (!isPersonalTask && !form.assignedToName.trim()) return alert('กรุณาเลือกผู้รับผิดชอบ');
    setSaving(true);
    setSaveResult('');
    try {
      let res;
      if (isPersonalTask) {
        res = await API.saveNewTask({
          name: user.name, team: user.team, empId: user.empId,
          job: form.job, subkpi: form.subkpi, mainkpi: form.mainkpi,
          deadline: form.deadline, note: form.note, extra_data: form.extra_data,
        });
      } else {
        // Lead/Manager: support multiple jobs per line
        const jobs = form.job.split('\n').map((j) => j.trim()).filter(Boolean);
        res = await API.saveNewTask({
          jobs,
          name: form.assignedToName,
          team: form.assignedToTeam || user.team,
          mainkpi: form.mainkpi,
          subkpi: form.subkpi,
          deadline: form.deadline,
          note: form.note,
        });
      }
      const msg = (res && res.message) ? res.message : 'บันทึกงานเรียบร้อย';
      setSaveResult(msg);
      setForm({
        job: '', note: '', subkpi: '', mainkpi: '', deadline: '',
        assignedToName: isPersonalTask ? user.name : '',
        assignedToTeam: user.team,
        assignedToEmpId: '',
        extra_data: {},
      });
      setAssigneeKpis([]);
      onSaved?.();
    } catch (e) {
      alert(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title={isPersonalTask ? 'Create Personal Task' : 'Assign Task'}
      subtitle={isPersonalTask ? 'สร้างงานของตัวเองจาก shell ใหม่' : 'มอบหมายงานได้ครั้งละหลาย Job (แต่ละบรรทัด = 1 งาน)'}
    >
      {saveResult && (
        <div className="mb-4 rounded-[14px] p-3 mx-status-completed text-sm font-bold">
          <i className="fas fa-check-circle mr-2"></i>{saveResult}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {isPersonalTask && (
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-bold uppercase tracking-[0.08em] text-[var(--mx-muted)]">SSR Number</label>
            <input
              className="mx-input"
              placeholder="เช่น DS01_0123"
              value={form.extra_data?.ssrNumber || ''}
              onChange={(e) => setForm((p) => ({ ...p, extra_data: { ...(p.extra_data || {}), ssrNumber: e.target.value } }))}
            />
          </div>
        )}

        <div className="md:col-span-2">
          <label className="block mb-2 text-sm font-bold">
            Job / รายละเอียดงาน
            {!isPersonalTask && <span className="ml-2 text-xs text-[var(--mx-muted)] font-normal">(แต่ละบรรทัด = 1 งาน)</span>}
          </label>
          <textarea
            className="mx-textarea min-h-[110px]"
            value={form.job}
            onChange={(e) => setForm((p) => ({ ...p, job: e.target.value }))}
            placeholder={isPersonalTask ? 'ระบุ job หรือรายละเอียดงาน' : 'Job 1\nJob 2\nJob 3 (แต่ละบรรทัดจะสร้างเป็น 1 งาน)'}
          />
        </div>

        {!isPersonalTask && (
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-bold">ผู้รับผิดชอบ</label>
            <select
              className="mx-select"
              value={form.assignedToEmpId}
              onChange={(e) => setForm((p) => ({ ...p, assignedToEmpId: e.target.value }))}
            >
              <option value="">เลือกผู้รับผิดชอบ</option>
              {(people || []).map((person) => (
                <option key={person.empId} value={person.empId}>
                  {person.name} ({person.team})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block mb-2 text-sm font-bold">Sub KPI</label>
          {activeKpis.length > 0 ? (
            <select className="mx-select" value={form.subkpi} onChange={(e) => handleSubKpiChange(e.target.value)}>
              <option value="">เลือก Sub KPI</option>
              {activeKpis.map((k) => (
                <option key={`${k.main}-${k.sub}`} value={k.sub}>{k.sub} ({k.main})</option>
              ))}
            </select>
          ) : (
            <input
              className="mx-input"
              value={form.subkpi}
              onChange={(e) => setForm((p) => ({ ...p, subkpi: e.target.value }))}
              placeholder={isPersonalTask ? 'Sub KPI' : 'เลือกผู้รับผิดชอบก่อน'}
            />
          )}
        </div>

        <div>
          <label className="block mb-2 text-sm font-bold">Main KPI</label>
          <input
            className="mx-input"
            value={form.mainkpi}
            readOnly
            placeholder={loadingDeadline ? 'กำลังคำนวณ...' : 'กรอกอัตโนมัติเมื่อเลือก Sub KPI'}
          />
        </div>

        <ExtraDataFields
          subkpi={form.subkpi}
          extraData={form.extra_data}
          onChange={(ed) => setForm((p) => ({ ...p, extra_data: ed }))}
          hideSsr={isPersonalTask}
        />

        <div>
          <label className="block mb-2 text-sm font-bold">Deadline (คำนวณจาก SLA)</label>
          <input
            className="mx-input"
            value={form.deadline ? formatDate(form.deadline) : ''}
            readOnly
            placeholder={loadingDeadline ? 'กำลังคำนวณ...' : 'กรอกอัตโนมัติเมื่อเลือก Sub KPI'}
          />
        </div>

        {isPersonalTask && (
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-bold">Note (optional)</label>
            <textarea
              className="mx-textarea min-h-[80px]"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="หมายเหตุเพิ่มเติม"
            />
          </div>
        )}
      </div>

      <div className="mt-5">
        <button className="mx-btn mx-btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'กำลังบันทึก...' : isPersonalTask ? 'Create Task' : 'Assign Task'}
        </button>
      </div>
    </Panel>
  );
}

// ─── People View ───────────────────────────────────────────────────────────────
function PeopleView({ user, people, onRefresh }) {
  return (
    <Panel
      title={user.role === 'Lead' ? 'Team People' : 'People Directory'}
      subtitle="รายชื่อที่มองเห็นได้ตามสิทธิ์เดิม แต่แสดงในโครงใหม่ที่อ่านง่ายกว่า"
      actions={[<button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh}>Refresh</button>]}
    >
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(people || []).map((person) => (
          <div key={`${person.empId}-${person.name}`} className="mx-data-card">
            <div className="font-bold">{person.name}</div>
            <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.department || person.departmentId || '-'} • {person.team} • {roleLabel(person.role)}</div>
            <div className="mt-3 text-xs text-[var(--mx-muted)]">Emp ID: {person.empId}</div>
          </div>
        ))}
        {(!people || people.length === 0) && <div className="text-sm text-[var(--mx-muted)]">ไม่พบรายชื่อ</div>}
      </div>
    </Panel>
  );
}

// ─── Admin Studio ──────────────────────────────────────────────────────────────
function SystemsView({ user, systemLinks }) {
  const systems = visibleSystemLinksForUser(systemLinks, user);
  const statusClass = (status) => {
    if (status === 'Active') return 'mx-status-completed';
    if (status === 'Maintenance') return 'mx-status-pending';
    if (status === 'Coming Soon') return 'mx-status-process';
    return 'mx-status-cancelled';
  };

  const openSystem = (system) => {
    if (!system.url || system.status === 'Coming Soon' || system.status === 'Hidden') return;
    window.open(system.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Panel
      title="Systems"
      subtitle="ระบบงานที่บัญชีนี้มีสิทธิ์ใช้งาน"
      actions={[<span key="count" className="mx-badge mx-status-process">{systems.length} systems</span>]}
    >
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {systems.map((system) => {
          const disabled = !system.url || system.status === 'Coming Soon' || system.status === 'Hidden';
          return (
            <div key={system.id} className="mx-data-card">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-lg grid place-items-center bg-[var(--mx-surface)] border border-[var(--mx-line)] flex-shrink-0">
                  <i className={`fa-solid ${system.icon || 'fa-up-right-from-square'} text-[var(--mx-accent)]`}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold truncate">{system.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={cn('mx-badge', statusClass(system.status))}>{system.status}</span>
                    {!system.visibleToAll && <span className="mx-badge mx-status-cancelled">Restricted</span>}
                  </div>
                  <div className="mt-3 text-sm text-[var(--mx-muted)] leading-6">{system.description || '-'}</div>
                </div>
              </div>
              <button
                className={cn('mx-btn w-full mt-4', disabled ? 'mx-btn-soft opacity-60 cursor-not-allowed' : 'mx-btn-primary')}
                disabled={disabled}
                onClick={() => openSystem(system)}
              >
                <i className="fa-solid fa-up-right-from-square mr-2"></i>{disabled ? 'Unavailable' : 'Open System'}
              </button>
            </div>
          );
        })}
        {systems.length === 0 && (
          <div className="text-sm text-[var(--mx-muted)]">ยังไม่มีระบบงานที่เปิดให้บัญชีนี้ใช้งาน</div>
        )}
      </div>
    </Panel>
  );
}

function AdminStudio({ user, adminData, systemLinks, onSystemLinksChange, onRefresh, adminSection = 'overview', setAdminSection = () => {} }) {
  const [userForm, setUserForm] = useState({ empid: '', name: '', department: '', team: '', role: 'Staff', accessScope: 'Self', pigurl: '' });
  const [teamForm, setTeamForm] = useState({ id: '', name: '' });
  const [kpiForm, setKpiForm] = useState({ main: '', sub: '', team: '', days: 1, main_weight: 1 });
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', name: '', is_active: true });
  const emptySystemForm = { id: '', name: '', description: '', url: '', icon: 'fa-up-right-from-square', status: 'Active', visibleToAll: false, allowedRoles: [], allowedTeams: [], allowedEmpIds: '', isActive: true };
  const [systemForm, setSystemForm] = useState(emptySystemForm);
  const [previewEmpId, setPreviewEmpId] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [saving, setSaving] = useState('');

  const teams = adminData?.teams || [];
  const staff = adminData?.staff || [];
  const kpis = adminData?.kpis || [];
  const holidays = adminData?.holidays || [];
  const logs = adminData?.logs || [];
  const q = adminSearch.trim().toLowerCase();
  const matches = (...values) => !q || values.some((value) => String(value || '').toLowerCase().includes(q));
  const filteredStaff = staff.filter((s) => matches(s.name, s.empId, s.empid, s.department, s.departmentId, s.team, s.role, roleScope(s)));
  const filteredKpis = kpis.filter((k) => matches(k.main, k.sub, k.team, k.days, k.main_weight));
  const filteredHolidays = holidays.filter((h) => matches(h.name, h.holiday_date, h.is_active ? 'active' : 'inactive'));
  const normalizedSystemLinks = normalizeSystemLinks(systemLinks);
  const filteredSystems = normalizedSystemLinks.filter((s) => matches(s.name, s.description, s.url, s.status, s.allowedRoles.join(' '), s.allowedTeams.join(' '), s.allowedEmpIds.join(' ')));
  const selectedRoleNeedsTeam = roleRequiresTeam(userForm.role);
  const selectedRoleNeedsDepartment = roleRequiresDepartment(userForm.role);
  const selectedRoleUsesTeamVisibility = isDepartmentManagerRole(userForm.role) || isStrategicViewRole(userForm.role);

  const userDepartmentValue = (item) => {
    const permissions = userPermissions(item);
    const explicitDepartment = item.department || item.departmentId || item.division || permissions.department || permissions.division;
    if (explicitDepartment) return explicitDepartment;
    return item.team || '';
  };

  const userTeamValue = (item) => {
    return roleRequiresTeam(item.role) ? (item.team || '') : '';
  };

  const toPositiveNumber = (value, fallback = 1) => {
    const normalized = String(value ?? '').trim().replace(',', '.');
    const number = Number(normalized);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };

  const runAdminAction = async (key, action, successMessage) => {
    setSaving(key);
    try {
      const res = await action();
      if (res?.error) return alert(res.error);
      await onRefresh();
      if (successMessage) alert(successMessage);
    } catch (error) {
      alert(error.message || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSaving('');
    }
  };

  const editUser = (item) => {
    setUserForm({
      empid: item.empId || item.empid || '',
      name: item.name || '',
      department: userDepartmentValue(item),
      team: userTeamValue(item),
      role: item.role || 'Staff',
      accessScope: item.accessScope || item.scope || userPermissions(item).scope || roleScope(item.role || 'Staff'),
      pigurl: item.pigurl || item.pigUrl || item.avatar || item.photoUrl || '',
      permissions: { allowedTeams: [], allowedStaff: [], ...userPermissions(item) },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAllowedTeam = (teamName) => {
    setUserForm((prev) => {
      const current = Array.isArray(prev.permissions?.allowedTeams) ? prev.permissions.allowedTeams : [];
      const allowedTeams = current.includes(teamName)
        ? current.filter((team) => team !== teamName)
        : [...current, teamName];
      return { ...prev, permissions: { ...(prev.permissions || {}), allowedTeams } };
    });
  };

  const persistSystemLinks = async (nextLinks) => {
    const normalized = normalizeSystemLinks(nextLinks);
    try {
      await saveSystemLinksToApi(normalized, user.empId);
      const cached = cacheSystemLinks(normalized);
      onSystemLinksChange?.(cached);
    } catch (error) {
      console.error('System links save failed.', error);
      alert(`บันทึก Systems ไม่สำเร็จ: ${error.message || 'ตรวจสอบ Supabase RLS policy และตาราง app_system_links'}`);
      throw error;
    }
  };

  const toggleSystemRole = (role) => {
    setSystemForm((prev) => {
      const current = normalizeList(prev.allowedRoles);
      return {
        ...prev,
        allowedRoles: current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
      };
    });
  };

  const toggleSystemTeam = (teamName) => {
    setSystemForm((prev) => {
      const current = normalizeList(prev.allowedTeams);
      return {
        ...prev,
        allowedTeams: current.includes(teamName) ? current.filter((item) => item !== teamName) : [...current, teamName],
      };
    });
  };

  const editSystem = (item) => {
    setSystemForm({
      ...normalizeSystemLink(item),
      allowedEmpIds: normalizeList(item.allowedEmpIds).join(', '),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveSystem = async () => {
    if (!systemForm.name.trim()) return alert('กรุณากรอกชื่อระบบ');
    const next = normalizeSystemLink({
      ...systemForm,
      id: systemForm.id || systemForm.name,
      allowedEmpIds: normalizeList(systemForm.allowedEmpIds),
    });
    const others = normalizedSystemLinks.filter((item) => item.id !== next.id);
    setSaving('systems');
    try {
      await persistSystemLinks([...others, next]);
      setSystemForm(emptySystemForm);
    } finally {
      setSaving('');
    }
  };

  const duplicateSystem = async (item) => {
    const copy = normalizeSystemLink({ ...item, id: `${item.id}-copy`, name: `${item.name} Copy` });
    setSaving('systems');
    try {
      await persistSystemLinks([...normalizedSystemLinks, copy]);
    } finally {
      setSaving('');
    }
  };

  const removeSystem = async (id) => {
    if (!window.confirm('ยืนยันการลบระบบนี้?')) return;
    setSaving('systems');
    try {
      await persistSystemLinks(normalizedSystemLinks.filter((item) => item.id !== id));
    } finally {
      setSaving('');
    }
  };

  const previewUser = (staff || []).find((person) => String(person.empId || person.empid || '').toUpperCase() === previewEmpId.trim().toUpperCase());
  const previewSystems = previewUser ? visibleSystemLinksForUser(normalizedSystemLinks, previewUser) : [];

  const editKpi = (item) => {
    setKpiForm({
      id: item.id,
      main: item.main || item.mainkpi || '',
      sub: item.sub || item.subkpi || '',
      team: item.team || '',
      days: item.days || 1,
      main_weight: item.main_weight || item.mainWeight || 1,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editHoliday = (item) => {
    setHolidayForm({
      id: item.id,
      holiday_date: item.holiday_date || '',
      name: item.name || '',
      is_active: item.is_active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveUser = async () => {
    if (!userForm.empid || !userForm.name || !userForm.role) return alert('กรุณากรอก Emp ID, ชื่อ และบทบาทให้ครบ');
    if (selectedRoleNeedsTeam && !userForm.team) return alert('กรุณาเลือกทีมสำหรับ Staff หรือ Lead');
    if (selectedRoleNeedsDepartment && !userForm.department) return alert('กรุณากรอก Department / Division สำหรับบทบาทผู้บริหาร');
    const accessScope = userForm.accessScope || roleScope(userForm.role);
    const legacyTeam = userForm.team || userForm.department || accessScope;
    const permissions = {
      ...(userForm.permissions || {}),
      scope: accessScope,
      department: String(userForm.department || '').trim(),
      allowedTeams: userForm.permissions?.allowedTeams || [],
      allowedStaff: userForm.permissions?.allowedStaff || [],
    };
    const basePayload = {
      empid: String(userForm.empid || '').trim().toUpperCase(),
      name: String(userForm.name || '').trim(),
      role: userForm.role,
      team: legacyTeam,
      pigurl: String(userForm.pigurl || '').trim(),
    };
    const payload = { ...basePayload, permissions };
    await runAdminAction('user', async () => {
      try {
        return await adminPost('admin/saveUser', payload, user.empId);
      } catch (error) {
        if (error.status >= 500) {
          return adminPost('admin/saveUser', basePayload, user.empId);
        }
        throw error;
      }
    }, 'บันทึกผู้ใช้สำเร็จ');
    setUserForm({ empid: '', name: '', department: '', team: '', role: 'Staff', accessScope: 'Self', pigurl: '' });
  };

  const saveTeam = async () => {
    if (!teamForm.name.trim()) return alert('กรุณากรอกชื่อทีม');
    await runAdminAction('team', async () => adminPost('admin/saveTeam', { id: teamForm.id || undefined, name: teamForm.name.trim() }, user.empId), 'บันทึกทีมสำเร็จ');
    setTeamForm({ id: '', name: '' });
  };

  const saveKpi = async () => {
    const main = kpiForm.main.trim();
    const sub = kpiForm.sub.trim();
    const team = kpiForm.team.trim();
    const days = Math.round(toPositiveNumber(kpiForm.days, 1));
    const mainWeight = toPositiveNumber(kpiForm.main_weight, 1);
    if (!main || !sub || !team) return alert('กรุณากรอก Main KPI, Sub KPI และทีมให้ครบ');
    if (!days || days < 1) return alert('SLA Days ต้องมากกว่า 0');
    if (!mainWeight || mainWeight <= 0) return alert('Weight ต้องมากกว่า 0');
    const payload = {
      ...(kpiForm.id ? { id: kpiForm.id } : {}),
      main,
      sub,
      team,
      days,
      main_weight: mainWeight,
      mainWeight,
    };
    await runAdminAction('kpi', async () => adminPost('admin/saveKpi', payload, user.empId), 'บันทึก KPI สำเร็จ');
    setKpiForm({ main: '', sub: '', team: '', days: 1, main_weight: 1 });
  };

  const saveHoliday = async () => {
    if (!holidayForm.holiday_date || !holidayForm.name) return alert('กรุณากรอกวันที่และชื่อวันหยุดให้ครบ');
    await runAdminAction('holiday', async () => adminPost('admin/saveHoliday', holidayForm, user.empId), 'บันทึกวันหยุดสำเร็จ');
    setHolidayForm({ holiday_date: '', name: '', is_active: true });
  };

  const recalc = async () => {
    await runAdminAction('recalc', async () => adminPost('admin/recalculateDeadlines', {}, user.empId), 'คำนวณกำหนดส่งใหม่สำเร็จ');
  };

  const removeUser = async (empId) => {
    if (!window.confirm(`ยืนยันการลบผู้ใช้ ${empId}?`)) return;
    await runAdminAction(`delete-user-${empId}`, async () => adminDelete(`admin/deleteUser?empId=${encodeURIComponent(empId)}`, user.empId), 'ลบผู้ใช้สำเร็จ');
  };

  const removeTeam = async (id) => {
    if (!window.confirm('ยืนยันการลบทีมนี้?')) return;
    await runAdminAction(`delete-team-${id}`, async () => adminDelete(`admin/deleteTeam?id=${encodeURIComponent(id)}`, user.empId), 'ลบทีมสำเร็จ');
  };

  const removeHoliday = async (id) => {
    if (!window.confirm('ยืนยันการลบวันหยุดนี้?')) return;
    await runAdminAction(`delete-holiday-${id}`, async () => adminDelete(`admin/deleteHoliday?id=${encodeURIComponent(id)}`, user.empId), 'ลบวันหยุดสำเร็จ');
  };

  const removeKpi = async (id) => {
    if (!window.confirm('ยืนยันการลบ KPI นี้?')) return;
    await runAdminAction(`delete-kpi-${id}`, async () => adminDelete(`admin/deleteKpi?id=${encodeURIComponent(id)}`, user.empId), 'ลบ KPI สำเร็จ');
  };

  const sectionItems = [
    { id: 'overview', label: 'ภาพรวมระบบ', icon: 'fa-gauge-high', count: staff.length + teams.length + kpis.length + holidays.length },
    { id: 'users', label: 'ผู้ใช้และสิทธิ์', icon: 'fa-users-gear', count: staff.length },
    { id: 'systems', label: 'Systems', icon: 'fa-table-cells-large', count: normalizedSystemLinks.length },
    { id: 'teams', label: 'ทีมงาน', icon: 'fa-people-group', count: teams.length },
    { id: 'kpi', label: 'กฎ KPI/SLA', icon: 'fa-scale-balanced', count: kpis.length },
    { id: 'calendar', label: 'ปฏิทิน SLA', icon: 'fa-calendar-days', count: holidays.length },
    { id: 'audit', label: 'ประวัติการแก้ไข', icon: 'fa-shield-halved', count: logs.length },
  ];

  const UserEditor = () => (
    <Panel title="เพิ่ม / แก้ไขผู้ใช้" subtitle="จัดการตัวตน บทบาท ทีม และรูปโปรไฟล์ผ่านระบบเท่านั้น">
      <div className="grid gap-3">
        <input className="mx-input" placeholder="Emp ID" value={userForm.empid} onChange={(e) => setUserForm((p) => ({ ...p, empid: e.target.value.toUpperCase() }))} />
        <input className="mx-input" placeholder="ชื่อผู้ใช้" value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} />
        <label className="grid gap-2 text-xs font-bold text-[var(--mx-muted)]">
          Department / Division {selectedRoleNeedsDepartment ? <span className="text-rose-500">Required</span> : <span>Optional</span>}
          <input className="mx-input" placeholder="เช่น IT Division, Operations, Service" value={userForm.department} onChange={(e) => setUserForm((p) => ({ ...p, department: e.target.value }))} />
        </label>
        <label className="grid gap-2 text-xs font-bold text-[var(--mx-muted)]">
          Team {selectedRoleNeedsTeam ? <span className="text-rose-500">Required</span> : <span>Optional</span>}
        <select className="mx-select" value={userForm.team} onChange={(e) => setUserForm((p) => ({ ...p, team: e.target.value }))}>
          <option value="">{selectedRoleNeedsTeam ? 'เลือกทีม' : 'ไม่ผูกทีมเดียว'}</option>
          {teams.map((team) => <option key={team.id || team.name} value={team.name}>{team.name}</option>)}
        </select>
        </label>
        <select className="mx-select" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value, accessScope: roleScope(e.target.value) }))}>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select className="mx-select" value={userForm.accessScope} onChange={(e) => setUserForm((p) => ({ ...p, accessScope: e.target.value }))}>
          {SCOPE_OPTIONS.map((scope) => (
            <option key={scope} value={scope}>Scope: {scope}</option>
          ))}
        </select>
        {selectedRoleUsesTeamVisibility && (
          <div className="mx-muted-card rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold">Team Visibility</div>
                <div className="mt-1 text-xs text-[var(--mx-muted)]">เลือกทีมที่ผู้ใช้นี้มองเห็น ถ้าไม่เลือกทีมใดเลยจะเห็นทั้งหมด</div>
              </div>
              <span className="mx-badge mx-status-process">{userForm.permissions?.allowedTeams?.length || 0} teams</span>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {teams.map((team) => {
                const teamName = team.name || '';
                const checked = (userForm.permissions?.allowedTeams || []).includes(teamName);
                return (
                  <label key={team.id || teamName} className="flex items-center gap-2 rounded-lg border border-[var(--mx-line)] bg-[var(--mx-panel)] px-3 py-2 text-sm font-bold">
                    <input type="checkbox" checked={checked} onChange={() => toggleAllowedTeam(teamName)} />
                    <span className="truncate">{teamName}</span>
                  </label>
                );
              })}
              {teams.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบทีม</div>}
            </div>
          </div>
        )}
        <input className="mx-input" placeholder="ลิงก์รูปโปรไฟล์ (ถ้ามี)" value={userForm.pigurl} onChange={(e) => setUserForm((p) => ({ ...p, pigurl: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <button className="mx-btn mx-btn-primary" onClick={saveUser} disabled={saving === 'user'}>{saving === 'user' ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้'}</button>
          <button className="mx-btn mx-btn-soft" onClick={() => setUserForm({ empid: '', name: '', department: '', team: '', role: 'Staff', accessScope: 'Self', pigurl: '' })}>ล้างฟอร์ม</button>
        </div>
      </div>
    </Panel>
  );

  const UsersList = () => (
    <Panel title="ผู้ใช้และสิทธิ์" subtitle="แก้ไขหรือลบสิทธิ์ผู้ใช้ผ่านระบบ โดยไม่แตะ data source โดยตรง">
      <div className="grid gap-3">
        {filteredStaff.slice(0, 60).map((s) => {
          const department = userDepartmentValue(s) || '-';
          const team = userTeamValue(s) || '-';
          return (
          <div key={s.empId || s.empid} className="mx-data-card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-bold">{s.name}</div>
                <div className="mt-1 text-sm text-[var(--mx-muted)]">{s.empId || s.empid} / {department} / {team} / {roleLabel(s.role)} / Scope: {roleScope(s)}</div>
              </div>
              <div className="flex gap-2">
                <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => editUser(s)}>แก้ไข</button>
                <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeUser(s.empId || s.empid)}>ลบ</button>
              </div>
            </div>
          </div>
        );
        })}
        {filteredStaff.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบผู้ใช้</div>}
      </div>
    </Panel>
  );

  const TeamControls = () => (
    <Panel title="ทีมงาน" subtitle="เพิ่ม แก้ไข และลบทีมผ่านระบบเท่านั้น">
      <div className="grid gap-4">
        <div className="mx-muted-card rounded-lg p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <div className="text-sm font-extrabold">{teamForm.id ? 'แก้ไขทีม' : 'เพิ่มทีมใหม่'}</div>
              <input className="mx-input mt-3" placeholder="ชื่อทีม" value={teamForm.name} onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 lg:w-[260px] gap-2">
              <button className="mx-btn mx-btn-primary" onClick={saveTeam} disabled={saving === 'team'}>{saving === 'team' ? 'กำลังบันทึก...' : 'บันทึกทีม'}</button>
              <button className="mx-btn mx-btn-soft" onClick={() => setTeamForm({ id: '', name: '' })}>ล้างฟอร์ม</button>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          {teams.map((team) => (
            <div key={team.id || team.name} className="mx-data-card flex items-center justify-between gap-3">
              <div className="font-bold">{team.name}</div>
              <div className="flex gap-2">
                <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => setTeamForm({ id: team.id || '', name: team.name || '' })}>แก้ไข</button>
                <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeTeam(team.id)} disabled={!team.id}>ลบ</button>
              </div>
            </div>
          ))}
          {teams.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบทีม</div>}
        </div>
      </div>
    </Panel>
  );

  const KpiControls = () => (
    <Panel
      title="กฎ KPI/SLA"
      subtitle="จัดการจำนวนวัน SLA และน้ำหนัก KPI ที่ใช้คำนวณคะแนน"
      actions={[
        <button key="recalc" className="mx-btn mx-btn-soft" onClick={recalc} disabled={saving === 'recalc'}>
          <i className="fa-solid fa-rotate mr-2"></i>{saving === 'recalc' ? 'กำลังคำนวณ...' : 'คำนวณ Deadline ใหม่'}
        </button>,
      ]}
    >
      <div className="grid gap-5">
        <div className="mx-muted-card rounded-lg p-4">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="grid gap-2 text-xs font-bold text-[var(--mx-muted)]">
              Main KPI
              <input className="mx-input" placeholder="Main KPI" value={kpiForm.main} onChange={(e) => setKpiForm((p) => ({ ...p, main: e.target.value }))} />
            </label>
            <label className="grid gap-2 text-xs font-bold text-[var(--mx-muted)]">
              Sub KPI
              <input className="mx-input" placeholder="Sub KPI" value={kpiForm.sub} onChange={(e) => setKpiForm((p) => ({ ...p, sub: e.target.value }))} />
            </label>
            <label className="grid gap-2 text-xs font-bold text-[var(--mx-muted)]">
              Team
              <select className="mx-select" value={kpiForm.team} onChange={(e) => setKpiForm((p) => ({ ...p, team: e.target.value }))}>
                <option value="">เลือกทีม</option>
                {teams.map((team) => <option key={team.id || team.name} value={team.name}>{team.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-xs font-bold text-[var(--mx-muted)]">
                SLA Days
                <input className="mx-input" type="number" min="1" placeholder="1" value={kpiForm.days} onChange={(e) => setKpiForm((p) => ({ ...p, days: e.target.value }))} />
              </label>
              <label className="grid gap-2 text-xs font-bold text-[var(--mx-muted)]">
                Weight
                <input className="mx-input" type="number" min="1" step="0.1" placeholder="1" value={kpiForm.main_weight} onChange={(e) => setKpiForm((p) => ({ ...p, main_weight: e.target.value }))} />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button className="mx-btn mx-btn-primary w-full" onClick={saveKpi} disabled={saving === 'kpi'}>{saving === 'kpi' ? 'กำลังบันทึก...' : 'บันทึก KPI'}</button>
            <button className="mx-btn mx-btn-soft w-full" onClick={() => setKpiForm({ main: '', sub: '', team: '', days: 1, main_weight: 1 })}>ล้างฟอร์ม</button>
          </div>
        </div>
        <div className="grid gap-3">
          {filteredKpis.slice(0, 80).map((kpi) => (
            <div key={kpi.id || `${kpi.team}-${kpi.main}-${kpi.sub}`} className="mx-data-card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="font-bold">{kpi.main} / {kpi.sub}</div>
                  <div className="mt-1 text-sm text-[var(--mx-muted)]">{kpi.team} / {kpi.days} day(s) / weight {kpi.main_weight}</div>
                </div>
                <div className="flex gap-2">
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => editKpi(kpi)}>แก้ไข</button>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeKpi(kpi.id)} disabled={!kpi.id}>ลบ</button>
                </div>
              </div>
            </div>
          ))}
          {filteredKpis.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบกฎ KPI/SLA</div>}
        </div>
      </div>
    </Panel>
  );

  const CalendarControls = () => (
    <Panel
      title="ปฏิทิน SLA"
      subtitle="จัดการวันหยุดที่มีผลต่อการคำนวณกำหนดส่ง"
      actions={[
        <button key="recalc" className="mx-btn mx-btn-soft" onClick={recalc} disabled={saving === 'recalc'}>
          <i className="fa-solid fa-rotate mr-2"></i>{saving === 'recalc' ? 'กำลังคำนวณ...' : 'คำนวณ Deadline ใหม่'}
        </button>,
      ]}
    >
      <div className="grid gap-5">
        <div className="mx-muted-card rounded-lg p-4">
          <div className="grid md:grid-cols-[180px_1fr_150px] gap-3">
            <input className="mx-input" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value }))} />
            <input className="mx-input" placeholder="ชื่อวันหยุด" value={holidayForm.name} onChange={(e) => setHolidayForm((p) => ({ ...p, name: e.target.value }))} />
            <button className="mx-btn mx-btn-primary" onClick={saveHoliday} disabled={saving === 'holiday'}>{saving === 'holiday' ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
        <div className="grid gap-3">
          {filteredHolidays.slice(0, 80).map((holiday) => (
            <div key={holiday.id || holiday.holiday_date} className="mx-data-card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="font-bold">{holiday.name}</div>
                  <div className="mt-1 text-sm text-[var(--mx-muted)]">{holiday.holiday_date} / {holiday.is_active ? 'Active' : 'Inactive'}</div>
                </div>
                <div className="flex gap-2">
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => editHoliday(holiday)}>แก้ไข</button>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeHoliday(holiday.id)} disabled={!holiday.id}>ลบ</button>
                </div>
              </div>
            </div>
          ))}
          {filteredHolidays.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบวันหยุด</div>}
        </div>
      </div>
    </Panel>
  );

  const AuditPanel = () => (
    <Panel title="ประวัติการแก้ไข" subtitle="ตรวจสอบการเปลี่ยนแปลงของระบบโดยไม่ต้องเข้า backend">
      <div className="admin-audit-scroll grid gap-3">
        {logs.slice(0, 80).map((log) => (
          <div key={log.id || `${log.action}-${log.timestamp}`} className="mx-data-card">
            <div className="font-bold text-sm">{log.action || 'Activity'}</div>
            <div className="mt-2 text-sm text-[var(--mx-muted)]">{log.details || '-'}</div>
            <div className="mt-2 text-xs text-[var(--mx-muted)]">{log.by_user || '-'} / {formatDate(log.timestamp, true)}</div>
          </div>
        ))}
        {logs.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ยังไม่มีประวัติการแก้ไข</div>}
      </div>
    </Panel>
  );

  const SystemsControls = () => (
    <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-5">
      <Panel title="System Link Editor" subtitle="เพิ่ม แก้ไข และกำหนดสิทธิ์ระบบงานที่ผู้ใช้เห็นใน Sidebar">
        <div className="grid gap-3">
          <input className="mx-input" placeholder="System name" value={systemForm.name} onChange={(e) => setSystemForm((p) => ({ ...p, name: e.target.value }))} />
          <textarea className="mx-textarea min-h-[80px]" placeholder="Description" value={systemForm.description} onChange={(e) => setSystemForm((p) => ({ ...p, description: e.target.value }))} />
          <input className="mx-input" placeholder="URL" value={systemForm.url} onChange={(e) => setSystemForm((p) => ({ ...p, url: e.target.value }))} />
          <div className="grid md:grid-cols-2 gap-3">
            <input className="mx-input" placeholder="FontAwesome icon เช่น fa-file-invoice" value={systemForm.icon} onChange={(e) => setSystemForm((p) => ({ ...p, icon: e.target.value }))} />
            <select className="mx-select" value={systemForm.status} onChange={(e) => setSystemForm((p) => ({ ...p, status: e.target.value }))}>
              {['Active', 'Maintenance', 'Coming Soon', 'Hidden'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-[var(--mx-line)] bg-[var(--mx-panel)] px-3 py-3 text-sm font-bold">
            <input type="checkbox" checked={systemForm.visibleToAll} onChange={(e) => setSystemForm((p) => ({ ...p, visibleToAll: e.target.checked }))} />
            <span>Visible to all users</span>
          </label>
          <div className="mx-muted-card rounded-lg p-4">
            <div className="text-sm font-extrabold mb-3">Allowed Roles</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((role) => (
                <label key={role.value} className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={normalizeList(systemForm.allowedRoles).includes(role.value)} onChange={() => toggleSystemRole(role.value)} />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mx-muted-card rounded-lg p-4">
            <div className="text-sm font-extrabold mb-3">Allowed Teams</div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
              {teams.map((team) => {
                const teamName = team.name || '';
                return (
                  <label key={team.id || teamName} className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={normalizeList(systemForm.allowedTeams).includes(teamName)} onChange={() => toggleSystemTeam(teamName)} />
                    <span className="truncate">{teamName}</span>
                  </label>
                );
              })}
              {teams.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบทีม</div>}
            </div>
          </div>
          <textarea className="mx-textarea min-h-[70px]" placeholder="Allowed Emp IDs คั่นด้วย comma เช่น EMP001, EMP002" value={systemForm.allowedEmpIds} onChange={(e) => setSystemForm((p) => ({ ...p, allowedEmpIds: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <button className="mx-btn mx-btn-primary" onClick={saveSystem} disabled={saving === 'systems'}>{saving === 'systems' ? 'Saving...' : 'Save System'}</button>
            <button className="mx-btn mx-btn-soft" onClick={() => setSystemForm(emptySystemForm)}>Clear</button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5">
        <Panel title="Systems Registry" subtitle="รายการระบบที่พร้อมแสดงให้ผู้ใช้ตามสิทธิ์">
          <div className="grid gap-3">
            {filteredSystems.map((system) => (
              <div key={system.id} className="mx-data-card">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <i className={`fa-solid ${system.icon} text-[var(--mx-accent)]`}></i>
                      <div className="font-extrabold truncate">{system.name}</div>
                    </div>
                    <div className="mt-2 text-sm text-[var(--mx-muted)]">{system.description || '-'}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="mx-badge mx-status-process">{system.status}</span>
                      {system.visibleToAll && <span className="mx-badge mx-status-completed">All users</span>}
                      {system.allowedRoles.length > 0 && <span className="mx-badge mx-status-cancelled">{system.allowedRoles.length} roles</span>}
                      {system.allowedTeams.length > 0 && <span className="mx-badge mx-status-cancelled">{system.allowedTeams.length} teams</span>}
                      {system.allowedEmpIds.length > 0 && <span className="mx-badge mx-status-cancelled">{system.allowedEmpIds.length} emp</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => editSystem(system)}>แก้ไข</button>
                    <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => duplicateSystem(system)}>Duplicate</button>
                    <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeSystem(system.id)}>ลบ</button>
                  </div>
                </div>
              </div>
            ))}
            {filteredSystems.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่พบระบบงาน</div>}
          </div>
        </Panel>

        <Panel title="Preview As User" subtitle="ใส่ Emp ID เพื่อดูว่าผู้ใช้นั้นจะเห็นระบบอะไร">
          <div className="grid gap-3">
            <input className="mx-input" placeholder="EMP ID" value={previewEmpId} onChange={(e) => setPreviewEmpId(e.target.value.toUpperCase())} />
            {previewUser ? (
              <div className="grid gap-2">
                <div className="text-sm font-extrabold">{previewUser.name} / {roleLabel(previewUser.role)} / {previewUser.team}</div>
                <div className="flex flex-wrap gap-2">
                  {previewSystems.map((system) => <span key={system.id} className="mx-badge mx-status-process">{system.name}</span>)}
                  {previewSystems.length === 0 && <span className="text-sm text-[var(--mx-muted)]">ไม่พบระบบที่เห็นได้</span>}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--mx-muted)]">เลือกหรือกรอก Emp ID ที่มีในระบบ</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );

  const AdminOverview = () => {
    const setupItems = [
      { id: 'users', label: 'ผู้ใช้และสิทธิ์', value: staff.length, icon: 'fa-users-gear', detail: 'จัดการบัญชี บทบาท ทีม และ scope' },
      { id: 'systems', label: 'Systems', value: normalizedSystemLinks.length, icon: 'fa-table-cells-large', detail: 'จัดการลิงก์ระบบงานและสิทธิ์การมองเห็น' },
      { id: 'teams', label: 'ทีมงาน', value: teams.length, icon: 'fa-people-group', detail: 'จัดการทีมที่ใช้ในงานและ KPI' },
      { id: 'kpi', label: 'กฎ KPI/SLA', value: kpis.length, icon: 'fa-scale-balanced', detail: 'กำหนด SLA days และน้ำหนัก KPI' },
      { id: 'calendar', label: 'ปฏิทิน SLA', value: holidays.length, icon: 'fa-calendar-days', detail: 'จัดการวันหยุดและ recalculation' },
      { id: 'audit', label: 'ประวัติการแก้ไข', value: logs.length, icon: 'fa-shield-halved', detail: 'ตรวจสอบ action ที่เกิดในระบบ' },
    ];

    return (
      <div className="grid gap-5">
        <div className="mx-grid-auto">
          <MetricCard label="ผู้ใช้" value={staff.length} sub="บัญชีที่จัดการในระบบ" icon="fa-users" />
          <MetricCard label="ทีม" value={teams.length} sub="กลุ่มงานปฏิบัติการ" icon="fa-people-group" accent="var(--mx-teal)" />
          <MetricCard label="กฎ KPI/SLA" value={kpis.length} sub="วัน SLA และน้ำหนักคะแนน" icon="fa-scale-balanced" accent="var(--mx-indigo)" />
          <MetricCard label="วันหยุด" value={holidays.length} sub="ข้อมูลในปฏิทิน SLA" icon="fa-calendar-days" accent="var(--mx-amber)" />
        </div>

        <Panel title="ทางลัดการจัดการระบบ" subtitle="เลือกหมวดที่ต้องการแก้ไข ระบบจะแยกงาน setup, SLA และ audit ออกจากกันชัดเจน">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {setupItems.map((item) => (
              <button
                key={item.id}
                className="mx-data-card text-left hover:border-[var(--mx-accent)] transition-colors"
                onClick={() => setAdminSection(item.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold">{item.label}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{item.detail}</div>
                  </div>
                  <span className="w-10 h-10 rounded-lg grid place-items-center bg-[var(--mx-surface)] border border-[var(--mx-line)]">
                    <i className={`fa-solid ${item.icon} text-[var(--mx-accent)]`}></i>
                  </span>
                </div>
                <div className="mt-4 text-2xl font-extrabold">{formatNumber(item.value)}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="กติกาการควบคุมระบบ" subtitle="Admin เป็นผู้จัดการระบบทั้งหมดผ่าน UI และ API เท่านั้น">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-sm font-extrabold">ไม่แตะข้อมูลดิบ</div>
              <div className="mt-2 text-sm text-[var(--mx-muted)]">การแก้ master data และงานดูแลระบบต้องทำผ่าน System Control</div>
            </div>
            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-sm font-extrabold">Recalculate อยู่กับ SLA</div>
              <div className="mt-2 text-sm text-[var(--mx-muted)]">คำสั่งคำนวณ deadline ใหม่อยู่ในกฎ KPI/SLA และปฏิทิน SLA แล้ว</div>
            </div>
            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-sm font-extrabold">Audit แยกชัดเจน</div>
              <div className="mt-2 text-sm text-[var(--mx-muted)]">ประวัติการแก้ไขอยู่ในหมวดของตัวเองเพื่อลดความซ้ำซ้อน</div>
            </div>
          </div>
        </Panel>
      </div>
    );
  };

  return (
    <div className="grid gap-5">
        <Panel
          title={sectionItems.find((item) => item.id === adminSection)?.label || 'System Control'}
          subtitle="ทุกการแก้ไขในหน้านี้ต้องผ่านระบบและ API เท่านั้น ห้ามแก้ข้อมูลโดยตรง"
          actions={[
            <button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh} disabled={!!saving}>
              <i className="fa-solid fa-arrows-rotate mr-2"></i>Refresh
            </button>,
          ]}
        >
          <div className="grid lg:grid-cols-[1fr_360px] gap-4 lg:items-center">
            <div>
              <div className="text-sm font-extrabold">กติกาควบคุมระบบ</div>
              <div className="mt-1 text-sm text-[var(--mx-muted)]">
                ห้ามแก้ฐานข้อมูลโดยตรง การแก้ master data, กฎ SLA, ปฏิทิน และงานดูแลระบบต้องผ่าน System Control เท่านั้น
              </div>
            </div>
            <input className="mx-input" placeholder="ค้นหาในหมวดนี้..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} />
          </div>
        </Panel>

        {adminSection === 'overview' && AdminOverview()}

        {adminSection === 'users' && <div className="grid xl:grid-cols-[0.85fr_1.15fr] gap-5">{UserEditor()}{UsersList()}</div>}
        {adminSection === 'systems' && SystemsControls()}
        {adminSection === 'teams' && TeamControls()}
        {adminSection === 'kpi' && KpiControls()}
        {adminSection === 'calendar' && CalendarControls()}
        {adminSection === 'audit' && AuditPanel()}
      </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(() => {
    safeLocalRemove(SESSION_KEY);
    return normalizeAppUser(parseJsonSafe(safeSessionGet(SESSION_KEY), null));
  });
  const [theme, setTheme] = useState(() => safeLocalGet(THEME_KEY) || 'light');
  const [view, setView] = useState(() => {
    const saved = parseJsonSafe(safeSessionGet(SESSION_KEY), null);
    return ROLE_HOME[saved?.role] || 'dashboard';
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showDashboardCreate, setShowDashboardCreate] = useState(false);
  const [adminSection, setAdminSection] = useState('overview');
  const [systemLinks, setSystemLinks] = useState(loadSystemLinks);

  const {
    state, filterMonth, setFilterMonth, filterYear, setFilterYear,
    reloadDashboard, reloadTasks, reloadPeople, reloadAdmin,
  } = useAppData(user, view);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    safeLocalSet(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    fetchSystemLinksFromApi(user)
      .then((links) => {
        if (cancelled) return;
        const normalized = cacheSystemLinks(links);
        setSystemLinks(normalized);
      })
      .catch(() => {
        if (!cancelled) setSystemLinks(loadSystemLinks());
      });
    return () => { cancelled = true; };
  }, [user]);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  // Available years for filter
  const availableYears = useMemo(() => {
    const y = new Date().getFullYear();
    const years = [];
    for (let i = y - 3; i <= y + 1; i++) years.push(i);
    return years;
  }, []);

  // Notifications computed from tasks
  const notifications = useMemo(() => {
    if (!state.tasks || !state.tasks.length) return [];
    const holidaySet = buildHolidaySet(state.holidays || []);
    const result = [];
    state.tasks.forEach((task) => {
      const st = (task.status || '').toLowerCase();
      if (st === 'pending') {
        result.push({
          id: `pending-${task.id}`,
          type: 'pending',
          icon: 'fa-circle-exclamation',
          color: '#f59e0b',
          message: `Pending: ${(task.job || '').substring(0, 35)}${task.job?.length > 35 ? '...' : ''}`,
        });
      }
      if (['on process', 'pending', 'on hold'].includes(st) && task.deadline) {
        const daysLeft = getDaysUntilDeadline(task, holidaySet);
        if (daysLeft === null) return;
        if (daysLeft < 0) {
          result.push({
            id: `overdue-${task.id}`,
            type: 'overdue',
            icon: 'fa-triangle-exclamation',
            color: '#ef4444',
            message: `เกิน deadline ${Math.abs(daysLeft)} วันทำการ: ${(task.job || '').substring(0, 28)}`,
          });
        } else if (daysLeft <= 3) {
          result.push({
            id: `deadline-${task.id}`,
            type: 'deadline',
            icon: 'fa-clock',
            color: '#f59e0b',
            message: `อีก ${daysLeft} วันทำการ: ${(task.job || '').substring(0, 30)}`,
          });
        }
      }
    });
    return result;
  }, [state.tasks, state.holidays]);

  useEffect(() => {
    if (!user) {
      safeSessionRemove(SESSION_KEY);
      return;
    }
    if (isSessionSuperseded(user)) {
      safeSessionRemove(SESSION_KEY);
      setUser(null);
      setView('dashboard');
      setLoginError('บัญชีนี้ถูกเข้าสู่ระบบจากหน้าต่างหรืออุปกรณ์อื่น ระบบจึงออกจากระบบให้อัตโนมัติ');
      return;
    }
    safeSessionSet(SESSION_KEY, JSON.stringify(user));
    writeActiveSessionLock(user);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const forceLogoutIfSuperseded = () => {
      if (!isSessionSuperseded(user)) return false;
      safeSessionRemove(SESSION_KEY);
      setUser(null);
      setView('dashboard');
      setLoginError('บัญชีนี้ถูกเข้าสู่ระบบจากหน้าต่างหรืออุปกรณ์อื่น ระบบจึงออกจากระบบให้อัตโนมัติ');
      return true;
    };
    if (forceLogoutIfSuperseded()) return undefined;
    writeActiveSessionLock(user);
    const timer = setInterval(() => {
      if (!forceLogoutIfSuperseded()) writeActiveSessionLock(user);
    }, 15000);
    const handleStorage = (event) => {
      if (event.key === SESSION_LOCK_KEY) forceLogoutIfSuperseded();
    };
    const handleBeforeUnload = () => clearActiveSessionLock();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  const handleLogin = async (empId) => {
    const cleanEmpId = empId?.trim();
    if (!cleanEmpId) { setLoginError('กรุณาระบุรหัสพนักงาน'); return; }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await API.getInitialData(cleanEmpId);
      if (res?.error) throw new Error(res.error);
      if (!res?.user) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
      const nextUser = { ...normalizeAppUser(res.user, cleanEmpId), kpis: res.kpis || [] };
      writeActiveSessionLock(nextUser);
      setUser(nextUser);
      setView(ROLE_HOME[nextUser.role] || 'dashboard');
    } catch (e) {
      setLoginError(e.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    clearActiveSessionLock();
    safeSessionRemove(SESSION_KEY);
    setUser(null);
    setView('dashboard');
    setLoginError('');
  };

  const handleAccept = async (task) => {
    setActionLoading(true);
    try {
      await API.acceptTask(task.id, task.team);
      await reloadTasks();
      await reloadDashboard();
    } catch (e) {
      alert(e.message || 'รับงานไม่สำเร็จ');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (task, status, note = '', mode = 'normal') => {
    setActionLoading(true);
    try {
      const isCompleting = status === 'Completed';
      const nextNote = isCompleting ? '' : note;
      const statusMode = isCompleting ? undefined : 'append';
      const holdUpdate = mode === 'note_only'
        ? null
        : buildHoldExtraData(task, status, state.holidays || [], user.name);
      if (mode === 'note_only') {
        await API.updateTaskStatus(task.id, task.team, task.status, nextNote, 'append');
      } else if (user.role === 'Staff') {
        await API.updateTaskStatus(task.id, task.team, status, nextNote, statusMode);
      } else {
        await API.updateTaskStatusWithLog(task.id, task.team, status, nextNote, user.name);
      }
      if (holdUpdate?.changed) {
        await API.updateTaskDetails({
          id: task.id,
          team: task.team,
          job: task.job,
          subkpi: task.subkpi,
          mainkpi: task.mainkpi,
          deadline: holdUpdate.deadline || task.deadline,
          extra_data: holdUpdate.extraData,
        });
      }
      await reloadTasks();
      await reloadDashboard();
    } catch (e) {
      alert(e.message || 'อัปเดตสถานะไม่สำเร็จ');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`ยืนยันการลบงาน "${(task.job || '').substring(0, 40)}"?`)) return;
    setActionLoading(true);
    try {
      await API.deleteTask(task.id, task.team, user.name);
      await reloadTasks();
      await reloadDashboard();
    } catch (e) {
      alert(e.message || 'ลบงานไม่สำเร็จ');
    } finally {
      setActionLoading(false);
    }
  };

  const downloadCSV = () => {
    const src = state.tasks || [];
    if (src.length === 0) return alert('ไม่มีข้อมูลสำหรับ export');
    const headers = ['ลำดับ', 'รายละเอียดงาน', 'Main KPI', 'Sub KPI', 'ผู้รับผิดชอบ', 'ทีม', 'สถานะ', 'วันเริ่มต้น', 'Deadline', 'วันที่เสร็จ', 'ผล'];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = src.map((t, i) => {
      const dl = t.deadline ? new Date(t.deadline) : null;
      const cp = t.completiondate ? new Date(t.completiondate) : null;
      const onTime = t.status === 'Completed' && dl && cp && cp <= dl;
      return [
        i + 1, esc(t.job), esc(t.mainkpi), esc(t.subkpi),
        esc(t.name), esc(t.team), esc(t.status),
        esc(formatDate(t.startdate)), esc(formatDate(t.deadline)),
        esc(formatDate(t.completiondate)),
        t.status === 'Completed' ? (onTime ? 'ตรงเวลา' : 'เกินกำหนด') : '-',
      ].join(',');
    });
    const period = filterMonth === 0 ? `all_${filterYear}` : `${filterMonth}_${filterYear}`;
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNavigate = (nextView) => {
    if (nextView === 'create' && ['dashboard', 'my-dashboard'].includes(view) && ['Staff', 'Lead'].includes(user.role)) {
      setShowDashboardCreate(true);
      return;
    }
    setView(nextView);
  };

  const openExecutiveView = () => {
    const executiveUrl = new URL('/dashboard', window.location.origin);
    executiveUrl.searchParams.set('empId', user.empId || user.empid || '');
    executiveUrl.searchParams.set('month', String(filterMonth));
    executiveUrl.searchParams.set('year', String(filterYear));
    window.open(executiveUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  if (!user) {
    return <LoginScreenPro onLogin={handleLogin} loading={loginLoading} error={loginError} theme={theme} onToggleTheme={toggleTheme} />;
  }

  const showFilterBar = ['executive', 'dashboard', 'tasks', 'my-dashboard', 'my-tasks'].includes(view);
  const peopleForAssign = state.people?.length ? state.people : state.admin?.staff || [];
  const personalWorkUser = user.role === 'Lead' ? { ...user, role: 'Staff' } : user;
  const currentRoleLabel = roleLabel(user.role);
  const currentScopeLabel = roleScope(user);
  const pageTitle =
    view === 'executive' ? 'Executive View'
      : view === 'my-dashboard' ? 'My Dashboard'
      : view === 'my-tasks' ? 'My Tasks'
      : view === 'dashboard'
      ? (isStrategicViewRole(user.role) ? 'Strategic Performance Dashboard' : user.role === 'Manager' ? 'Executive Dashboard' : user.role === 'Lead' ? 'Team Command Center' : isAdminRole(user.role) ? 'System Control Center' : 'My Work Dashboard')
      : view === 'tasks' ? 'Task Center'
      : view === 'create' ? 'Create Task'
      : view === 'assign' ? 'Assignment Center'
      : view === 'people' ? 'People Overview'
      : view === 'tracker' ? 'Job Tracker'
      : view === 'systems' ? 'Systems'
      : view === 'admin' ? 'ควบคุมระบบ'
      : APP_NAME;
  const pageSubtitle =
    view === 'executive' ? 'Board-ready view for SLA risk, weighted KPI health, team performance, and critical work.'
      :
    view === 'my-dashboard' ? 'งานของตัวเองสำหรับ Lead ใช้งานเหมือน Staff: KPI, SLA, งานค้าง และ action ประจำวัน'
      : view === 'my-tasks' ? 'รายการงานของตัวเอง พร้อม action แบบผู้ปฏิบัติงาน'
      :
    view === 'dashboard' ? 'KPI, SLA, งานค้าง และภาพรวมผลงานในช่วงเวลาที่เลือก'
      : view === 'tasks' ? 'จัดการรายการงาน ติดตามสถานะ และตรวจสอบ SLA'
      : view === 'tracker' ? 'ค้นหาและติดตามประวัติงานจากรหัสงาน'
      : view === 'systems' ? 'ระบบงานที่บัญชีนี้มีสิทธิ์ใช้งาน กดเปิดระบบที่เกี่ยวข้องได้จากที่เดียว'
      : view === 'admin' ? 'จัดการผู้ใช้ ทีม KPI/SLA วันหยุด งานดูแลระบบ และ audit log ผ่านระบบเดียว'
      : 'จัดการงานและข้อมูลที่เกี่ยวข้องกับบทบาทของคุณ';
  const activePeriodLabel = showFilterBar
    ? `${filterMonth === 0 ? 'ทุกเดือน' : MONTH_NAMES[filterMonth - 1]} ${filterYear}`
    : user.team;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-[1640px] mx-auto grid xl:grid-cols-[320px_1fr] gap-5 items-start">
        <Sidebar
          user={user}
          view={view}
          setView={setView}
          onLogout={logout}
          notifCount={notifications.length}
          adminSection={adminSection}
          setAdminSection={setAdminSection}
        />

        <main className="grid content-start gap-5">
          <header className="mx-shell-card overflow-visible">
            <div className="px-5 py-5 md:px-6 md:py-6">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <BrandPill className="px-3 py-2 text-[11px] tracking-[0.16em]" />
                    <span className="mx-badge mx-status-process"><i className="fa-solid fa-user"></i>{currentRoleLabel}</span>
                    <span className="mx-badge mx-status-pending"><i className="fa-solid fa-layer-group"></i>{currentScopeLabel}</span>
                    <span className="mx-badge mx-status-completed"><i className="fa-solid fa-building-user"></i>{user.team}</span>
                  </div>
                  <h1 className="mt-4 mb-0 text-[30px] md:text-[38px] leading-tight font-extrabold tracking-normal">
                    {pageTitle}
                  </h1>
                  <p className="mt-2 mb-0 max-w-[64ch] text-sm md:text-[15px] leading-6 text-[var(--mx-muted)]">
                    {pageSubtitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center xl:justify-end gap-2">
                  {canOpenExecutiveView(user.role) && (
                    <button className="mx-btn mx-btn-primary !py-2 inline-flex items-center gap-2" onClick={openExecutiveView} title="Open Executive View">
                      <i className="fa-solid fa-display"></i>
                      <span>Executive View</span>
                    </button>
                  )}
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  <div className="relative">
                    <button className="mx-btn mx-btn-soft !py-2 !px-3 relative" onClick={() => setShowNotif((v) => !v)} title="Notifications" aria-label="Notifications">
                      <i className="fa-solid fa-bell"></i>
                      {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                          {notifications.length > 9 ? '9+' : notifications.length}
                        </span>
                      )}
                    </button>
                    {showNotif && (
                      <div className="absolute right-0 top-12 z-40 w-80 mx-shell-card rounded-[20px] p-4 shadow-2xl border border-[rgba(255,255,255,0.08)]">
                        <div className="text-sm font-extrabold mb-3 flex items-center justify-between">
                          <span>การแจ้งเตือน</span>
                          <button className="text-[var(--mx-muted)] hover:text-[var(--mx-text)]" onClick={() => setShowNotif(false)}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                        {notifications.length === 0 && (
                          <div className="text-sm text-[var(--mx-muted)]">ไม่มีการแจ้งเตือน</div>
                        )}
                        <div className="grid gap-2 max-h-72 overflow-y-auto">
                          {notifications.slice(0, 10).map((n) => (
                            <div key={n.id} className="rounded-[14px] p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]">
                              <div className="flex items-start gap-2 text-sm">
                                <i className={`fa-solid ${n.icon} mt-0.5 flex-shrink-0`} style={{ color: n.color }}></i>
                                <span>{n.message}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {['tasks', 'my-tasks'].includes(view) && state.tasks.length > 0 && (
                    <button className="mx-btn mx-btn-soft !py-2" onClick={downloadCSV} title="Export CSV">
                      <i className="fa-solid fa-file-csv mr-1"></i>CSV
                    </button>
                  )}
                  {(state.loading || actionLoading) && (
                    <span className="mx-badge mx-status-pending"><i className="fa-solid fa-rotate-right fa-spin"></i>Loading</span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--mx-line)] bg-[var(--mx-surface)] px-5 py-3 md:px-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3 text-sm text-[var(--mx-muted)]">
                  <span className="w-9 h-9 rounded-lg mx-brand-mark grid place-items-center">
                    <i className="fa-solid fa-calendar-check text-[var(--mx-accent)]"></i>
                  </span>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] font-extrabold">Current Scope</div>
                    <div className="mt-0.5 text-[var(--mx-text)] font-bold">{activePeriodLabel}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {showFilterBar && (
                    <>
                      <select
                        className="mx-select !w-[160px] !py-2 !text-sm"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(Number(e.target.value))}
                      >
                        <option value={0}>ทุกเดือน</option>
                        {MONTH_NAMES.map((name, i) => (
                          <option key={i + 1} value={i + 1}>{name}</option>
                        ))}
                      </select>
                      <select
                        className="mx-select !w-[116px] !py-2 !text-sm"
                        value={filterYear}
                        onChange={(e) => setFilterYear(Number(e.target.value))}
                      >
                        {availableYears.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>
            </div>
            {state.error && <div className="px-5 pb-4 md:px-6 text-sm text-[#ffb7b7] font-bold">{state.error}</div>}
          </header>

          {showDashboardCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.56)' }}>
              <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto">
                <button
                  className="mx-btn mx-btn-soft !p-0 absolute right-4 top-4 z-10 w-10 h-10 grid place-items-center"
                  onClick={() => setShowDashboardCreate(false)}
                  aria-label="Close create task popup"
                  title="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
                <QuickCreateView
                  user={user}
                  people={peopleForAssign}
                  mode="personal"
                  onSaved={() => {
                    reloadTasks();
                    reloadDashboard();
                    setShowDashboardCreate(false);
                  }}
                />
              </div>
            </div>
          )}

          {view === 'executive' && (
            <ExecutiveView
              data={state.dashboard}
              filterMonth={filterMonth}
              filterYear={filterYear}
              holidays={state.holidays}
              onNavigate={handleNavigate}
            />
          )}
          {view === 'dashboard' && (
            <DashboardView
              user={user}
              data={state.dashboard}
              filterMonth={filterMonth}
              filterYear={filterYear}
              holidays={state.holidays}
              onAccept={handleAccept}
              onStatusChange={handleStatusChange}
              onNavigate={handleNavigate}
            />
          )}
          {view === 'my-dashboard' && (
            <DashboardView
              user={personalWorkUser}
              data={state.dashboard}
              filterMonth={filterMonth}
              filterYear={filterYear}
              holidays={state.holidays}
              onAccept={handleAccept}
              onStatusChange={handleStatusChange}
              onNavigate={handleNavigate}
            />
          )}
          {view === 'tasks' && (
            <TaskCenterView
              user={user}
              tasks={state.tasks}
              holidays={state.holidays}
              onAccept={handleAccept}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onRefresh={reloadTasks}
            />
          )}
          {view === 'my-tasks' && (
            <TaskCenterView
              user={personalWorkUser}
              tasks={state.tasks}
              holidays={state.holidays}
              onAccept={handleAccept}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onRefresh={reloadTasks}
            />
          )}
          {view === 'create' && (
            <QuickCreateView user={user} people={peopleForAssign} mode="personal" onSaved={() => { reloadTasks(); reloadDashboard(); }} />
          )}
          {view === 'assign' && (
            <QuickCreateView user={user} people={peopleForAssign} mode="assign" onSaved={() => { reloadTasks(); reloadDashboard(); reloadPeople(); }} />
          )}
          {view === 'people' && <PeopleView user={user} people={state.people} onRefresh={reloadPeople} />}
          {view === 'tracker' && <TrackerViewNew />}
          {view === 'systems' && <SystemsView user={user} systemLinks={systemLinks} />}
          {view === 'admin' && (
            <AdminStudio
              user={user}
              adminData={state.admin}
              systemLinks={systemLinks}
              onSystemLinksChange={setSystemLinks}
              onRefresh={reloadAdmin}
              adminSection={adminSection}
              setAdminSection={setAdminSection}
            />
          )}
        </main>
      </div>
    </div>
  );
}

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<App />);
