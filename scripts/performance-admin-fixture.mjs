import worker from '../public/_worker.js';
import { canonicalPerformanceValue } from '../public/performance-admin-model.js';
let counter = 0;
export function createPerformanceAdminFixture({ users, kpis, tasks } = {}) {
  const now = new Date();
  const actor = { empid: 'ADMIN', name: 'Admin Fixture', team: 'Alpha', role: 'Admin', permissions: {}, active_session_id: 'admin-session', active_session_updated_at: now.toISOString(), active_session_expires_at: new Date(now.getTime() + 3600000).toISOString() };
  const person = { empid: 'E1', name: 'Person Fixture', team: 'Alpha', role: 'Staff', permissions: {}, active_session_id: 'staff-session', active_session_updated_at: now.toISOString(), active_session_expires_at: new Date(now.getTime() + 3600000).toISOString() };
  const state = {
    users: users || [actor, person],
    kpis: kpis || [{ id: 'K1', team: 'Alpha', main: 'Delivery', sub: 'Install', main_weight: 10, days: 2 }],
    tasks: tasks || [
      { id: 'T1', empid: 'E1', name: person.name, team: 'Alpha', job: 'Completed Fixture', mainkpi: 'Delivery', subkpi: 'Install', mainkpiweight: 30, weight: 30, extra_data: { hold_days_total: 2 }, status: 'Completed', startdate: '2026-11-01', deadline: '2026-11-18', completiondate: '2026-11-17', note: 'Keep this note' },
      { id: 'T2', empid: 'E1', name: person.name, team: 'Alpha', job: 'Repair Fixture', mainkpi: 'Old', subkpi: 'Typo', mainkpiweight: 40, weight: 40, extra_data: { hold_days_total: 3 }, status: 'Pending', startdate: '2026-11-01', deadline: '2026-11-18', completiondate: null, note: 'Keep this too' },
      { id: 'T3', empid: 'E2', name: 'Other Fixture', team: 'Alpha', job: 'Other Person', mainkpi: 'Delivery', subkpi: 'Install', mainkpiweight: 50, weight: 50, extra_data: {}, status: 'Completed', startdate: '2026-11-01', deadline: '2026-11-18', completiondate: '2026-11-19', note: '' },
    ],
    audit_log: [], holidays: [], calls: [], beforePatch: null,
  };
  const env = { SUPABASE_URL: 'https://performance-admin-fixture-' + (++counter) + '.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only' };
  function matches(row, query) {
    for (const [key, condition] of query) {
      if (['select', 'limit', 'offset', 'order', 'on_conflict'].includes(key)) continue;
      if (condition === 'is.null') { if (row[key] != null) return false; continue; }
      if (condition.startsWith('eq.')) {
        const expected = condition.slice(3);
        if (row[key] && typeof row[key] === 'object') {
          try { if (canonicalPerformanceValue(row[key]) !== canonicalPerformanceValue(JSON.parse(expected))) return false; } catch { return false; }
        } else if (String(row[key] ?? '') !== expected) return false;
      }
    }
    return true;
  }
  async function fakeFetch(input, options = {}) {
    const url = new URL(input);
    if (url.origin !== env.SUPABASE_URL) throw new Error('Unexpected fixture network');
    const table = url.pathname.split('/').pop(); const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ table, method, body, query: Object.fromEntries(url.searchParams) });
    const records = state[table] || [];
    if (method === 'GET') {
      const rows = records.filter((row) => matches(row, url.searchParams));
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
      return Response.json(rows.slice(offset, offset + limit));
    }
    if (method === 'PATCH') {
      if (state.beforePatch) await state.beforePatch(table, body, url);
      const rows = records.filter((row) => matches(row, url.searchParams));
      rows.forEach((row) => Object.assign(row, structuredClone(body)));
      return options.headers?.Prefer === 'return=minimal' ? new Response(null, { status: 204 }) : Response.json(rows);
    }
    if (method === 'POST' && table === 'audit_log') { state.audit_log.push(body); return new Response(null, { status: 201 }); }
    throw new Error('Unexpected fixture write: ' + table);
  }
  async function request(path, body, identity = { empId: 'ADMIN', sessionId: 'admin-session' }) {
    const old = globalThis.fetch; globalThis.fetch = fakeFetch;
    try {
      return await worker.fetch(new Request('https://app.invalid/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-empid': identity.empId, 'x-session-id': identity.sessionId, 'x-admin-empid': 'ADMIN' }, body: JSON.stringify(body) }), env);
    } finally { globalThis.fetch = old; }
  }
  return { state, request, env };
}
