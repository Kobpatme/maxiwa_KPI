const { useEffect, useMemo, useState } = React;

const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function fmtPct(value) {
  return value === null || value === undefined ? '-' : `${value}%`;
}

function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function taskWeight(task) {
  const raw = task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight ?? 1;
  const weight = typeof raw === 'string' ? Number.parseFloat(raw.replace('%', '').trim()) : Number(raw);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function kpiKey(task) {
  return String(task?.mainkpi ?? task?.mainKpi ?? task?.main ?? task?.subkpi ?? task?.sub ?? 'Other').trim() || 'Other';
}

function isCompletedOnTime(task) {
  const deadline = task?.deadline ? new Date(task.deadline) : null;
  const completedAt = task?.completiondate ? new Date(task.completiondate) : null;
  return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt <= deadline);
}

function calcWeightedScores(tasks) {
  const groups = {};
  (tasks || []).forEach((task) => {
    const key = kpiKey(task);
    const weight = taskWeight(task);
    const status = String(task?.status || '').toLowerCase();
    if (!groups[key]) groups[key] = { weight, total: 0, completed: 0, onTime: 0 };
    else if (groups[key].weight === 1 && weight !== 1) groups[key].weight = weight;
    if (status === 'cancelled') return;
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
    sla: slaWeight > 0 ? Math.round((onTimeWeight / slaWeight) * 100) : null,
    completion: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : null,
    totalWeight,
    completedWeight,
    slaWeight,
    onTimeWeight,
  };
}

function isActive(task) {
  return !['completed', 'cancelled'].includes(String(task?.status || '').toLowerCase());
}

function daysUntil(task) {
  if (!task?.deadline) return null;
  const d = new Date(task.deadline);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
}

function extractJobCode(job) {
  if (!job) return '-';
  const match = String(job).match(/^([A-Za-z]+\d+_\d+)/);
  return match ? match[1].toUpperCase() : String(job).slice(0, 22);
}

function healthClass(value) {
  if (value === null || value === undefined) return 'status-neutral';
  if (value >= 90) return 'status-good';
  if (value >= 75) return 'status-info';
  if (value >= 60) return 'status-warn';
  return 'status-bad';
}

function statusClass(status) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'completed') return 'status-good';
  if (raw === 'on process') return 'status-info';
  if (raw === 'pending') return 'status-warn';
  if (raw === 'on hold') return 'status-bad';
  return 'status-neutral';
}

function riskBadge(days) {
  if (days === null) return ['No deadline', 'status-neutral'];
  if (days < 0) return [`${Math.abs(days)}d late`, 'status-bad'];
  if (days <= 3) return [`${days}d left`, 'status-warn'];
  return [`${days}d left`, 'status-info'];
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
    const key = getKey(item) || 'Unassigned';
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
}

function calcGroupRows(map) {
  return Object.entries(map).map(([name, items]) => {
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
    const completed = items.filter((task) => String(task.status || '').toLowerCase() === 'completed').length;
    const completion = scores.completion ?? (items.length ? Math.round((completed / items.length) * 100) : null);
    const health = Math.round(((scores.sla ?? completion ?? 0) + (completion ?? scores.sla ?? 0)) / 2) - overdue * 5 - risk * 2;
    return { name, items, total: items.length, active: active.length, completed, overdue, risk, sla: scores.sla, completion, health };
  });
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
        <circle
          cx="56"
          cy="56"
          r="42"
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 56 56)"
        />
        <text x="56" y="60" textAnchor="middle" fontSize="22" fontWeight="900" fill="var(--mx-text)">{fmtPct(value)}</text>
      </svg>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">{label}</div>
        <div className="mt-2 text-sm text-[var(--mx-muted)] leading-6">{sub}</div>
      </div>
    </div>
  );
}

