import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const context = vm.createContext({ console, Date, Set, Map, URLSearchParams, window: {},
  React: { createContext: (value) => ({ value }) } });
vm.runInContext(fs.readFileSync('public/js/api.js', 'utf8'), context);
const source = fs.readFileSync('public/js/executive-dashboard.js', 'utf8').replace(/ReactDOM\.createRoot[\s\S]*$/, '');
vm.runInContext(transformSync(source, { loader: 'jsx' }).code + '\n globalThis.model = { buildPortfolio, buildGroupRows, buildKpiRows, buildPersonalKpiRows, buildWeightCatalogRows, buildPeopleRows, taskWeight, hasExplicitWeight, buildDataQuality, buildAgingBuckets, scopeTasksForUser, filterByAllowedTeams, sortRows, performanceLabel, daysUntil, getPerformanceRiskAsOfDate, visiblePersonalKpiRows, configuredWeightsForPerson, sumPersonalKpiWeights, summarizePersonalKpiWeights, resolvePersonalTaskKpi, teamTaskWeightInfo, createTeamWeightResolver, buildTeamPeopleRows };', context);
const m = context.model;
const asOf = new Date('2026-11-19T00:00:00');
const make = (patch = {}) => ({ id: 'T1', empid: 'E1', name: 'Fixture One', team: 'Alpha', mainkpi: 'Delivery', subkpi: 'Install', status: 'Pending', mainkpiweight: 30, startdate: '2025-12-01', deadline: '2026-11-18', ...patch });
let count = 0;
function test(name, fn) { fn(); count++; console.log('ok - ' + name); }
const catalog = [
  { id: 'K1', team: 'Alpha', main: 'Delivery', sub: 'Install', main_weight: 50 },
  { id: 'K2', team: 'Alpha', main: 'Delivery', sub: 'Audit', main_weight: 50 },
  { id: 'K3', team: 'Alpha', main: 'Quality', sub: 'Install', main_weight: 20 },
];
const profile = { empid: 'E1', name: 'Fixture One', team: 'Alpha', permissions: { kpiAssignments: { K1: true, K2: true }, kpiOverrides: { K1: { weight: 25 } } } };

test('Weighted score preserves the existing task formula and excludes cancelled work', () => {
  const tasks = [make({ status: 'Completed', completiondate: '2026-11-17', mainkpiweight: 30 }),
    make({ id: 'T2', status: 'Completed', completiondate: '2026-11-19', mainkpiweight: 10 }),
    make({ id: 'T3', mainkpiweight: 60 }), make({ id: 'T4', status: 'Cancelled', mainkpiweight: 99 })];
  const p = m.buildPortfolio(tasks, [], asOf);
  assert.equal(p.completion, 40); assert.equal(p.scores.sla, 75); assert.equal(p.weightedScore, 57.5);
  const row = m.buildGroupRows(tasks, (t) => t.empid, [], asOf)[0];
  assert.equal(row.backlog, 1); assert.equal(row.cancelled, 1); assert.equal(row.total, 4);
  assert.equal(row.activeOwnShare, 60);
});

test('Empty and cancelled-only scopes stay unrated, not zero-performance', () => {
  for (const tasks of [[], [make({ status: 'Cancelled' })]]) {
    const p = m.buildPortfolio(tasks, [], asOf);
    assert.equal(p.completion, null); assert.equal(p.scores.sla, null); assert.equal(p.weightedScore, null);
  }
  const row = m.buildGroupRows([make({ status: 'Cancelled' })], (t) => t.empid, [], asOf)[0];
  assert.equal(row.health, null); assert.equal(row.backlog, 0);
  assert.equal(m.performanceLabel(null), 'ยังประเมินไม่ได้');
});

