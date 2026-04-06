const { useEffect, useMemo, useState, useCallback } = React;

const SESSION_KEY = 'maxiwa-kpi-session';

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

function formatDate(value, withTime = false) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('th-TH', withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
}

function parseJsonSafe(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

function adminHeaders(empId) {
  return {
    'Content-Type': 'application/json',
    'x-admin-empid': empId || '',
  };
}

async function adminGet(path, empId) {
  const res = await fetch(`/api/${path}`, { headers: adminHeaders(empId) });
  return res.json();
}

async function adminPost(path, payload, empId) {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: adminHeaders(empId),
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function adminDelete(path, empId) {
  const res = await fetch(`/api/${path}`, {
    method: 'DELETE',
    headers: adminHeaders(empId),
  });
  return res.json();
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
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (entries.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([label, value]) => (
        <span key={label} className="mx-badge mx-status-process">{label}: {value}</span>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, icon, accent = 'var(--mx-blue)' }) {
  return (
    <div className="mx-shell-card rounded-[20px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] uppercase tracking-[0.14em] text-[var(--mx-muted)] font-extrabold">{label}</div>
        <div className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}>
          <i className={`fa-solid ${icon}`} style={{ color: accent }}></i>
        </div>
      </div>
      <div className="mt-5 text-[34px] font-extrabold tracking-[-0.05em]">{value}</div>
      <div className="mt-2 text-sm text-[var(--mx-muted)]">{sub}</div>
    </div>
  );
}

function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="mx-shell-card rounded-[28px] p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[22px] font-extrabold tracking-[-0.04em] m-0">{title}</h3>
          {subtitle && <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Sidebar({ user, view, setView, onLogout }) {
  const navItems = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.Staff;

  return (
    <aside className="mx-shell-card rounded-[28px] p-5 md:p-6 h-full">
      <div className="flex items-center gap-4 mb-7">
        <div className="w-14 h-14 rounded-[20px] bg-gradient-to-br from-[#4f7cff] to-[#22c1a1] grid place-items-center text-xl font-black shadow-[0_20px_40px_rgba(34,193,161,0.16)]">M</div>
        <div>
          <div className="text-xl font-extrabold tracking-[0.02em]">MAXIWA KPI</div>
          <div className="text-sm text-[var(--mx-muted)]">Executive Performance System</div>
        </div>
      </div>

      <div className="rounded-[22px] p-4 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Signed In</div>
        <div className="mt-2 font-bold text-base">{user?.name}</div>
        <div className="text-sm text-[var(--mx-muted)]">{user?.role} • {user?.team}</div>
        <div className="mt-3 text-xs text-[var(--mx-muted)]">Emp ID: {user?.empId}</div>
      </div>

      <div className="mt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Navigation</div>
      <div className="mt-3 grid gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'mx-btn text-left flex items-center gap-3 px-4 py-4 rounded-[18px]',
              view === item.id ? 'bg-[linear-gradient(135deg,rgba(79,124,255,0.18),rgba(34,193,161,0.12))] border border-[rgba(138,171,255,0.22)]' : 'bg-transparent border border-transparent'
            )}
          >
            <i className={`fa-solid ${item.icon} w-5 text-center text-[#9dbbff]`}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-[20px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
        <div className="text-sm font-bold">Closed-loop system</div>
        <div className="mt-2 text-sm text-[var(--mx-muted)]">ทุกอย่างทำผ่านระบบนี้ โดยใช้ backend และฐานข้อมูลเดิมได้ทันที</div>
      </div>

      <button onClick={onLogout} className="mx-btn mx-btn-soft w-full mt-6">
        <i className="fa-solid fa-right-from-bracket mr-2"></i>ออกจากระบบ
      </button>
    </aside>
  );
}

function LoginScreen({ onLogin, loading, error }) {
  const [empId, setEmpId] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center p-5 md:p-8">
      <div className="w-full max-w-[1120px] grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="mx-shell-card rounded-[34px] p-8 md:p-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(79,124,255,0.1)] border border-[rgba(138,171,255,0.16)] text-[#c8d6ff] text-xs font-extrabold uppercase tracking-[0.12em]">
            <i className="fa-solid fa-crown"></i> MAXIWA KPI
          </div>
          <h1 className="mt-6 text-[42px] md:text-[58px] leading-[0.95] tracking-[-0.06em] font-extrabold mb-0">
            ระบบใหม่ที่ดูดี ใช้ง่าย และต่อของเดิมได้ทันที
          </h1>
          <p className="mt-5 mb-0 text-[15px] leading-8 text-[var(--mx-muted)] max-w-[60ch]">
            MAXIWA KPI ถูกออกแบบใหม่สำหรับผู้บริหารและทีมปฏิบัติการยุคใหม่ โดยยังเชื่อมต่อกับฐานข้อมูลและ backend เดิมโดยตรง
            ไม่ต้องแก้หลังบ้าน และไม่ต้องให้ใครไปแตะ database เพื่อใช้งานประจำวัน
          </p>
        </div>

        <div className="mx-shell-card rounded-[34px] p-8 md:p-10 flex flex-col justify-center">
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#4f7cff] to-[#22c1a1] grid place-items-center text-2xl font-black shadow-[0_20px_42px_rgba(34,193,161,0.2)]">M</div>
          <h2 className="mt-6 text-[30px] tracking-[-0.05em] font-extrabold mb-0">Sign in to MAXIWA KPI</h2>
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

function useAppData(user, view) {
  const [state, setState] = useState({
    loading: false,
    error: '',
    dashboard: null,
    tasks: [],
    people: [],
    admin: null,
  });

  const safeSet = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      if (user.role === 'Staff') {
        const now = new Date();
        const res = await API.getEmployeeTasks(user, now.getMonth() + 1, now.getFullYear(), false, user.empId);
        safeSet({ dashboard: { tasks: res.tasks || res || [] }, loading: false });
        return;
      }

      if (user.role === 'Lead') {
        const now = new Date();
        const res = await API.getTeamSummaryReport(user.team, now.getMonth() + 1, now.getFullYear(), user.empId);
        safeSet({ dashboard: { summary: res.summary || [], period: res.period }, loading: false });
        return;
      }

      if (user.role === 'Manager') {
        const now = new Date();
        const [summaryRes, tasksRes] = await Promise.all([
          API.getSummaryReport(now.getMonth() + 1, now.getFullYear(), user.empId),
          API.getAllTasks(now.getMonth() + 1, now.getFullYear(), 'all', user.empId),
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
  }, [user]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      const now = new Date();
      if (user.role === 'Staff') {
        const res = await API.getEmployeeTasks(user, now.getMonth() + 1, now.getFullYear(), false, user.empId);
        safeSet({ tasks: res.tasks || res || [], loading: false });
        return;
      }
      const team = user.role === 'Lead' ? user.team : 'all';
      const res = await API.getAllTasks(now.getMonth() + 1, now.getFullYear(), team, user.empId);
      safeSet({ tasks: res.tasks || [], loading: false });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'โหลด tasks ไม่สำเร็จ' });
    }
  }, [user]);

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

  return { state, reloadDashboard: loadDashboard, reloadTasks: loadTasks, reloadPeople: loadPeople, reloadAdmin: loadAdmin };
}

