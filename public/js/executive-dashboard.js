const { useEffect, useMemo, useState } = React;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'fa-chart-line' },
  { id: 'teams', label: 'Teams', icon: 'fa-people-group' },
  { id: 'employees', label: 'Employees', icon: 'fa-id-badge' },
  { id: 'kpi', label: 'KPI Analysis', icon: 'fa-bullseye' },
  { id: 'weights', label: 'KPI Weights', icon: 'fa-scale-balanced' },
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

function mainKpi(task) {
  return String(task?.mainkpi ?? task?.mainKpi ?? task?.main ?? 'Other').trim() || 'Other';
}

function subKpi(task) {
  return String(task?.subkpi ?? task?.subKpi ?? task?.sub ?? task?.job ?? 'General').trim() || 'General';
}

function personName(task) {
  return String(task?.name || task?.assignee || task?.owner || task?.empName || task?.empId || task?.empid || 'Unassigned').trim();
}

function teamName(task) {
  return String(task?.team || 'Unassigned').trim();
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
  if (days < 0) return [`${Math.abs(days)}d late`, 'status-bad'];
  if (days <= 3) return [`${days}d left`, 'status-warn'];
  return [`${days}d left`, 'status-info'];
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
  const groups = {};
  (tasks || []).forEach((task) => {
    if (isCancelled(task)) return;
    const key = mainKpi(task);
    const weight = taskWeight(task);
    if (!groups[key]) groups[key] = { weight, total: 0, completed: 0, onTime: 0 };
    else groups[key].weight = Math.max(groups[key].weight, weight);
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
    sla: slaWeight > 0 ? Math.round((onTimeWeight / slaWeight) * 1000) / 10 : null,
    completion: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 1000) / 10 : null,
    totalWeight,
  };
}

function getTaskMonth(task) {
  const raw = task.completiondate || task.deadline || task.startdate || task.created_at || task.timestamp;
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.getMonth();
}

function buildPortfolio(tasks) {
  const active = tasks.filter(isActive);
  const completed = tasks.filter(isCompleted);
  const onProcess = tasks.filter(isOnProcess);
  const overdue = active.filter((task) => {
    const days = daysUntil(task);
    return days !== null && days < 0;
  });
  const atRisk = active.filter((task) => {
    const days = daysUntil(task);
    return days !== null && days >= 0 && days <= 3;
  });
  const slaPass = tasks.filter(isCompletedOnTime);
  const slaFail = tasks.filter(isCompletedLate);
  const scores = calcWeightedScores(tasks);
  const completion = scores.completion ?? (tasks.length ? Math.round((completed.length / tasks.length) * 1000) / 10 : null);
  const weightedScore = completion !== null && scores.sla !== null
    ? Math.round(((completion + scores.sla) / 2) * 10) / 10
    : (completion ?? scores.sla);

  return { active, completed, onProcess, overdue, atRisk, slaPass, slaFail, scores, completion, weightedScore };
}

