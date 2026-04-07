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
    { id: 'personalDashboard', label: 'My Dashboard', icon: 'fa-gauge-high' },
    { id: 'personalTasks', label: 'My Tasks', icon: 'fa-clipboard-check' },
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

const MONTH_OPTIONS = [
  { value: 0, label: 'ทุกเดือน' },
  { value: 1, label: 'ม.ค.' },
  { value: 2, label: 'ก.พ.' },
  { value: 3, label: 'มี.ค.' },
  { value: 4, label: 'เม.ย.' },
  { value: 5, label: 'พ.ค.' },
  { value: 6, label: 'มิ.ย.' },
  { value: 7, label: 'ก.ค.' },
  { value: 8, label: 'ส.ค.' },
  { value: 9, label: 'ก.ย.' },
  { value: 10, label: 'ต.ค.' },
  { value: 11, label: 'พ.ย.' },
  { value: 12, label: 'ธ.ค.' },
];

function getAvailableYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, index) => currentYear - 5 + index);
}

function parseJsonSafe(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseExtraData(extraData) {
  if (!extraData) return null;
  if (typeof extraData === 'string') return parseJsonSafe(extraData, null);
  if (typeof extraData === 'object') return extraData;
  return null;
}

function parseDate(value) {
  if (!value || value === '-') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value) {
  const date = parseDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMonthLabel(month, year) {
  const monthText = MONTH_OPTIONS.find((item) => item.value === Number(month))?.label || 'ทุกเดือน';
  return `${monthText}-${year}`;
}

function getTimestampLabel() {
  const now = new Date();
  return `[${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
}

function isOpenPrSubKpi(subKpi) {
  return String(subKpi || '').toLowerCase().includes('open pr');
}

function getExtraFieldDefinitions(subKpi) {
  const text = String(subKpi || '').toLowerCase();
  const fields = [];
  if (text.includes('ประสานงานอาคาร')) {
    fields.push({ key: 'building', label: 'Building', placeholder: 'อาคาร' });
    fields.push({ key: 'client', label: 'Client', placeholder: 'ลูกค้า' });
    fields.push({ key: 'contractor', label: 'Contractor', placeholder: 'ผู้รับเหมา' });
  }
  if (text.includes('แจ้ง job ให้ผู้รับเหมา')) {
    fields.push({ key: 'contractorName', label: 'Contractor Name', placeholder: 'ชื่อผู้รับเหมา' });
    fields.push({ key: 'contractorType', label: 'Type', type: 'select', options: ['B1', 'C1', 'C2', 'E1'] });
  }
  if (text.includes('open job sap')) {
    fields.push({ key: 'ssrNumber', label: 'SSR Number', placeholder: 'SSR Number' });
  }
  if (text.includes('open job owf')) {
    fields.push({ key: 'ospNumber', label: 'OSP Number', placeholder: 'OSP Number' });
  }
  if (isOpenPrSubKpi(subKpi)) {
    fields.push({ key: 'fundNumber', label: 'Fund Number', placeholder: 'Fund Number' });
    fields.push({ key: 'amount', label: 'Amount', placeholder: 'จำนวนเงิน', type: 'number' });
  }
  return fields;
}

function buildTaskNotifications(tasks) {
  const now = new Date();
  const notifications = [];

  (tasks || []).forEach((task) => {
    const status = String(task.status || '').toLowerCase();
    const deadline = parseDate(task.deadline);

    if (status === 'pending') {
      notifications.push({
        id: `pending-${task.id}`,
        priority: 'high',
        message: `มีงานใหม่รอรับ: ${String(task.job || '').slice(0, 48)}`,
      });
    }

    if (deadline && status !== 'completed' && status !== 'cancelled') {
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      if (daysUntil > 0 && daysUntil <= 3) {
        notifications.push({
          id: `deadline-${task.id}`,
          priority: daysUntil === 1 ? 'urgent' : 'medium',
          message: `ใกล้ถึงกำหนดในอีก ${daysUntil} วัน: ${String(task.job || '').slice(0, 48)}`,
        });
      }
      if (daysUntil <= 0) {
        notifications.push({
          id: `overdue-${task.id}`,
          priority: 'urgent',
          message: `เกินกำหนดแล้ว: ${String(task.job || '').slice(0, 48)}`,
        });
      }
    }
  });

  return notifications;
}

function exportTasksCsv(tasks, userName, selectedMonth, selectedYear) {
  const headers = ['ลำดับ', 'รายละเอียดงาน', 'Main KPI', 'Sub KPI', 'สถานะ', 'วันเริ่มต้น', 'Deadline', 'วันเสร็จ', 'ผล'];
  const escape = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
  const rows = (tasks || []).map((task, index) => {
    const deadline = parseDate(task.deadline);
    const completed = parseDate(task.completiondate);
    const onTime = task.status === 'Completed' && deadline && completed ? completed <= deadline : null;
    return [
      index + 1,
      escape(task.job),
      escape(task.mainkpi),
      escape(task.subkpi),
      escape(task.status),
      escape(formatDisplayDate(task.startdate)),
      escape(formatDisplayDate(task.deadline)),
      escape(formatDisplayDate(task.completiondate)),
      escape(task.status === 'Completed' ? (onTime ? 'ตรงเวลา' : 'เกินกำหนด') : '-'),
    ].join(',');
  });
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tasks_${(userName || 'export').replace(/\s+/g, '_')}_${formatMonthLabel(selectedMonth, selectedYear)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportTrackerCsv(groups, selectedMonth, selectedYear) {
  const escape = (value) => {
    const text = String(value == null ? '' : value);
    return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [[
    'Job Code',
    'ชื่องาน',
    'ผู้รับผิดชอบ',
    'ทีม',
    'Sub KPI',
    'สถานะ',
    'วันเริ่ม',
    'กำหนดเสร็จ',
    'วันเสร็จ',
    'อาคาร',
    'ลูกค้า',
    'ผู้รับเหมา',
    'ชื่อผู้รับเหมา',
    'TYPE',
    'SSR Number',
    'OSP Number',
    'Fund Number',
    'จำนวนเงิน',
  ]];

  (groups || []).forEach((group) => {
    group.tasks.forEach((task) => {
      const ed = parseExtraData(task.extra_data) || {};
      rows.push([
        escape(group.code),
        escape(task.job),
        escape(task.name),
        escape(task.team),
        escape(task.subkpi),
        escape(task.status),
        escape(task.startdate ? formatDisplayDate(task.startdate) : ''),
        escape(task.deadline ? formatDisplayDate(task.deadline) : ''),
        escape(task.completiondate ? formatDisplayDate(task.completiondate) : ''),
        escape(ed.building || ''),
        escape(ed.client || ''),
        escape(ed.contractor || ''),
        escape(ed.contractorName || ''),
        escape(ed.contractorType || ''),
        escape(ed.ssrNumber || ''),
        escape(ed.ospNumber || ''),
        escape(ed.fundNumber || ''),
        escape(ed.amount || ''),
      ]);
    });
  });

  const csv = '\uFEFF' + rows.map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `job-tracker-${selectedYear}${selectedMonth > 0 ? `-${String(selectedMonth).padStart(2, '0')}` : ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizePermissions(permissions) {
  return {
    allowedTeams: Array.isArray(permissions?.allowedTeams) ? permissions.allowedTeams : [],
    allowedStaff: Array.isArray(permissions?.allowedStaff) ? permissions.allowedStaff : [],
  };
}

function getTaskFingerprint(task) {
  return [
    String(task.job || '').trim().toLowerCase(),
    String(task.name || '').trim().toLowerCase(),
    String(task.team || '').trim().toLowerCase(),
    String(task.subkpi || '').trim().toLowerCase(),
  ].join('||');
}

function getStatusClass(status) {
  if (status === 'Completed') return 'mx-status-completed';
  if (status === 'On Process') return 'mx-status-process';
  if (status === 'Pending') return 'mx-status-pending';
  if (status === 'On Hold') return 'mx-status-hold';
  return 'mx-status-cancelled';
}

function extractJobCode(jobStr) {
  if (!jobStr) return 'เนเธกเนเธกเธตเธฃเธซเธฑเธช';
  const match = jobStr.match(/^([A-Za-z]+\d+_\d+)/);
  return match ? match[1].toUpperCase() : jobStr.substring(0, 20);
}

function adminHeaders(empId) {
  return {
    'Content-Type': 'application/json',
    'x-admin-empid': empId || '',
  };
}

function getApiBase() {
  return (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '/api';
}

async function adminGet(path, empId) {
  const res = await fetch(`${getApiBase()}/${path}`, { headers: adminHeaders(empId) });
  return res.json();
}

async function adminPost(path, payload, empId) {
  const res = await fetch(`${getApiBase()}/${path}`, {
    method: 'POST',
    headers: adminHeaders(empId),
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function adminDelete(path, empId) {
  const res = await fetch(`${getApiBase()}/${path}`, {
    method: 'DELETE',
    headers: adminHeaders(empId),
  });
  return res.json();
}

function renderExtraData(extraData) {
  const ed = parseExtraData(extraData) || {};
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

function TaskEditModal({ user, task, onClose, onSaved }) {
  const [form, setForm] = useState({
    job: task?.job || '',
    subkpi: task?.subkpi || '',
    note: task?.note || '',
    mainkpi: task?.mainkpi || '',
    deadline: task?.deadline || '',
    extraData: parseExtraData(task?.extra_data) || {},
  });
  const [kpis, setKpis] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    API.getKPIsByTeam(task.team)
      .then((res) => {
        if (mounted) setKpis(res.kpis || []);
      })
      .catch(() => {
        if (mounted) setKpis([]);
      });
    return () => {
      mounted = false;
    };
  }, [task.team]);

  const handleSubKpiChange = async (subkpi) => {
    if (!subkpi) {
      setForm((prev) => ({ ...prev, subkpi: '', mainkpi: '', deadline: '', extraData: {} }));
      return;
    }
    const matchedKpi = kpis.find((kpi) => kpi.sub === subkpi);
    setForm((prev) => ({ ...prev, subkpi, mainkpi: matchedKpi?.main || prev.mainkpi, deadline: '', extraData: {} }));
    try {
      const preview = await API.calculateDeadlinePreview({
        team: task.team,
        subkpi,
        startDate: task.startdate || new Date().toISOString(),
      });
      setForm((prev) => ({ ...prev, subkpi, mainkpi: preview.mainkpi || matchedKpi?.main || '', deadline: preview.deadline || '', extraData: prev.extraData || {} }));
    } catch {}
  };

  const handleSave = async () => {
    if (!form.job.trim()) return setError('เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธ');
    if (!form.subkpi.trim()) return setError('เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธซเธฃเธทเธญเน€เธฅเธทเธญเธ Sub KPI');

    setSaving(true);
    setError('');
    try {
      const payload = {
        id: task.id,
        team: task.team,
        job: form.job.trim(),
        subkpi: form.subkpi.trim(),
        note: form.note,
        extra_data: form.extraData,
        changedBy: user.name,
      };
      const res = await API.updateTaskDetails(payload);
      if (res.error) throw new Error(res.error);
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message || 'เนเธเนเนเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธเนเธกเนเธชเธณเน€เธฃเนเธ');
    } finally {
      setSaving(false);
    }
  };

  const extraFields = getExtraFieldDefinitions(form.subkpi);

  return (
    <div className="fixed inset-0 bg-[rgba(3,8,14,0.75)] backdrop-blur-md z-[80] flex items-center justify-center p-4">
      <div className="mx-shell-card rounded-[28px] p-6 w-full max-w-[760px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="m-0 text-[26px] font-extrabold tracking-[-0.05em]">Edit Task Details</h3>
            <p className="mt-2 mb-0 text-sm text-[var(--mx-muted)]">เธญเธฑเธเน€เธ”เธ•เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธเธเธเธเธฒเธเธเนเธญเธกเธนเธฅเน€เธ”เธดเธก เธเธฃเนเธญเธก sync KPI เนเธฅเธฐ deadline เนเธซเธกเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด</p>
          </div>
          <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={onClose}>Close</button>
        </div>

        <div className="grid gap-4 mt-6">
          <div>
            <label className="block mb-2 text-sm font-bold">Job Detail</label>
            <textarea className="mx-textarea min-h-[120px]" value={form.job} onChange={(e) => setForm((p) => ({ ...p, job: e.target.value }))} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-bold">Sub KPI</label>
              <input
                list="mx-kpi-options"
                className="mx-input"
                value={form.subkpi}
                onChange={(e) => handleSubKpiChange(e.target.value)}
                placeholder="เน€เธฅเธทเธญเธเธซเธฃเธทเธญเธเธดเธกเธเน Sub KPI"
              />
              <datalist id="mx-kpi-options">
                {kpis.map((kpi) => <option key={`${kpi.team}-${kpi.sub}`} value={kpi.sub}>{kpi.main}</option>)}
              </datalist>
            </div>
            <div>
              <label className="block mb-2 text-sm font-bold">Main KPI</label>
              <input className="mx-input" value={form.mainkpi || ''} disabled />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-bold">Deadline</label>
            <input className="mx-input" value={form.deadline ? `${formatDisplayDate(form.deadline)} 23:59` : ''} disabled />
          </div>

          <div>
            <label className="block mb-2 text-sm font-bold">Current Note</label>
            <textarea className="mx-textarea min-h-[120px]" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </div>

          {extraFields.length > 0 ? (
            <div className="rounded-[18px] p-4 bg-[rgba(255,184,77,0.08)] border border-[rgba(255,184,77,0.18)] grid md:grid-cols-2 gap-3">
              {extraFields.map((field) => (
                <div key={field.key}>
                  <label className="block mb-2 text-sm font-bold">{field.label}</label>
                  {field.type === 'select' ? (
                    <select className="mx-select" value={form.extraData?.[field.key] || ''} onChange={(e) => setForm((prev) => ({ ...prev, extraData: { ...(prev.extraData || {}), [field.key]: e.target.value } }))}>
                      <option value="">เลือก {field.label}</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input className="mx-input" type={field.type || 'text'} value={form.extraData?.[field.key] || ''} onChange={(e) => setForm((prev) => ({ ...prev, extraData: { ...(prev.extraData || {}), [field.key]: e.target.value } }))} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="block mb-2 text-sm font-bold">Extra Data JSON</label>
              <textarea className="mx-textarea min-h-[140px] font-mono text-sm" value={JSON.stringify(form.extraData || {}, null, 2)} onChange={(e) => {
                const parsed = parseJsonSafe(e.target.value, '__invalid__');
                if (parsed !== '__invalid__') setForm((prev) => ({ ...prev, extraData: parsed }));
                else setError('Extra data ต้องเป็น JSON ที่ถูกต้อง');
              }} />
            </div>
          )}
          {error ? <div className="text-sm font-bold text-[#ffb7b7]">{error}</div> : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="mx-btn mx-btn-soft" onClick={onClose}>Cancel</button>
          <button className="mx-btn mx-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
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
        <div className="text-sm text-[var(--mx-muted)]">{user?.role} โ€ข {user?.team}</div>
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
        <div className="mt-2 text-sm text-[var(--mx-muted)]">เธ—เธธเธเธญเธขเนเธฒเธเธ—เธณเธเนเธฒเธเธฃเธฐเธเธเธเธตเน เนเธ”เธขเนเธเน backend เนเธฅเธฐเธเธฒเธเธเนเธญเธกเธนเธฅเน€เธ”เธดเธกเนเธ”เนเธ—เธฑเธเธ—เธต</div>
      </div>

      <button onClick={onLogout} className="mx-btn mx-btn-soft w-full mt-6">
        <i className="fa-solid fa-right-from-bracket mr-2"></i>เธญเธญเธเธเธฒเธเธฃเธฐเธเธ
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
            เธฃเธฐเธเธเนเธซเธกเนเธ—เธตเนเธ”เธนเธ”เธต เนเธเนเธเนเธฒเธข เนเธฅเธฐเธ•เนเธญเธเธญเธเน€เธ”เธดเธกเนเธ”เนเธ—เธฑเธเธ—เธต
          </h1>
          <p className="mt-5 mb-0 text-[15px] leading-8 text-[var(--mx-muted)] max-w-[60ch]">
            MAXIWA KPI เธ–เธนเธเธญเธญเธเนเธเธเนเธซเธกเนเธชเธณเธซเธฃเธฑเธเธเธนเนเธเธฃเธดเธซเธฒเธฃเนเธฅเธฐเธ—เธตเธกเธเธเธดเธเธฑเธ•เธดเธเธฒเธฃเธขเธธเธเนเธซเธกเน เนเธ”เธขเธขเธฑเธเน€เธเธทเนเธญเธกเธ•เนเธญเธเธฑเธเธเธฒเธเธเนเธญเธกเธนเธฅเนเธฅเธฐ backend เน€เธ”เธดเธกเนเธ”เธขเธ•เธฃเธ
            เนเธกเนเธ•เนเธญเธเนเธเนเธซเธฅเธฑเธเธเนเธฒเธ เนเธฅเธฐเนเธกเนเธ•เนเธญเธเนเธซเนเนเธเธฃเนเธเนเธ•เธฐ database เน€เธเธทเนเธญเนเธเนเธเธฒเธเธเธฃเธฐเธเธณเธงเธฑเธ
          </p>
        </div>

        <div className="mx-shell-card rounded-[34px] p-8 md:p-10 flex flex-col justify-center">
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#4f7cff] to-[#22c1a1] grid place-items-center text-2xl font-black shadow-[0_20px_42px_rgba(34,193,161,0.2)]">M</div>
          <h2 className="mt-6 text-[30px] tracking-[-0.05em] font-extrabold mb-0">Sign in to MAXIWA KPI</h2>
          <p className="mt-3 mb-0 text-[var(--mx-muted)]">เธเธฃเธญเธเธฃเธซเธฑเธชเธเธเธฑเธเธเธฒเธเน€เธเธทเนเธญเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธซเธกเน</p>

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
            {loading ? 'เธเธณเธฅเธฑเธเธ•เธฃเธงเธเธชเธญเธเธเนเธญเธกเธนเธฅ...' : 'เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ'}
          </button>
        </div>
      </div>
    </div>
  );
}

function useAppData(user, view, selectedMonth, selectedYear) {
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
      if (user.role === 'Staff' || (user.role === 'Lead' && view === 'personalDashboard')) {
        const res = await API.getEmployeeTasks(user, selectedMonth, selectedYear, false, user.empId);
        safeSet({ dashboard: { tasks: res.tasks || res || [] }, loading: false });
        return;
      }

      if (user.role === 'Lead') {
        const res = await API.getTeamSummaryReport(user.team, selectedMonth, selectedYear, user.empId);
        safeSet({ dashboard: { summary: res.summary || [], period: res.period }, loading: false });
        return;
      }

      if (user.role === 'Manager') {
        const [summaryRes, tasksRes] = await Promise.all([
          API.getSummaryReport(selectedMonth, selectedYear, user.empId),
          API.getAllTasks(selectedMonth, selectedYear, 'all', user.empId),
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
      safeSet({ loading: false, error: e.message || 'เนเธซเธฅเธ” dashboard เนเธกเนเธชเธณเน€เธฃเนเธ' });
    }
  }, [user, view, selectedMonth, selectedYear]);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      if (user.role === 'Staff' || (user.role === 'Lead' && view === 'personalTasks')) {
        const res = await API.getEmployeeTasks(user, selectedMonth, selectedYear, false, user.empId);
        safeSet({ tasks: res.tasks || res || [], loading: false });
        return;
      }
      const team = user.role === 'Lead' ? user.team : 'all';
      const res = await API.getAllTasks(selectedMonth, selectedYear, team, user.empId);
      safeSet({ tasks: res.tasks || [], loading: false });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'เนเธซเธฅเธ” tasks เนเธกเนเธชเธณเน€เธฃเนเธ' });
    }
  }, [user, view, selectedMonth, selectedYear]);

  const loadPeople = useCallback(async () => {
    if (!user) return;
    safeSet({ loading: true, error: '' });
    try {
      let res;
      if (user.role === 'Lead') res = await API.getAllStaffInTeam(user.team, user.empId);
      else res = await API.getAllStaff(user.empId);
      safeSet({ people: res.staff || [], loading: false });
    } catch (e) {
      safeSet({ loading: false, error: e.message || 'เนเธซเธฅเธ”เธฃเธฒเธขเธเธทเนเธญเนเธกเนเธชเธณเน€เธฃเนเธ' });
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
      safeSet({ loading: false, error: e.message || 'เนเธซเธฅเธ” admin data เนเธกเนเธชเธณเน€เธฃเนเธ' });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (view === 'dashboard') loadDashboard();
    if (view === 'personalDashboard') loadDashboard();
    if (view === 'tasks') loadTasks();
    if (view === 'personalTasks') loadTasks();
    if (view === 'people') loadPeople();
    if (view === 'assign') loadPeople();
    if (view === 'admin') loadAdmin();
  }, [user, view, loadDashboard, loadTasks, loadPeople, loadAdmin]);

  return { state, reloadDashboard: loadDashboard, reloadTasks: loadTasks, reloadPeople: loadPeople, reloadAdmin: loadAdmin };
}

function DashboardView({ user, data, view }) {
  if (!data) {
    return <Panel title="Executive Overview" subtitle="เธเธณเธฅเธฑเธเน€เธ•เธฃเธตเธขเธกเธเนเธญเธกเธนเธฅเนเธซเนเธเธธเธ“..."><div className="text-[var(--mx-muted)]">Loading dashboard...</div></Panel>;
  }

  if (user.role === 'Staff' || (user.role === 'Lead' && view === 'personalDashboard')) {
    const tasks = data.tasks || [];
    const completed = tasks.filter((t) => t.status === 'Completed').length;
    const active = tasks.filter((t) => ['On Process', 'Pending', 'On Hold'].includes(t.status)).length;
    const soon = tasks.filter((t) => t.deadline && ['On Process', 'Pending', 'On Hold'].includes(t.status)).slice(0, 5);
    return (
      <div className="grid gap-5">
        <div className="mx-grid-auto">
          <MetricCard label="My Tasks" value={tasks.length} sub="เธฃเธฒเธขเธเธฒเธฃเธเธฒเธเนเธเน€เธ”เธทเธญเธเธเธตเน" icon="fa-list-check" />
          <MetricCard label="Active" value={active} sub="เธเธฒเธเธ—เธตเนเธขเธฑเธเธ•เนเธญเธเธ•เธดเธ”เธ•เธฒเธก" icon="fa-bolt" accent="var(--mx-teal)" />
          <MetricCard label="Completed" value={completed} sub="เธเธฒเธเธ—เธตเนเธเธดเธ”เนเธฅเนเธง" icon="fa-check-double" accent="var(--mx-green)" />
        </div>
        <Panel title="Priority for Today" subtitle="เธเธฒเธเธ—เธตเนเธเธงเธฃเธ•เธฒเธกเธเนเธญเธเนเธเธกเธธเธกเธเธนเนเธเธเธดเธเธฑเธ•เธดเธเธฒเธ">
          <div className="grid gap-3">
            {soon.length === 0 && <div className="text-sm text-[var(--mx-muted)]">เนเธกเนเธกเธตเธเธฒเธเน€เธฃเนเธเธ”เนเธงเธเนเธเธเนเธงเธเธเธตเน</div>}
            {soon.map((task) => (
              <div key={task.id} className="mx-data-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{task.job}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{task.subkpi || 'เนเธกเนเธฃเธฐเธเธธ Sub KPI'} โ€ข Due {formatDate(task.deadline)}</div>
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
          <MetricCard label="Team Members" value={summary.length} sub="เธเธณเธฅเธฑเธเนเธชเธ”เธเธ•เธฒเธกเธชเธดเธ—เธเธดเนเธเธญเธ Lead" icon="fa-users" />
          <MetricCard label="Avg SLA" value={`${avgSla}%`} sub="เธเนเธฒเน€เธเธฅเธตเนเธข weighted SLA score" icon="fa-chart-line" accent="var(--mx-teal)" />
          <MetricCard label="Period" value={data.period || '-'} sub="เธเนเธงเธเน€เธงเธฅเธฒเธ—เธตเนเธเธณเธฅเธฑเธเธ”เธน" icon="fa-calendar-days" accent="var(--mx-amber)" />
        </div>
        <Panel title="Team Performance Pulse" subtitle="เธ เธฒเธเธฃเธงเธกเธ—เธตเธกเนเธเธซเธเนเธฒเธ—เธตเนเธญเนเธฒเธเธเนเธฒเธขเธเธถเนเธ">
          <div className="grid gap-3">
            {summary.map((person) => (
              <div key={person.empId || person.name} className="mx-data-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{person.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team} โ€ข Total {person.totalTasks} โ€ข Completed {person.completedTasks}</div>
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
          <MetricCard label="Active Tasks" value={tasks.length} sub="เนเธซเธฅเธ”เธเธฒเธเธฃเธฐเธเธเน€เธ”เธดเธกเนเธเธเธ•เธฃเธ เน" icon="fa-briefcase" />
          <MetricCard label="Risk Queue" value={risky} sub="Pending / On Hold เธ•เนเธญเธเธ•เธดเธ”เธ•เธฒเธก" icon="fa-triangle-exclamation" accent="var(--mx-amber)" />
          <MetricCard label="Avg SLA" value={`${avgSla}%`} sub="weighted SLA across visible staff" icon="fa-chart-line" accent="var(--mx-teal)" />
          <MetricCard label="People" value={summary.length} sub="เธเธณเธเธงเธเธเธเนเธเธกเธธเธกเธเธนเนเธเธฑเธ”เธเธฒเธฃ" icon="fa-users-viewfinder" accent="var(--mx-blue)" />
        </div>
        <Panel title="Executive Scoreboard" subtitle="เธเธนเนเธเธฃเธดเธซเธฒเธฃเน€เธซเนเธเธเธฐเนเธเธ, เธเธฃเธดเธกเธฒเธ“เธเธฒเธ, เนเธฅเธฐเธเธธเธ”เธ—เธตเนเธเธงเธฃ intervene เธ—เธฑเธเธ—เธต">
          <div className="grid md:grid-cols-2 gap-3">
            {topPeople.map((person) => (
              <div key={person.empId || person.name} className="mx-data-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{person.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team} โ€ข Total {person.totalTasks}</div>
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
        <MetricCard label="Tasks" value={tasks.length} sub="เธเนเธญเธกเธนเธฅเธฃเธงเธกเธเธฒเธเธฃเธฐเธเธเน€เธ”เธดเธก" icon="fa-briefcase" />
        <MetricCard label="Users" value={staff.length} sub="เธเธนเนเนเธเนเธเธฒเธเนเธเธฃเธฐเธเธ" icon="fa-users" accent="var(--mx-teal)" />
        <MetricCard label="KPI Items" value={kpis.length} sub="เธฃเธฒเธขเธเธฒเธฃ KPI เธเธฑเธเธเธธเธเธฑเธ" icon="fa-sliders" accent="var(--mx-amber)" />
      </div>
      <Panel title="System Overview" subtitle="เธ เธฒเธเธฃเธงเธกเธชเธณเธซเธฃเธฑเธเธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธเนเธ shell เนเธซเธกเน">
        <div className="text-sm text-[var(--mx-muted)]">
          MAXIWA KPI เนเธเน backend เน€เธ”เธดเธกเนเธฅเธฐเธเธฒเธเธเนเธญเธกเธนเธฅเน€เธ”เธดเธกเนเธ”เธขเธ•เธฃเธ เนเธ•เนเน€เธเธฅเธตเนเธขเธเธเธฃเธฐเธชเธเธเธฒเธฃเธ“เนเธเธฒเธฃเนเธเนเธเธฒเธเนเธซเนเธเธฑเธ”เน€เธเธเนเธฅเธฐเน€เธเนเธเธฃเธฐเธเธเธกเธฒเธเธเธถเนเธ
        </div>
      </Panel>
    </div>
  );
}

function TaskCenterView({ user, tasks, onAccept, onStatusChange, onDelete, onRefresh, onEdit }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const teams = useMemo(() => [...new Set((tasks || []).map((task) => task.team).filter(Boolean))].sort(), [tasks]);
  const duplicateCounts = useMemo(() => {
    const counts = {};
    (tasks || []).forEach((task) => {
      const key = getTaskFingerprint(task);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const filtered = useMemo(() => {
    return (tasks || []).filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (teamFilter !== 'all' && task.team !== teamFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [task.job, task.name, task.team, task.subkpi, task.status].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [tasks, statusFilter, teamFilter, search]);

  const taskSummary = useMemo(() => ({
    total: (tasks || []).length,
    active: (tasks || []).filter((t) => ['On Process', 'Pending', 'On Hold'].includes(t.status)).length,
    completed: (tasks || []).filter((t) => t.status === 'Completed').length,
    risk: (tasks || []).filter((t) => ['Pending', 'On Hold'].includes(t.status)).length,
    duplicates: Object.values(duplicateCounts).filter((count) => count > 1).reduce((sum, count) => sum + count, 0),
  }), [tasks, duplicateCounts]);

  return (
    <div className="grid gap-5">
      <div className="mx-grid-auto">
        <MetricCard label="Total Tasks" value={taskSummary.total} sub="เธ—เธฑเนเธเธซเธกเธ”เนเธเธกเธธเธกเธกเธญเธเธเธตเน" icon="fa-list-check" />
        <MetricCard label="Active" value={taskSummary.active} sub="เธเธฒเธเธ—เธตเนเธขเธฑเธเธ•เนเธญเธเธเธฑเธเน€เธเธฅเธทเนเธญเธ" icon="fa-bolt" accent="var(--mx-teal)" />
        <MetricCard label="Completed" value={taskSummary.completed} sub="เธเธฒเธเธ—เธตเนเธเธดเธ”เนเธฅเนเธง" icon="fa-check-double" accent="var(--mx-green)" />
        <MetricCard label="Need Attention" value={taskSummary.risk} sub="Pending / On Hold" icon="fa-triangle-exclamation" accent="var(--mx-amber)" />
        <MetricCard label="Duplicate Signals" value={taskSummary.duplicates} sub="fingerprint เธเนเธณเนเธเธเธธเธ”เธเนเธญเธกเธนเธฅเธเธตเน" icon="fa-clone" accent="var(--mx-blue)" />
      </div>
      <Panel
        title="Task Center"
        subtitle="เธกเธธเธกเธกเธญเธเธเธฒเธเนเธเธเนเธซเธกเนเธ—เธตเนเธญเนเธฒเธเน€เธฃเนเธงเนเธฅเธฐเธเธฑเธ”เธเธฒเธฃเธเนเธฒเธขเธเธงเนเธฒเน€เธ”เธดเธก"
        actions={[<button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh}><i className="fa-solid fa-rotate-right mr-2"></i>Refresh</button>]}
      >
        <div className="grid md:grid-cols-[1fr_220px_220px] gap-3 mb-5">
          <input className="mx-input" placeholder="เธเนเธเธซเธฒ job / เธเธ / team / status" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="mx-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">เธ—เธธเธเธชเธ–เธฒเธเธฐ</option>
            <option value="Pending">Pending</option>
            <option value="On Process">On Process</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select className="mx-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">เธ—เธธเธเธ—เธตเธก</option>
            {teams.map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
        </div>
        <div className="grid gap-3">
          {filtered.length === 0 && <div className="text-sm text-[var(--mx-muted)]">เนเธกเนเธเธเธฃเธฒเธขเธเธฒเธฃเธเธฒเธ</div>}
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
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">{task.name || '-'} โ€ข {task.team || '-'} โ€ข {task.subkpi || 'เนเธกเนเธฃเธฐเธเธธ Sub KPI'}</div>
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">Start {formatDate(task.startdate)} โ€ข Deadline {formatDate(task.deadline)} โ€ข Complete {formatDate(task.completiondate)}</div>
                  {expandedTaskId === task.id && (
                    <div className="mt-4 rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="text-sm text-[var(--mx-muted)]">Task ID: {task.id}</div>
                      {task.note ? <div className="mt-3 text-sm leading-7 whitespace-pre-wrap">{task.note}</div> : <div className="mt-3 text-sm text-[var(--mx-muted)]">เนเธกเนเธกเธต note</div>}
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
      setError('เธเธฃเธธเธ“เธฒเธเนเธเธซเธฒเธญเธขเนเธฒเธเธเนเธญเธข 3 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ');
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
      setError(e.message || 'เธเนเธเธซเธฒเนเธกเนเธชเธณเน€เธฃเนเธ');
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
      <Panel title="Job Tracker" subtitle="เนเธขเธเนเธซเนเธเธฑเธ”เธงเนเธฒ Job เธซเธเธถเนเธเธญเธฒเธเธกเธตเธซเธฅเธฒเธข Task เธขเนเธญเธข">
        <div className="grid md:grid-cols-[1fr_180px] gap-3 mb-5">
          <input className="mx-input" placeholder="เธเนเธเธซเธฒ job code เธซเธฃเธทเธญเธเธทเนเธญเธเธฒเธ" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <button className="mx-btn mx-btn-primary" onClick={handleSearch} disabled={loading}>{loading ? 'เธเธณเธฅเธฑเธเธเนเธเธซเธฒ...' : 'Search'}</button>
        </div>
        {error && <div className="mb-4 text-sm text-[#ffb7b7] font-bold">{error}</div>}
        <div className="grid gap-4">
          {grouped.length === 0 && <div className="text-sm text-[var(--mx-muted)]">เธขเธฑเธเนเธกเนเธกเธตเธเธฅเธเธฒเธฃเธเนเธเธซเธฒ</div>}
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
                          <div className="font-bold">Task {idx + 1} โ€ข {task.name || '-'}</div>
                          <div className="mt-2 text-sm text-[var(--mx-muted)]">{task.team || '-'} โ€ข {task.subkpi || 'เนเธกเนเธฃเธฐเธเธธ Sub KPI'} โ€ข Start {formatDate(task.startdate)}</div>
                          <div className="mt-1 text-sm text-[var(--mx-muted)]">Deadline {formatDate(task.deadline)} โ€ข Completed {formatDate(task.completiondate)}</div>
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
                          {task.note ? <div className="text-sm leading-7 whitespace-pre-wrap">{task.note}</div> : <div className="text-sm text-[var(--mx-muted)]">เนเธกเนเธกเธต note เธเธญเธ task เธเธตเน</div>}
                          {renderExtraData(task.extra_data)}
                          <div className="mt-4">
                            <div className="text-sm font-bold">Audit Timeline</div>
                            <div className="mt-3 grid gap-3">
                              {(logsByTask[task.id] || []).length === 0 && <div className="text-sm text-[var(--mx-muted)]">เธขเธฑเธเนเธกเนเธกเธต audit log</div>}
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
    mainkpi: '',
    deadline: '',
    extra_data: {},
    assignedToName: '',
    assignedToTeam: user?.team || '',
  });
  const [saving, setSaving] = useState(false);
  const [availableKpis, setAvailableKpis] = useState(user?.kpis || []);
  const isStaff = user.role === 'Staff';
  const selectedTeam = isStaff ? user.team : form.assignedToTeam;

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      assignedToName: isStaff ? user.name : prev.assignedToName,
      assignedToTeam: isStaff ? user.team : (prev.assignedToTeam || user.team),
    }));
  }, [user, isStaff]);

  useEffect(() => {
    if (isStaff) {
      setAvailableKpis(user?.kpis || []);
      return;
    }
    if (!selectedTeam) {
      setAvailableKpis([]);
      return;
    }
    let active = true;
    API.getKPIsByTeam(selectedTeam)
      .then((res) => {
        if (active) setAvailableKpis(res.kpis || []);
      })
      .catch(() => {
        if (active) setAvailableKpis([]);
      });
    return () => {
      active = false;
    };
  }, [isStaff, selectedTeam, user]);

  const handleSubKpiChange = async (subkpi) => {
    if (!subkpi) {
      setForm((prev) => ({ ...prev, subkpi: '', mainkpi: '', deadline: '', extra_data: {} }));
      return;
    }
    const matchedKpi = availableKpis.find((kpi) => kpi.sub === subkpi);
    setForm((prev) => ({
      ...prev,
      subkpi,
      mainkpi: matchedKpi?.main || '',
      deadline: '',
      extra_data: {},
    }));
    if (!selectedTeam) return;
    try {
      const preview = await API.calculateDeadlinePreview({
        team: selectedTeam,
        subkpi,
        startDate: new Date().toISOString(),
      });
      setForm((prev) => ({
        ...prev,
        subkpi,
        mainkpi: preview.mainkpi || matchedKpi?.main || '',
        deadline: preview.deadline || '',
        extra_data: prev.subkpi === subkpi ? prev.extra_data : {},
      }));
    } catch {}
  };

  const handleSave = async () => {
    if (!form.job.trim()) return alert('เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธ job');
    if (!form.subkpi.trim()) return alert('เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธ Sub KPI');
    setSaving(true);
    try {
      if (isStaff) {
        await API.saveNewTask({
          name: user.name,
          team: user.team,
          job: form.job,
          subkpi: form.subkpi,
          note: form.note,
          extra_data: form.extra_data,
        });
      } else {
        if (!form.assignedToName.trim()) return alert('เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธนเนเธฃเธฑเธเธเธดเธ”เธเธญเธ');
        await API.assignNewTask({
          assignedToName: form.assignedToName,
          assignedToTeam: form.assignedToTeam || user.team,
          job: form.job,
          subkpi: form.subkpi,
          note: form.note,
          extra_data: form.extra_data,
        });
      }
      setForm({
        job: '',
        note: '',
        subkpi: '',
        mainkpi: '',
        deadline: '',
        extra_data: {},
        assignedToName: isStaff ? user.name : '',
        assignedToTeam: isStaff ? user.team : user.team,
      });
      onSaved?.();
      alert('เธเธฑเธเธ—เธถเธเธเธฒเธเน€เธฃเธตเธขเธเธฃเนเธญเธข');
    } catch (e) {
      alert(e.message || 'เธเธฑเธเธ—เธถเธเนเธกเนเธชเธณเน€เธฃเนเธ');
    } finally {
      setSaving(false);
    }
  };

  const extraFields = getExtraFieldDefinitions(form.subkpi);

  return (
    <Panel title={isStaff ? 'Create Personal Task' : 'Assign Task'} subtitle={isStaff ? 'เธชเธฃเนเธฒเธเธเธฒเธเธเธญเธเธ•เธฑเธงเน€เธญเธเธเธฒเธ shell เนเธซเธกเน' : 'เธกเธญเธเธซเธกเธฒเธขเธเธฒเธเธเนเธฒเธเธฃเธฐเธเธเนเธซเธกเน เนเธ”เธขเธขเธฑเธเนเธเน API เน€เธ”เธดเธก'}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block mb-2 text-sm font-bold">Job</label>
          <textarea className="mx-textarea min-h-[110px]" value={form.job} onChange={(e) => setForm((p) => ({ ...p, job: e.target.value }))} placeholder="เธฃเธฐเธเธธ job เธซเธฃเธทเธญเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฒเธ"></textarea>
        </div>
        <div>
          <label className="block mb-2 text-sm font-bold">Sub KPI</label>
          <select className="mx-select" value={form.subkpi} onChange={(e) => handleSubKpiChange(e.target.value)}>
            <option value="">เลือก Sub KPI</option>
            {availableKpis.map((kpi) => <option key={`${kpi.team}-${kpi.sub}`} value={kpi.sub}>{kpi.sub} ({kpi.main})</option>)}
          </select>
        </div>
        {!isStaff && (
          <>
            <div>
              <label className="block mb-2 text-sm font-bold">Assigned To</label>
              <select className="mx-select" value={form.assignedToName} onChange={(e) => {
                const person = (people || []).find((p) => p.name === e.target.value);
                setForm((prev) => ({ ...prev, assignedToName: e.target.value, assignedToTeam: person?.team || prev.assignedToTeam }));
              }}>
                <option value="">เน€เธฅเธทเธญเธเธเธนเนเธฃเธฑเธเธเธดเธ”เธเธญเธ</option>
                {(people || []).map((person) => <option key={`${person.empId}-${person.name}`} value={person.name}>{person.name} ({person.team})</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-bold">Team</label>
              <input className="mx-input" value={form.assignedToTeam} onChange={(e) => setForm((p) => ({ ...p, assignedToTeam: e.target.value }))} />
            </div>
          </>
        )}
        <div>
          <label className="block mb-2 text-sm font-bold">Main KPI</label>
          <div className="mx-input !bg-[rgba(255,255,255,0.02)]">{form.mainkpi || 'เลือก Sub KPI ก่อน'}</div>
        </div>
        <div>
          <label className="block mb-2 text-sm font-bold">Deadline</label>
          <div className="mx-input !bg-[rgba(255,255,255,0.02)]">{form.deadline ? `${formatDisplayDate(form.deadline)} 23:59` : 'รอคำนวณจาก KPI'}</div>
        </div>
        {extraFields.length > 0 ? (
          <div className="md:col-span-2 rounded-[18px] p-4 bg-[rgba(255,184,77,0.08)] border border-[rgba(255,184,77,0.18)] grid md:grid-cols-2 gap-3">
            {extraFields.map((field) => (
              <div key={field.key} className={field.type === 'select' ? '' : ''}>
                <label className="block mb-2 text-sm font-bold">{field.label}</label>
                {field.type === 'select' ? (
                  <select className="mx-select" value={form.extra_data?.[field.key] || ''} onChange={(e) => setForm((prev) => ({ ...prev, extra_data: { ...(prev.extra_data || {}), [field.key]: e.target.value } }))}>
                    <option value="">เลือก {field.label}</option>
                    {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input
                    className="mx-input"
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={form.extra_data?.[field.key] || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, extra_data: { ...(prev.extra_data || {}), [field.key]: e.target.value } }))}
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}
        <div className="md:col-span-2">
          <label className="block mb-2 text-sm font-bold">Note</label>
          <textarea className="mx-textarea min-h-[100px]" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="หมายเหตุเพิ่มเติม"></textarea>
        </div>
      </div>
      <div className="mt-5">
        <button className="mx-btn mx-btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'เธเธณเธฅเธฑเธเธเธฑเธเธ—เธถเธ...' : isStaff ? 'Create Task' : 'Assign Task'}</button>
      </div>
    </Panel>
  );
}

function PeopleView({ user, people, onRefresh }) {
  return (
    <Panel title={user.role === 'Lead' ? 'Team People' : 'People Directory'} subtitle="เธฃเธฒเธขเธเธทเนเธญเธ—เธตเนเธกเธญเธเน€เธซเนเธเนเธ”เนเธ•เธฒเธกเธชเธดเธ—เธเธดเนเน€เธ”เธดเธก เนเธ•เนเนเธชเธ”เธเนเธเนเธเธฃเธเนเธซเธกเนเธ—เธตเนเธญเนเธฒเธเธเนเธฒเธขเธเธงเนเธฒ" actions={[<button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh}>Refresh</button>]}>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(people || []).map((person) => (
          <div key={`${person.empId}-${person.name}`} className="mx-data-card">
            <div className="font-bold">{person.name}</div>
            <div className="mt-1 text-sm text-[var(--mx-muted)]">{person.team} โ€ข {person.role}</div>
            <div className="mt-3 text-xs text-[var(--mx-muted)]">Emp ID: {person.empId}</div>
          </div>
        ))}
        {(!people || people.length === 0) && <div className="text-sm text-[var(--mx-muted)]">เนเธกเนเธเธเธฃเธฒเธขเธเธทเนเธญ</div>}
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
    alert('เธเธฑเธเธ—เธถเธ user เธชเธณเน€เธฃเนเธ');
  };

  const saveTeam = async () => {
    const res = await adminPost('admin/saveTeam', { name: teamName }, user.empId);
    if (res.error) return alert(res.error);
    setTeamName('');
    onRefresh();
    alert('เธเธฑเธเธ—เธถเธเธ—เธตเธกเธชเธณเน€เธฃเนเธ');
  };

  const saveKpi = async () => {
    const res = await adminPost('admin/saveKpi', { ...kpiForm, days: Number(kpiForm.days), main_weight: Number(kpiForm.main_weight) }, user.empId);
    if (res.error) return alert(res.error);
    setKpiForm({ main: '', sub: '', team: '', days: 1, main_weight: 1 });
    alert('เธเธฑเธเธ—เธถเธ KPI เธชเธณเน€เธฃเนเธ');
  };

  const saveHoliday = async () => {
    const res = await adminPost('admin/saveHoliday', holidayForm, user.empId);
    if (res.error) return alert(res.error);
    setHolidayForm({ holiday_date: '', name: '', is_active: true });
    onRefresh();
    alert('เธเธฑเธเธ—เธถเธเธงเธฑเธเธซเธขเธธเธ”เธชเธณเน€เธฃเนเธ');
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
      <Panel title="Admin Studio" subtitle="เธเธฑเธ”เธเธฒเธฃเธ—เธธเธเธญเธขเนเธฒเธเธเนเธฒเธเธฃเธฐเธเธเนเธซเธกเน เนเธ”เธขเนเธกเนเธ•เนเธญเธเนเธ•เธฐ database">
        <div className="mx-grid-auto">
          <MetricCard label="Users" value={adminData?.staff?.length || 0} sub="เธเธนเนเนเธเนเธเธฒเธเนเธเธฃเธฐเธเธ" icon="fa-users" />
          <MetricCard label="Teams" value={adminData?.teams?.length || 0} sub="เธ—เธตเธกเธ—เธตเนเธเธฑเธเธ—เธถเธเนเธงเน" icon="fa-people-group" accent="var(--mx-teal)" />
          <MetricCard label="Holidays" value={adminData?.holidays?.length || 0} sub="เธงเธฑเธเธซเธขเธธเธ”เนเธเธเธเธดเธ—เธดเธ SLA" icon="fa-calendar-days" accent="var(--mx-amber)" />
          <MetricCard label="Audit Logs" value={adminData?.logs?.length || 0} sub="log เธฅเนเธฒเธชเธธเธ”เนเธเธฃเธฐเธเธ" icon="fa-shield-halved" accent="var(--mx-blue)" />
        </div>
      </Panel>

      <div className="grid xl:grid-cols-2 gap-5">
        <Panel title="Create User" subtitle="เธเธฑเธ”เธเธฒเธฃเธเธนเนเนเธเนเธเธฒเธเธ เธฒเธขเนเธเธฃเธฐเธเธ">
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

        <Panel title="Organization Controls" subtitle="เธ—เธตเธก, KPI, เธงเธฑเธเธซเธขเธธเธ” เนเธฅเธฐเธเธฒเธฃ recalculate">
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
        <Panel title="Teams" subtitle="เธฃเธฒเธขเธเธฒเธฃเธ—เธตเธกเธเธฒเธเธฃเธฐเธเธเน€เธ”เธดเธก">
          <div className="grid gap-3">
            {(adminData?.teams || []).map((team) => (
              <div key={team.id || team.name} className="mx-data-card flex items-center justify-between gap-3">
                <div className="font-bold">{team.name}</div>
                <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeTeam(team.id)}>Delete</button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Latest Audit Logs" subtitle="เธ”เธนเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเน€เธเธฅเธตเนเธขเธเนเธเธฅเธเนเธ”เธขเนเธกเนเธ•เนเธญเธเน€เธเนเธฒ backend">
          <div className="grid gap-3">
            {(adminData?.logs || []).slice(0, 12).map((log) => (
              <div key={log.id} className="mx-data-card">
                <div className="font-bold">{log.action || 'Activity'}</div>
                <div className="mt-2 text-sm text-[var(--mx-muted)]">{log.details || '-'}</div>
                <div className="mt-2 text-xs text-[var(--mx-muted)]">{log.by_user || '-'} โ€ข {formatDate(log.timestamp, true)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        <Panel title="Users" subtitle="เธเธฑเธ”เธเธฒเธฃเธเธนเนเนเธเนเธเธฒเธเธเธฒเธเธฃเธฐเธเธเนเธซเธกเน">
          <div className="grid gap-3">
            {(adminData?.staff || []).slice(0, 15).map((staff) => (
              <div key={staff.empId} className="mx-data-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{staff.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{staff.empId} โ€ข {staff.team} โ€ข {staff.role}</div>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeUser(staff.empId)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="KPI Catalog" subtitle="เน€เธซเนเธเนเธฅเธฐเธฅเธ KPI เนเธ”เนเธเธฒเธเนเธเธฃเธฐเธเธ">
          <div className="grid gap-3">
            {(adminData?.kpis || []).slice(0, 15).map((kpi) => (
              <div key={kpi.id} className="mx-data-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{kpi.main} / {kpi.sub}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{kpi.team} โ€ข {kpi.days} day(s) โ€ข weight {kpi.main_weight}</div>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeKpi(kpi.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Holiday Calendar" subtitle="เธ”เธนเนเธฅเธฐเธฅเธเธงเธฑเธเธซเธขเธธเธ”เนเธ”เธขเนเธกเนเธญเธญเธเธเธฒเธเธฃเธฐเธเธ">
          <div className="grid gap-3">
            {(adminData?.holidays || []).slice(0, 15).map((holiday) => (
              <div key={holiday.id} className="mx-data-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{holiday.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{holiday.holiday_date} โ€ข {holiday.is_active ? 'Active' : 'Inactive'}</div>
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

function TaskCenterPro({ user, tasks, onAccept, onStatusChange, onDelete, onRefresh, onEdit, onOpenStatusModal, onOpenNoteModal }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const teams = useMemo(() => [...new Set((tasks || []).map((task) => task.team).filter(Boolean))].sort(), [tasks]);
  const duplicateCounts = useMemo(() => {
    const counts = {};
    (tasks || []).forEach((task) => {
      const key = getTaskFingerprint(task);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const filtered = useMemo(() => {
    return (tasks || []).filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (teamFilter !== 'all' && task.team !== teamFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [task.job, task.name, task.team, task.subkpi, task.status].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [tasks, search, statusFilter, teamFilter]);

  const taskSummary = useMemo(() => ({
    total: (tasks || []).length,
    active: (tasks || []).filter((task) => ['On Process', 'Pending', 'On Hold'].includes(task.status)).length,
    completed: (tasks || []).filter((task) => task.status === 'Completed').length,
    risk: (tasks || []).filter((task) => ['Pending', 'On Hold'].includes(task.status)).length,
    duplicates: Object.values(duplicateCounts).filter((count) => count > 1).reduce((sum, count) => sum + count, 0),
  }), [tasks, duplicateCounts]);

  return (
    <div className="grid gap-5">
      <div className="mx-grid-auto">
        <MetricCard label="Total Tasks" value={taskSummary.total} sub="visible in this workspace" icon="fa-list-check" />
        <MetricCard label="Active" value={taskSummary.active} sub="still moving" icon="fa-bolt" accent="var(--mx-teal)" />
        <MetricCard label="Completed" value={taskSummary.completed} sub="closed successfully" icon="fa-check-double" accent="var(--mx-green)" />
        <MetricCard label="Need Attention" value={taskSummary.risk} sub="Pending / On Hold" icon="fa-triangle-exclamation" accent="var(--mx-amber)" />
        <MetricCard label="Duplicate Signals" value={taskSummary.duplicates} sub="same task fingerprint repeated" icon="fa-clone" accent="var(--mx-blue)" />
      </div>
      <Panel
        title="Task Center"
        subtitle="A faster control surface for search, triage, edit, and status updates"
        actions={[<button key="refresh" className="mx-btn mx-btn-soft" onClick={onRefresh}><i className="fa-solid fa-rotate-right mr-2"></i>Refresh</button>]}
      >
        <div className="grid md:grid-cols-[1fr_220px_220px] gap-3 mb-5">
          <input className="mx-input" placeholder="Search by job, person, team, sub KPI, or status" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="mx-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="On Process">On Process</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select className="mx-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="all">All Teams</option>
            {teams.map((team) => <option key={team} value={team}>{team}</option>)}
          </select>
        </div>
        <div className="grid gap-3">
          {filtered.length === 0 && <div className="text-sm text-[var(--mx-muted)]">No tasks found for the current filters.</div>}
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
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">{task.name || '-'} | {task.team || '-'} | {task.subkpi || 'No Sub KPI'}</div>
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">Start {formatDate(task.startdate)} | Deadline {formatDate(task.deadline)} | Complete {formatDate(task.completiondate)}</div>
                  {duplicateCounts[getTaskFingerprint(task)] > 1 ? <div className="mt-2 text-xs font-bold text-[#c8d6ff]">Duplicate signal detected for this task fingerprint. It may be a valid child task or a repeated record.</div> : null}
                  {expandedTaskId === task.id ? (
                    <div className="mt-4 rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="text-sm text-[var(--mx-muted)]">Task ID: {task.id}</div>
                      {task.note ? <div className="mt-3 text-sm leading-7 whitespace-pre-wrap">{task.note}</div> : <div className="mt-3 text-sm text-[var(--mx-muted)]">No note on this task.</div>}
                      {renderExtraData(task.extra_data)}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.role === 'Staff' && task.status === 'Pending' ? <button className="mx-btn mx-btn-primary" onClick={() => onAccept(task)}>Accept</button> : null}
                  <button className="mx-btn mx-btn-soft" onClick={() => onEdit(task)}>Edit</button>
                  {task.status !== 'Completed' ? <button className="mx-btn mx-btn-soft" onClick={() => onOpenNoteModal(task)}>Add Note</button> : null}
                  {task.status === 'Pending' ? <button className="mx-btn mx-btn-soft" onClick={() => onOpenStatusModal(task, 'On Process')}>On Process</button> : null}
                  {task.status === 'On Process' ? <button className="mx-btn mx-btn-soft" onClick={() => onOpenStatusModal(task, 'Completed')}>Completed</button> : null}
                  {task.status === 'On Process' ? <button className="mx-btn mx-btn-soft" onClick={() => onOpenStatusModal(task, 'On Hold')}>On Hold</button> : null}
                  {task.status === 'On Hold' ? <button className="mx-btn mx-btn-soft" onClick={() => onOpenStatusModal(task, 'On Process')}>Resume</button> : null}
                  {task.status !== 'Completed' && task.status !== 'Cancelled' ? <button className="mx-btn mx-btn-soft" onClick={() => onOpenStatusModal(task, 'Cancelled')}>Cancel</button> : null}
                  {(user.role === 'Manager' || user.role === 'Admin') ? <button className="mx-btn mx-btn-soft" onClick={() => onDelete(task)}>Delete</button> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TrackerViewPro({ user, selectedMonth, selectedYear }) {
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [expandedJob, setExpandedJob] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [logsByTask, setLogsByTask] = useState({});

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.getAllTasks(selectedMonth, selectedYear, 'all', user?.empId);
      const tasks = res.tasks || [];
      setItems(tasks);
      setExpandedJob(null);
      setExpandedTaskId(null);
    } catch (e) {
      setError(e.message || 'โหลด Job Tracker ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, user]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const grouped = useMemo(() => {
    const groups = {};
    const query = filterText.trim().toLowerCase();
    const filteredItems = query
      ? items.filter((task) =>
        [task.job, task.name, task.team, task.subkpi, task.status]
          .some((value) => String(value || '').toLowerCase().includes(query)))
      : items;

    filteredItems.forEach((task) => {
      const code = extractJobCode(task.job);
      if (!groups[code]) groups[code] = [];
      groups[code].push(task);
    });

    return Object.entries(groups).map(([code, tasks]) => {
      const ordered = [...tasks].sort((a, b) => new Date(a.startdate || 0) - new Date(b.startdate || 0));
      const owners = [...new Set(ordered.map((task) => task.name).filter(Boolean))];
      const fingerprints = ordered.reduce((acc, task) => {
        const key = getTaskFingerprint(task);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return {
        code,
        tasks: ordered,
        owners,
        completed: ordered.filter((task) => task.status === 'Completed').length,
        active: ordered.filter((task) => ['Pending', 'On Process', 'On Hold'].includes(task.status)).length,
        duplicateSignals: Object.values(fingerprints).filter((count) => count > 1).length,
        lastActivity: ordered.reduce((latest, task) => {
          const stamp = new Date(task.completiondate || task.startdate || 0).getTime();
          return stamp > latest ? stamp : latest;
        }, 0),
      };
    }).sort((a, b) => String(b.code).localeCompare(String(a.code)));
  }, [filterText, items]);

  const handleOpenTask = async (taskId) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
    if (logsByTask[taskId]) return;
    try {
      const logRes = await API.getAuditLogsByTask(taskId);
      setLogsByTask((prev) => ({ ...prev, [taskId]: logRes.logs || [] }));
    } catch {
      setLogsByTask((prev) => ({ ...prev, [taskId]: [] }));
    }
  };

  return (
    <div className="grid gap-5">
      <Panel title="Job Tracker" subtitle="ติดตามงานแบบ grouped timeline พร้อมกรองตามช่วงเวลาและดาวน์โหลด CSV">
        <div className="grid md:grid-cols-[1fr_180px_180px_180px] gap-3 mb-5">
          <input className="mx-input" placeholder="ค้นหา Job / คน / ทีม / Sub KPI / สถานะ" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
          <button className="mx-btn mx-btn-soft" onClick={loadTasks} disabled={loading}>{loading ? 'กำลังโหลด...' : 'Refresh'}</button>
          <button className="mx-btn mx-btn-soft" onClick={() => exportTrackerCsv(grouped, selectedMonth, selectedYear)} disabled={grouped.length === 0}>Export CSV</button>
          <div className="mx-input !bg-[rgba(255,255,255,0.02)] flex items-center justify-center">{formatMonthLabel(selectedMonth, selectedYear)}</div>
        </div>
        {error ? <div className="mb-4 text-sm text-[#ffb7b7] font-bold">{error}</div> : null}
        <div className="grid gap-4">
          {grouped.length === 0 ? <div className="text-sm text-[var(--mx-muted)]">{filterText ? 'ลองเปลี่ยนคำค้นหา' : 'ไม่มีงานในช่วงเวลาที่เลือก'}</div> : null}
          {grouped.map((group) => (
            <div key={group.code} className="mx-data-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-extrabold text-lg">{group.code}</div>
                  <div className="mt-1 text-sm text-[var(--mx-muted)]">{group.tasks.length} task(s) grouped under this job</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mx-badge mx-status-process">{group.owners.length} owner(s)</span>
                  <span className="mx-badge mx-status-completed">{group.completed} completed</span>
                  <span className="mx-badge mx-status-pending">{group.active} active</span>
                  {group.duplicateSignals ? <span className="mx-badge mx-status-cancelled">{group.duplicateSignals} duplicate signal</span> : null}
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => setExpandedJob(expandedJob === group.code ? null : group.code)}>
                    {expandedJob === group.code ? 'Collapse' : 'Open Timeline'}
                  </button>
                </div>
              </div>
              {group.lastActivity ? <div className="mt-3 text-xs text-[var(--mx-muted)]">Last activity {formatDate(group.lastActivity, true)}</div> : null}
              {expandedJob === group.code ? (
                <div className="mt-4 grid gap-3">
                  {group.tasks.map((task, idx) => (
                    <div key={task.id} className="rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-bold">Task {idx + 1} | {task.name || '-'}</div>
                          <div className="mt-2 text-sm text-[var(--mx-muted)]">{task.team || '-'} | {task.subkpi || 'No Sub KPI'} | Start {formatDate(task.startdate)}</div>
                          <div className="mt-1 text-sm text-[var(--mx-muted)]">Deadline {formatDate(task.deadline)} | Completed {formatDate(task.completiondate)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('mx-badge', getStatusClass(task.status))}>{task.status}</span>
                          <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => handleOpenTask(task.id)}>
                            {expandedTaskId === task.id ? 'Hide Detail' : 'View Detail'}
                          </button>
                        </div>
                      </div>
                      {expandedTaskId === task.id ? (
                        <div className="mt-4 rounded-[18px] p-4 bg-[rgba(0,0,0,0.16)] border border-[rgba(255,255,255,0.06)]">
                          {task.note ? <div className="text-sm leading-7 whitespace-pre-wrap">{task.note}</div> : <div className="text-sm text-[var(--mx-muted)]">No note on this task.</div>}
                          {renderExtraData(task.extra_data)}
                          <div className="mt-4">
                            <div className="text-sm font-bold">Audit Timeline</div>
                            <div className="mt-3 grid gap-3">
                              {(logsByTask[task.id] || []).length === 0 ? <div className="text-sm text-[var(--mx-muted)]">No audit log found.</div> : null}
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
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AdminStudioPro({ user, adminData, onRefresh }) {
  const emptyUserForm = {
    empid: '',
    name: '',
    team: '',
    role: 'Staff',
    pigurl: '',
    permissions: { allowedTeams: [], allowedStaff: [] },
  };
  const emptyKpiForm = { id: '', main: '', sub: '', team: '', days: 1, main_weight: 1 };

  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userSearch, setUserSearch] = useState('');
  const [teamName, setTeamName] = useState('');
  const [kpiForm, setKpiForm] = useState(emptyKpiForm);
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', name: '', is_active: true });
  const [auditSearch, setAuditSearch] = useState('');

  const teams = adminData?.teams || [];
  const staff = adminData?.staff || [];
  const kpis = adminData?.kpis || [];
  const holidays = adminData?.holidays || [];
  const logs = adminData?.logs || [];
  const selectedTeamStaff = useMemo(() => staff.filter((member) => member.team === userForm.team), [staff, userForm.team]);

  const filteredStaff = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((member) => [member.name, member.empId, member.team, member.role].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [staff, userSearch]);

  const filteredLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return logs.slice(0, 20);
    return logs.filter((log) => [log.action, log.details, log.by_user].some((value) => String(value || '').toLowerCase().includes(q))).slice(0, 20);
  }, [logs, auditSearch]);

  const togglePermission = (key, value) => {
    setUserForm((prev) => {
      const current = normalizePermissions(prev.permissions)[key];
      const exists = current.includes(value);
      const nextValues = exists ? current.filter((item) => item !== value) : [...current, value];
      return {
        ...prev,
        permissions: {
          ...normalizePermissions(prev.permissions),
          [key]: nextValues,
        },
      };
    });
  };

  const beginEditUser = (member) => {
    setUserForm({
      empid: member.empId,
      name: member.name,
      team: member.team,
      role: member.role || 'Staff',
      pigurl: member.pigurl || '',
      permissions: normalizePermissions(member.permissions),
    });
  };

  const resetUserForm = () => setUserForm(emptyUserForm);

  const saveUser = async () => {
    const payload = {
      ...userForm,
      permissions: normalizePermissions(userForm.permissions),
    };
    const res = await adminPost('admin/saveUser', payload, user.empId);
    if (res.error) return alert(res.error);
    resetUserForm();
    onRefresh();
    alert('Saved user successfully');
  };

  const saveTeam = async () => {
    const res = await adminPost('admin/saveTeam', { name: teamName }, user.empId);
    if (res.error) return alert(res.error);
    setTeamName('');
    onRefresh();
    alert('Saved team successfully');
  };

  const saveKpi = async () => {
    const payload = { ...kpiForm, days: Number(kpiForm.days), main_weight: Number(kpiForm.main_weight) };
    if (!payload.id) delete payload.id;
    const res = await adminPost('admin/saveKpi', payload, user.empId);
    if (res.error) return alert(res.error);
    setKpiForm(emptyKpiForm);
    onRefresh();
    alert('Saved KPI successfully');
  };

  const saveHoliday = async () => {
    const res = await adminPost('admin/saveHoliday', holidayForm, user.empId);
    if (res.error) return alert(res.error);
    setHolidayForm({ holiday_date: '', name: '', is_active: true });
    onRefresh();
    alert('Saved holiday successfully');
  };

  const recalc = async () => {
    const res = await adminPost('admin/recalculateDeadlines', {}, user.empId);
    if (res.error) return alert(res.error);
    onRefresh();
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
      <Panel title="Admin Studio" subtitle="Control users, permissions, KPI, holidays, and audits without touching the database">
        <div className="mx-grid-auto">
          <MetricCard label="Users" value={staff.length} sub="people in the system" icon="fa-users" />
          <MetricCard label="Teams" value={teams.length} sub="active organization units" icon="fa-people-group" accent="var(--mx-teal)" />
          <MetricCard label="Holidays" value={holidays.length} sub="SLA calendar days" icon="fa-calendar-days" accent="var(--mx-amber)" />
          <MetricCard label="Audit Logs" value={logs.length} sub="latest system activities" icon="fa-shield-halved" accent="var(--mx-blue)" />
        </div>
      </Panel>

      <div className="grid xl:grid-cols-2 gap-5">
        <Panel title="User Editor" subtitle="Create or update user identity and scoped permissions">
          <div className="grid gap-3">
            <div className="grid md:grid-cols-2 gap-3">
              <input className="mx-input" placeholder="Emp ID" value={userForm.empid} onChange={(e) => setUserForm((prev) => ({ ...prev, empid: e.target.value }))} />
              <input className="mx-input" placeholder="Full Name" value={userForm.name} onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <select className="mx-select" value={userForm.team} onChange={(e) => setUserForm((prev) => ({ ...prev, team: e.target.value, permissions: { ...normalizePermissions(prev.permissions), allowedStaff: [] } }))}>
                <option value="">Select team</option>
                {teams.map((team) => <option key={team.id || team.name} value={team.name}>{team.name}</option>)}
              </select>
              <select className="mx-select" value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value, permissions: { allowedTeams: [], allowedStaff: [] } }))}>
                <option value="Staff">Staff</option>
                <option value="Lead">Lead</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <input className="mx-input" placeholder="Avatar URL (optional)" value={userForm.pigurl} onChange={(e) => setUserForm((prev) => ({ ...prev, pigurl: e.target.value }))} />

            {userForm.role === 'Manager' ? (
              <div className="rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                <div className="text-sm font-bold mb-3">Allowed Teams</div>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => {
                    const active = normalizePermissions(userForm.permissions).allowedTeams.includes(team.name);
                    return <button key={team.id || team.name} className={cn('mx-btn !py-2 !px-3', active ? 'mx-btn-primary' : 'mx-btn-soft')} onClick={() => togglePermission('allowedTeams', team.name)}>{team.name}</button>;
                  })}
                </div>
              </div>
            ) : null}

            {userForm.role === 'Lead' ? (
              <div className="rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                <div className="text-sm font-bold mb-3">Allowed Staff In Team</div>
                <div className="flex flex-wrap gap-2">
                  {selectedTeamStaff.map((member) => {
                    const active = normalizePermissions(userForm.permissions).allowedStaff.includes(member.name);
                    return <button key={member.empId} className={cn('mx-btn !py-2 !px-3', active ? 'mx-btn-primary' : 'mx-btn-soft')} onClick={() => togglePermission('allowedStaff', member.name)}>{member.name}</button>;
                  })}
                  {selectedTeamStaff.length === 0 ? <div className="text-sm text-[var(--mx-muted)]">Select team first to scope lead access.</div> : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button className="mx-btn mx-btn-primary" onClick={saveUser}>Save User</button>
              <button className="mx-btn mx-btn-soft" onClick={resetUserForm}>Reset Form</button>
            </div>
          </div>
        </Panel>

        <Panel title="Organization Controls" subtitle="Teams, KPI configuration, holidays, and deadline recalculation">
          <div className="grid gap-3">
            <input className="mx-input" placeholder="New Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <button className="mx-btn mx-btn-soft" onClick={saveTeam}>Save Team</button>
            <div className="grid md:grid-cols-2 gap-3">
              <input className="mx-input" placeholder="Main KPI" value={kpiForm.main} onChange={(e) => setKpiForm((prev) => ({ ...prev, main: e.target.value }))} />
              <input className="mx-input" placeholder="Sub KPI" value={kpiForm.sub} onChange={(e) => setKpiForm((prev) => ({ ...prev, sub: e.target.value }))} />
              <input className="mx-input" placeholder="Team" value={kpiForm.team} onChange={(e) => setKpiForm((prev) => ({ ...prev, team: e.target.value }))} />
              <input className="mx-input" type="number" placeholder="Days" value={kpiForm.days} onChange={(e) => setKpiForm((prev) => ({ ...prev, days: e.target.value }))} />
              <input className="mx-input md:col-span-2" type="number" placeholder="Weight" value={kpiForm.main_weight} onChange={(e) => setKpiForm((prev) => ({ ...prev, main_weight: e.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="mx-btn mx-btn-soft" onClick={saveKpi}>Save KPI</button>
              <button className="mx-btn mx-btn-soft" onClick={() => setKpiForm(emptyKpiForm)}>Reset KPI Form</button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <input className="mx-input" type="date" value={holidayForm.holiday_date} onChange={(e) => setHolidayForm((prev) => ({ ...prev, holiday_date: e.target.value }))} />
              <input className="mx-input" placeholder="Holiday Name" value={holidayForm.name} onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <button className="mx-btn mx-btn-soft" onClick={saveHoliday}>Save Holiday</button>
            <button className="mx-btn mx-btn-primary" onClick={recalc}>Recalculate Deadlines</button>
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <Panel title="User Directory" subtitle="Search, edit, and remove users from inside the system">
          <div className="grid gap-3">
            <input className="mx-input" placeholder="Search user, team, role, or emp ID" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            <div className="grid gap-3">
              {filteredStaff.slice(0, 24).map((member) => (
                <div key={member.empId} className="mx-data-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{member.name}</div>
                      <div className="mt-1 text-sm text-[var(--mx-muted)]">{member.empId} | {member.team} | {member.role}</div>
                      {normalizePermissions(member.permissions).allowedTeams.length || normalizePermissions(member.permissions).allowedStaff.length ? (
                        <div className="mt-2 text-xs text-[var(--mx-muted)]">
                          Teams: {normalizePermissions(member.permissions).allowedTeams.join(', ') || '-'} | Staff: {normalizePermissions(member.permissions).allowedStaff.join(', ') || '-'}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => beginEditUser(member)}>Edit</button>
                      <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeUser(member.empId)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Latest Audit Logs" subtitle="Search recent system activity without opening the backend">
          <div className="grid gap-3">
            <input className="mx-input" placeholder="Search audit action, details, or actor" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
            <div className="grid gap-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="mx-data-card">
                  <div className="font-bold">{log.action || 'Activity'}</div>
                  <div className="mt-2 text-sm text-[var(--mx-muted)]">{log.details || '-'}</div>
                  <div className="mt-2 text-xs text-[var(--mx-muted)]">{log.by_user || '-'} | {formatDate(log.timestamp, true)}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        <Panel title="Teams" subtitle="Edit organization structure from the new control center">
          <div className="grid gap-3">
            {teams.map((team) => (
              <div key={team.id || team.name} className="mx-data-card flex items-center justify-between gap-3">
                <div className="font-bold">{team.name}</div>
                <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeTeam(team.id)}>Delete</button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="KPI Catalog" subtitle="Select any KPI to edit it in the form above">
          <div className="grid gap-3">
            {kpis.slice(0, 24).map((kpi) => (
              <div key={kpi.id} className="mx-data-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{kpi.main} / {kpi.sub}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{kpi.team} | {kpi.days} day(s) | weight {kpi.main_weight ?? kpi.mainWeight}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => setKpiForm({ id: kpi.id, main: kpi.main, sub: kpi.sub, team: kpi.team, days: kpi.days, main_weight: kpi.main_weight ?? kpi.mainWeight ?? 1 })}>Edit</button>
                    <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => removeKpi(kpi.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Holiday Calendar" subtitle="Keep SLA holiday rules managed inside the app">
          <div className="grid gap-3">
            {holidays.slice(0, 24).map((holiday) => (
              <div key={holiday.id} className="mx-data-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{holiday.name}</div>
                    <div className="mt-1 text-sm text-[var(--mx-muted)]">{holiday.holiday_date} | {holiday.is_active ? 'Active' : 'Inactive'}</div>
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
  const [editingTask, setEditingTask] = useState(null);
  const [liveMode, setLiveMode] = useState('Idle');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showNotifications, setShowNotifications] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, task: null, status: '', reason: '' });
  const [noteModal, setNoteModal] = useState({ show: false, task: null, note: '' });
  const [prCompleteModal, setPrCompleteModal] = useState({ show: false, task: null, fundNumber: '', amount: '' });
  const { state, reloadDashboard, reloadTasks, reloadPeople, reloadAdmin } = useAppData(user, view, selectedMonth, selectedYear);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (!user || !window.subscribeToRealtime) return;
    let active = true;
    const refreshVisible = () => {
      if (!active) return;
      setLiveMode('Live Sync');
      if (view === 'dashboard' || view === 'personalDashboard') reloadDashboard();
      if (view === 'tasks' || view === 'personalTasks') reloadTasks();
      if (view === 'people' || view === 'assign') reloadPeople();
      if (view === 'admin') reloadAdmin();
    };

    window.subscribeToRealtime('tasks', refreshVisible);
    window.subscribeToRealtime('audit_log', () => {
      if (!active) return;
      setLiveMode('Live Sync');
      if (view === 'admin') reloadAdmin();
    });

    return () => {
      active = false;
      if (window.unsubscribeFromRealtime) {
        window.unsubscribeFromRealtime('tasks');
        window.unsubscribeFromRealtime('audit_log');
      }
    };
  }, [user, view, reloadAdmin, reloadDashboard, reloadPeople, reloadTasks]);

  const handleLogin = async (empId) => {
    if (!empId?.trim()) {
      setLoginError('เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธฃเธซเธฑเธชเธเธเธฑเธเธเธฒเธ');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await API.getInitialData(empId.trim());
      if (res?.error) throw new Error(res.error);
      if (!res?.user) throw new Error('เนเธกเนเธเธเธเนเธญเธกเธนเธฅเธเธนเนเนเธเนเธเธฒเธ');
      const nextUser = { ...res.user, kpis: res.kpis || [] };
      setUser(nextUser);
      setView(ROLE_HOME[nextUser.role] || 'dashboard');
    } catch (e) {
      setLoginError(e.message || 'เน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธกเนเธชเธณเน€เธฃเนเธ');
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
      alert(e.message || 'เธฃเธฑเธเธเธฒเธเนเธกเนเธชเธณเน€เธฃเนเธ');
    } finally {
      setActionLoading(false);
    }
  };

  const openStatusModal = (task, status) => {
    setStatusModal({
      show: true,
      task,
      status: status || task?.status || '',
      reason: '',
    });
  };

  const closeStatusModal = () => {
    setStatusModal({ show: false, task: null, status: '', reason: '' });
  };

  const openNoteModal = (task) => {
    setNoteModal({
      show: true,
      task,
      note: task?.note || '',
    });
  };

  const closeNoteModal = () => {
    setNoteModal({ show: false, task: null, note: '' });
  };

  const handleStatusChange = async (task, status, reason = '') => {
    if (user.role === 'Staff' && status === 'Completed' && isOpenPrSubKpi(task.subkpi)) {
      setPrCompleteModal({
        show: true,
        task,
        fundNumber: parseExtraData(task.extra_data)?.fundNumber || '',
        amount: parseExtraData(task.extra_data)?.amount || '',
      });
      return;
    }
    setActionLoading(true);
    try {
      if (user.role === 'Staff') {
        await API.updateTaskStatus(task.id, task.team, status, reason, 'append');
      } else {
        await API.updateTaskStatusWithLog(task.id, task.team, status, reason, user.name);
      }
      await reloadTasks();
      await reloadDashboard();
      closeStatusModal();
    } catch (e) {
      alert(e.message || 'เธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐเนเธกเนเธชเธณเน€เธฃเนเธ');
    } finally {
      setActionLoading(false);
    }
  };

  const submitStatusModal = async () => {
    const { task, status, reason } = statusModal;
    if (!task || !status) return;
    if (status !== task.status && !reason.trim()) {
      alert('กรุณาระบุเหตุผลในการเปลี่ยนสถานะ');
      return;
    }
    await handleStatusChange(task, status, reason.trim());
  };

  const saveTaskNote = async () => {
    const { task, note } = noteModal;
    if (!task) return;
    setActionLoading(true);
    try {
      await API.updateTaskDetails({
        id: task.id,
        team: task.team,
        job: task.job,
        subkpi: task.subkpi,
        note,
        extra_data: parseExtraData(task.extra_data) || {},
        changedBy: user.name,
      });
      await reloadTasks();
      await reloadDashboard();
      closeNoteModal();
    } catch (e) {
      alert(e.message || 'บันทึก note ไม่สำเร็จ');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditTaskSaved = async () => {
    await reloadTasks();
    await reloadDashboard();
    if (view === 'admin') await reloadAdmin();
    setLiveMode('Just Synced');
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`เธขเธทเธเธขเธฑเธเธเธฒเธฃเธฅเธเธเธฒเธ ${task.job}?`)) return;
    setActionLoading(true);
    try {
      await API.deleteTask(task.id, task.team, user.name);
      await reloadTasks();
      await reloadDashboard();
    } catch (e) {
      alert(e.message || 'เธฅเธเธเธฒเธเนเธกเนเธชเธณเน€เธฃเนเธ');
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError} />;
  }

  const peopleForAssign = state.people?.length ? state.people : state.admin?.staff || [];
  const availableYears = getAvailableYears();
  const visibleTasks = view === 'dashboard' || view === 'personalDashboard'
    ? state.dashboard?.tasks || []
    : state.tasks || [];
  const notifications = (user.role === 'Staff' || (user.role === 'Lead' && (view === 'personalDashboard' || view === 'personalTasks')))
    ? buildTaskNotifications(visibleTasks)
    : [];
  const showPeriodControls = ['dashboard', 'tasks', 'personalDashboard', 'personalTasks', 'tracker'].includes(view);
  const canExportTasks = ['dashboard', 'tasks', 'personalDashboard', 'personalTasks'].includes(view) && visibleTasks.length > 0;

  const exportCurrentTasks = () => {
    const fileLabel = user.role === 'Lead' && (view === 'personalDashboard' || view === 'personalTasks') ? user.name : (user.name || user.team || 'tasks');
    exportTasksCsv(visibleTasks, fileLabel, selectedMonth, selectedYear);
  };

  const completePrTask = async () => {
    const { task, fundNumber, amount } = prCompleteModal;
    if (!task) return;
    setActionLoading(true);
    try {
      const nextExtraData = { ...(parseExtraData(task.extra_data) || {}), fundNumber, amount };
      await API.updateTaskDetails({
        id: task.id,
        team: task.team,
        job: task.job,
        subkpi: task.subkpi,
        extra_data: nextExtraData,
        changedBy: user.name,
      });
      await API.updateTaskStatus(task.id, task.team, 'Completed', `${getTimestampLabel()} งานเสร็จสิ้น`, 'append');
      setPrCompleteModal({ show: false, task: null, fundNumber: '', amount: '' });
      await reloadTasks();
      await reloadDashboard();
    } catch (e) {
      alert(e.message || 'ปิดงานไม่สำเร็จ');
    } finally {
      setActionLoading(false);
    }
  };

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
                  {view === 'personalDashboard' && 'My Personal Dashboard'}
                  {view === 'tasks' && 'Task Center'}
                  {view === 'personalTasks' && 'My Personal Tasks'}
                  {view === 'create' && 'Create Task'}
                  {view === 'assign' && 'Assignment Center'}
                  {view === 'people' && 'People Overview'}
                  {view === 'tracker' && 'Job Tracker'}
                  {view === 'admin' && 'Admin Studio'}
                </h1>
                <p className="mt-2 mb-0 text-[var(--mx-muted)]">เธฃเธฐเธเธเนเธซเธกเนเธ—เธตเนเธขเธเธฃเธฐเธ”เธฑเธ UX/UI เนเธ•เนเธขเธฑเธเธ—เธณเธเธฒเธเธเธ backend เนเธฅเธฐเธเธฒเธเธเนเธญเธกเธนเธฅเน€เธ”เธดเธกเนเธ”เธขเธ•เธฃเธ</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {showPeriodControls ? (
                  <>
                    <select className="mx-select !w-auto min-w-[124px]" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                      {MONTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select className="mx-select !w-auto min-w-[112px]" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                      {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </>
                ) : null}
                {canExportTasks ? <button className="mx-btn mx-btn-soft" onClick={exportCurrentTasks}><i className="fa-solid fa-file-csv mr-2"></i>CSV</button> : null}
                {(user.role === 'Staff' || (user.role === 'Lead' && (view === 'personalDashboard' || view === 'personalTasks'))) ? (
                  <div className="relative">
                    <button className="mx-btn mx-btn-soft" onClick={() => setShowNotifications((prev) => !prev)}>
                      <i className="fa-solid fa-bell mr-2"></i>{notifications.length}
                    </button>
                    {showNotifications ? (
                      <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-w-[90vw] rounded-[22px] p-4 mx-shell-card z-20">
                        <div className="font-bold text-sm">การแจ้งเตือน ({notifications.length})</div>
                        <div className="mt-3 grid gap-2 max-h-[280px] overflow-y-auto">
                          {notifications.length === 0 ? <div className="text-sm text-[var(--mx-muted)]">ไม่มีการแจ้งเตือน</div> : null}
                          {notifications.map((notification) => (
                            <div key={notification.id} className="rounded-[16px] p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
                              <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--mx-muted)]">{notification.priority}</div>
                              <div className="mt-1 text-sm">{notification.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <span className="mx-badge mx-status-process"><i className="fa-solid fa-user"></i>{user.role}</span>
                <span className="mx-badge mx-status-completed"><i className="fa-solid fa-building-user"></i>{user.team}</span>
                {state.loading || actionLoading ? <span className="mx-badge mx-status-pending"><i className="fa-solid fa-rotate-right fa-spin"></i>Loading</span> : null}
                <span className="mx-badge mx-status-cancelled"><i className="fa-solid fa-satellite-dish"></i>{liveMode}</span>
              </div>
            </div>
            {state.error && <div className="mt-4 text-sm text-[#ffb7b7] font-bold">{state.error}</div>}
          </header>

          {view === 'dashboard' && <DashboardView user={user} data={state.dashboard} view={view} />}
          {view === 'personalDashboard' && <DashboardView user={user} data={state.dashboard} view={view} />}
          {view === 'tasks' && <TaskCenterPro user={user} tasks={state.tasks} onAccept={handleAccept} onStatusChange={handleStatusChange} onDelete={handleDelete} onRefresh={reloadTasks} onEdit={setEditingTask} onOpenStatusModal={openStatusModal} onOpenNoteModal={openNoteModal} />}
          {view === 'personalTasks' && <TaskCenterPro user={user} tasks={state.tasks} onAccept={handleAccept} onStatusChange={handleStatusChange} onDelete={handleDelete} onRefresh={reloadTasks} onEdit={setEditingTask} onOpenStatusModal={openStatusModal} onOpenNoteModal={openNoteModal} />}
          {view === 'create' && <QuickCreateView user={user} people={peopleForAssign} onSaved={() => { reloadTasks(); reloadDashboard(); }} />}
          {view === 'assign' && <QuickCreateView user={user} people={peopleForAssign} onSaved={() => { reloadTasks(); reloadDashboard(); reloadPeople(); }} />}
          {view === 'people' && <PeopleView user={user} people={state.people} onRefresh={reloadPeople} />}
          {view === 'tracker' && <TrackerViewPro user={user} selectedMonth={selectedMonth} selectedYear={selectedYear} />}
          {view === 'admin' && <AdminStudioPro user={user} adminData={state.admin} onRefresh={reloadAdmin} />}
          {editingTask ? <TaskEditModal user={user} task={editingTask} onClose={() => setEditingTask(null)} onSaved={handleEditTaskSaved} /> : null}
          {statusModal.show ? (
            <div className="fixed inset-0 bg-[rgba(3,8,14,0.75)] backdrop-blur-md z-[90] flex items-center justify-center p-4">
              <div className="mx-shell-card rounded-[28px] p-6 w-full max-w-[560px]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="m-0 text-[26px] font-extrabold tracking-[-0.05em]">Update Task Status</h3>
                    <p className="mt-2 mb-0 text-sm text-[var(--mx-muted)] line-clamp-2">{statusModal.task?.job}</p>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={closeStatusModal}>Close</button>
                </div>
                <div className="grid gap-4 mt-6">
                  <div>
                    <label className="block mb-2 text-sm font-bold">New Status</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['Pending', 'On Process', 'On Hold', 'Completed', 'Cancelled'].map((status) => (
                        <button
                          key={status}
                          className={`mx-btn ${statusModal.status === status ? 'mx-btn-primary' : 'mx-btn-soft'}`}
                          onClick={() => setStatusModal((prev) => ({ ...prev, status }))}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-bold">Reason / Note</label>
                    <textarea
                      className="mx-textarea min-h-[140px]"
                      value={statusModal.reason}
                      onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="ระบุเหตุผลการเปลี่ยนสถานะหรือบันทึกประกอบ"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="mx-btn mx-btn-soft" onClick={closeStatusModal}>Cancel</button>
                    <button className="mx-btn mx-btn-primary" disabled={!statusModal.status || !statusModal.reason.trim() || actionLoading} onClick={submitStatusModal}>Save Status</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {noteModal.show ? (
            <div className="fixed inset-0 bg-[rgba(3,8,14,0.75)] backdrop-blur-md z-[90] flex items-center justify-center p-4">
              <div className="mx-shell-card rounded-[28px] p-6 w-full max-w-[720px]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="m-0 text-[26px] font-extrabold tracking-[-0.05em]">Task Note</h3>
                    <p className="mt-2 mb-0 text-sm text-[var(--mx-muted)] line-clamp-2">{noteModal.task?.job}</p>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={closeNoteModal}>Close</button>
                </div>
                <div className="grid gap-4 mt-6">
                  <div>
                    <label className="block mb-2 text-sm font-bold">Note</label>
                    <textarea
                      className="mx-textarea min-h-[240px]"
                      value={noteModal.note}
                      onChange={(e) => setNoteModal((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="บันทึกความคืบหน้าหรือรายละเอียดเพิ่มเติม"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="mx-btn mx-btn-soft" onClick={closeNoteModal}>Cancel</button>
                    <button className="mx-btn mx-btn-primary" disabled={actionLoading} onClick={saveTaskNote}>Save Note</button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {prCompleteModal.show ? (
            <div className="fixed inset-0 bg-[rgba(3,8,14,0.75)] backdrop-blur-md z-[90] flex items-center justify-center p-4">
              <div className="mx-shell-card rounded-[28px] p-6 w-full max-w-[520px]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="m-0 text-[26px] font-extrabold tracking-[-0.05em]">Open PR Completion</h3>
                    <p className="mt-2 mb-0 text-sm text-[var(--mx-muted)]">กรอก Fund Number และจำนวนเงินก่อนปิดงานประเภท Open PR</p>
                  </div>
                  <button className="mx-btn mx-btn-soft !py-2 !px-3" onClick={() => setPrCompleteModal({ show: false, task: null, fundNumber: '', amount: '' })}>Close</button>
                </div>
                <div className="grid gap-4 mt-6">
                  <div>
                    <label className="block mb-2 text-sm font-bold">Fund Number</label>
                    <input className="mx-input" value={prCompleteModal.fundNumber} onChange={(e) => setPrCompleteModal((prev) => ({ ...prev, fundNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-bold">Amount</label>
                    <input className="mx-input" type="number" value={prCompleteModal.amount} onChange={(e) => setPrCompleteModal((prev) => ({ ...prev, amount: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="mx-btn mx-btn-soft" onClick={() => setPrCompleteModal({ show: false, task: null, fundNumber: '', amount: '' })}>Cancel</button>
                  <button className="mx-btn mx-btn-primary" onClick={completePrTask}>Complete Task</button>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);