function LineChart({ months, series }) {
  const width = 860;
  const height = 270;
  const pad = { left: 42, right: 18, top: 24, bottom: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index) => pad.left + (plotW * index) / Math.max(1, months.length - 1);
  const y = (value) => pad.top + plotH - (plotH * clampPercent(value)) / 100;
  const points = (values) => values.map((value, index) => `${x(index)},${value === null ? y(0) : y(value)}`).join(' ');
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[720px]">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-label" x="8" y={y(tick) + 4}>{tick}%</text>
          </g>
        ))}
        {months.map((month, index) => (
          <text key={month} className="chart-label" x={x(index)} y={height - 14} textAnchor="middle">{MONTH_NAMES[month].slice(0, 3)}</text>
        ))}
        <polyline className="chart-line" points={points(series.sla)} stroke="var(--mx-info)" />
        <polyline className="chart-line" points={points(series.completion)} stroke="var(--mx-success)" />
        <polyline className="chart-line" points={points(series.risk)} stroke="var(--mx-danger)" />
        {series.sla.map((value, index) => value !== null && <circle key={`s-${index}`} cx={x(index)} cy={y(value)} r="4" fill="var(--mx-info)" />)}
        {series.completion.map((value, index) => value !== null && <circle key={`c-${index}`} cx={x(index)} cy={y(value)} r="4" fill="var(--mx-success)" />)}
        {series.risk.map((value, index) => value !== null && <circle key={`r-${index}`} cx={x(index)} cy={y(value)} r="4" fill="var(--mx-danger)" />)}
      </svg>
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