test('Snapshot weights and legacy weights use the same priority as the score and quality check', () => {
  const task = make({ mainkpiweight: undefined, extra_data: JSON.stringify({ kpi_effective_weight: 35 }) });
  assert.equal(m.taskWeight(task), 35); assert.equal(m.hasExplicitWeight(task), true);
  assert.equal(m.buildDataQuality([task]).checks.find((c) => c.key === 'missingWeight').items.length, 0);
  assert.equal(m.taskWeight(make({ mainkpiweight: undefined, extra_data: 'null' })), 1);
});

test('Assignments without work remain visible and overrides never rewrite historical weights', () => {
  const person = { team: 'Alpha', profile, asOfDate: asOf, items: [make(), make({ id: 'T2', mainkpiweight: 40 })] };
  const rows = m.buildPersonalKpiRows(person, catalog, []);
  const install = rows.find((r) => r.sub === 'Install');
  assert.equal(rows.length, 2); assert.equal(install.baseWeight, 50); assert.equal(install.effectiveWeight, 25);
  assert.equal(install.overridden, true); assert.deepEqual(Array.from(install.weights), [30, 40]);
  const audit = rows.find((r) => r.sub === 'Audit'); assert.equal(audit.items.length, 0); assert.equal(audit.portfolio.weightedScore, null);
});

test('Same Sub KPI in different Main KPIs stays separate; performed unassigned KPI stays visible', () => {
  const rows = m.buildPersonalKpiRows({ profile, team: 'Alpha', items: [make(), make({ mainkpi: 'Quality' })] }, catalog, []);
  assert.equal(rows.filter((r) => r.sub === 'Install').length, 2);
  const quality = rows.find((r) => r.main === 'Quality'); assert.equal(quality.assigned, false); assert.equal(quality.baseWeight, 20);
});

test('Catalog includes zero-work configurations, multiple actual weights and orphan tasks', () => {
  const rows = m.buildWeightCatalogRows(catalog, [make(), make({ mainkpiweight: 40 }), make({ mainkpi: 'Retired', subkpi: 'Old' })], [], asOf);
  assert.equal(rows.length, 4); assert.equal(rows.find((r) => r.sub === 'Audit').items.length, 0);
  assert.deepEqual(Array.from(rows.find((r) => r.main === 'Delivery' && r.sub === 'Install').weights), [30, 40]);
  assert.equal(rows.find((r) => r.main === 'Retired').configured, false);
});

test('People include zero-work staff, merge unambiguous legacy names and keep same-name teams distinct', () => {
  const directory = [profile, { empid: 'E2', name: 'Fixture One', team: 'Beta' }, { empid: 'E3', name: 'No Work', team: 'Alpha' }];
  const rows = m.buildPeopleRows([make(), make({ id: 'T2', empid: '' }), make({ id: 'T3', empid: 'E2', team: 'Beta' })], directory, [], asOf);
  assert.equal(rows.length, 3); assert.equal(rows.find((r) => r.empId === 'E1').total, 2);
  const noWork = rows.find((r) => r.empId === 'E3'); assert.equal(noWork.total, 0); assert.equal(noWork.weightedScore, null);
  assert.equal(rows.reduce((sum, r) => sum + r.total, 0), 3);
});

test('Aging covers every active task exactly once including future and no-deadline work', () => {
  const tasks = [make(), make({ deadline: '2026-11-20' }), make({ deadline: '2027-01-01' }), make({ deadline: null })];
  const buckets = m.buildAgingBuckets(tasks, [], asOf);
  assert.equal(Object.values(buckets).reduce((sum, b) => sum + b.total, 0), 4);
  assert.equal(buckets.future.total, 1); assert.equal(buckets.noDeadline.total, 1);
});

test('KPI workload denominator excludes cancellation and risk drilldown equals displayed counts', () => {
  const rows = m.buildKpiRows([make(), make({ mainkpi: 'Other', status: 'Cancelled', mainkpiweight: 99 })], [], asOf);
  const delivery = rows.find((r) => r.name === 'Delivery');
  assert.equal(delivery.weightShare, 100); assert.equal(delivery.riskItems.length, delivery.overdue + delivery.risk);
});

