const { useEffect, useMemo, useState, useCallback } = React;

const SESSION_KEY = 'maxiwa-kpi-session';
const THEME_KEY = 'maxiwa-kpi-theme';
const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const NAV_BY_ROLE = {
  Staff: [
    { id: 'dashboard', label: 'My Dashboard', icon: 'fa-chart-line' },
    { id: 'tasks', label: 'My Tasks', icon: 'fa-list-check' },
    { id: 'create', label: 'Create Task', icon: 'fa-square-plus' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project' },
  ],
  Lead: [
    { id: 'dashboard', label: 'Team Command', icon: 'fa-chart-line' },
    { id: 'tasks', label: 'Team Tasks', icon: 'fa-list-check' },
    { id: 'assign', label: 'Assign Task', icon: 'fa-user-plus' },
    { id: 'people', label: 'Team People', icon: 'fa-users' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project' },
  ],
  Manager: [
    { id: 'dashboard', label: 'Executive Dashboard', icon: 'fa-chart-line' },
    { id: 'tasks', label: 'Task Center', icon: 'fa-list-check' },
    { id: 'assign', label: 'Assign Task', icon: 'fa-user-plus' },
    { id: 'people', label: 'People', icon: 'fa-users-viewfinder' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project' },
    { id: 'admin', label: 'Admin Studio', icon: 'fa-shield-halved' },
  ],
  Admin: [
    { id: 'dashboard', label: 'System Dashboard', icon: 'fa-chart-line' },
    { id: 'admin', label: 'Admin Studio', icon: 'fa-shield-halved' },
    { id: 'tracker', label: 'Job Tracker', icon: 'fa-diagram-project' },
  ],
};

const ROLE_HOME = { Staff: 'dashboard', Lead: 'dashboard', Manager: 'dashboard', Admin: 'dashboard' };

function cn(...values) {
  return values.filter(Boolean).join(' ');
}

// ─── URL Helpers ───────────────────────────────────────────────────────────────
function apiBase() {
  return (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '/api';
}

function adminHeaders(empId) {
  return { 'Content-Type': 'application/json', 'x-admin-empid': empId || '' };
}

async function adminGet(path, empId) {
  const res = await fetch(`${apiBase()}/${path}`, { headers: adminHeaders(empId) });
  return res.json();
}

async function adminPost(path, payload, empId) {
  const res = await fetch(`${apiBase()}/${path}`, {
    method: 'POST',
    headers: adminHeaders(empId),
    body: JSON.stringify(payload),
  });
  return res.json();
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
        </div>
        <div className="flex gap-3 mt-6">
          <button className="mx-btn mx-btn-soft flex-1" onClick={onClose}>ยกเลิก</button>
          <button
            className="mx-btn mx-btn-primary flex-1"
            onClick={() => { onSave(newStatus, reason); onClose(); }}
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ user, view, setView, onLogout, notifCount = 0 }) {
  const navItems = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.Staff;
  return (
    <aside className="mx-shell-card rounded-[28px] p-5 md:p-6 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
      <div className="flex items-center gap-4 mb-7">
        <div className="mx-brand-mark w-14 h-14 rounded-lg grid place-items-center text-xl font-black">M</div>
        <div>
          <div className="text-xl font-extrabold tracking-[0.02em]">MAXIWA KPI</div>
          <div className="text-sm text-[var(--mx-muted)]">Executive Performance System</div>
        </div>
      </div>

      <div className="mx-muted-card rounded-lg p-4">
        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="xl" />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Signed In</div>
            <div className="mt-2 font-extrabold text-base truncate">{user?.name}</div>
            <div className="mt-1 text-sm text-[var(--mx-muted)] truncate">{user?.role} • {user?.team}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="mx-badge mx-status-process">{user?.role || '-'}</span>
          <span className="mx-badge mx-status-cancelled">Emp ID: {user?.empId}</span>
        </div>
      </div>

      <div className="mt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Navigation</div>
      <div className="mt-3 grid gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
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
            {item.id === 'tasks' && notifCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {notifCount}
              </span>
            )}
          </button>
        ))}
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
            <div className="mx-brand-pill inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-[0.12em]">
              <i className="fa-solid fa-gauge-high"></i> MAXIWA KPI
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
          <h1 className="mt-6 text-[42px] md:text-[58px] leading-[1.02] tracking-normal font-extrabold mb-0">
            ระบบใหม่ที่ดูดี ใช้ง่าย และต่อของเดิมได้ทันที
          </h1>
          <p className="mt-5 mb-0 text-[15px] leading-8 text-[var(--mx-muted)] max-w-[60ch]">
            MAXIWA KPI ถูกออกแบบใหม่สำหรับผู้บริหารและทีมปฏิบัติการยุคใหม่ โดยยังเชื่อมต่อกับฐานข้อมูลและ backend เดิมโดยตรง
            ไม่ต้องแก้หลังบ้าน และไม่ต้องให้ใครไปแตะ database เพื่อใช้งานประจำวัน
          </p>
        </div>

        <div className="mx-shell-card rounded-[34px] p-8 md:p-10 flex flex-col justify-center">
          <div className="mx-brand-mark w-16 h-16 rounded-lg grid place-items-center text-2xl font-black">M</div>
          <h2 className="mt-6 text-[30px] tracking-normal font-extrabold mb-0">Sign in to MAXIWA KPI</h2>
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
    ['fa-building-user', 'Role Based View', 'แสดงข้อมูลตามสิทธิ์ Staff, Lead, Manager และ Admin'],
  ];

  return (
    <div className="min-h-screen grid place-items-center p-4 md:p-8">
      <div className="w-full max-w-[1180px] mx-shell-card overflow-hidden">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <section className="p-6 md:p-9 border-b lg:border-b-0 lg:border-r border-[var(--mx-line)] bg-[var(--mx-surface)]">
            <div className="flex items-center justify-between gap-3">
              <div className="mx-brand-pill inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-[0.14em]">
                <i className="fa-solid fa-gauge-high"></i> MAXIWA KPI
              </div>
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
                <div className="mx-brand-mark w-14 h-14 rounded-lg grid place-items-center text-xl font-black">M</div>
                <div>
                  <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--mx-muted)] font-extrabold">Secure Access</div>
                  <h2 className="mt-1 mb-0 text-[28px] md:text-[34px] tracking-normal font-extrabold">เข้าสู่ระบบ</h2>
                </div>
              </div>

              <p className="mt-5 mb-0 text-[var(--mx-muted)] leading-7">
                กรอกรหัสพนักงานเพื่อเข้าสู่ MAXIWA KPI ระบบจะโหลดข้อมูลและสิทธิ์ของคุณโดยอัตโนมัติ
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
    loading: false, error: '', dashboard: null, tasks: [], people: [], admin: null,
  });
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1); // 0 = ทุกเดือน
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const safeSet = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    const monthParam = filterMonth === 0 ? null : filterMonth;
    try {
      if (user.role === 'Staff') {
        const res = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
        safeSet({ dashboard: { tasks: res.tasks || res || [] }, loading: false });
        return;
      }
      if (user.role === 'Lead') {
        const [summaryRes, tasksRes] = await Promise.all([
          API.getTeamSummaryReport(user.team, monthParam, filterYear, user.empId),
          API.getAllTasks(monthParam, filterYear, user.team, user.empId),
        ]);
        safeSet({ dashboard: { summary: summaryRes.summary || [], tasks: tasksRes.tasks || [], period: summaryRes.period }, loading: false });
        return;
      }
      if (user.role === 'Manager') {
        const [summaryRes, tasksRes] = await Promise.all([
          API.getSummaryReport(monthParam, filterYear, user.empId),
          API.getAllTasks(monthParam, filterYear, 'all', user.empId),
        ]);
        safeSet({ dashboard: { summary: summaryRes.summary || [], tasks: tasksRes.tasks || [], period: summaryRes.period }, loading: false });
        return;
      }
      const [dashboardRes, staffRes] = await Promise.all([
        API.getDashboardData(),
        API.getAllStaff(user.empId),
      ]);
      safeSet({
        dashboard: { summary: dashboardRes.tasks || [], staff: staffRes.staff || [], kpis: dashboardRes.kpis || [] },
        loading: false,
      });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลด dashboard ไม่สำเร็จ' });
    }
  }, [user, filterMonth, filterYear]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    const monthParam = filterMonth === 0 ? null : filterMonth;
    try {
      if (user.role === 'Staff') {
        const res = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
        safeSet({ tasks: res.tasks || res || [], loading: false });
        return;
      }
      const team = user.role === 'Lead' ? user.team : 'all';
      const res = await API.getAllTasks(monthParam, filterYear, team, user.empId);
      safeSet({ tasks: res.tasks || [], loading: false });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลด tasks ไม่สำเร็จ' });
    }
  }, [user, filterMonth, filterYear]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      let res;
      if (user.role === 'Lead') res = await API.getAllStaffInTeam(user.team, user.empId);
      else res = await API.getAllStaff(user.empId);
      safeSet({ people: res.staff || [], loading: false });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลดรายชื่อไม่สำเร็จ' });
    }
  }, [user]);

  const loadAdmin = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      const [logs, teams, holidays, staff, dashboardRes] = await Promise.all([
        adminGet('admin/getAuditLogs', user.empId),
        adminGet('admin/getTeams', user.empId),
        adminGet('admin/getHolidays', user.empId),
        API.getAllStaff(user.empId),
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
        loading: false,
      });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลด admin data ไม่สำเร็จ' });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (view === 'dashboard') loadDashboard();
    if (view === 'tasks') loadTasks();
    if (view === 'people') loadPeople();
    if (view === 'assign') loadPeople();
    if (view === 'admin') loadAdmin();
  }, [user, view, loadDashboard, loadTasks, loadPeople, loadAdmin]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !window.subscribeToRealtime) return;
    window.subscribeToRealtime('tasks', () => {
      if (view === 'dashboard') loadDashboard();
      if (view === 'tasks') loadTasks();
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
function DashboardView({ user, data, filterMonth, filterYear, onAccept, onStatusChange, onNavigate }) {
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
    const now = new Date();

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
        setDashModal({ show: true, title: 'งานเสร็จสิ้น', message: 'ยืนยันว่างานนี้เสร็จสมบูรณ์แล้วใช่หรือไม่?', color: 'emerald', type: 'confirm', action: () => onStatusChange(task, 'Completed', `${ts} งานเสร็จสิ้น`) });
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
              const dl = task.deadline ? new Date(task.deadline) : null;
              const daysLeft = dl ? Math.ceil((dl - now) / 86400000) : null;
              const isOverdue = daysLeft !== null && daysLeft < 0;
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
                        {isOverdue && <span className="ml-2 text-red-400 font-bold">เกิน {Math.abs(daysLeft)} วัน</span>}
                        {!isOverdue && daysLeft !== null && daysLeft <= 3 && <span className="ml-2 text-[var(--mx-warning)] font-bold">อีก {daysLeft} วัน</span>}
                      </div>
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
    const summary = enrichSummaryWithTaskWeights(data.summary || [], tasks);
    const teamScores = tasks.length > 0 ? calcTaskWeightedScores(tasks) : null;
    const avgSla = teamScores && teamScores.sla !== null
      ? teamScores.sla
      : (summary.length ? Math.round(summary.reduce((s, p) => s + (Number(p.weightedSlaScore) || 0), 0) / summary.length) : 0);
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
          <div className="grid gap-3">
            {summary.map((person) => (
              <div key={person.empId || person.name} className="mx-data-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{person.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">
                      {person.team} • Total {person.totalTasks} • Completed {person.completedTasks}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="mx-badge mx-status-cancelled">Weight {formatWeightPercent(person.totalWeight)}</span>
                      <span className="mx-badge mx-status-completed">Completion {person.weightedCompletionScore ?? '-'}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-lg">{person.weightedSlaScore ?? '-'}%</div>
                    <div className="text-xs text-[var(--mx-muted)]">Weighted SLA</div>
                  </div>
                </div>
              </div>
            ))}
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
          MAXIWA KPI ใช้ backend เดิมและฐานข้อมูลเดิมโดยตรง แต่เปลี่ยนประสบการณ์การใช้งานให้ชัดเจนและเป็นระบบมากขึ้น
        </div>
      </Panel>
    </div>
  );
}

// ─── Task Center View ──────────────────────────────────────────────────────────
function TaskCenterView({ user, tasks, onAccept, onStatusChange, onDelete, onRefresh }) {
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
          action: () => onStatusChange(task, 'Completed', `${ts} งานเสร็จสิ้น`),
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
        API.updateTaskStatus(prModal.task.id, prModal.task.team, 'Completed', `${ts} งานเสร็จสิ้น`, 'append'),
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
          {filtered.map((task) => (
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
                  {expandedTaskId === task.id && (
                    <div className="mt-4 rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="text-xs text-[var(--mx-muted)]">Task ID: {task.id}</div>
                      <div className="mt-2 text-xs text-[var(--mx-muted)]">Weight: {formatWeightPercent(getTaskWeight(task))}</div>
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
          ))}
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
function ExtraDataFields({ subkpi, extraData, onChange }) {
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
        {isSAP && (
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
function QuickCreateView({ user, people, onSaved }) {
  const isStaff = user.role === 'Staff';

  // KPIs: filter by user's team for Staff, all for Lead/Manager
  const teamKpis = useMemo(() => {
    const kpis = user?.kpis || [];
    if (isStaff) return kpis.filter((k) => !k.team || k.team === user.team);
    return kpis;
  }, [user, isStaff]);

  const [loadedStaffKpis, setLoadedStaffKpis] = useState([]);
  useEffect(() => {
    if (!isStaff) return;
    API.getKPIsByTeam(user.team).then((res) => {
      if (res && res.kpis && res.kpis.length > 0) setLoadedStaffKpis(res.kpis);
    }).catch(() => {});
  }, [user.team, isStaff]);

  const [form, setForm] = useState({
    job: '', note: '', subkpi: '', mainkpi: '', deadline: '',
    assignedToName: isStaff ? user.name : '',
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
    if (isStaff) return;
    if (!form.assignedToEmpId) { setAssigneeKpis([]); return; }
    const person = (people || []).find((p) => p.empId === form.assignedToEmpId);
    if (!person) return;
    setForm((prev) => ({ ...prev, assignedToName: person.name, assignedToTeam: person.team, subkpi: '', mainkpi: '', deadline: '', extra_data: {} }));
    API.getKPIsByTeam(person.team)
      .then((res) => setAssigneeKpis(res.kpis || []))
      .catch(() => setAssigneeKpis([]));
  }, [form.assignedToEmpId, isStaff, people]);

  const activeKpis = isStaff ? (loadedStaffKpis.length > 0 ? loadedStaffKpis : teamKpis) : assigneeKpis;

  const handleSubKpiChange = async (subkpi) => {
    if (!subkpi) {
      setForm((p) => ({ ...p, subkpi: '', mainkpi: '', deadline: '', extra_data: {} }));
      return;
    }
    const kpi = activeKpis.find((k) => k.sub === subkpi);
    setForm((p) => ({ ...p, subkpi, mainkpi: kpi?.main || '', extra_data: {} }));

    setLoadingDeadline(true);
    try {
      const targetTeam = isStaff ? user.team : form.assignedToTeam;
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
    if (!isStaff && !form.assignedToName.trim()) return alert('กรุณาเลือกผู้รับผิดชอบ');
    setSaving(true);
    setSaveResult('');
    try {
      let res;
      if (isStaff) {
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
        assignedToName: isStaff ? user.name : '',
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
      title={isStaff ? 'Create Personal Task' : 'Assign Task'}
      subtitle={isStaff ? 'สร้างงานของตัวเองจาก shell ใหม่' : 'มอบหมายงานได้ครั้งละหลาย Job (แต่ละบรรทัด = 1 งาน)'}
    >
      {saveResult && (
        <div className="mb-4 rounded-[14px] p-3 mx-status-completed text-sm font-bold">
          <i className="fas fa-check-circle mr-2"></i>{saveResult}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block mb-2 text-sm font-bold">
            Job / รายละเอียดงาน
            {!isStaff && <span className="ml-2 text-xs text-[var(--mx-muted)] font-normal">(แต่ละบรรทัด = 1 งาน)</span>}
          </label>
          <textarea
            className="mx-textarea min-h-[110px]"
            value={form.job}
            onChange={(e) => setForm((p) => ({ ...p, job: e.target.value }))}
            placeholder={isStaff ? 'ระบุ job หรือรายละเอียดงาน' : 'Job 1\nJob 2\nJob 3 (แต่ละบรรทัดจะสร้างเป็น 1 งาน)'}
          />
        </div>

        {!isStaff && (
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
              placeholder={isStaff ? 'Sub KPI' : 'เลือกผู้รับผิดชอบก่อน'}
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

        {isStaff && (
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
          {saving ? 'กำลังบันทึก...' : isStaff ? 'Create Task' : 'Assign Task'}
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
            <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team} • {person.role}</div>
            <div className="mt-3 text-xs text-[var(--mx-muted)]">Emp ID: {person.empId}</div>
          </div>
        ))}
        {(!people || people.length === 0) && <div className="text-sm text-[var(--mx-muted)]">ไม่พบรายชื่อ</div>}
      </div>
    </Panel>
  );
}

// ─── Admin Studio ──────────────────────────────────────────────────────────────
function AdminStudio({ user, adminData, onRefresh }) {
  const [userForm, setUserForm] = useState({ empid: '', name: '', team: '', role: 'Staff', pigurl: '' });
  const [teamName, setTeamName] = useState('');
  const [kpiForm, setKpiForm] = useState({ main: '', sub: '', team: '', days: 1, main_weight: 1 });
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', name: '', is_active: true });

  const saveUser = async () => {
    const res = await adminPost('admin/saveUser', { ...userForm, permissions: { allowedTeams: [], allowedStaff: [] } }, user.empId);
    if (res.error) return alert(res.error);
    setUserForm({ empid: '', name: '', team: '', role: 'Staff', pigurl: '' });
    onRefresh();
    alert('บันทึก user สำเร็จ');
  };

  const saveTeam = async () => {
    const res = await adminPost('admin/saveTeam', { name: teamName }, user.empId);
    if (res.error) return alert(res.error);
    setTeamName('');
    onRefresh();
    alert('บันทึกทีมสำเร็จ');
  };

  const saveKpi = async () => {
    const res = await adminPost('admin/saveKpi', { ...kpiForm, days: Number(kpiForm.days), main_weight: Number(kpiForm.main_weight) }, user.empId);
    if (res.error) return alert(res.error);
    setKpiForm({ main: '', sub: '', team: '', days: 1, main_weight: 1 });
    alert('บันทึก KPI สำเร็จ');
  };

  const saveHoliday = async () => {
    const res = await adminPost('admin/saveHoliday', holidayForm, user.empId);
    if (res.error) return alert(res.error);
    setHolidayForm({ holiday_date: '', name: '', is_active: true });
    onRefresh();
    alert('บันทึกวันหยุดสำเร็จ');
  };

  const recalc = async () => {
    const res = await adminPost('admin/recalculateDeadlines', {}, user.empId);
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
    if (!window.confirm('Delete this team?')) return;
    const res = await adminDelete(`admin/deleteTeam?id=${encodeURIComponent(id)}`, user.empId);
    if (res.error) return alert(res.error);
    onRefresh();
  };

  const removeHoliday = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    const res = await adminDelete(`admin/deleteHoliday?id=${encodeURIComponent(id)}`, user.empId);
    if (res.error) return alert(res.error);
    onRefresh();
  };

  const removeKpi = async (id) => {
    if (!window.confirm('Delete this KPI?')) return;
    const res = await adminDelete(`admin/deleteKpi?id=${encodeURIComponent(id)}`, user.empId);
    if (res.error) return alert(res.error);
    onRefresh();
  };

  return (
    <div className="grid gap-5">
      <Panel title="Admin Studio" subtitle="จัดการทุกอย่างผ่านระบบใหม่ โดยไม่ต้องแตะ database">
        <div className="mx-grid-auto">
          <MetricCard label="Users" value={adminData?.staff?.length || 0} sub="ผู้ใช้งานในระบบ" icon="fa-users" />
          <MetricCard label="Teams" value={adminData?.teams?.length || 0} sub="ทีมที่บันทึกไว้" icon="fa-people-group" accent="var(--mx-teal)" />
          <MetricCard label="Holidays" value={adminData?.holidays?.length || 0} sub="วันหยุดในปฏิทิน SLA" icon="fa-calendar-days" accent="var(--mx-amber)" />
          <MetricCard label="Audit Logs" value={adminData?.logs?.length || 0} sub="log ล่าสุดในระบบ" icon="fa-shield-halved" accent="var(--mx-blue)" />
        </div>
      </Panel>

      <div className="grid xl:grid-cols-2 gap-5">
        <Panel title="Create / Update User" subtitle="จัดการผู้ใช้จากภายในระบบ">
          <div className="grid gap-3">
            <input className="mx-input" placeholder="Emp ID" value={userForm.empid} onChange={(e) => setUserForm((p) => ({ ...p, empid: e.target.value }))} />
            <input className="mx-input" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="mx-input" placeholder="Team" value={userForm.team} onChange={(e) => setUserForm((p) => ({ ...p, team: e.target.value }))} />
            <select className="mx-select" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>
              <option value="Staff">Staff</option>
              <option value="Lead">Lead</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
            <input className="mx-input" placeholder="Avatar URL (optional)" value={userForm.pigurl} onChange={(e) => setUserForm((p) => ({ ...p, pigurl: e.target.value }))} />
            <button className="mx-btn mx-btn-primary" onClick={saveUser}>Save User</button>
          </div>
        </Panel>

        <Panel title="Organization Controls" subtitle="ทีม, KPI, วันหยุด และการคำนวณ SLA">
          <div className="grid gap-4">
            <div className="mx-muted-card rounded-lg p-4">
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="flex-1">
                  <div className="text-sm font-extrabold">Team</div>
                  <div className="mt-1 text-xs text-[var(--mx-muted)]">เพิ่มทีมใหม่สำหรับจัดกลุ่มผู้ใช้งานและ KPI</div>
                  <input className="mx-input mt-3" placeholder="New Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>
                <button className="mx-btn mx-btn-soft lg:w-36" onClick={saveTeam}>Save Team</button>
              </div>
            </div>

            <div className="mx-muted-card rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-extrabold">KPI Definition</div>
                  <div className="mt-1 text-xs text-[var(--mx-muted)]">กำหนด SLA days และ Weight ที่ใช้คำนวณคะแนนแบบถ่วงน้ำหนัก</div>
                </div>
                <span className="mx-badge mx-status-process">Weight affects score</span>
              </div>
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
                  <input className="mx-input" placeholder="Team" value={kpiForm.team} onChange={(e) => setKpiForm((p) => ({ ...p, team: e.target.value }))} />
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
              <button className="mx-btn mx-btn-soft w-full mt-3" onClick={saveKpi}>Save KPI</button>
            </div>

            <div className="mx-muted-card rounded-lg p-4">
              <div className="text-sm font-extrabold">Holiday Calendar</div>
              <div className="mt-1 text-xs text-[var(--mx-muted)]">วันหยุดจะถูกใช้ตอนคำนวณ deadline และ SLA</div>
              <div className="grid md:grid-cols-[180px_1fr_auto] gap-3 mt-3">
                <input className="mx-input" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value }))} />
                <input className="mx-input" placeholder="Holiday Name" value={holidayForm.name} onChange={(e) => setHolidayForm((p) => ({ ...p, name: e.target.value }))} />
                <button className="mx-btn mx-btn-soft md:w-36" onClick={saveHoliday}>Save Holiday</button>
              </div>
            </div>

            <div className="mx-muted-card rounded-lg p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold">Maintenance</div>
                  <div className="mt-1 text-xs text-[var(--mx-muted)]">ใช้เมื่อมีการปรับ KPI หรือวันหยุด แล้วต้องคำนวณ deadline ใหม่</div>
                </div>
                <button className="mx-btn mx-btn-primary lg:w-60" onClick={recalc}>
                  <i className="fa-solid fa-rotate mr-2"></i>Recalculate Deadlines
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <Panel title="Teams" subtitle="รายการทีมจากระบบเดิม">
          <div className="grid gap-3">
            {(adminData?.teams || []).map((team) => (
              <div key={team.id || team.name} className="mx-data-card flex items-center justify-between gap-3">
                <div className="font-bold">{team.name}</div>
                <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeTeam(team.id)}>Delete</button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Latest Audit Logs" subtitle="ดูประวัติการเปลี่ยนแปลงโดยไม่ต้องเข้า backend">
          <div className="grid gap-3">
            {(adminData?.logs || []).slice(0, 12).map((log) => (
              <div key={log.id} className="mx-data-card">
                <div className="font-bold text-sm">{log.action || 'Activity'}</div>
                <div className="mt-2 text-sm text-[var(--mx-muted)]">{log.details || '-'}</div>
                <div className="mt-2 text-xs text-[var(--mx-muted)]">{log.by_user || '-'} • {formatDate(log.timestamp, true)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        <Panel title="Users" subtitle="จัดการผู้ใช้งานจากระบบใหม่">
          <div className="grid gap-3">
            {(adminData?.staff || []).slice(0, 15).map((s) => (
              <div key={s.empId} className="mx-data-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{s.empId} • {s.team} • {s.role}</div>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeUser(s.empId)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="KPI Catalog" subtitle="เห็นและลบ KPI ได้จากในระบบ">
          <div className="grid gap-3">
            {(adminData?.kpis || []).slice(0, 15).map((kpi) => (
              <div key={kpi.id} className="mx-data-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{kpi.main} / {kpi.sub}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{kpi.team} • {kpi.days} day(s) • weight {kpi.main_weight}</div>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeKpi(kpi.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Holiday Calendar" subtitle="ดูและลบวันหยุดโดยไม่ออกจากระบบ">
          <div className="grid gap-3">
            {(adminData?.holidays || []).slice(0, 15).map((holiday) => (
              <div key={holiday.id} className="mx-data-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{holiday.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">
                      {holiday.holiday_date} • {holiday.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeHoliday(holiday.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(() => parseJsonSafe(localStorage.getItem(SESSION_KEY), null));
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [view, setView] = useState(() => {
    const saved = parseJsonSafe(localStorage.getItem(SESSION_KEY), null);
    return ROLE_HOME[saved?.role] || 'dashboard';
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showDashboardCreate, setShowDashboardCreate] = useState(false);

  const {
    state, filterMonth, setFilterMonth, filterYear, setFilterYear,
    reloadDashboard, reloadTasks, reloadPeople, reloadAdmin,
  } = useAppData(user, view);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

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
    const now = new Date();
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
        const dl = new Date(task.deadline);
        const daysLeft = Math.ceil((dl - now) / 86400000);
        if (daysLeft < 0) {
          result.push({
            id: `overdue-${task.id}`,
            type: 'overdue',
            icon: 'fa-triangle-exclamation',
            color: '#ef4444',
            message: `เกิน deadline ${Math.abs(daysLeft)} วัน: ${(task.job || '').substring(0, 28)}`,
          });
        } else if (daysLeft <= 3) {
          result.push({
            id: `deadline-${task.id}`,
            type: 'deadline',
            icon: 'fa-clock',
            color: '#f59e0b',
            message: `อีก ${daysLeft} วัน: ${(task.job || '').substring(0, 30)}`,
          });
        }
      }
    });
    return result;
  }, [state.tasks]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }, [user]);

  const handleLogin = async (empId) => {
    if (!empId?.trim()) { setLoginError('กรุณาระบุรหัสพนักงาน'); return; }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await API.getInitialData(empId.trim());
      if (res?.error) throw new Error(res.error);
      if (!res?.user) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
      const nextUser = { ...res.user, kpis: res.kpis || [] };
      setUser(nextUser);
      setView(ROLE_HOME[nextUser.role] || 'dashboard');
    } catch (e) {
      setLoginError(e.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
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
      if (mode === 'note_only') {
        await API.updateTaskStatus(task.id, task.team, task.status, note, 'append');
      } else if (user.role === 'Staff') {
        await API.updateTaskStatus(task.id, task.team, status, note, 'append');
      } else {
        await API.updateTaskStatusWithLog(task.id, task.team, status, note, user.name);
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
    if (nextView === 'create' && view === 'dashboard' && user.role === 'Staff') {
      setShowDashboardCreate(true);
      return;
    }
    setView(nextView);
  };

  if (!user) {
    return <LoginScreenPro onLogin={handleLogin} loading={loginLoading} error={loginError} theme={theme} onToggleTheme={toggleTheme} />;
  }

  const showFilterBar = ['dashboard', 'tasks'].includes(view);
  const peopleForAssign = state.people?.length ? state.people : state.admin?.staff || [];
  const pageTitle =
    view === 'dashboard'
      ? (user.role === 'Manager' ? 'Executive Dashboard' : user.role === 'Lead' ? 'Team Command Center' : user.role === 'Admin' ? 'System Control Center' : 'My Work Dashboard')
      : view === 'tasks' ? 'Task Center'
      : view === 'create' ? 'Create Task'
      : view === 'assign' ? 'Assignment Center'
      : view === 'people' ? 'People Overview'
      : view === 'tracker' ? 'Job Tracker'
      : view === 'admin' ? 'Admin Studio'
      : 'MAXIWA KPI';
  const pageSubtitle =
    view === 'dashboard' ? 'KPI, SLA, งานค้าง และภาพรวมผลงานในช่วงเวลาที่เลือก'
      : view === 'tasks' ? 'จัดการรายการงาน ติดตามสถานะ และตรวจสอบ SLA'
      : view === 'tracker' ? 'ค้นหาและติดตามประวัติงานจากรหัสงาน'
      : view === 'admin' ? 'ตั้งค่าทีม KPI วันหยุด และข้อมูลระบบ'
      : 'จัดการงานและข้อมูลที่เกี่ยวข้องกับบทบาทของคุณ';
  const activePeriodLabel = showFilterBar
    ? `${filterMonth === 0 ? 'ทุกเดือน' : MONTH_NAMES[filterMonth - 1]} ${filterYear}`
    : user.team;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-[1640px] mx-auto grid xl:grid-cols-[320px_1fr] gap-5 items-start">
        <Sidebar user={user} view={view} setView={setView} onLogout={logout} notifCount={notifications.length} />

        <main className="grid content-start gap-5">
          <header className="mx-shell-card overflow-visible">
            <div className="px-5 py-5 md:px-6 md:py-6">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mx-brand-pill inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-[0.16em]">
                      <i className="fa-solid fa-gauge-high"></i> MAXIWA KPI
                    </div>
                    <span className="mx-badge mx-status-process"><i className="fa-solid fa-user"></i>{user.role}</span>
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
                  {view === 'tasks' && state.tasks.length > 0 && (
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
                  onSaved={() => {
                    reloadTasks();
                    reloadDashboard();
                    setShowDashboardCreate(false);
                  }}
                />
              </div>
            </div>
          )}

          {view === 'dashboard' && (
            <DashboardView
              user={user}
              data={state.dashboard}
              filterMonth={filterMonth}
              filterYear={filterYear}
              onAccept={handleAccept}
              onStatusChange={handleStatusChange}
              onNavigate={handleNavigate}
            />
          )}
          {view === 'tasks' && (
            <TaskCenterView
              user={user}
              tasks={state.tasks}
              onAccept={handleAccept}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onRefresh={reloadTasks}
            />
          )}
          {view === 'create' && (
            <QuickCreateView user={user} people={peopleForAssign} onSaved={() => { reloadTasks(); reloadDashboard(); }} />
          )}
          {view === 'assign' && (
            <QuickCreateView user={user} people={peopleForAssign} onSaved={() => { reloadTasks(); reloadDashboard(); reloadPeople(); }} />
          )}
          {view === 'people' && <PeopleView user={user} people={state.people} onRefresh={reloadPeople} />}
          {view === 'tracker' && <TrackerViewNew />}
          {view === 'admin' && <AdminStudio user={user} adminData={state.admin} onRefresh={reloadAdmin} />}
        </main>
      </div>
    </div>
  );
}

const _root = ReactDOM.createRoot(document.getElementById('root'));
_root.render(<App />);