function Shell({ children }) {
  return <div className="max-w-[1760px] mx-auto p-4 md:p-7 grid gap-6">{children}</div>;
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const initialEmpId = String(params.get('empId') || '').trim().toUpperCase();
  const [empId, setEmpId] = useState(initialEmpId);
  const [month, setMonth] = useState(params.has('month') ? Number(params.get('month')) : 0);
  const [year, setYear] = useState(Number(params.get('year') || new Date().getFullYear()));
  const [state, setState] = useState({ loading: false, error: '', user: null, tasks: [] });

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - 3 + i);
  }, []);

  const load = async (nextEmpId = empId) => {
    const cleanEmpId = String(nextEmpId || '').trim().toUpperCase();
    if (!cleanEmpId) {
      setState((prev) => ({ ...prev, error: 'กรุณาระบุ empId ใน URL หรือช่องด้านบน' }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const initial = await API.getInitialData(cleanEmpId);
      if (initial?.error) throw new Error(initial.error);
      if (!initial?.user) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
      const user = { ...initial.user, kpis: initial.kpis || [] };
      const monthParam = month === 0 ? null : month;
      let tasks = [];
      if (user.role === 'Staff') {
        const res = await API.getEmployeeTasks(user, monthParam, year, month === 0, user.empId);
        tasks = res.tasks || res || [];
      } else {
        const team = user.role === 'Lead' ? user.team : 'all';
        const res = await API.getAllTasks(monthParam, year, team, user.empId);
        tasks = res.tasks || [];
      }
      setState({ loading: false, error: '', user, tasks });
      const url = new URL(window.location.href);
      url.searchParams.set('empId', cleanEmpId);
      url.searchParams.set('month', String(month));
      url.searchParams.set('year', String(year));
      window.history.replaceState(null, '', url);
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'โหลดข้อมูลไม่สำเร็จ' }));
    }
  };

  useEffect(() => {
    if (initialEmpId) load(initialEmpId);
  }, [month, year]);

  const tasks = state.tasks || [];
  const activeTasks = tasks.filter(isActive);
  const completedTasks = tasks.filter((task) => String(task.status || '').toLowerCase() === 'completed');
  const overdueTasks = activeTasks.filter((task) => {
    const days = daysUntil(task);
    return days !== null && days < 0;
  });
  const atRiskTasks = activeTasks.filter((task) => {
    const days = daysUntil(task);
    return days !== null && days >= 0 && days <= 3;
  });
  const scores = calcWeightedScores(tasks);
  const completion = scores.completion ?? (tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : null);
  const sla = scores.sla;
  const weightedScore = completion !== null && sla !== null ? Math.round((completion + sla) / 2) : (completion ?? sla);
  const periodLabel = `${month === 0 ? 'All Months' : MONTH_NAMES[month - 1]} ${year}`;

  const teamRows = useMemo(() => calcGroupRows(groupBy(tasks, (task) => task.team || 'Unassigned'))
    .map((row) => ({ ...row, team: row.name }))
    .sort((a, b) => (a.overdue - b.overdue) || (a.risk - b.risk) || (b.health - a.health)), [tasks]);

  const personRows = useMemo(() => calcGroupRows(groupBy(tasks, (task) => {
    const name = task.name || task.assignee || task.owner || task.empId || task.empid;
    const team = task.team || '-';
    return `${name || 'Unassigned'} · ${team}`;
  })).sort((a, b) => (b.total - a.total) || (a.overdue - b.overdue) || (b.health - a.health)), [tasks]);

  const statusRows = useMemo(() => {
    const map = groupBy(tasks, (task) => task.status || 'Unknown');
    return Object.entries(map).map(([status, items]) => ({ status, total: items.length, pct: tasks.length ? Math.round((items.length / tasks.length) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [tasks]);

  const kpiRows = useMemo(() => {
    const map = groupBy(tasks, kpiKey);
    return Object.entries(map).map(([name, items]) => {
      const scores = calcWeightedScores(items);
      const active = items.filter(isActive);
      return {
        name,
        total: items.length,
        active: active.length,
        weight: Math.max(...items.map(taskWeight), 1),
        sla: scores.sla,
        completion: scores.completion,
      };
    }).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [tasks]);

  const monthlyTrend = useMemo(() => {
    const months = month === 0 ? Array.from({ length: 12 }, (_, i) => i) : [month - 1];
    const sla = [];
    const trendCompletion = [];
    const risk = [];
    months.forEach((monthIndex) => {
      const monthTasks = tasks.filter((task) => getTaskMonth(task) === monthIndex);
      const monthScores = calcWeightedScores(monthTasks);
      const active = monthTasks.filter(isActive);
      const riskCount = active.filter((task) => {
        const days = daysUntil(task);
        return days !== null && days <= 3;
      }).length;
      sla.push(monthTasks.length ? monthScores.sla : null);
      trendCompletion.push(monthTasks.length ? (monthScores.completion ?? Math.round((monthTasks.filter((task) => String(task.status || '').toLowerCase() === 'completed').length / monthTasks.length) * 100)) : null);
      risk.push(monthTasks.length ? Math.round((riskCount / monthTasks.length) * 100) : null);
    });
    return { months, series: { sla, completion: trendCompletion, risk } };
  }, [tasks, month]);

  const criticalQueue = useMemo(() => activeTasks
    .map((task) => ({ task, days: daysUntil(task), weight: taskWeight(task) }))
    .filter((item) => item.days !== null)
    .sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return (riskA - riskB) || (a.days - b.days) || (b.weight - a.weight);
    })
    .slice(0, 10), [activeTasks]);

  const insights = [];
  if (overdueTasks.length) insights.push(`${overdueTasks.length} overdue task(s) require attention before the next SLA review.`);
  if (atRiskTasks.length) insights.push(`${atRiskTasks.length} task(s) are due within 3 days and may affect the monthly SLA score.`);
  if (teamRows[0]) insights.push(`${teamRows[0].team} is the current highest-risk team in this scope.`);
  if (sla !== null) insights.push(`Weighted SLA is ${sla}% and weighted completion is ${completion ?? '-'}%.`);
  if (!insights.length) insights.push('No critical SLA risk is visible in this scope.');

  return (
    <Shell>
      <header className="mx-card stage-header p-5 md:p-8">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mx-badge status-info"><i className="fa-solid fa-display"></i> Executive View</span>
              <span className="mx-badge status-neutral">MAXIWA KPI</span>
              {state.user && <span className="mx-badge status-good">{state.user.role} · {state.user.team}</span>}
            </div>
            <h1 className="display-title mt-6 mb-0 break-words">
              <span className="block">Executive Performance</span>
              <span className="block">Command Center</span>
            </h1>
            <p className="mt-4 mb-0 max-w-[84ch] text-base md:text-[18px] leading-8 text-[var(--mx-muted)]">
              A boardroom-ready readout for SLA exposure, KPI weight, team capacity, and individual performance depth.
            </p>
          </div>
          <div className="no-print control-panel flex flex-wrap gap-2 xl:justify-end xl:max-w-[640px]">
            <input className="mx-input !w-36" value={empId} onChange={(e) => setEmpId(e.target.value.toUpperCase())} placeholder="empId" />
            <select className="mx-input !w-40" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              <option value={0}>ทุกเดือน</option>
              {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
            <select className="mx-input !w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button className="mx-btn mx-btn-primary" onClick={() => load(empId)} disabled={state.loading}>
              <i className={`fa-solid ${state.loading ? 'fa-rotate-right fa-spin' : 'fa-arrows-rotate'} mr-2`}></i>Load
            </button>
            <button className="mx-btn" onClick={() => window.print()}><i className="fa-solid fa-print mr-2"></i>Print</button>
          </div>
        </div>
        {state.error && <div className="mt-4 mx-soft p-4 text-sm font-bold text-[var(--mx-danger)]">{state.error}</div>}
      </header>

      <section className="mx-card hero-band p-5 md:p-8">
        <div className="presentation-grid items-stretch">
          <div className="grid md:grid-cols-2 gap-5">
            <GaugeMetric label="Overall SLA" value={sla} sub="คะแนนตรงเวลาถ่วงน้ำหนักตาม KPI" tone="var(--mx-info)" />
            <GaugeMetric label="Completion" value={completion} sub={`${completedTasks.length}/${tasks.length} งานเสร็จสมบูรณ์`} tone="var(--mx-success)" />
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            <Metric label="Overdue" value={overdueTasks.length} sub="งาน active ที่เกินกำหนด" icon="fa-triangle-exclamation" tone={overdueTasks.length ? 'status-bad' : 'status-good'} />
            <Metric label="At Risk" value={atRiskTasks.length} sub="ครบกำหนดใน 3 วัน" icon="fa-clock" tone={atRiskTasks.length ? 'status-warn' : 'status-good'} />
            <Metric label="Weighted Score" value={fmtPct(weightedScore)} sub="SLA + Completion" icon="fa-ranking-star" tone={healthClass(weightedScore)} />
          </div>
        </div>
      </section>

      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <h2 className="section-title m-0">Management Summary</h2>
            <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">{periodLabel} · {state.user?.name || empId || 'No employee selected'}</p>
          </div>
          <span className="mx-badge status-neutral">Updated {new Date().toLocaleString('th-TH')}</span>
        </div>
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
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
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Scope</span><strong>{periodLabel}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Active workload</span><strong>{activeTasks.length}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Teams monitored</span><strong>{teamRows.length}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Presentation URL</span><strong>/dashboard?empId={empId || 'EMPID'}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="presentation-grid">
        <section className="mx-card p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="section-title m-0">Monthly Performance Trend</h2>
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">เส้นแนวโน้ม SLA, completion และ risk rate ตามเดือนของงานใน scope นี้</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="mx-badge status-info">SLA</span>
              <span className="mx-badge status-good">Completion</span>
              <span className="mx-badge status-bad">Risk</span>
            </div>
          </div>
          <div className="mt-5">
            <LineChart months={monthlyTrend.months} series={monthlyTrend.series} />
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Workload Mix</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">ภาพรวมสถานะงานและกลุ่ม KPI ที่กิน workload สูงสุด</p>
          <div className="grid gap-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black mb-3">Status Distribution</div>
              <div className="grid gap-3">
                {statusRows.map((row) => (
                  <div key={row.status}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className={`mx-badge ${statusClass(row.status)}`}>{row.status}</span>
                      <strong>{row.total} · {row.pct}%</strong>
                    </div>
                    <HorizontalBar value={row.pct} color={row.status === 'Completed' ? 'var(--mx-success)' : row.status === 'On Hold' ? 'var(--mx-danger)' : row.status === 'Pending' ? 'var(--mx-warning)' : 'var(--mx-info)'} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black mb-3">Top KPI Groups</div>
              <div className="grid gap-3">
                {kpiRows.map((row, index) => (
                  <div key={row.name} className="mx-soft p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-extrabold leading-5 min-w-0 break-words"><span className="text-[var(--mx-brass)] mr-2">#{index + 1}</span>{row.name}</div>
                      <span className="mx-badge status-neutral">{row.total}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--mx-muted)]">
                      <span>SLA <strong className="text-[var(--mx-text)]">{fmtPct(row.sla)}</strong></span>
                      <span>Done <strong className="text-[var(--mx-text)]">{fmtPct(row.completion)}</strong></span>
                      <span>Weight <strong className="text-[var(--mx-text)]">{row.weight}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid 2xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Team Performance Matrix</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">เจาะลึกรายทีม เรียงตาม overdue, risk และ weighted health</p>
          <div className="table-shell overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
                  <th className="pb-3">Team</th>
                  <th className="pb-3">Tasks</th>
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
                    <td className="py-4">{row.total}</td>
                    <td className="py-4 font-bold">{fmtPct(row.sla)}</td>
                    <td className="py-4 font-bold">{fmtPct(row.completion)}</td>
                    <td className="py-4"><span className={`mx-badge ${row.overdue ? 'status-bad' : row.risk ? 'status-warn' : 'status-good'}`}>{row.overdue} overdue / {row.risk} risk</span></td>
                    <td className="py-4"><span className={`mx-badge ${healthClass(row.health)}`}>{row.health >= 90 ? 'Healthy' : row.health >= 75 ? 'Watch' : row.health >= 60 ? 'Pressure' : 'Critical'}</span></td>
                  </tr>
                ))}
                {!teamRows.length && <tr><td className="py-8 text-center text-[var(--mx-muted)]" colSpan="6">No team data in this scope.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Critical Work Queue</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">งานที่มีความเสี่ยงกระทบ SLA/KPI สูงสุดใน scope นี้</p>
          <div className="grid gap-3">
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
                    <span className="mx-badge status-neutral">{task.team || '-'}</span>
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

      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h2 className="section-title m-0">Individual Performance Deep Dive</h2>
            <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">รายละเอียดรายบุคคลจาก workload, SLA, completion และงานเสี่ยง</p>
          </div>
          <span className="mx-badge status-neutral">{personRows.length} people</span>
        </div>
        <div className="table-shell overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
                <th className="pb-3">Person</th>
                <th className="pb-3">Tasks</th>
                <th className="pb-3">Active</th>
                <th className="pb-3">SLA</th>
                <th className="pb-3">Completion</th>
                <th className="pb-3">Risk</th>
                <th className="pb-3">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--mx-line)]">
              {personRows.slice(0, 24).map((row) => (
                <tr key={row.name}>
                  <td className="py-4 font-extrabold max-w-[280px]">
                    <div className="truncate">{row.name}</div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold w-10">{row.total}</span>
                      <div className="w-28"><HorizontalBar value={tasks.length ? Math.round((row.total / tasks.length) * 100) : 0} /></div>
                    </div>
                  </td>
                  <td className="py-4">{row.active}</td>
                  <td className="py-4 font-bold">{fmtPct(row.sla)}</td>
                  <td className="py-4 font-bold">{fmtPct(row.completion)}</td>
                  <td className="py-4">
                    <span className={`mx-badge ${row.overdue ? 'status-bad' : row.risk ? 'status-warn' : 'status-good'}`}>{row.overdue} overdue / {row.risk} risk</span>
                  </td>
                  <td className="py-4"><span className={`mx-badge ${healthClass(row.health)}`}>{row.health}</span></td>
                </tr>
              ))}
              {!personRows.length && <tr><td className="py-8 text-center text-[var(--mx-muted)]" colSpan="7">No individual data in this scope.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