test('Missing and invalid dates and unknown statuses surface as quality issues with unique affected count', () => {
  const task = make({ status: 'mystery', deadline: 'invalid', mainkpiweight: undefined, subkpi: '' });
  const q = m.buildDataQuality([task]); assert.equal(q.affectedTasks, 1); assert.ok(q.totalIssues >= 3);
  assert.equal(m.buildPortfolio([make({ status: 'Completed', completiondate: null })], [], asOf).scores.sla, 0);
});

test('Staff, Lead, Manager and strategic scopes retain existing permission boundaries', () => {
  const tasks = [make(), make({ empid: 'E2' }), make({ empid: 'E3', team: 'Beta' })];
  assert.equal(m.scopeTasksForUser({ ...profile, role: 'Staff' }, tasks).length, 1);
  assert.equal(m.scopeTasksForUser({ ...profile, role: 'Lead' }, tasks).length, 2);
  for (const role of ['Manager', 'Director', 'Executive', 'SrManager']) assert.equal(m.scopeTasksForUser({ role, permissions: { allowedTeams: ['Beta'] } }, tasks).length, 1);
  assert.equal(m.scopeTasksForUser({ role: 'Admin' }, tasks).length, 3);
});

test('Active Weight sort follows the displayed row share and always keeps unrated rows last', () => {
  const rows = m.sortRows([{ id: 'A', activeOwnShare: 90 }, { id: 'B', activeOwnShare: 10 }, { id: 'C', activeOwnShare: null }], { key: 'activeOwnShare', direction: 'asc' });
  assert.deepEqual(Array.from(rows, (r) => r.id), ['B', 'A', 'C']);
});

test('Historic all-year risk date uses the selected year and hold deadline uses the same as-of date', () => {
  assert.equal(m.getPerformanceRiskAsOfDate(12, 2020).getFullYear(), 2020);
  const task = make({ status: 'On_Hold', deadline: '2026-11-18', extra_data: { hold_started_at: '2026-11-16' } });
  assert.equal(m.daysUntil(task, [], asOf), 2);
});
test('Fractional weights keep workload shares accurate without rounding away small tasks', () => {
  const p = m.buildPortfolio([make({ mainkpiweight: 0.1 })], [], asOf);
  assert.equal(p.totalWeight, 0.001); assert.equal(p.aging.overdue1to3.weight, 0.001);
  const row = m.buildGroupRows([make({ mainkpiweight: 0.1 })], (task) => task.empid, [], asOf)[0];
  assert.equal(row.activeOwnShare, 100);
});

test('Missing staff profiles never imply confirmed personal assignments', () => {
  const rows = m.buildPersonalKpiRows({ team: 'Alpha', profile: null, items: [make()] }, catalog, []);
  assert.ok(rows.every((row) => row.assignmentKnown === false));
});