function buildGroupRows(tasks, getKey) {
  return Object.entries(groupBy(tasks, getKey)).map(([name, items]) => {
    const portfolio = buildPortfolio(items);
    const topKpiEntry = Object.entries(groupBy(items, mainKpi)).sort((a, b) => b[1].length - a[1].length)[0];
    const health = Math.round(((portfolio.scores.sla ?? portfolio.completion ?? 0) + (portfolio.completion ?? portfolio.scores.sla ?? 0)) / 2)
      - portfolio.overdue.length * 5
      - portfolio.atRisk.length * 2;
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
      share: tasks.length ? Math.round((items.length / tasks.length) * 1000) / 10 : 0,
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

function TabBar({ activeTab, setActiveTab }) {
  return (
    <nav className="tab-strip no-print">
      {TAB_ITEMS.map((tab) => (
        <button key={tab.id} className={`tab-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
          <i className={`fa-solid ${tab.icon}`}></i>
          <span>{tab.label}</span>
        </button>
      ))}
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

function OverviewPanel({ portfolio, teamRows, kpiRows, statusRows, criticalQueue, monthlyTrend, periodLabel, user, empId, tasks }) {
  const highestRisk = teamRows[0];
  const strongestTeam = [...teamRows].sort((a, b) => (b.sla || 0) - (a.sla || 0))[0];
  const insights = [
    portfolio.overdue.length ? `${portfolio.overdue.length} overdue task(s) require executive attention.` : 'No overdue active tasks in the current scope.',
    portfolio.atRisk.length ? `${portfolio.atRisk.length} task(s) are due within 3 days and may affect SLA confidence.` : 'Short-term delivery risk is currently contained.',
    highestRisk ? `${highestRisk.team} carries the most visible operational pressure.` : 'No team pressure data is available yet.',
    strongestTeam ? `${strongestTeam.team} is the current SLA benchmark at ${fmtPct(strongestTeam.sla)}.` : 'No SLA benchmark is available yet.',
  ];

  return (
    <div className="grid gap-6">
      <section className="mx-card p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <h2 className="section-title m-0">Executive Intelligence</h2>
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
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Active workload</span><strong>{fmtNum(portfolio.active.length)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">SLA breach rate</span><strong>{tasks.length ? fmtPct(Math.round((portfolio.slaFail.length / Math.max(1, portfolio.completed.length)) * 1000) / 10) : '-'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Teams monitored</span><strong>{fmtNum(teamRows.length)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-[var(--mx-muted)]">Presentation URL</span><strong>/dashboard?empId={empId || 'EMPID'}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="presentation-grid">
        <section className="mx-card p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="section-title m-0">Execution Trend</h2>
              <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">SLA, completion, and risk rate across the selected period.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="mx-badge status-info">SLA</span>
              <span className="mx-badge status-good">Completion</span>
              <span className="mx-badge status-bad">Risk</span>
            </div>
          </div>
          <div className="mt-5"><LineChart months={monthlyTrend.months} series={monthlyTrend.series} /></div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Workload Mix</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Status distribution and top KPI exposure.</p>
          <div className="grid gap-5">
            {statusRows.map((row) => (
              <div key={row.status}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`mx-badge ${statusClass(row.status)}`}>{row.status}</span>
                  <strong>{fmtNum(row.total)} / {row.pct}%</strong>
                </div>
                <HorizontalBar value={row.pct} color={statusClass(row.status) === 'status-good' ? 'var(--mx-success)' : statusClass(row.status) === 'status-bad' ? 'var(--mx-danger)' : 'var(--mx-info)'} />
              </div>
            ))}
            <div className="grid gap-3">
              {kpiRows.slice(0, 6).map((row, index) => (
                <div key={row.name} className="mx-soft p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-extrabold leading-5 min-w-0 break-words"><span className="text-[var(--mx-brass)] mr-2">#{index + 1}</span>{row.name}</div>
                    <span className="mx-badge status-neutral">{fmtNum(row.total)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--mx-muted)]">
                    <span>SLA <strong className="text-[var(--mx-text)]">{fmtPct(row.sla)}</strong></span>
                    <span>Done <strong className="text-[var(--mx-text)]">{fmtPct(row.completion)}</strong></span>
                    <span>Share <strong className="text-[var(--mx-text)]">{fmtPct(row.share)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid 2xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Unified SLA + KPI Control Board</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Team-level control view for SLA, completion, backlog, and risk.</p>
          <div className="grid gap-4">
            {teamRows.slice(0, 8).map((row) => (
              <div key={row.team} className="control-row">
                <div className="min-w-0">
                  <div className="font-black truncate">{row.team}</div>
                  <div className="mt-1 text-xs text-[var(--mx-muted)]">Top KPI: {row.topKpi}</div>
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
                  <span className="mx-badge status-neutral">{fmtNum(row.backlog)} backlog</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Priority Watchlist</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Active work with the highest near-term SLA exposure.</p>
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

function TeamsPanel({ teamRows }) {
  return (
    <div className="grid gap-6">
      <div className="detail-grid">
        {teamRows.slice(0, 8).map((row) => (
          <div key={row.team} className="mx-card leader-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black">Team</div>
                <h3 className="mt-2 mb-0 text-xl font-black truncate">{row.team}</h3>
              </div>
              <span className={`mx-badge ${healthClass(row.health)}`}>{row.health}</span>
            </div>
            <div className="mini-metric-grid mt-5">
              <div><span>Total</span><strong>{fmtNum(row.total)}</strong></div>
              <div><span>Done</span><strong>{fmtNum(row.completed)}</strong></div>
              <div><span>Backlog</span><strong>{fmtNum(row.backlog)}</strong></div>
              <div><span>SLA Fail</span><strong>{fmtNum(row.slaFail)}</strong></div>
            </div>
            <div className="mt-5 grid gap-3">
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.SLA</span><span>{fmtPct(row.sla)}</span></div><HorizontalBar value={row.sla} color="var(--mx-info)" /></div>
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.Completion</span><span>{fmtPct(row.completion)}</span></div><HorizontalBar value={row.completion} color="var(--mx-success)" /></div>
            </div>
          </div>
        ))}
      </div>

      <section className="mx-card p-5 md:p-7">
        <h2 className="section-title m-0">Team SLA Summary</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Detailed team matrix aligned with the SPDS executive dashboard structure.</p>
        <DataTable minWidth={980}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
              <th className="p-4">Team</th><th className="p-4">Total</th><th className="p-4">Completed</th><th className="p-4">Backlog</th><th className="p-4">On Process</th><th className="p-4">SLA Pass</th><th className="p-4">SLA Fail</th><th className="p-4">W.SLA</th><th className="p-4">W.Completion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mx-line)]">
            {teamRows.map((row) => (
              <tr key={row.team}>
                <td className="p-4 font-black">{row.team}</td><td className="p-4">{fmtNum(row.total)}</td><td className="p-4">{fmtNum(row.completed)}</td><td className="p-4">{fmtNum(row.backlog)}</td><td className="p-4">{fmtNum(row.onProcess)}</td><td className="p-4">{fmtNum(row.slaPass)}</td><td className="p-4">{fmtNum(row.slaFail)}</td><td className="p-4 font-bold">{fmtPct(row.sla)}</td><td className="p-4 font-bold">{fmtPct(row.completion)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </section>
    </div>
  );
}

function EmployeesPanel({ personRows, teams, personTeamFilter, setPersonTeamFilter, tasks }) {
  const filtered = personTeamFilter === 'all' ? personRows : personRows.filter((row) => row.team === personTeamFilter);
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
      </section>

      <div className="employee-grid">
        {filtered.slice(0, 36).map((row, index) => (
          <div key={row.name} className="mx-card employee-card p-5">
            <div className="flex items-start gap-4">
              <div className="avatar-ring">{row.person.charAt(0).toUpperCase()}</div>
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
              <div><span>Done</span><strong>{fmtNum(row.completed)}</strong></div>
              <div><span>On Process</span><strong>{fmtNum(row.onProcess)}</strong></div>
              <div><span>SLA Fail</span><strong>{fmtNum(row.slaFail)}</strong></div>
            </div>
            <div className="mt-5 grid gap-3">
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.SLA</span><span>{fmtPct(row.sla)}</span></div><HorizontalBar value={row.sla} color="var(--mx-info)" /></div>
              <div><div className="flex justify-between text-xs font-black mb-2"><span>W.Completion</span><span>{fmtPct(row.completion)}</span></div><HorizontalBar value={row.completion} color="var(--mx-success)" /></div>
            </div>
            <div className="mt-5 mx-soft p-3 text-xs">
              <div className="font-black">Top KPI</div>
              <div className="mt-1 text-[var(--mx-muted)]">{row.topKpi} / {fmtNum(row.topKpiCount)} task(s)</div>
            </div>
          </div>
        ))}
      </div>

      <section className="mx-card p-5 md:p-7">
        <h2 className="section-title m-0">Employee Leaderboard Matrix</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">{fmtNum(filtered.length)} people from {fmtNum(tasks.length)} task records.</p>
        <DataTable minWidth={1040}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
              <th className="p-4">Rank</th><th className="p-4">Name</th><th className="p-4">Team</th><th className="p-4">Total</th><th className="p-4">Completed</th><th className="p-4">SLA Pass</th><th className="p-4">SLA Fail</th><th className="p-4">W.SLA</th><th className="p-4">W.Completion</th><th className="p-4">Performance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mx-line)]">
            {filtered.map((row, index) => (
              <tr key={row.name}>
                <td className="p-4 font-black text-[var(--mx-brass)]">{String(index + 1).padStart(2, '0')}</td>
                <td className="p-4 font-black">{row.person}</td>
                <td className="p-4"><span className="mx-badge status-neutral">{row.team}</span></td>
                <td className="p-4">{fmtNum(row.total)}</td><td className="p-4">{fmtNum(row.completed)}</td><td className="p-4">{fmtNum(row.slaPass)}</td><td className="p-4">{fmtNum(row.slaFail)}</td><td className="p-4 font-bold">{fmtPct(row.sla)}</td><td className="p-4 font-bold">{fmtPct(row.completion)}</td>
                <td className="p-4"><span className={`mx-badge ${healthClass(row.weightedScore)}`}>{row.weightedScore >= 90 ? 'Excellent' : row.weightedScore >= 75 ? 'Good' : row.weightedScore >= 60 ? 'Monitor' : 'Critical'}</span></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </section>
    </div>
  );
}

function KpiAnalysisPanel({ kpiRows, personRows, teamRows }) {
  const topPerformer = [...personRows].filter((row) => row.sla !== null).sort((a, b) => (b.sla || 0) - (a.sla || 0))[0];
  const bestTeam = [...teamRows].filter((row) => row.sla !== null).sort((a, b) => (b.sla || 0) - (a.sla || 0))[0];
  const avgTasks = personRows.length ? Math.round(personRows.reduce((sum, row) => sum + row.total, 0) / personRows.length) : 0;
  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-4 gap-5">
        <Metric label="KPI Categories" value={fmtNum(kpiRows.length)} sub="Main KPI categories" icon="fa-bullseye" tone="status-info" />
        <Metric label="Top Performer" value={topPerformer?.person || '-'} sub={topPerformer ? `W.SLA ${fmtPct(topPerformer.sla)}` : 'No scored person'} icon="fa-trophy" tone="status-good" />
        <Metric label="Best SLA Team" value={bestTeam?.team || '-'} sub={bestTeam ? `W.SLA ${fmtPct(bestTeam.sla)}` : 'No scored team'} icon="fa-bolt" tone="status-warn" />
        <Metric label="Avg Tasks/Person" value={fmtNum(avgTasks)} sub={`${fmtNum(personRows.length)} people`} icon="fa-users" tone="status-neutral" />
      </div>

      <div className="presentation-grid">
        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Top KPI Categories by Volume</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Portfolio share and execution quality by KPI group.</p>
          <div className="grid gap-4">
            {kpiRows.slice(0, 12).map((row) => (
              <div key={row.name} className="mx-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-black break-words">{row.name}</div>
                  <span className="mx-badge status-neutral">{fmtPct(row.share)}</span>
                </div>
                <div className="mt-4"><HorizontalBar value={row.share} color="var(--mx-brass)" /></div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-[var(--mx-muted)]">
                  <span>Total <strong className="text-[var(--mx-text)]">{fmtNum(row.total)}</strong></span>
                  <span>W.SLA <strong className="text-[var(--mx-text)]">{fmtPct(row.sla)}</strong></span>
                  <span>Done <strong className="text-[var(--mx-text)]">{fmtPct(row.completion)}</strong></span>
                  <span>Fail <strong className="text-[var(--mx-text)]">{fmtNum(row.slaFail)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-card p-5 md:p-7">
          <h2 className="section-title m-0">Weighted SLA Performance by Employee</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--mx-muted)]">Top 15 people by weighted SLA score.</p>
          <div className="grid gap-4">
            {[...personRows].filter((row) => row.sla !== null).sort((a, b) => (b.sla || 0) - (a.sla || 0)).slice(0, 15).map((row) => (
              <div key={row.name}>
                <div className="flex justify-between gap-3 mb-2 text-sm">
                  <span className="font-black truncate">{row.person}</span>
                  <span className={`font-black ${row.sla >= 95 ? 'text-[var(--mx-success)]' : row.sla >= 85 ? 'text-[var(--mx-warning)]' : 'text-[var(--mx-danger)]'}`}>{fmtPct(row.sla)}</span>
                </div>
                <HorizontalBar value={row.sla} color={row.sla >= 95 ? 'var(--mx-success)' : row.sla >= 85 ? 'var(--mx-warning)' : 'var(--mx-danger)'} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiWeightsPanel({ kpiWeightRows, kpiSearch, setKpiSearch }) {
  const search = kpiSearch.trim().toLowerCase();
  const filtered = search
    ? kpiWeightRows.filter((row) => [row.team, row.main, row.sub].join(' ').toLowerCase().includes(search))
    : kpiWeightRows;
  return (
    <section className="mx-card p-5 md:p-7">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="section-title m-0">KPI Configurations & Weights</h2>
          <p className="mt-1 mb-0 text-sm text-[var(--mx-muted)]">Searchable KPI weight detail by team, main KPI, and sub KPI.</p>
        </div>
        <input className="mx-input max-w-[420px]" value={kpiSearch} onChange={(e) => setKpiSearch(e.target.value)} placeholder="Search team, main KPI, or sub KPI" />
      </div>
      <div className="mt-5">
        <DataTable minWidth={1120}>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]">
              <th className="p-4">Team</th><th className="p-4">Main KPI</th><th className="p-4">Sub KPI</th><th className="p-4">Weight</th><th className="p-4">Total</th><th className="p-4">Completed</th><th className="p-4">Pending</th><th className="p-4">SLA Pass</th><th className="p-4">SLA Fail</th><th className="p-4">SLA %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mx-line)]">
            {filtered.map((row) => (
              <tr key={`${row.team}-${row.main}-${row.sub}`}>
                <td className="p-4"><span className="mx-badge status-neutral">{row.team}</span></td>
                <td className="p-4 font-black max-w-[280px]">{row.main}</td>
                <td className="p-4 max-w-[360px]">{row.sub}</td>
                <td className="p-4 font-bold">{row.weight}</td>
                <td className="p-4">{fmtNum(row.total)}</td>
                <td className="p-4">{fmtNum(row.completed)}</td>
                <td className="p-4">{fmtNum(row.pending)}</td>
                <td className="p-4">{fmtNum(row.slaPass)}</td>
                <td className="p-4">{fmtNum(row.slaFail)}</td>
                <td className="p-4 font-bold">{fmtPct(row.sla)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td className="p-8 text-center text-[var(--mx-muted)]" colSpan="10">No KPI weight records match this search.</td></tr>}
          </tbody>
        </DataTable>
      </div>
    </section>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const initialEmpId = String(params.get('empId') || '').trim().toUpperCase();
  const [empId, setEmpId] = useState(initialEmpId);
  const [month, setMonth] = useState(params.has('month') ? Number(params.get('month')) : 0);
  const [year, setYear] = useState(Number(params.get('year') || new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState('overview');
  const [personTeamFilter, setPersonTeamFilter] = useState('all');
  const [kpiSearch, setKpiSearch] = useState('');
  const [state, setState] = useState({ loading: false, error: '', user: null, tasks: [] });

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
      const initial = await API.getInitialData(cleanEmpId);
      if (initial?.error) throw new Error(initial.error);
      if (!initial?.user) throw new Error('User profile was not found.');
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
      setState((prev) => ({ ...prev, loading: false, error: error.message || 'Unable to load dashboard data.' }));
    }
  };

  useEffect(() => {
    if (initialEmpId) load(initialEmpId);
  }, [month, year]);

  const tasks = state.tasks || [];
  const portfolio = useMemo(() => buildPortfolio(tasks), [tasks]);
  const periodLabel = `${month === 0 ? 'All Months' : MONTH_NAMES[month - 1]} ${year}`;

  const teamRows = useMemo(() => buildGroupRows(tasks, teamName)
    .map((row) => ({ ...row, team: row.name }))
    .sort((a, b) => (a.overdue - b.overdue) || (a.risk - b.risk) || (b.health - a.health) || b.total - a.total), [tasks]);

  const personRows = useMemo(() => buildGroupRows(tasks, (task) => `${personName(task)}|${teamName(task)}`)
    .map((row) => {
      const [person, team] = row.name.split('|');
      return { ...row, person, team };
    })
    .sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0) || b.total - a.total), [tasks]);

  const statusRows = useMemo(() => Object.entries(groupBy(tasks, (task) => task.status || 'Unknown'))
    .map(([status, items]) => ({ status, total: items.length, pct: tasks.length ? Math.round((items.length / tasks.length) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total), [tasks]);

  const kpiRows = useMemo(() => buildKpiRows(tasks), [tasks]);
  const kpiWeightRows = useMemo(() => buildKpiWeightRows(tasks), [tasks]);
  const teams = useMemo(() => [...new Set(teamRows.map((row) => row.team))], [teamRows]);

  const monthlyTrend = useMemo(() => {
    const months = month === 0 ? Array.from({ length: 12 }, (_, i) => i) : [month - 1];
    const sla = [];
    const trendCompletion = [];
    const risk = [];
    months.forEach((monthIndex) => {
      const monthTasks = tasks.filter((task) => getTaskMonth(task) === monthIndex);
      const monthPortfolio = buildPortfolio(monthTasks);
      sla.push(monthTasks.length ? monthPortfolio.scores.sla : null);
      trendCompletion.push(monthTasks.length ? monthPortfolio.completion : null);
      risk.push(monthTasks.length ? Math.round(((monthPortfolio.overdue.length + monthPortfolio.atRisk.length) / monthTasks.length) * 1000) / 10 : null);
    });
    return { months, series: { sla, completion: trendCompletion, risk } };
  }, [tasks, month]);

  const criticalQueue = useMemo(() => portfolio.active
    .map((task) => ({ task, days: daysUntil(task), weight: taskWeight(task) }))
    .filter((item) => item.days !== null)
    .sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return (riskA - riskB) || (a.days - b.days) || (b.weight - a.weight);
    })
    .slice(0, 12), [portfolio.active]);

  return (
    <Shell>
      <header className="mx-card stage-header p-5 md:p-8">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mx-badge status-info"><i className="fa-solid fa-display"></i> Executive View</span>
              <span className="mx-badge status-neutral">MAXIWA KPI</span>
              {state.user && <span className="mx-badge status-good">{state.user.role} / {state.user.team}</span>}
            </div>
            <h1 className="display-title mt-6 mb-0 break-words">
              <span className="block">Executive Performance</span>
              <span className="block">Command Center</span>
            </h1>
            <p className="mt-4 mb-0 max-w-[84ch] text-base md:text-[18px] leading-8 text-[var(--mx-muted)]">
              Boardroom-ready SLA, KPI weight, team capacity, employee performance, and priority risk intelligence.
            </p>
          </div>
          <div className="no-print control-panel flex flex-wrap gap-2 xl:justify-end xl:max-w-[640px]">
            <input className="mx-input !w-36" value={empId} onChange={(e) => setEmpId(e.target.value.toUpperCase())} placeholder="empId" />
            <select className="mx-input !w-40" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              <option value={0}>All Months</option>
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
            <GaugeMetric label="Overall SLA" value={portfolio.scores.sla} sub="Weighted on-time completion across KPI groups" tone="var(--mx-info)" />
            <GaugeMetric label="Weighted Completion" value={portfolio.completion} sub={`${fmtNum(portfolio.completed.length)} of ${fmtNum(tasks.length)} tasks completed`} tone="var(--mx-success)" />
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            <Metric label="Total Tasks" value={fmtNum(tasks.length)} sub={periodLabel} icon="fa-clipboard-list" tone="status-neutral" />
            <Metric label="Overdue" value={fmtNum(portfolio.overdue.length)} sub="Active tasks past deadline" icon="fa-triangle-exclamation" tone={portfolio.overdue.length ? 'status-bad' : 'status-good'} />
            <Metric label="At Risk" value={fmtNum(portfolio.atRisk.length)} sub="Due within 3 days" icon="fa-clock" tone={portfolio.atRisk.length ? 'status-warn' : 'status-good'} />
          </div>
        </div>
      </section>

      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'overview' && <OverviewPanel portfolio={portfolio} teamRows={teamRows} kpiRows={kpiRows} statusRows={statusRows} criticalQueue={criticalQueue} monthlyTrend={monthlyTrend} periodLabel={periodLabel} user={state.user} empId={empId} tasks={tasks} />}
      {activeTab === 'teams' && <TeamsPanel teamRows={teamRows} />}
      {activeTab === 'employees' && <EmployeesPanel personRows={personRows} teams={teams} personTeamFilter={personTeamFilter} setPersonTeamFilter={setPersonTeamFilter} tasks={tasks} />}
      {activeTab === 'kpi' && <KpiAnalysisPanel kpiRows={kpiRows} personRows={personRows} teamRows={teamRows} />}
      {activeTab === 'weights' && <KpiWeightsPanel kpiWeightRows={kpiWeightRows} kpiSearch={kpiSearch} setKpiSearch={setKpiSearch} />}
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
