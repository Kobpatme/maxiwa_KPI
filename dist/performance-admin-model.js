// Pure preview model. Database writes are performed only by the authenticated worker route.
const norm = (v) => String(v || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
const main = (v) => String(v.main ?? v.mainkpi ?? v.mainKpi ?? '').trim();
const sub = (v) => String(v.sub ?? v.subkpi ?? v.subKpi ?? '').trim();
const emp = (v) => String(v.empid || v.empId || v.emp_id || v.assignedToEmpId || '').trim();
const status = (v) => norm(v.status).replace(/[_-]+/g, ' ');
const extra = (value) => { try { const v = typeof value === 'string' ? JSON.parse(value) : value; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
const number = (v, fallback = null) => { const n = typeof v === 'string' ? Number(v.trim().replace(/%$/, '')) : Number(v); return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : fallback; };
const ruleKey = (kpi) => String(kpi.id || `${norm(kpi.team)}::${norm(main(kpi))}::${norm(sub(kpi))}`);
const keys = (kpi) => [kpi.id ? String(kpi.id) : '', `${norm(kpi.team)}::${norm(main(kpi))}::${norm(sub(kpi))}`].filter(Boolean);
const base = (kpi) => number(kpi.main_weight ?? kpi.mainWeight ?? kpi.weight, 1);
const permissions = (user) => extra(user.permissions);
const override = (user, kpi) => { const map = permissions(user).kpiOverrides || {}; for (const key of keys(kpi)) { const value = map[key]; const n = number(typeof value === 'object' && value ? value.weight ?? value.main_weight ?? value.mainWeight : value); if (n !== null) return n; } return null; };
const assigned = (user, kpi) => { const map = permissions(user).kpiAssignments || {}; return !Object.keys(map).length || keys(kpi).some((key) => map[key] === true); };
export const personalSnapshotWeight = (task) => number(extra(task.extra_data).kpi_effective_weight ?? task.kpi_effective_weight ?? task.mainkpiweight ?? task.main_weight ?? task.weight ?? task.kpiweight, 1);
export function matchPerformanceKpi(task, catalog) {
  const candidates = catalog.filter((kpi) => !kpi.team || norm(kpi.team) === norm(task.team));
  const id = task.kpi_id || task.kpiId || extra(task.extra_data).kpi_id || extra(task.extra_data).kpiId;
  if (id) { const found = candidates.filter((kpi) => String(kpi.id || '') === String(id)); if (found.length) return found.length === 1 ? found[0] : null; }
  if (!sub(task)) return null;
  const exact = candidates.filter((kpi) => norm(main(kpi)) === norm(main(task)) && norm(sub(kpi)) === norm(sub(task)));
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const found = candidates.filter((kpi) => norm(sub(kpi)) === norm(sub(task)));
  return found.length === 1 ? found[0] : null;
}
export function standardSnapshotWeight(task, catalog) {
  const kpi = matchPerformanceKpi(task, catalog);
  const configured = kpi ? number(kpi.main_weight ?? kpi.mainWeight ?? kpi.weight) : null;
  return configured ?? number(extra(task.extra_data).kpi_base_weight ?? task.kpi_base_weight, 1);
}
function standardWeightResolver(catalog) {
  const teams = new Map(), cache = new Map();
  const add = (map, key, kpi) => { const rows = map.get(key) || []; rows.push(kpi); map.set(key, rows); };
  const unique = (rows) => rows?.length === 1 ? rows[0] : null;
  return (task) => {
    if (cache.has(task)) return cache.get(task);
    const team = norm(task.team);
    if (!teams.has(team)) {
      const index = { ids: new Map(), exact: new Map(), subs: new Map() };
      catalog.filter((kpi) => !kpi.team || norm(kpi.team) === team).forEach((kpi) => {
        if (kpi.id) add(index.ids, String(kpi.id), kpi);
        add(index.exact, JSON.stringify([norm(main(kpi)), norm(sub(kpi))]), kpi); add(index.subs, norm(sub(kpi)), kpi);
      });
      teams.set(team, index);
    }
    const index = teams.get(team), data = extra(task.extra_data);
    const id = task.kpi_id || task.kpiId || data.kpi_id || data.kpiId;
    const byId = id ? index.ids.get(String(id)) : null;
    const exact = sub(task) ? index.exact.get(JSON.stringify([norm(main(task)), norm(sub(task))])) : null;
    const kpi = byId?.length ? unique(byId) : exact?.length ? unique(exact) : sub(task) ? unique(index.subs.get(norm(sub(task)))) : null;
    const weight = (kpi ? number(kpi.main_weight ?? kpi.mainWeight ?? kpi.weight) : null) ?? number(data.kpi_base_weight ?? task.kpi_base_weight, 1);
    cache.set(task, weight); return weight;
  };
}

export function performanceEditScores(tasks, weightForTask) {
  let total = 0, completed = 0, onTime = 0;
  for (const task of tasks) {
    if (status(task) === 'cancelled') continue;
    const w = weightForTask(task); total += w;
    if (status(task) === 'completed') {
      completed += w;
      const deadline = task.deadline ? new Date(task.deadline).getTime() : NaN;
      const closed = task.completiondate ? new Date(task.completiondate).getTime() : NaN;
      if (Number.isFinite(deadline) && Number.isFinite(closed) && closed <= deadline) onTime += w;
    }
  }
  const completion = total ? Math.round(completed / total * 100) : null;
  const sla = completed ? Math.round(onTime / completed * 100) : null;
  return { completion, sla, score: completion !== null && sla !== null ? Math.round((completion + sla) * 5) / 10 : completion ?? sla, taskCount: tasks.length };
}
export function canonicalPerformanceValue(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalPerformanceValue).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => JSON.stringify(key) + ':' + canonicalPerformanceValue(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function invalid(message, code = 400) { const error = new Error(message); error.status = code; throw error; }
export function buildPerformanceEditPlan({ actor, user, kpis, tasks, body, inPeriod }) {
  if (actor?.role !== 'Admin') invalid('เฉพาะแอดมินเท่านั้นที่แก้ไขข้อมูลนี้ได้', 403);
  if (!user || !emp(user) || norm(emp(user)) !== norm(body.empId)) invalid('ไม่พบพนักงานที่เลือก', 404);
  if (typeof body.reason !== 'string' || !String(body.reason || '').trim() || String(body.reason).length > 500) invalid('กรุณาระบุเหตุผลการแก้ไขไม่เกิน 500 ตัวอักษร');
  const team = String(body.team || '').trim();
  const target = kpis.find((kpi) => String(kpi.id) === String(body.targetKpiId) && norm(kpi.team) === norm(team));
  if (!target || !target.id || !main(target) || !sub(target)) invalid('กรุณาเลือก KPI ที่มีรหัสจากทะเบียนของทีมเดียวกัน');
  if (!Number.isInteger(body.year) || body.year < 1900 || body.year > 2200 || !Array.isArray(body.months) || body.months.length > 12 || body.months.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) invalid('ช่วงประเมินไม่ถูกต้อง');
  if (!Array.isArray(body.taskIds) || body.taskIds.length > 50) invalid('เลือกงานได้ไม่เกิน 50 รายการต่อครั้ง');
  const ids = [...new Set(body.taskIds.map(String))].sort();
  const scope = tasks.filter((task) => norm(task.team) === norm(team) && inPeriod(task, body.months, body.year) && !/resign|inactive|ลาออก/i.test(String(task.name || '') + ' ' + String(task.team || '')));
  const owns = (task) => emp(task) ? norm(emp(task)) === norm(emp(user)) : norm(task.name) === norm(user.name) && norm(task.team) === norm(team);
  const selected = ids.map((id) => scope.find((task) => String(task.id) === id && owns(task)));
  if (selected.some((task) => !task)) invalid('บางงานไม่อยู่ในช่วง ทีม หรือบุคคลที่เลือก กรุณาโหลดข้อมูลใหม่', 409);
  if (typeof body.changeTeamWeight !== 'boolean') invalid('รูปแบบการปรับน้ำหนักทีมไม่ถูกต้อง');
  const teamWeight = body.changeTeamWeight ? number(body.teamWeight) : base(target);
  if (teamWeight === null || teamWeight > 10000) invalid('น้ำหนักทีมต้องมากกว่า 0 และไม่เกิน 10000');
  if (!['keep', 'standard', 'custom'].includes(body.personalMode)) invalid('รูปแบบน้ำหนักบุคคลไม่ถูกต้อง');
  const personalWeight = body.personalMode === 'custom' ? number(body.personalWeight) : null;
  if (body.personalMode === 'custom' && (personalWeight === null || personalWeight > 10000)) invalid('น้ำหนักบุคคลต้องมากกว่า 0 และไม่เกิน 10000');
  if (typeof body.assigned !== 'boolean') invalid('ข้อมูลการมอบหมาย KPI ไม่ถูกต้อง');
  const nextKpi = { ...target, main_weight: teamWeight };
  const nextPermissions = structuredClone(permissions(user));
  if (body.personalMode !== 'keep') {
    nextPermissions.kpiOverrides = { ...(nextPermissions.kpiOverrides || {}) };
    keys(target).forEach((key) => delete nextPermissions.kpiOverrides[key]);
    if (body.personalMode === 'custom') nextPermissions.kpiOverrides[ruleKey(target)] = { weight: personalWeight, baseWeight: teamWeight, team, main: main(target), sub: sub(target) };
  }
  if (body.assigned !== assigned(user, target)) {
    nextPermissions.kpiAssignments = { ...(nextPermissions.kpiAssignments || {}) };
    if (!Object.keys(nextPermissions.kpiAssignments).length) kpis.filter((kpi) => norm(kpi.team) === norm(user.team)).forEach((kpi) => { nextPermissions.kpiAssignments[ruleKey(kpi)] = true; });
    nextPermissions.kpiAssignments.__configured = true;
    keys(target).forEach((key) => delete nextPermissions.kpiAssignments[key]);
    if (body.assigned) nextPermissions.kpiAssignments[ruleKey(target)] = true;
  }
  const nextUser = { ...user, permissions: nextPermissions };
  const effective = override(nextUser, nextKpi) ?? teamWeight;
  const changes = selected.map((task) => {
    const nextExtra = { ...extra(task.extra_data), kpi_base_weight: teamWeight, kpi_effective_weight: effective, kpi_personal_override: effective !== teamWeight, kpi_id: target.id };
    const patch = { mainkpi: main(target), subkpi: sub(target), mainkpiweight: effective, weight: effective, extra_data: typeof task.extra_data === 'string' ? JSON.stringify(nextExtra) : nextExtra };
    if ('kpi_id' in task) patch.kpi_id = target.id;
    const after = { ...task, ...patch };
    return { before: task, patch, after, changed: Object.keys(patch).some((key) => canonicalPerformanceValue(task[key]) !== canonicalPerformanceValue(patch[key])) };
  });
  const byId = new Map(changes.map((change) => [String(change.before.id), change.after]));
  const afterScope = scope.map((task) => byId.get(String(task.id)) || task);
  const nextCatalog = kpis.map((kpi) => String(kpi.id) === String(target.id) ? nextKpi : kpi);
  const teamPatch = body.changeTeamWeight && teamWeight !== base(target) ? { main_weight: teamWeight } : null;
  const userPatch = canonicalPerformanceValue(nextPermissions) !== canonicalPerformanceValue(permissions(user)) ? { permissions: typeof user.permissions === 'string' ? JSON.stringify(nextPermissions) : nextPermissions } : null;
  if (!teamPatch && !userPatch && !changes.some((change) => change.changed)) invalid('ไม่มีข้อมูลที่เปลี่ยน กรุณาเลือกงานหรือปรับค่าที่ต้องการ');
  const scorePair = (beforeTasks, afterTasks, beforeWeight, afterWeight) => ({ before: performanceEditScores(beforeTasks, beforeWeight), after: performanceEditScores(afterTasks, afterWeight) });
  const beforeTeamWeight = standardWeightResolver(kpis), afterTeamWeight = standardWeightResolver(nextCatalog);
  const preview = {
    person: { empId: emp(user), name: user.name, team },
    target: { id: target.id, main: main(target), sub: sub(target), beforeTeamWeight: base(target), afterTeamWeight: teamWeight, beforePersonalWeight: override(user, target) ?? base(target), afterPersonalWeight: effective, beforeAssigned: assigned(user, target), afterAssigned: assigned(nextUser, target) },
    settings: { teamChanged: !!teamPatch, personalChanged: !!userPatch },
    rows: changes.map((change) => ({ id: change.before.id, job: change.before.job || '', status: change.before.status || '', beforeMain: main(change.before), beforeSub: sub(change.before), afterMain: main(target), afterSub: sub(target), beforeTeamWeight: beforeTeamWeight(change.before), afterTeamWeight: teamWeight, beforePersonalWeight: personalSnapshotWeight(change.before), afterPersonalWeight: effective, changed: change.changed })),
    scores: { team: scorePair(scope, afterScope, beforeTeamWeight, afterTeamWeight), personal: scorePair(scope.filter(owns), afterScope.filter(owns), personalSnapshotWeight, personalSnapshotWeight) },
    teamAffected: scope.filter((task, i) => beforeTeamWeight(task) !== afterTeamWeight(afterScope[i])).length,
    scope: { year: body.year, months: body.months, team, teamTaskCount: scope.length, personalTaskCount: scope.filter(owns).length },
  };
  return { preview, changes: changes.filter((change) => change.changed), teamPatch, userPatch, target, user,
    fingerprintInput: { actor: emp(actor), body: { empId: body.empId, team, targetKpiId: body.targetKpiId, changeTeamWeight: !!body.changeTeamWeight, teamWeight, personalMode: body.personalMode, personalWeight, assigned: body.assigned, reason: body.reason.trim(), taskIds: ids, year: body.year, months: [...body.months].sort((a, b) => a - b) }, user: { empId: emp(user), permissions: user.permissions, role: user.role, name: user.name, team: user.team }, kpis: kpis.filter((kpi) => !kpi.team || norm(kpi.team) === norm(team)), selected: selected.slice().sort((a,b) => String(a.id).localeCompare(String(b.id))), tasks: scope.map((task) => ({ id: task.id, team: task.team, empId: emp(task), name: task.name, status: task.status, deadline: task.deadline, completiondate: task.completiondate, personalWeight: personalSnapshotWeight(task), teamWeight: beforeTeamWeight(task) })).sort((a,b) => String(a.id).localeCompare(String(b.id))) } };
}
export async function performancePlanFingerprint(plan) {
  const bytes = new TextEncoder().encode(canonicalPerformanceValue(plan.fingerprintInput));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