test('Staff directory aliases retain the employee identity', () => {
  const rows = m.buildPeopleRows([make()], [{ emp_id: 'E1', fullname: 'Fixture One', team: 'Alpha' }], [], asOf);
  assert.equal(rows.length, 1); assert.equal(rows[0].empId, 'E1'); assert.ok(rows[0].profile);
});
test('Personal display hides zero-work Main and Sub KPIs while retaining configured overrides', () => {
  const person = { team: 'Alpha', profile: { ...profile, permissions: { ...profile.permissions, kpiAssignments: { K1: true, K2: true, K3: true } } }, asOfDate: asOf, items: [make()] };
  const rows = m.visiblePersonalKpiRows(person, catalog, []);
  assert.equal(rows.length, 1); assert.equal(rows[0].sub, 'Install'); assert.equal(rows[0].effectiveWeight, 25);
  assert.equal(m.visiblePersonalKpiRows({ ...person, items: [] }, catalog, []).length, 0);
  assert.equal(m.visiblePersonalKpiRows(person, catalog, [], 'current').length, 3);
  const card = m.configuredWeightsForPerson(person, catalog);
  assert.equal(card.rows.length, 1); assert.equal(card.rows[0].effectiveWeight, 25);
});
test('Main KPI total sums each displayed Sub KPI once, preserves equal weights and applies personal overrides', () => {
  const person = { team: 'Alpha', profile, items: [make(), make({ id: 'T2' }), make({ id: 'T3', subkpi: 'Audit' })] };
  const rows = m.visiblePersonalKpiRows(person, catalog, []);
  assert.equal(m.sumPersonalKpiWeights(rows), 75);
  assert.equal(m.sumPersonalKpiWeights(rows.map((row) => ({ ...row, effectiveWeight: 5 }))), 10);
  const install = rows.find((row) => row.sub === 'Install');
  assert.equal(m.sumPersonalKpiWeights([install, install]), 25);
  assert.equal(m.sumPersonalKpiWeights(rows.map((row) => ({ ...row, assignmentKnown: false }))), null);
  assert.equal(m.sumPersonalKpiWeights([]), null);
});
test('Renamed Main KPI resolves a unique same-team Sub KPI and retains the personal override', () => {
  const person = { profile, team: 'Alpha', items: [make({ mainkpi: 'Old Delivery' })] };
  const uniqueCatalog = catalog.filter((kpi) => kpi.id !== 'K3');
  const rows = m.visiblePersonalKpiRows(person, uniqueCatalog, []);
  assert.equal(rows.length, 1); assert.equal(rows[0].effectiveWeight, 25); assert.equal(m.sumPersonalKpiWeights(rows), 25);
  const byId = m.resolvePersonalTaskKpi(make({ mainkpi: 'Old Main', subkpi: 'Old Sub', kpi_id: 'K1' }), catalog);
  assert.equal(byId.id, 'K1');
});

test('Ambiguous or cross-team matches do not borrow another KPI setting', () => {
  const ambiguous = [...catalog, { id: 'OTHER', team: 'Alpha', main: 'Another Main', sub: 'Install', main_weight: 99 }];
  assert.equal(m.resolvePersonalTaskKpi(make({ mainkpi: 'Old Main' }), ambiguous), null);
  assert.equal(m.resolvePersonalTaskKpi(make({ team: 'Beta', kpi_id: 'K1' }), catalog), null);
  assert.equal(m.resolvePersonalTaskKpi(make({ mainkpi: 'Old', subkpi: '' }), catalog), null);
});

test('Partial Main KPI totals preserve confirmed weights and explicitly count missing settings', () => {
  const rows = m.visiblePersonalKpiRows({ profile, team: 'Alpha', items: [make(), make({ subkpi: 'No Match' })] }, catalog, []);
  const result = m.summarizePersonalKpiWeights(rows);
  assert.equal(result.total, 25); assert.equal(result.missing, 1); assert.equal(result.complete, false);
  assert.equal(m.sumPersonalKpiWeights(rows), null);
});
test('Team and personal scores use independent weight bases for identical tasks', () => {
  const teamCatalog = [{ id: 'A', team: 'Alpha', main: 'Delivery', sub: 'Install', main_weight: 10 }, { id: 'B', team: 'Alpha', main: 'Delivery', sub: 'Audit', main_weight: 30 }];
  const tasks = [make({ status: 'Completed', completiondate: '2026-11-17', mainkpiweight: 90 }), make({ id: 'T2', subkpi: 'Audit', status: 'Completed', completiondate: '2026-11-19', mainkpiweight: 10 }), make({ id: 'T3', mainkpiweight: 100 })];
  const weight = m.createTeamWeightResolver(teamCatalog);
  const team = m.buildPortfolio(tasks, [], asOf, weight); const personal = m.buildPortfolio(tasks, [], asOf);
  assert.equal(team.completion, 80); assert.equal(team.scores.sla, 25); assert.equal(team.weightedScore, 52.5);
  assert.equal(personal.completion, 50); assert.equal(personal.scores.sla, 90); assert.equal(personal.weightedScore, 70);
  assert.equal(team.scoreBasis, 'team'); assert.equal(personal.scoreBasis, 'personal');
  assert.equal(team.activeWeight, 0.1); assert.equal(team.aging.overdue1to3.weight, 0.1);
  tasks[0].mainkpiweight = 900;
  assert.equal(m.buildPortfolio(tasks, [], asOf, weight).weightedScore, 52.5);
  assert.notEqual(m.buildPortfolio(tasks, [], asOf).weightedScore, personal.weightedScore);
  const grouped = m.buildGroupRows(tasks, (task) => task.team, [], asOf, weight)[0];
  assert.equal(grouped.weightedScore, team.weightedScore);
  const kpi = m.buildKpiRows(tasks, [], asOf, weight)[0]; assert.equal(kpi.completion, team.completion); assert.equal(kpi.sla, team.scores.sla);
});

