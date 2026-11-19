import assert from 'node:assert/strict';
import { createPerformanceAdminFixture } from './performance-admin-fixture.mjs';
import { performanceEditScores, personalSnapshotWeight } from '../public/performance-admin-model.js';
const payload = () => ({ empId: 'E1', team: 'Alpha', targetKpiId: 'K1', taskIds: ['T2'], changeTeamWeight: true, teamWeight: 20, personalMode: 'custom', personalWeight: 12, assigned: true, reason: 'Repair selected historical KPI', year: 2026, months: [11] });
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('ok - ' + name); }
const writes = (fixture) => fixture.state.calls.filter((call) => call.method !== 'GET');
await test('Preview computes both score bases and performs no database writes', async () => {
  const f = createPerformanceAdminFixture(); const response = await f.request('admin/previewPerformanceEdit', payload()); const p = await response.json();
  assert.equal(response.status, 200); assert.equal(writes(f).length, 0); assert.equal(p.rows.length, 1); assert.equal(p.rows[0].id, 'T2');
  assert.equal(p.scores.personal.before.completion, 43); assert.equal(p.scores.personal.after.completion, 71);
  assert.equal(p.scores.team.before.completion, 95); assert.equal(p.scores.team.after.completion, 67); assert.equal(p.teamAffected, 3);
  assert.equal(p.fingerprint.length, 64);
});
await test('Apply saves team/personal settings and only selected tasks, preserving status/dates/notes/hold metadata', async () => {
  const f = createPerformanceAdminFixture(); const original = structuredClone(f.state.tasks);
  const preview = await (await f.request('admin/previewPerformanceEdit', payload())).json();
  const response = await f.request('admin/applyPerformanceEdit', { ...payload(), fingerprint: preview.fingerprint }); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.ok, true); assert.deepEqual(result.updatedIds, ['T2']);
  assert.equal(f.state.kpis[0].main_weight, 20); assert.equal(f.state.users[1].permissions.kpiOverrides.K1.weight, 12);
  assert.equal(f.state.tasks[1].mainkpi, 'Delivery'); assert.equal(f.state.tasks[1].subkpi, 'Install'); assert.equal(f.state.tasks[1].mainkpiweight, 12);
  assert.equal(f.state.tasks[1].extra_data.kpi_id, 'K1'); assert.equal(f.state.tasks[1].extra_data.kpi_base_weight, 20); assert.equal(f.state.tasks[1].extra_data.hold_days_total, 3);
  for (const key of ['status','deadline','startdate','completiondate','note','job','team','empid']) assert.equal(f.state.tasks[1][key], original[1][key]);
  assert.deepEqual(f.state.tasks[0], original[0]); assert.deepEqual(f.state.tasks[2], original[2]);
  assert.equal(f.state.audit_log.length, 1); assert.equal(f.state.audit_log[0].by_user, 'ADMIN'); assert.equal(f.state.audit_log[0].action, 'admin_performance_edit');
});
await test('Stale previews and modified intents are rejected before any writes', async () => {
  for (const change of ['record','intent']) {
    const f = createPerformanceAdminFixture(); const p = await (await f.request('admin/previewPerformanceEdit', payload())).json();
    if (change === 'record') f.state.tasks[1].note = 'Changed by another user';
    const response = await f.request('admin/applyPerformanceEdit', { ...payload(), ...(change === 'intent' ? { personalWeight: 99 } : {}), fingerprint: p.fingerprint });
    assert.equal(response.status, 409); assert.equal(writes(f).length, 0);
  }
});
await test('Non-admin, invalid session, wrong owner, oversized selection, wrong team and missing preview fail closed', async () => {
  const cases = [
    { identity: { empId: 'E1', sessionId: 'staff-session' }, status: 403 },
    { identity: { empId: 'ADMIN', sessionId: 'wrong' }, status: 409 },
    { body: { taskIds: ['T3'] }, status: 409 },
    { body: { taskIds: Array.from({ length: 51 }, (_, i) => String(i)) }, status: 400 },
    { body: { team: 'Beta' }, status: 400 },
    { path: 'admin/applyPerformanceEdit', status: 409 },
  ];
  for (const item of cases) {
    const f = createPerformanceAdminFixture(); const response = await f.request(item.path || 'admin/previewPerformanceEdit', { ...payload(), ...item.body }, item.identity);
    assert.equal(response.status, item.status, await response.text()); assert.equal(writes(f).length, 0);
  }
});
await test('Setting-only edits do not rewrite old tasks or change historical personal scores', async () => {
  const f = createPerformanceAdminFixture(); const body = { ...payload(), taskIds: [], changeTeamWeight: false };
  const p = await (await f.request('admin/previewPerformanceEdit', body)).json(); assert.equal(p.rows.length, 0); assert.deepEqual(p.scores.personal.before, p.scores.personal.after);
  const result = await (await f.request('admin/applyPerformanceEdit', { ...body, fingerprint: p.fingerprint })).json();
  assert.equal(result.ok, true); assert.equal(writes(f).filter((call) => call.table === 'tasks').length, 0); assert.equal(f.state.tasks[1].mainkpiweight, 40);
});
await test('A concurrent task edit is preserved by conditional PATCH and partial success is explicit', async () => {
  const f = createPerformanceAdminFixture(); const p = await (await f.request('admin/previewPerformanceEdit', payload())).json();
  f.state.beforePatch = (table) => { if (table === 'tasks') { f.state.tasks[1].extra_data.hold_days_total = 9; f.state.beforePatch = null; } };
  const result = await (await f.request('admin/applyPerformanceEdit', { ...payload(), fingerprint: p.fingerprint })).json();
  assert.equal(result.partial, true); assert.equal(result.ok, false); assert.deepEqual(result.updatedIds, []); assert.deepEqual(result.notUpdatedIds, ['T2']);
  assert.equal(result.savedSettings.team, true); assert.equal(result.savedSettings.personal, true); assert.equal(f.state.tasks[1].extra_data.hold_days_total, 9); assert.equal(f.state.tasks[1].mainkpiweight, 40);
  assert.equal(JSON.parse(f.state.audit_log[0].details).partial, true);
});
await test('The preview score formula preserves the task-weighted rounding and cancelled exclusions', async () => {
  const score = performanceEditScores([{ status:'Completed', deadline:'2026-11-18', completiondate:'2026-11-17', weight:30 }, { status:'Completed', deadline:'2026-11-18', completiondate:'2026-11-19', weight:10 }, { status:'Pending', weight:60 }, { status:'Cancelled', weight:99 }], personalSnapshotWeight);
  assert.equal(score.completion, 40); assert.equal(score.sla, 75); assert.equal(score.score, 57.5);
});
await test('Revoked admin rights block apply even after a valid preview', async () => {
  const f = createPerformanceAdminFixture(); const p = await (await f.request('admin/previewPerformanceEdit', payload())).json();
  f.state.users[0].role = 'Staff';
  const response = await f.request('admin/applyPerformanceEdit', { ...payload(), fingerprint: p.fingerprint });
  assert.equal(response.status, 403); assert.equal(writes(f).length, 0);
});
await test('String JSON snapshots and permissions retain storage format and unrelated metadata', async () => {
  const f = createPerformanceAdminFixture();
  f.state.tasks[1].extra_data = JSON.stringify(f.state.tasks[1].extra_data);
  f.state.users[1].permissions = JSON.stringify({ untouched: true, kpiOverrides: { OTHER: { weight: 7 } } });
  const p = await (await f.request('admin/previewPerformanceEdit', payload())).json();
  const response = await f.request('admin/applyPerformanceEdit', { ...payload(), fingerprint: p.fingerprint });
  assert.equal((await response.json()).ok, true);
  assert.equal(typeof f.state.tasks[1].extra_data, 'string'); assert.equal(JSON.parse(f.state.tasks[1].extra_data).hold_days_total, 3);
  const perms = JSON.parse(f.state.users[1].permissions); assert.equal(perms.untouched, true); assert.equal(perms.kpiOverrides.OTHER.weight, 7);
});
await test('Reset to team standard removes only the selected override and leaves unselected work unchanged', async () => {
  const f = createPerformanceAdminFixture();
  f.state.users[1].permissions = { kpiOverrides: { K1: { weight: 15 }, OTHER: { weight: 7 } }, kpiAssignments: { K1: true, OTHER: true } };
  const body = { ...payload(), changeTeamWeight: false, personalMode: 'standard', assigned: false };
  const p = await (await f.request('admin/previewPerformanceEdit', body)).json();
  assert.equal(p.target.beforePersonalWeight, 15); assert.equal(p.target.afterPersonalWeight, 10);
  const result = await (await f.request('admin/applyPerformanceEdit', { ...body, fingerprint: p.fingerprint })).json();
  assert.equal(result.ok, true); assert.equal(f.state.users[1].permissions.kpiOverrides.K1, undefined);
  assert.equal(f.state.users[1].permissions.kpiOverrides.OTHER.weight, 7); assert.equal(f.state.users[1].permissions.kpiAssignments.OTHER, true);
  assert.equal(f.state.users[1].permissions.kpiAssignments.K1, undefined); assert.equal(f.state.tasks[0].mainkpiweight, 30);
  assert.equal(f.state.tasks[1].mainkpiweight, 10);
});
console.log('Passed ' + count + ' admin performance edit tests');
