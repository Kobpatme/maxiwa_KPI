const DEFAULT_BACKEND_API_BASE = "";
const DEFAULT_THAI_HOLIDAY_API_URL = "https://api.iapp.co.th/v3/store/data/thai-holiday";
const PAGE_SIZE = 1000;
const READ_TABLES = ["users", "tasks", "kpis", "teams", "holidays", "audit_log", "app_system_links"];

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-empid",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

function supabaseSettings(env) {
  const url = env.SUPABASE_URL || env.MAXIWA_SUPABASE_URL;
  const writeKey = env.SUPABASE_SERVICE_ROLE_KEY
    || env.MAXIWA_SUPABASE_SERVICE_ROLE_KEY
    || env.SUPABASE_ANON_KEY
    || env.MAXIWA_SUPABASE_ANON_KEY;
  const publicKey = env.SUPABASE_ANON_KEY || env.MAXIWA_SUPABASE_ANON_KEY || "";
  if (!url || !writeKey) return null;
  return { url: url.replace(/\/+$/, ""), writeKey, publicKey };
}

function endpoint(settings, table, query = "") {
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  return `${settings.url}/rest/v1/${encodeURIComponent(table)}${qs}`;
}

async function supabaseFetch(env, table, query = "") {
  const settings = supabaseSettings(env);
  if (!settings) throw new Error("Supabase environment variables are not configured");
  const res = await fetch(endpoint(settings, table, query), {
    headers: {
      apikey: settings.writeKey,
      Authorization: `Bearer ${settings.writeKey}`,
      Accept: "application/json",
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase ${table} HTTP ${res.status}`);
  return Array.isArray(data) ? data : [];
}

async function supabaseWrite(env, table, { method = "POST", query = "", body, prefer = "return=representation" } = {}) {
  const settings = supabaseSettings(env);
  if (!settings) throw new Error("Supabase environment variables are not configured");
  const res = await fetch(endpoint(settings, table, query), {
    method,
    headers: {
      apikey: settings.writeKey,
      Authorization: `Bearer ${settings.writeKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase ${table} HTTP ${res.status}`);
  return Array.isArray(data) ? data : (data ? [data] : []);
}

async function readAll(env, table, queryPrefix = "select=*") {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const sep = queryPrefix ? "&" : "";
    const page = await supabaseFetch(env, table, `${queryPrefix}${sep}limit=${PAGE_SIZE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function tableColumns(env, table) {
  const page = await supabaseFetch(env, table, "select=*&limit=1").catch(() => []);
  if (page[0]) return new Set(Object.keys(page[0]));
  return null;
}

function shapeWithColumns(row, columns) {
  const clean = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (value === undefined) continue;
    if (!columns || columns.has(key)) clean[key] = value;
  }
  return clean;
}

async function shapeForTable(env, table, row) {
  const columns = await tableColumns(env, table);
  return shapeWithColumns(row, columns);
}

function encodeEq(value) {
  return encodeURIComponent(String(value ?? "").trim());
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isTerminalStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "cancelled";
}

function normalizeStatus(status, fallback = "Pending") {
  return String(status || fallback).trim() || fallback;
}

function kpiMain(row) {
  return row?.main ?? row?.mainkpi ?? row?.mainKpi ?? "";
}

function kpiSub(row) {
  return row?.sub ?? row?.subkpi ?? row?.subKpi ?? "";
}

function kpiWeight(row) {
  const raw = row?.main_weight ?? row?.mainkpiweight ?? row?.weight ?? 1;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function activeHolidayDates(holidays) {
  return new Set((holidays || [])
    .filter((h) => h.is_active !== false)
    .map((h) => String(h.holiday_date || h.date || "").slice(0, 10))
    .filter(Boolean));
}

function currentYearBangkok() {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());
  return Number(year) || new Date().getUTCFullYear();
}

function normalizeHolidayYears(input) {
  const current = currentYearBangkok();
  const rawYears = Array.isArray(input?.years)
    ? input.years
    : (input?.year ? [input.year] : [current, current + 1]);
  const years = rawYears
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100);
  return [...new Set(years)].slice(0, 5);
}

async function fetchThaiPublicHolidays(year) {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Nager.Date HTTP ${res.status}`);
  return normalizeThaiHolidayResponse(data, year, "nager.date");
}

function thaiHolidayApiUrl(env) {
  return env.THAI_HOLIDAY_API_URL || env.IAPP_THAI_HOLIDAY_API_URL || DEFAULT_THAI_HOLIDAY_API_URL;
}

function thaiHolidayHeaders(env) {
  const headers = { Accept: "application/json" };
  const key = env.THAI_HOLIDAY_API_KEY || env.IAPP_API_KEY || env.IAPP_KEY || "";
  if (key) {
    headers.apikey = key;
    headers["x-api-key"] = key;
    headers.Authorization = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
  }
  return headers;
}

function pickHolidayArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["data", "items", "holidays", "holiday", "results", "rows"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function normalizeThaiHolidayResponse(data, year, provider = "iapp") {
  const rows = pickHolidayArray(data);
  return rows.map((item) => {
    const date = String(item.date || item.holiday_date || item.holidayDate || item.startDate || item.start_date || "").slice(0, 10);
    if (!date || (year && !date.startsWith(String(year)))) return null;
    return {
      date,
      localName: item.localName || item.local_name || item.nameTh || item.name_th || item.name || item.title || item.summary || "",
      name: item.name || item.nameEn || item.name_en || item.localName || item.title || item.summary || "",
      countryCode: "TH",
      global: item.global ?? item.active ?? true,
      types: item.types || item.type || ["Public"],
      provider,
    };
  }).filter(Boolean);
}

async function fetchThaiPublicHolidaysFromIapp(env, year) {
  const apiUrl = new URL(thaiHolidayApiUrl(env));
  if (!apiUrl.searchParams.has("year")) apiUrl.searchParams.set("year", String(year));
  const res = await fetch(apiUrl.toString(), { headers: thaiHolidayHeaders(env) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || `iApp Thai holiday HTTP ${res.status}`);
  return normalizeThaiHolidayResponse(data, year, "iapp");
}

async function fetchThaiPublicHolidaysForYear(env, year) {
  const iappRows = await fetchThaiPublicHolidaysFromIapp(env, year).catch(() => []);
  if (iappRows.length > 0) return iappRows;
  return fetchThaiPublicHolidays(year);
}

async function upsertHolidayRow(env, row, columns) {
  const shaped = shapeWithColumns(row, columns);
  if (shaped.id && (!columns || columns.has("id"))) {
    const rows = await supabaseWrite(env, "holidays", {
      query: "on_conflict=id",
      body: shaped,
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return rows[0] || shaped;
  }

  const date = shaped.holiday_date || row.holiday_date;
  const existing = date
    ? await supabaseFetch(env, "holidays", `select=*&holiday_date=eq.${encodeEq(date)}&limit=1`).then((rows) => rows[0]).catch(() => null)
    : null;
  if (existing?.id) {
    const rows = await supabaseWrite(env, "holidays", {
      method: "PATCH",
      query: `id=eq.${encodeEq(existing.id)}`,
      body: shaped,
    });
    return rows[0] || { ...existing, ...shaped };
  }
  if (existing && date) {
    const rows = await supabaseWrite(env, "holidays", {
      method: "PATCH",
      query: `holiday_date=eq.${encodeEq(date)}`,
      body: shaped,
    });
    return rows[0] || { ...existing, ...shaped };
  }
  const rows = await supabaseWrite(env, "holidays", { body: shaped });
  return rows[0] || shaped;
}

async function syncThaiPublicHolidays(env, body = {}) {
  const years = normalizeHolidayYears(body);
  const columns = await tableColumns(env, "holidays");
  const holidayColumns = columns || new Set(["id", "holiday_date", "name", "is_active"]);
  const rawRows = [];

  for (const year of years) {
    const holidays = await fetchThaiPublicHolidaysForYear(env, year);
    for (const item of holidays) {
      const date = String(item.date || "").slice(0, 10);
      if (!date) continue;
      const provider = item.provider || "iapp";
      rawRows.push({
        id: `th-public-${date}`,
        holiday_date: date,
        name: item.localName || item.name || `Thailand public holiday ${date}`,
        is_active: true,
        source: "thai_public",
        holiday_source: "thai_public",
        type: "thai_public",
        country_code: "TH",
        external_id: `${provider}-th-${date}`,
        provider,
      });
    }
  }

  let synced = [];
  const rows = rawRows.map((row) => shapeWithColumns(row, holidayColumns));
  if (rows.length > 0 && holidayColumns.has("id") && rows.every((row) => row.id)) {
    synced = await supabaseWrite(env, "holidays", {
      query: "on_conflict=id",
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation",
    });
  } else {
    for (const row of rawRows) synced.push(await upsertHolidayRow(env, row, holidayColumns));
  }

  return { ok: true, years, imported: synced.length, holidays: synced };
}

function addWorkingDays(startDate, days, holidays = []) {
  const holidaySet = activeHolidayDates(holidays);
  const date = startDate ? new Date(startDate) : new Date();
  let remaining = Math.max(0, Number(days || 0));
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    const iso = date.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function normalizeDateOnly(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function businessDaysBetween(startValue, endValue, holidays = []) {
  const start = normalizeDateOnly(startValue);
  const end = normalizeDateOnly(endValue);
  if (!start || !end || start.getTime() === end.getTime()) return 0;
  const holidaySet = activeHolidayDates(holidays);
  const direction = end > start ? 1 : -1;
  const cursor = new Date(start);
  let count = 0;
  while (cursor.getTime() !== end.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    const day = cursor.getDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) count += direction;
  }
  return count;
}

function normalizeExtraData(extraData) {
  if (!extraData) return {};
  if (typeof extraData === "string") {
    try { return JSON.parse(extraData); } catch { return {}; }
  }
  return typeof extraData === "object" ? extraData : {};
}

function activeHoldStart(task) {
  const extra = normalizeExtraData(task?.extra_data);
  return extra.hold_started_at || extra.holdStartAt || extra.holdStart || null;
}

function buildHoldStatusUpdate(task, nextStatus, holidays = [], changedBy = "") {
  const currentStatus = String(task?.status || "").toLowerCase();
  const targetStatus = String(nextStatus || "").toLowerCase();
  const extra = { ...normalizeExtraData(task?.extra_data) };
  const now = new Date().toISOString();
  const start = activeHoldStart(task);

  if (targetStatus === "on hold") {
    if (!start) {
      extra.hold_started_at = now;
      extra.hold_started_by = changedBy || extra.hold_started_by || "";
      extra.hold_deadline_before = task?.deadline || "";
    }
    return { extra_data: extra, deadline: task?.deadline || "" };
  }

  if (currentStatus !== "on hold" || !start) return {};

  const holdDays = Math.max(0, businessDaysBetween(start, now, holidays));
  const nextDeadline = holdDays > 0 ? addWorkingDays(task.deadline, holdDays, holidays) : (task?.deadline || "");
  const history = Array.isArray(extra.hold_history) ? [...extra.hold_history] : [];
  history.push({
    start,
    end: now,
    businessDays: holdDays,
    deadlineBefore: extra.hold_deadline_before || task?.deadline || "",
    deadlineAfter: nextDeadline || task?.deadline || "",
    changedBy: changedBy || "",
  });
  delete extra.hold_started_at;
  delete extra.hold_started_by;
  delete extra.hold_deadline_before;
  extra.hold_days_total = Number(extra.hold_days_total || 0) + holdDays;
  extra.hold_history = history.slice(-20);
  return { extra_data: extra, deadline: nextDeadline || task?.deadline || "" };
}

function dateInPeriod(value, month, year, allTime) {
  if (allTime) return true;
  if (!month || !year) return true;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return true;
  return date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month);
}

function taskPersonId(task) {
  return String(task.empId || task.empid || task.assignedToEmpId || "").trim();
}

function filterTasks(tasks, params = {}) {
  const month = Number(params.month || 0);
  const year = Number(params.year || 0);
  const allTime = params.allTime === true || params.allTime === "true" || month === 0;
  const team = String(params.team || "").trim();
  const name = String(params.name || "").trim();
  const requesterEmpId = String(params.requesterEmpId || params.empId || params.empid || "").trim();
  return (tasks || []).filter((task) => {
    if (team && team !== "all" && task.team !== team) return false;
    if (name && String(task.name || "").trim() !== name) return false;
    if (requesterEmpId && name) {
      const taskEmp = taskPersonId(task);
      if (taskEmp && taskEmp.toUpperCase() !== requesterEmpId.toUpperCase() && String(task.name || "").trim() !== name) return false;
    }
    return dateInPeriod(task.startdate || task.created_at || task.deadline, month, year, allTime);
  });
}

function summarizeTasks(tasks) {
  const people = new Map();
  for (const task of tasks || []) {
    const key = taskPersonId(task) || `${task.name || "Unassigned"}|${task.team || ""}`;
    if (!people.has(key)) {
      people.set(key, {
        empId: task.empId || task.empid || task.assignedToEmpId || "",
        empid: task.empId || task.empid || task.assignedToEmpId || "",
        name: task.name || task.assignee || task.owner || "Unassigned",
        team: task.team || "",
        total: 0,
        completed: 0,
        onProcess: 0,
        pending: 0,
        onHold: 0,
        cancelled: 0,
        onTime: 0,
        overKpi: 0,
      });
    }
    const row = people.get(key);
    const status = String(task.status || "").toLowerCase();
    row.total += 1;
    if (status === "completed") row.completed += 1;
    else if (status === "on process") row.onProcess += 1;
    else if (status === "pending") row.pending += 1;
    else if (status === "on hold") row.onHold += 1;
    else if (status === "cancelled") row.cancelled += 1;
    if (status === "completed") {
      const done = task.completiondate ? new Date(task.completiondate) : null;
      const deadline = task.deadline ? new Date(task.deadline) : null;
      if (done && deadline && !Number.isNaN(done.getTime()) && !Number.isNaN(deadline.getTime()) && done <= deadline) row.onTime += 1;
      else row.overKpi += 1;
    }
  }
  return Array.from(people.values());
}

async function findUserByEmpId(env, empId) {
  const cleanEmpId = String(empId || "").trim();
  if (!cleanEmpId) return null;
  for (const column of ["empid", "empId"]) {
    try {
      const rows = await supabaseFetch(env, "users", `select=*&${column}=eq.${encodeEq(cleanEmpId)}&limit=1`);
      if (rows[0]) return rows[0];
    } catch {}
  }
  const users = await readAll(env, "users");
  return users.find((user) => String(user.empid || user.empId || "").trim().toUpperCase() === cleanEmpId.toUpperCase()) || null;
}

async function kpisForTeam(env, team) {
  if (!team) return readAll(env, "kpis");
  return supabaseFetch(env, "kpis", `select=*&team=eq.${encodeEq(team)}`).catch(async () => {
    const all = await readAll(env, "kpis").catch(() => []);
    return all.filter((kpi) => String(kpi.team || "") === String(team || ""));
  });
}

async function findKpi(env, team, subkpi) {
  const kpis = await kpisForTeam(env, team);
  const wanted = String(subkpi || "").trim().toLowerCase();
  return kpis.find((kpi) => String(kpiSub(kpi)).trim().toLowerCase() === wanted) || null;
}

async function writeAudit(env, event) {
  const candidates = [
    {
      task_id: event.taskId || event.task_id || null,
      action: event.action || event.type || "update",
      changed_by: event.changedBy || event.changed_by || event.user || "",
      details: event.details || event,
      created_at: new Date().toISOString(),
    },
    {
      taskid: event.taskId || event.task_id || null,
      action: event.action || event.type || "update",
      changedby: event.changedBy || event.changed_by || event.user || "",
      details: JSON.stringify(event.details || event),
      created_at: new Date().toISOString(),
    },
  ];
  for (const row of candidates) {
    try {
      const shaped = await shapeForTable(env, "audit_log", row);
      await supabaseWrite(env, "audit_log", { body: shaped, prefer: "return=minimal" });
      return;
    } catch {}
  }
}

async function patchTask(env, id, updates) {
  const shaped = await shapeForTable(env, "tasks", updates);
  const rows = await supabaseWrite(env, "tasks", {
    method: "PATCH",
    query: `id=eq.${encodeEq(id)}`,
    body: shaped,
  });
  return rows[0] || null;
}

async function buildTaskRows(env, body) {
  const jobs = Array.isArray(body.jobs) && body.jobs.length > 0 ? body.jobs : [body.job || ""];
  const holidays = await readAll(env, "holidays").catch(() => []);
  const kpi = await findKpi(env, body.team || body.assignedToTeam, body.subkpi);
  const startdate = body.startdate || body.startDate || todayIso();
  const deadline = body.deadline || addWorkingDays(startdate, kpi?.days || body.days || 1, holidays);
  return Promise.all(jobs.map(async (job) => {
    const jobText = typeof job === "string" ? job : (job.job || job.name || "");
    const raw = {
      id: body.id || randomId(),
      name: body.name || body.assignedToName || "",
      team: body.team || body.assignedToTeam || "",
      empId: body.empId || body.empid || body.assignedToEmpId || "",
      empid: body.empid || body.empId || body.assignedToEmpId || "",
      assignedToEmpId: body.assignedToEmpId || body.empId || body.empid || "",
      job: jobText,
      mainkpi: body.mainkpi || kpiMain(kpi),
      subkpi: body.subkpi || kpiSub(kpi),
      deadline,
      startdate,
      status: normalizeStatus(body.status, body.assignedToEmpId ? "Pending" : "On Process"),
      note: body.note || "",
      extra_data: typeof job === "object" ? (job.extra_data || body.extra_data || {}) : (body.extra_data || {}),
      mainkpiweight: body.mainkpiweight || body.main_weight || kpiWeight(kpi),
      weight: body.weight || kpiWeight(kpi),
      created_at: new Date().toISOString(),
    };
    return shapeForTable(env, "tasks", raw);
  }));
}

function systemLinkFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    url: row.url || "",
    icon: row.icon || "fa-up-right-from-square",
    status: row.status || "Active",
    visibleToAll: row.visible_to_all === true,
    allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles : [],
    allowedTeams: Array.isArray(row.allowed_team_names) ? row.allowed_team_names : [],
    allowedEmpIds: Array.isArray(row.allowed_emp_ids) ? row.allowed_emp_ids : [],
    sortOrder: row.sort_order || 100,
    isActive: row.is_active !== false,
  };
}

function systemLinkToRow(item, index = 0) {
  return {
    id: String(item.id || `system-${Date.now().toString(36)}-${index + 1}`).trim(),
    name: item.name,
    description: item.description || "",
    url: item.url || "",
    icon: item.icon || "fa-up-right-from-square",
    status: item.status || "Active",
    visible_to_all: item.visibleToAll === true,
    allowed_roles: Array.isArray(item.allowedRoles) ? item.allowedRoles : [],
    allowed_team_names: Array.isArray(item.allowedTeams) ? item.allowedTeams : [],
    allowed_emp_ids: Array.isArray(item.allowedEmpIds) ? item.allowedEmpIds : [],
    sort_order: Number.isFinite(Number(item.sortOrder ?? item.sort_order)) ? Number(item.sortOrder ?? item.sort_order) : (index + 1) * 10,
    is_active: item.isActive !== false,
  };
}

async function readSystemLinks(env) {
  const rows = await readAll(env, "app_system_links").catch(() => []);
  return rows
    .map(systemLinkFromRow)
    .filter((item) => item.isActive !== false && item.status !== "Hidden")
    .sort((a, b) => (a.sortOrder || 100) - (b.sortOrder || 100) || String(a.name || "").localeCompare(String(b.name || "")));
}

async function recalculateDeadlines(env) {
  const [tasks, kpis, holidays] = await Promise.all([
    readAll(env, "tasks").catch(() => []),
    readAll(env, "kpis").catch(() => []),
    readAll(env, "holidays").catch(() => []),
  ]);
  let updated = 0;
  for (const task of tasks) {
    if (isTerminalStatus(task.status)) continue;
    const kpi = kpis.find((item) =>
      String(item.team || "") === String(task.team || "") &&
      String(kpiSub(item)).trim().toLowerCase() === String(task.subkpi || "").trim().toLowerCase()
    );
    if (!kpi) continue;
    const extra = normalizeExtraData(task.extra_data);
    const baseDeadline = addWorkingDays(task.startdate || task.created_at || todayIso(), kpi.days || 1, holidays);
    const holdDays = Number(extra.hold_days_total || extra.holdDaysTotal || 0);
    const activeDays = String(task.status || "").toLowerCase() === "on hold" ? Math.max(0, businessDaysBetween(activeHoldStart(task), new Date(), holidays)) : 0;
    const nextDeadline = holdDays + activeDays > 0 ? addWorkingDays(baseDeadline, holdDays + activeDays, holidays) : baseDeadline;
    if (nextDeadline && nextDeadline !== task.deadline) {
      await patchTask(env, task.id, {
        deadline: nextDeadline,
        mainkpi: task.mainkpi || kpiMain(kpi),
        subkpi: task.subkpi || kpiSub(kpi),
        mainkpiweight: kpiWeight(kpi),
        weight: kpiWeight(kpi),
      }).catch(() => null);
      updated += 1;
    }
  }
  return updated;
}

async function handleApi(request, env, apiPath) {
  const url = new URL(request.url);
  const settings = supabaseSettings(env);
  if (!settings) return null;

  if (apiPath === "public-config") {
    return jsonResponse(request, { url: settings.url, key: settings.publicKey }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getInitialData" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const user = await findUserByEmpId(env, body.empId || body.empid);
    if (!user) return jsonResponse(request, { error: "User profile was not found" }, 404, { "X-Maxiwa-Backend": "supabase" });
    const kpis = await kpisForTeam(env, user.team || "");
    return jsonResponse(request, { user: { ...user, empId: user.empId || user.empid }, kpis }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getKPIsByTeam") {
    return jsonResponse(request, { kpis: await kpisForTeam(env, url.searchParams.get("team") || "") }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getAllStaff") {
    return jsonResponse(request, { staff: await readAll(env, "users") }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getAllStaffInTeam") {
    const team = url.searchParams.get("team") || "";
    const staff = team ? await supabaseFetch(env, "users", `select=*&team=eq.${encodeEq(team)}`).catch(() => []) : await readAll(env, "users");
    return jsonResponse(request, { staff }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getDashboardData") {
    const [tasks, kpis, holidays] = await Promise.all([
      readAll(env, "tasks").catch(() => []),
      readAll(env, "kpis").catch(() => []),
      readAll(env, "holidays").catch(() => []),
    ]);
    return jsonResponse(request, { tasks, kpis, holidays }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getEmployeeTasks" || apiPath === "getAllTasks") {
    const params = Object.fromEntries(url.searchParams.entries());
    const [allTasks, holidays] = await Promise.all([
      readAll(env, "tasks").catch(() => []),
      readAll(env, "holidays").catch(() => []),
    ]);
    return jsonResponse(request, { tasks: filterTasks(allTasks, params), holidays }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getSummaryReport" || apiPath === "getTeamSummaryReport") {
    const params = Object.fromEntries(url.searchParams.entries());
    const [allTasks, holidays] = await Promise.all([
      readAll(env, "tasks").catch(() => []),
      readAll(env, "holidays").catch(() => []),
    ]);
    const tasks = filterTasks(allTasks, params);
    return jsonResponse(request, { summary: summarizeTasks(tasks), holidays, period: params }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "calculateDeadlinePreview" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const [kpi, holidays] = await Promise.all([
      findKpi(env, body.team, body.subkpi || body.sub).catch(() => null),
      readAll(env, "holidays").catch(() => []),
    ]);
    const deadline = addWorkingDays(body.startDate || body.startdate || todayIso(), kpi?.days || body.days || 1, holidays);
    return jsonResponse(request, { deadline, kpi }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if ((apiPath === "saveNewTask" || apiPath === "assignNewTask") && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const rows = await buildTaskRows(env, body);
    const inserted = await supabaseWrite(env, "tasks", { body: rows });
    await writeAudit(env, { action: "create_task", changedBy: body.changedBy || body.name, details: { count: rows.length } });
    return jsonResponse(request, { ok: true, tasks: inserted, task: inserted[0] || null }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "updateTaskDetails" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonResponse(request, { error: "Task id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    const { id, ...updates } = body;
    const task = await patchTask(env, id, updates);
    await writeAudit(env, { taskId: id, action: "update_task", changedBy: body.changedBy, details: updates });
    return jsonResponse(request, { ok: true, task }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if ((apiPath === "updateTaskStatus" || apiPath === "updateTaskStatusWithLog" || apiPath === "acceptTask") && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonResponse(request, { error: "Task id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    const status = apiPath === "acceptTask" ? "On Process" : normalizeStatus(body.status || body.newStatus || body.new_status);
    const existing = await supabaseFetch(env, "tasks", `select=*&id=eq.${encodeEq(body.id)}&limit=1`).then((rows) => rows[0]).catch(() => null);
    const holidays = await readAll(env, "holidays").catch(() => []);
    const updates = { status, ...(existing ? buildHoldStatusUpdate(existing, status, holidays, body.changedBy || body.reason || "") : {}) };
    if (body.note !== undefined || body.reason !== undefined) updates.note = body.note ?? body.reason;
    if (String(status).toLowerCase() === "completed") updates.completiondate = body.completiondate || todayIso();
    const task = await patchTask(env, body.id, updates);
    await writeAudit(env, { taskId: body.id, action: "status_change", changedBy: body.changedBy || body.reason, details: updates });
    return jsonResponse(request, { ok: true, task }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "deleteTask" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!body.id) return jsonResponse(request, { error: "Task id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    await supabaseWrite(env, "tasks", { method: "DELETE", query: `id=eq.${encodeEq(body.id)}`, prefer: "return=minimal" });
    await writeAudit(env, { taskId: body.id, action: "delete_task", changedBy: body.changedBy, details: body });
    return jsonResponse(request, { ok: true }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getTasksByJob") {
    const q = url.searchParams.get("q") || "";
    const allTasks = await readAll(env, "tasks").catch(() => []);
    const needle = q.trim().toLowerCase();
    const tasks = needle ? allTasks.filter((task) => String(task.job || "").toLowerCase().includes(needle)) : [];
    return jsonResponse(request, { tasks }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "getAuditLogsByTask") {
    const taskId = url.searchParams.get("taskId") || "";
    const logs = taskId
      ? await supabaseFetch(env, "audit_log", `select=*&or=(task_id.eq.${encodeEq(taskId)},taskid.eq.${encodeEq(taskId)})`).catch(() => [])
      : [];
    return jsonResponse(request, { logs }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "systemLinks") {
    return jsonResponse(request, { systemLinks: await readSystemLinks(env) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveSystemLinks" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const rows = await Promise.all((body.systemLinks || []).map((item, index) => shapeForTable(env, "app_system_links", systemLinkToRow(item, index))));
    if (rows.length > 0) {
      await supabaseWrite(env, "app_system_links", {
        query: "on_conflict=id",
        body: rows,
        prefer: "resolution=merge-duplicates,return=representation",
      });
    }
    const existing = await readAll(env, "app_system_links").catch(() => []);
    const nextIds = new Set(rows.map((row) => row.id));
    for (const row of existing) {
      if (!nextIds.has(row.id)) {
        await supabaseWrite(env, "app_system_links", {
          method: "PATCH",
          query: `id=eq.${encodeEq(row.id)}`,
          body: await shapeForTable(env, "app_system_links", { is_active: false, status: "Hidden" }),
          prefer: "return=minimal",
        }).catch(() => null);
      }
    }
    return jsonResponse(request, { ok: true, systemLinks: await readSystemLinks(env) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/getTeams") return jsonResponse(request, { teams: await readAll(env, "teams") }, 200, { "X-Maxiwa-Backend": "supabase" });
  if (apiPath === "admin/getHolidays") return jsonResponse(request, { holidays: await readAll(env, "holidays") }, 200, { "X-Maxiwa-Backend": "supabase" });
  if (apiPath === "admin/getAuditLogs") return jsonResponse(request, { logs: await readAll(env, "audit_log").catch(() => []) }, 200, { "X-Maxiwa-Backend": "supabase" });

  if (apiPath === "admin/saveUser" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const empid = String(body.empid || body.empId || "").trim();
    if (!empid) return jsonResponse(request, { error: "Emp ID is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    const existing = await findUserByEmpId(env, empid).catch(() => null);
    const { empId: _empId, ...rest } = body;
    const userColumns = await tableColumns(env, "users");
    const empColumn = userColumns?.has("empid") ? "empid" : (userColumns?.has("empId") ? "empId" : "empid");
    const row = await shapeForTable(env, "users", { ...rest, empid, empId: empid });
    const saved = await supabaseWrite(env, "users", {
      query: `on_conflict=${empColumn}`,
      body: row,
      prefer: "resolution=merge-duplicates,return=representation",
    });
    if (existing && (existing.name !== row.name || existing.team !== row.team)) {
      const allTasks = await readAll(env, "tasks").catch(() => []);
      const affected = allTasks.filter((task) =>
        String(task.empid || task.empId || task.assignedToEmpId || "").trim().toUpperCase() === empid.toUpperCase() ||
        (String(task.name || "").trim() === String(existing.name || "").trim() && String(task.team || "").trim() === String(existing.team || "").trim())
      );
      for (const task of affected) {
        await patchTask(env, task.id, { name: row.name, team: row.team }).catch(() => null);
      }
    }
    await writeAudit(env, { action: "save_user", changedBy: request.headers.get("x-admin-empid"), details: { empid } });
    const user = saved[0] || row;
    return jsonResponse(request, { ok: true, user: { ...user, empId: user.empid || empid } }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveTeam" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const row = await shapeForTable(env, "teams", { ...body, id: body.id || body.name });
    const teams = await supabaseWrite(env, "teams", {
      query: "on_conflict=id",
      body: row,
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return jsonResponse(request, { ok: true, team: teams[0] || row }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveKpi" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const row = await shapeForTable(env, "kpis", body);
    const kpis = row.id
      ? await supabaseWrite(env, "kpis", { method: "PATCH", query: `id=eq.${encodeEq(row.id)}`, body: row })
      : await supabaseWrite(env, "kpis", { body: row });
    return jsonResponse(request, { ok: true, kpi: kpis[0] || row }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/saveHoliday" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const source = body.source || body.holiday_source || body.type || "company";
    const row = await shapeForTable(env, "holidays", {
      ...body,
      source,
      holiday_source: source,
      type: source,
    });
    const holidays = row.id
      ? await supabaseWrite(env, "holidays", { method: "PATCH", query: `id=eq.${encodeEq(row.id)}`, body: row })
      : await supabaseWrite(env, "holidays", { body: row });
    return jsonResponse(request, { ok: true, holiday: holidays[0] || row }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/syncThaiHolidays" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await syncThaiPublicHolidays(env, body);
    await writeAudit(env, { action: "sync_thai_holidays", changedBy: request.headers.get("x-admin-empid"), details: { years: result.years, imported: result.imported } });
    return jsonResponse(request, result, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  if (apiPath === "admin/recalculateDeadlines" && request.method === "POST") {
    return jsonResponse(request, { ok: true, updated: await recalculateDeadlines(env) }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  const deleteMatch = apiPath.match(/^admin\/delete(User|Team|Kpi|Holiday)$/);
  if (deleteMatch && request.method === "DELETE") {
    const type = deleteMatch[1];
    const config = {
      User: { table: "users", column: "empid", param: "empId" },
      Team: { table: "teams", column: "id", param: "id" },
      Kpi: { table: "kpis", column: "id", param: "id" },
      Holiday: { table: "holidays", column: "id", param: "id" },
    }[type];
    const value = url.searchParams.get(config.param);
    if (!value) return jsonResponse(request, { error: "Delete id is required" }, 400, { "X-Maxiwa-Backend": "supabase" });
    if (type === "User") {
      const userColumns = await tableColumns(env, "users");
      config.column = userColumns?.has("empid") ? "empid" : (userColumns?.has("empId") ? "empId" : "empid");
    }
    await supabaseWrite(env, config.table, {
      method: "DELETE",
      query: `${config.column}=eq.${encodeEq(value)}`,
      prefer: "return=minimal",
    });
    await writeAudit(env, { action: `delete_${config.table}`, changedBy: request.headers.get("x-admin-empid"), details: { value } });
    return jsonResponse(request, { ok: true }, 200, { "X-Maxiwa-Backend": "supabase" });
  }

  return null;
}

async function proxyApiRequest(request, env) {
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/api\/?/, "");
  const backendBase = (env.MAXIWA_BACKEND_API_BASE || DEFAULT_BACKEND_API_BASE).replace(/\/+$/, "");
  if (!backendBase) {
    return jsonResponse(request, { error: "Backend API is not configured", endpoint: `/api/${apiPath}` }, 503, { "X-Maxiwa-Proxy": "disabled" });
  }
  const targetUrl = `${backendBase}/${apiPath}${url.search}`;
  const headers = new Headers(request.headers);
  ["host", "origin", "referer", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "x-forwarded-proto", "x-real-ip"]
    .forEach((header) => headers.delete(header));
  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow",
  });
  const responseHeaders = new Headers(backendResponse.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) responseHeaders.set(key, value);
  responseHeaders.set("X-Maxiwa-Proxy-Target", `/api/${apiPath}`);
  return new Response(backendResponse.body, { status: backendResponse.status, statusText: backendResponse.statusText, headers: responseHeaders });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
      const apiPath = url.pathname.replace(/^\/api\/?/, "");
      const fallbackRequest = request.clone();
      try {
        const handled = await handleApi(fallbackRequest, env, apiPath);
        if (handled) return handled;
      } catch (error) {
        return jsonResponse(request, { error: error.message || "Supabase backend failed", endpoint: `/api/${apiPath}` }, 500, { "X-Maxiwa-Backend": "supabase-error" });
      }
      return proxyApiRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