function DashboardView({ user, data }) {
  if (!data) {
    return <Panel title="Executive Overview" subtitle="กำลังเตรียมข้อมูลให้คุณ..."><div className="text-[var(--mx-muted)]">Loading dashboard...</div></Panel>;
  }

  if (user.role === 'Staff') {
    const tasks = data.tasks || [];
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    const active = tasks.filter((t) => ['On Process', 'Pending', 'On Hold'].includes(t.status)).length;
    const soon = tasks.filter((t) => t.deadline && ['On Process', 'Pending', 'On Hold'].includes(t.status)).slice(0, 5);
    return (
      <div className="grid gap-5">
        <div className="mx-grid-auto">
          <MetricCard label="My Tasks" value={tasks.length} sub="รายการงานในเดือนนี้" icon="fa-list-check" />
          <MetricCard label="Active" value={active} sub="งานที่ยังต้องติดตาม" icon="fa-bolt" accent="var(--mx-teal)" />
          <MetricCard label="Completed" value={completed} sub="งานที่ปิดแล้ว" icon="fa-check-double" accent="var(--mx-green)" />
        </div>
        <Panel title="Priority for Today" subtitle="งานที่ควรตามก่อนในมุมผู้ปฏิบัติงาน">
          <div className="grid gap-3">
            {soon.length === 0 && <div className="text-sm text-[var(--mx-muted)]">ไม่มีงานเร่งด่วนในช่วงนี้</div>}
            {soon.map((task) => (
              <div key={task.id} className="mx-data-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{task.job}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{task.subkpi || 'ไม่ระบุ Sub KPI'} • Due {formatDate(task.deadline)}</div>
                  </div>
                  <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  if (user.role === 'Lead') {
    const summary = data.summary || [];
    const avgSla = summary.length ? Math.round(summary.reduce((sum, s) => sum + (Number(s.weightedSlaScore) || 0), 0) / summary.length) : 0;
    return (
      <div className="grid gap-5">
        <div className="mx-grid-auto">
          <MetricCard label="Team Members" value={summary.length} sub="กำลังแสดงตามสิทธิ์ของ Lead" icon="fa-users" />
          <MetricCard label="Avg SLA" value={`${avgSla}%`} sub="ค่าเฉลี่ย weighted SLA score" icon="fa-chart-line" accent="var(--mx-teal)" />
          <MetricCard label="Period" value={data.period || '-'} sub="ช่วงเวลาที่กำลังดู" icon="fa-calendar-days" accent="var(--mx-amber)" />
        </div>
        <Panel title="Team Performance Pulse" subtitle="ภาพรวมทีมในหน้าที่อ่านง่ายขึ้น">
          <div className="grid gap-3">
            {summary.map((person) => (
              <div key={person.empId || person.name} className="mx-data-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{person.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team} • Total {person.totalTasks} • Completed {person.completedTasks}</div>
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
    const summary = data.summary || [];
    const tasks = data.tasks || [];
    const risky = tasks.filter((t) => ['Pending', 'On Hold'].includes(t.status)).length;
    const avgSla = summary.length ? Math.round(summary.reduce((sum, s) => sum + (Number(s.weightedSlaScore) || 0), 0) / summary.length) : 0;
    const topPeople = [...summary].sort((a, b) => (b.weightedSlaScore || 0) - (a.weightedSlaScore || 0)).slice(0, 6);
    return (
      <div className="grid gap-5">
        <div className="mx-grid-auto">
          <MetricCard label="Active Tasks" value={tasks.length} sub="โหลดจากระบบเดิมแบบตรง ๆ" icon="fa-briefcase" />
          <MetricCard label="Risk Queue" value={risky} sub="Pending / On Hold ต้องติดตาม" icon="fa-triangle-exclamation" accent="var(--mx-amber)" />
          <MetricCard label="Avg SLA" value={`${avgSla}%`} sub="weighted SLA across visible staff" icon="fa-chart-line" accent="var(--mx-teal)" />
          <MetricCard label="People" value={summary.length} sub="จำนวนคนในมุมผู้จัดการ" icon="fa-users-viewfinder" accent="var(--mx-blue)" />
        </div>
        <Panel title="Executive Scoreboard" subtitle="ผู้บริหารเห็นคะแนน, ปริมาณงาน, และจุดที่ควร intervene ทันที">
          <div className="grid md:grid-cols-2 gap-3">
            {topPeople.map((person) => (
              <div key={person.empId || person.name} className="mx-data-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{person.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team} • Total {person.totalTasks}</div>
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
      <Panel title="System Overview" subtitle="ภาพรวมสำหรับผู้ดูแลระบบใน shell ใหม่">
        <div className="text-sm text-[var(--mx-muted)]">
          MAXIWA KPI ใช้ backend เดิมและฐานข้อมูลเดิมโดยตรง แต่เปลี่ยนประสบการณ์การใช้งานให้ชัดเจนและเป็นระบบมากขึ้น
        </div>
      </Panel>
    </div>
  );
}

function TaskCenterView({ user, tasks, onAccept, onStatusChange, onDelete, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const filtered = useMemo(() => {
    return (tasks || []).filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [task.job, task.name, task.team, task.subkpi, task.status].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [tasks, statusFilter, search]);

  const taskSummary = useMemo(() => ({
    total: (tasks || []).length,
    active: (tasks || []).filter((t) => ['On Process', 'Pending', 'On Hold'].includes(t.status)).length,
    completed: (tasks || []).filter((t) => t.status === 'Completed').length,
    risk: (tasks || []).filter((t) => ['Pending', 'On Hold'].includes(t.status)).length,
  }), [tasks]);

  return (
    <div className="grid gap-5">
      <div className="mx-grid-auto">
        <MetricCard label="Total Tasks" value={taskSummary.total} sub="ทั้งหมดในมุมมองนี้" icon="fa-list-check" />
        <MetricCard label="Active" value={taskSummary.active} sub="งานที่ยังต้องขับเคลื่อน" icon="fa-bolt" accent="var(--mx-teal)" />
        <MetricCard label="Completed" value={taskSummary.completed} sub="งานที่ปิดแล้ว" icon="fa-check-double" accent="var(--mx-green)" />
        <MetricCard label="Need Attention" value={taskSummary.risk} sub="Pending / On Hold" icon="fa-triangle-exclamation" accent="var(--mx-amber)" />
      </div>
      <Panel
        title="Task Center"
        subtitle="มุมมองงานแบบใหม่ที่อ่านเร็วและจัดการง่ายกว่าเดิม"
        actions={[<button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh}><i className="fa-solid fa-rotate-right mr-2"></i>Refresh</button>]}
      >
        <div className="grid md:grid-cols-[1fr_220px] gap-3 mb-5">
          <input className="mx-input" placeholder="ค้นหา job / คน / team / status" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-base break-all">{task.job}</div>
                    <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status}</span>
                    <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                      {expandedTaskId === task.id ? 'Hide Detail' : 'Detail'}
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">{task.name || '-'} • {task.team || '-'} • {task.subkpi || 'ไม่ระบุ Sub KPI'}</div>
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">Start {formatDate(task.startdate)} • Deadline {formatDate(task.deadline)} • Complete {formatDate(task.completiondate)}</div>
                  {expandedTaskId === task.id && (
                    <div className="mt-4 rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="text-sm text-[var(--mx-muted)]">Task ID: {task.id}</div>
                      {task.note ? <div className="mt-3 text-sm leading-7 whitespace-pre-wrap">{task.note}</div> : <div className="mt-3 text-sm text-[var(--mx-muted)]">ไม่มี note</div>}
                      {renderExtraData(task.extra_data)}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.role === 'Staff' && task.status === 'Pending' && <button className="mx-btn mx-btn-primary" onClick={() => onAccept(task)}>Accept</button>}
                  <button className="mx-btn mx-btn-soft" onClick={() => onStatusChange(task, 'On Process')}>On Process</button>
                  <button className="mx-btn mx-btn-soft" onClick={() => onStatusChange(task, 'On Hold')}>On Hold</button>
                  <button className="mx-btn mx-btn-soft" onClick={() => onStatusChange(task, 'Completed')}>Completed</button>
                  {(user.role === 'Manager' || user.role === 'Admin') && <button className="mx-btn mx-btn-soft" onClick={() => onDelete(task)}>Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TrackerViewNew() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [logsByTask, setLogsByTask] = useState({});
  const [expandedJob, setExpandedJob] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const handleSearch = async () => {
    if (query.trim().length < 3) {
      setError('กรุณาค้นหาอย่างน้อย 3 ตัวอักษร');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await API.getTasksByJob(query.trim());
      const tasks = res.tasks || [];
      setItems(tasks);
      setExpandedJob(null);
      setExpandedTaskId(null);
      const logPairs = await Promise.all(tasks.map(async (task) => {
        try {
          const logRes = await API.getAuditLogsByTask(task.id);
          return [task.id, logRes.logs || []];
        } catch {
          return [task.id, []];
        }
      }));
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
          <input className="mx-input" placeholder="ค้นหา job code หรือชื่องาน" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <button className="mx-btn mx-btn-primary" onClick={handleSearch} disabled={loading}>{loading ? 'กำลังค้นหา...' : 'Search'}</button>
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
                  <span className="mx-badge mx-status-process">{[...new Set(tasks.map((t) => t.name).filter(Boolean))].length} owner(s)</span>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => setExpandedJob(expandedJob === code ? null : code)}>
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
                          <div className="mt-2 text-sm text-[var(--mx-muted)]">{task.team || '-'} • {task.subkpi || 'ไม่ระบุ Sub KPI'} • Start {formatDate(task.startdate)}</div>
                          <div className="mt-1 text-sm text-[var(--mx-muted)]">Deadline {formatDate(task.deadline)} • Completed {formatDate(task.completiondate)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status}</span>
                          <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                            {expandedTaskId === task.id ? 'Hide Detail' : 'View Detail'}
                          </button>
                        </div>
                      </div>

                      {expandedTaskId === task.id && (
                        <div className="mt-4 rounded-[18px] p-4 bg-[rgba(0,0,0,0.16)] border border-[rgba(255,255,255,0.06)]">
                          {task.note ? <div className="text-sm leading-7 whitespace-pre-wrap">{task.note}</div> : <div className="text-sm text-[var(--mx-muted)]">ไม่มี note ของ task นี้</div>}
                          {renderExtraData(task.extra_data)}
                          <div className="mt-4">
                            <div className="text-sm font-bold">Audit Timeline</div>
                            <div className="mt-3 grid gap-3">
                              {(logsByTask[task.id] || []).length === 0 && <div className="text-sm text-[var(--mx-muted)]">ยังไม่มี audit log</div>}
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

function QuickCreateView({ user, people, onSaved }) {
  const [form, setForm] = useState({
    job: '',
    note: '',
    subkpi: '',
    assignedToName: '',
    assignedToTeam: user?.team || '',
  });
  const [saving, setSaving] = useState(false);
  const isStaff = user.role === 'Staff';

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      assignedToName: isStaff ? user.name : prev.assignedToName,
      assignedToTeam: isStaff ? user.team : (prev.assignedToTeam || user.team),
    }));
  }, [user, isStaff]);

  const handleSave = async () => {
    if (!form.job.trim()) return alert('กรุณาระบุ job');
    if (!form.subkpi.trim()) return alert('กรุณาระบุ Sub KPI');
    setSaving(true);
    try {
      if (isStaff) {
        await API.saveNewTask({ name: user.name, team: user.team, job: form.job, subkpi: form.subkpi, note: form.note });
      } else {
        if (!form.assignedToName.trim()) return alert('กรุณาเลือกผู้รับผิดชอบ');
        await API.assignNewTask({ assignedToName: form.assignedToName, assignedToTeam: form.assignedToTeam || user.team, job: form.job, subkpi: form.subkpi });
      }
      setForm({
        job: '',
        note: '',
        subkpi: '',
        assignedToName: isStaff ? user.name : '',
        assignedToTeam: isStaff ? user.team : user.team,
      });
      onSaved?.();
      alert('บันทึกงานเรียบร้อย');
    } catch (e) {
      alert(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={isStaff ? 'Create Personal Task' : 'Assign Task'} subtitle={isStaff ? 'สร้างงานของตัวเองจาก shell ใหม่' : 'มอบหมายงานผ่านระบบใหม่ โดยยังใช้ API เดิม'}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block mb-2 text-sm font-bold">Job</label>
          <textarea className="mx-textarea min-h-[110px]" value={form.job} onChange={(e) => setForm((p) => ({ ...p, job: e.target.value }))} placeholder="ระบุ job หรือรายละเอียดงาน"></textarea>
        </div>
        <div>
          <label className="block mb-2 text-sm font-bold">Sub KPI</label>
          <input className="mx-input" value={form.subkpi} onChange={(e) => setForm((p) => ({ ...p, subkpi: e.target.value }))} placeholder="Sub KPI" />
        </div>
        {!isStaff && (
          <>
            <div>
              <label className="block mb-2 text-sm font-bold">Assigned To</label>
              <select className="mx-select" value={form.assignedToName} onChange={(e) => {
                const person = (people || []).find((p) => p.name === e.target.value);
                setForm((prev) => ({ ...prev, assignedToName: e.target.value, assignedToTeam: person?.team || prev.assignedToTeam }));
              }}>
                <option value="">เลือกผู้รับผิดชอบ</option>
                {(people || []).map((person) => <option key={`${person.empId}-${person.name}`} value={person.name}>{person.name} ({person.team})</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-bold">Team</label>
              <input className="mx-input" value={form.assignedToTeam} onChange={(e) => setForm((p) => ({ ...p, assignedToTeam: e.target.value }))} />
            </div>
          </>
        )}
        {isStaff && (
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-bold">Note</label>
            <textarea className="mx-textarea min-h-[100px]" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="หมายเหตุเพิ่มเติม"></textarea>
          </div>
        )}
      </div>
      <div className="mt-5">
        <button className="mx-btn mx-btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'กำลังบันทึก...' : isStaff ? 'Create Task' : 'Assign Task'}</button>
      </div>
    </Panel>
  );
}

function PeopleView({ user, people, onRefresh }) {
  return (
    <Panel title={user.role === 'Lead' ? 'Team People' : 'People Directory'} subtitle="รายชื่อที่มองเห็นได้ตามสิทธิ์เดิม แต่แสดงในโครงใหม่ที่อ่านง่ายกว่า" actions={[<button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh}>Refresh</button>]}>
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
        <Panel title="Create User" subtitle="จัดการผู้ใช้จากภายในระบบ">
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

        <Panel title="Organization Controls" subtitle="ทีม, KPI, วันหยุด และการ recalculate">
          <div className="grid gap-3">
            <input className="mx-input" placeholder="New Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <button className="mx-btn mx-btn-soft" onClick={saveTeam}>Save Team</button>
            <div className="grid md:grid-cols-2 gap-3">
              <input className="mx-input" placeholder="Main KPI" value={kpiForm.main} onChange={(e) => setKpiForm((p) => ({ ...p, main: e.target.value }))} />
              <input className="mx-input" placeholder="Sub KPI" value={kpiForm.sub} onChange={(e) => setKpiForm((p) => ({ ...p, sub: e.target.value }))} />
              <input className="mx-input" placeholder="Team" value={kpiForm.team} onChange={(e) => setKpiForm((p) => ({ ...p, team: e.target.value }))} />
              <input className="mx-input" type="number" placeholder="Days" value={kpiForm.days} onChange={(e) => setKpiForm((p) => ({ ...p, days: e.target.value }))} />
              <input className="mx-input md:col-span-2" type="number" placeholder="Weight" value={kpiForm.main_weight} onChange={(e) => setKpiForm((p) => ({ ...p, main_weight: e.target.value }))} />
            </div>
            <button className="mx-btn mx-btn-soft" onClick={saveKpi}>Save KPI</button>
            <div className="grid md:grid-cols-2 gap-3">
              <input className="mx-input" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value }))} />
              <input className="mx-input" placeholder="Holiday Name" value={holidayForm.name} onChange={(e) => setHolidayForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <button className="mx-btn mx-btn-soft" onClick={saveHoliday}>Save Holiday</button>
            <button className="mx-btn mx-btn-primary" onClick={recalc}>Recalculate Deadlines</button>
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
                <div className="font-bold">{log.action || 'Activity'}</div>
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
            {(adminData?.staff || []).slice(0, 15).map((staff) => (
              <div key={staff.empId} className="mx-data-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{staff.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{staff.empId} • {staff.team} • {staff.role}</div>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeUser(staff.empId)}>Delete</button>
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
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{holiday.holiday_date} • {holiday.is_active ? 'Active' : 'Inactive'}</div>
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

function App() {
  const [user, setUser] = useState(() => parseJsonSafe(localStorage.getItem(SESSION_KEY), null));
  const [view, setView] = useState(() => ROLE_HOME[parseJsonSafe(localStorage.getItem(SESSION_KEY), null)?.role] || 'dashboard');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { state, reloadDashboard, reloadTasks, reloadPeople, reloadAdmin } = useAppData(user, view);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }, [user]);

  const handleLogin = async (empId) => {
    if (!empId?.trim()) {
      setLoginError('กรุณาระบุรหัสพนักงาน');
      return;
    }
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

  const handleStatusChange = async (task, status) => {
    const reason = window.prompt(`ระบุเหตุผลหรือบันทึกสำหรับ "${status}"`, '') || '';
    setActionLoading(true);
    try {
      if (user.role === 'Staff') {
        await API.updateTaskStatus(task.id, task.team, status, reason, 'append');
      } else {
        await API.updateTaskStatusWithLog(task.id, task.team, status, reason, user.name);
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
    if (!window.confirm(`ยืนยันการลบงาน ${task.job}?`)) return;
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

  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError} />;
  }

  const peopleForAssign = state.people?.length ? state.people : state.admin?.staff || [];

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-[1640px] mx-auto grid xl:grid-cols-[320px_1fr] gap-5">
        <Sidebar user={user} view={view} setView={setView} onLogout={logout} />

        <main className="grid gap-5">
          <header className="mx-shell-card rounded-[28px] p-5 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(79,124,255,0.11)] border border-[rgba(138,171,255,0.16)] text-[#c8d6ff] text-[11px] font-extrabold uppercase tracking-[0.16em]">
                  <i className="fa-solid fa-wave-square"></i> MAXIWA KPI
                </div>
                <h1 className="mt-4 mb-0 text-[34px] md:text-[42px] font-extrabold tracking-[-0.06em]">
                  {view === 'dashboard' && (user.role === 'Manager' ? 'Executive Dashboard' : user.role === 'Lead' ? 'Team Command Center' : user.role === 'Admin' ? 'System Control Center' : 'My Work Dashboard')}
                  {view === 'tasks' && 'Task Center'}
                  {view === 'create' && 'Create Task'}
                  {view === 'assign' && 'Assignment Center'}
                  {view === 'people' && 'People Overview'}
                  {view === 'tracker' && 'Job Tracker'}
                  {view === 'admin' && 'Admin Studio'}
                </h1>
                <p className="mt-2 mb-0 text-[var(--mx-muted)]">ระบบใหม่ที่ยกระดับ UX/UI แต่ยังทำงานบน backend และฐานข้อมูลเดิมโดยตรง</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mx-badge mx-status-process"><i className="fa-solid fa-user"></i>{user.role}</span>
                <span className="mx-badge mx-status-completed"><i className="fa-solid fa-building-user"></i>{user.team}</span>
                {state.loading || actionLoading ? <span className="mx-badge mx-status-pending"><i className="fa-solid fa-rotate-right fa-spin"></i>Loading</span> : null}
              </div>
            </div>
            {state.error && <div className="mt-4 text-sm text-[#ffb7b7] font-bold">{state.error}</div>}
          </header>

          {view === 'dashboard' && <DashboardView user={user} data={state.dashboard} />}
          {view === 'tasks' && <TaskCenterView user={user} tasks={state.tasks} onAccept={handleAccept} onStatusChange={handleStatusChange} onDelete={handleDelete} onRefresh={reloadTasks} />}
          {view === 'create' && <QuickCreateView user={user} people={peopleForAssign} onSaved={() => { reloadTasks(); reloadDashboard(); }} />}
          {view === 'assign' && <QuickCreateView user={user} people={peopleForAssign} onSaved={() => { reloadTasks(); reloadDashboard(); reloadPeople(); }} />}
          {view === 'people' && <PeopleView user={user} people={state.people} onRefresh={reloadPeople} />}
          {view === 'tracker' && <TrackerViewNew />}
          {view === 'admin' && <AdminStudio user={user} adminData={state.admin} onRefresh={reloadAdmin} />}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