test('Team fallback uses an explicit base snapshot and never borrows personal effective weight', () => {
  const task = make({ mainkpiweight: 99, extra_data: { kpi_effective_weight: 99, kpi_base_weight: 15 } });
  assert.equal(m.teamTaskWeightInfo(task, []).value, 15); assert.equal(m.taskWeight(task), 99);
  assert.equal(m.teamTaskWeightInfo(task, catalog).value, 50);
  const unknown = make({ subkpi: 'Unknown', mainkpiweight: 99 });
  const resolver = m.createTeamWeightResolver(catalog); assert.equal(resolver(unknown), 1); assert.equal(resolver.info(unknown).known, false);
  assert.equal(m.buildPortfolio([unknown], [], asOf, resolver).dataQuality.checks.find((check) => check.key === 'missingWeight').items.length, 1);
});

test('Team score aggregates team tasks directly, not the mean of employee scores', () => {
  const teamCatalog = [{ team: 'Alpha', main: 'Delivery', sub: 'Install', main_weight: 10 }, { team: 'Alpha', main: 'Delivery', sub: 'Audit', main_weight: 30 }];
  const tasks = [make({ status: 'Completed', completiondate: '2026-11-17', mainkpiweight: 90 }), make({ empid: 'E2', name: 'Another Person', subkpi: 'Audit', status: 'Completed', completiondate: '2026-11-19', mainkpiweight: 10 })];
  const team = m.buildPortfolio(tasks, [], asOf, m.createTeamWeightResolver(teamCatalog));
  const people = m.buildPeopleRows(tasks, [profile], [], asOf);
  assert.equal(team.scores.sla, 25); assert.equal(people[0].sla, 100); assert.equal(people[1].sla, 0);
  assert.notEqual(team.scores.sla, (people[0].sla + people[1].sla) / 2);
  assert.equal(people.reduce((sum, row) => sum + row.total, 0), tasks.length);
});
test('A person with work in multiple teams contributes only the matching team tasks to each team detail', () => {
  const tasks = [make({ status: 'Completed', completiondate: '2026-11-17' }), make({ id: 'BETA', team: 'Beta', status: 'Completed', completiondate: '2026-11-19' })];
  const people = m.buildPeopleRows(tasks, [profile], [], asOf);
  assert.equal(people.length, 1); assert.equal(people[0].total, 2);
  const alpha = m.buildTeamPeopleRows(people, 'Alpha', [], asOf)[0]; const beta = m.buildTeamPeopleRows(people, 'Beta', [], asOf)[0];
  assert.equal(alpha.total, 1); assert.equal(beta.total, 1); assert.equal(alpha.score, 100); assert.equal(beta.score, 50);
  assert.equal(alpha.source.employeeKey, people[0].employeeKey);
});
console.log('Passed ' + count + ' Performance model tests');
