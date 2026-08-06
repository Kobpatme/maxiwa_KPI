const MAXIWA_REALTIME_CONFIG_TIMEOUT_MS = 25000;

function maxiwaTimeoutError(timeoutMs) {
  const error = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
  error.code = "REQUEST_TIMEOUT";
  return error;
}

async function maxiwaFetchWithTimeout(url, options = {}, timeoutMs = MAXIWA_REALTIME_CONFIG_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(maxiwaTimeoutError(timeoutMs)), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError" || error?.code === "REQUEST_TIMEOUT") throw maxiwaTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const API = (() => {
  const BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : "/api";
  const GET_CACHE_TTL = 15000;
  const GET_TIMEOUT_MS = 25000;
  const POST_TIMEOUT_MS = 30000;
  const RETRY_DELAYS_MS = [700, 1600];
  const getCache = new Map();
  const inflightGets = new Map();

  function sessionHeaders() {
    const session = (typeof window !== "undefined" && window.MAXIWA_ACTIVE_SESSION) ? window.MAXIWA_ACTIVE_SESSION : null;
    const empId = String(session?.empId || "").trim();
    const sessionId = String(session?.sessionId || "").trim();
    return empId && sessionId
      ? { "x-session-empid": empId, "x-session-id": sessionId }
      : {};
  }

  async function readError(res) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.error ? `HTTP ${res.status}: ${data.error}` : `HTTP ${res.status}`);
    error.status = res.status;
    error.code = data.code || "";
    error.data = data;
    if ((error.code === "SESSION_SUPERSEDED" || error.code === "SESSION_EXPIRED") && typeof window !== "undefined" && typeof window.MAXIWA_HANDLE_SESSION_ERROR === "function") {
      window.MAXIWA_HANDLE_SESSION_ERROR(data);
    }
    return error;
  }

  function cacheKey(endpoint, params = {}, headers = {}) {
    const sortedParams = Object.entries(params || {}).sort(([a], [b]) => a.localeCompare(b));
    const sortedHeaders = Object.entries(headers || {}).sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify([endpoint, sortedParams, sortedHeaders]);
  }

  function clearGetCache() {
    getCache.clear();
    inflightGets.clear();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function timeoutError(timeoutMs) {
    const error = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    error.code = "REQUEST_TIMEOUT";
    return error;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = GET_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(timeoutError(timeoutMs)), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError" || error?.code === "REQUEST_TIMEOUT") throw timeoutError(timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function isRetryableError(error) {
    return error?.code === "REQUEST_TIMEOUT"
      || error?.name === "TypeError"
      || error?.status === 408
      || error?.status === 425
      || error?.status === 429
      || (error?.status >= 500 && error?.status <= 599);
  }

  async function retryRead(operation) {
    let lastError;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === RETRY_DELAYS_MS.length) break;
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
    throw lastError;
  }

  async function post(endpoint, body, headers = {}) {
    const mergedHeaders = { "Content-Type": "application/json", ...sessionHeaders(), ...headers };
    const res = await fetchWithTimeout(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: mergedHeaders,
      body: JSON.stringify(body),
    }, POST_TIMEOUT_MS);
    if (!res.ok) {
      throw await readError(res);
    }
    clearGetCache();
    return res.json();
  }

  async function get(endpoint, params = {}, headers = {}) {
    const mergedHeaders = { ...sessionHeaders(), ...headers };
    const cleanParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") cleanParams[k] = v;
    }
    const key = cacheKey(endpoint, cleanParams, mergedHeaders);
    const cached = getCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    if (inflightGets.has(key)) return inflightGets.get(key);
    const qs = new URLSearchParams(cleanParams).toString();
    const request = (async () => {
      const data = await retryRead(async () => {
        const res = await fetchWithTimeout(`${BASE}/${endpoint}${qs ? `?${qs}` : ""}`, { headers: mergedHeaders }, GET_TIMEOUT_MS);
        if (!res.ok) {
          throw await readError(res);
        }
        return res.json();
      });
      getCache.set(key, { data, expiresAt: Date.now() + GET_CACHE_TTL });
      return data;
    })();
    inflightGets.set(key, request);
    try {
      return await request;
    } finally {
      inflightGets.delete(key);
    }
  }

  async function del(endpoint, searchParams, headers = {}) {
    const mergedHeaders = { ...sessionHeaders(), ...headers };
    const res = await fetchWithTimeout(`${BASE}/${endpoint}?${new URLSearchParams(searchParams).toString()}`, {
      method: "DELETE",
      headers: mergedHeaders,
    }, POST_TIMEOUT_MS);
    if (!res.ok) {
      throw await readError(res);
    }
    clearGetCache();
    return res.json().catch(() => ({}));
  }

  return {
    getInitialData: (empId, sessionId = "") => post("getInitialData", { empId, sessionId }),
    validateSession: () => post("session/heartbeat", {}),
    getEmployeeTasks: (userData, month, year, allTime, requesterEmpId) =>
      get("getEmployeeTasks", { name: userData.name, month, year, allTime, requesterEmpId }),
    getPerformanceEmployeeTasks: (userData, months, year, requesterEmpId) =>
      get("getEmployeeTasks", { name: userData.name, months: months?.length ? months.join(",") : "all", year, requesterEmpId, performance: true }),
    calculateDeadlinePreview: (payload) => post("calculateDeadlinePreview", payload),
    saveNewTask: (payload) => post("saveNewTask", payload),
    acceptTask: (id, team) => post("acceptTask", { id, team }),
    updateTaskStatus: (id, team, status, note, mode) =>
      post("updateTaskStatus", { id, team, status, note, mode }),
    updateTaskDetails: (taskData) => post("updateTaskDetails", taskData),
    assignNewTask: (payload) => post("assignNewTask", payload),
    updateTaskStatusWithLog: (id, team, newStatus, reason, changedBy) =>
      post("updateTaskStatusWithLog", { id, team, newStatus, reason, changedBy }),
    getAllTasks: (month, year, team, requesterEmpId) => get("getAllTasks", { month, year, team, requesterEmpId }),
    getPerformanceTasks: (months, year, team, requesterEmpId) =>
      get("getAllTasks", { months: months?.length ? months.join(",") : "all", year, team, requesterEmpId, performance: true }),
    getSummaryReport: (month, year, requesterEmpId) => get("getSummaryReport", { month, year, requesterEmpId }),
    getTeamSummaryReport: (team, month, year, requesterEmpId) =>
      get("getTeamSummaryReport", { team, month, year, requesterEmpId }),
    getAllStaff: (requesterEmpId) => get("getAllStaff", { requesterEmpId }),
    getAllStaffInTeam: (team, requesterEmpId) => get("getAllStaffInTeam", { team, requesterEmpId }),
    getKPIsByTeam: (team) => get("getKPIsByTeam", { team }),
    getDashboardData: () => get("getDashboardData"),
    saveUser: (userData, headers = {}) => post("admin/saveUser", userData, headers),
    deleteUser: (empId, headers = {}) => del("admin/deleteUser", { empId }, headers),
    saveKpi: (kpiData, headers = {}) => post("admin/saveKpi", kpiData, headers),
    deleteKpi: (id, headers = {}) => del("admin/deleteKpi", { id }, headers),
    getAuditLogs: (headers = {}) => get("admin/getAuditLogs", {}, headers),
    getTeams: (headers = {}) => get("admin/getTeams", {}, headers),
    saveTeam: (teamData, headers = {}) => post("admin/saveTeam", teamData, headers),
    deleteTeam: (id, headers = {}) => del("admin/deleteTeam", { id }, headers),
    getHolidays: (headers = {}) => get("admin/getHolidays", {}, headers),
    saveHoliday: (holidayData, headers = {}) => post("admin/saveHoliday", holidayData, headers),
    deleteHoliday: (id, headers = {}) => del("admin/deleteHoliday", { id }, headers),
    recalculateDeadlines: (headers = {}) => post("admin/recalculateDeadlines", {}, headers),
    deleteTask: (id, team, changedBy) => post("deleteTask", { id, team, changedBy }),
    getTasksByJob: (q) => get("getTasksByJob", { q }),
    getAuditLogsByTask: (taskId) => get("getAuditLogsByTask", { taskId }),
    getSystemLinks: (requesterEmpId) => get("systemLinks", { requesterEmpId }),
    saveSystemLinks: (systemLinks, headers = {}) => post("admin/saveSystemLinks", { systemLinks }, headers),
    getAdminAnnouncement: () => get("adminAnnouncement"),
    saveAdminAnnouncement: (announcement, headers = {}) => post("admin/saveAnnouncement", { announcement }, headers),
  };
})();

let supabaseClient = null;
let supabaseInitPromise = null;
const realtimeSubscriptions = {};
const realtimeDebounceTimers = {};

async function initSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (supabaseInitPromise) return supabaseInitPromise;
  supabaseInitPromise = (async () => {
    try {
      const configUrl = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE.replace(/\/api\/?$/, "/api/public-config") : "/api/public-config";
      const res = await maxiwaFetchWithTimeout(configUrl, {}, MAXIWA_REALTIME_CONFIG_TIMEOUT_MS);
      if (!res.ok) throw new Error("Cannot fetch config");
      const { url, key } = await res.json();
      if (!url || !key) return null;
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      if (window.supabase) {
        supabaseClient = window.supabase.createClient(url, key);
      }
    } catch (err) {
      console.error("Failed to initialize Supabase client for realtime:", err);
    } finally {
      supabaseInitPromise = null;
    }
    return supabaseClient;
  })();
  return supabaseInitPromise;
}

async function subscribeToRealtime(tableName, callback) {
  const client = await initSupabaseClient();
  if (typeof window !== "undefined") window.MAXIWA_REALTIME_ACTIVE = Boolean(client);
  if (!client) return null;

  if (realtimeSubscriptions[tableName]) {
    try {
      await client.removeChannel(realtimeSubscriptions[tableName]);
    } catch {}
    delete realtimeSubscriptions[tableName];
  }

  const channel = client.channel(`public:${tableName}`);
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: tableName },
    (payload) => {
      if (realtimeDebounceTimers[tableName]) clearTimeout(realtimeDebounceTimers[tableName]);
      realtimeDebounceTimers[tableName] = setTimeout(() => {
        if (typeof callback === "function") callback(payload);
      }, 1200);
    }
  ).subscribe();

  realtimeSubscriptions[tableName] = channel;
  return channel;
}

async function unsubscribeFromRealtime(tableName) {
  const client = supabaseClient;
  if (!client || !realtimeSubscriptions[tableName]) return;
  try {
    await client.removeChannel(realtimeSubscriptions[tableName]);
  } catch {}
  if (realtimeDebounceTimers[tableName]) {
    clearTimeout(realtimeDebounceTimers[tableName]);
    delete realtimeDebounceTimers[tableName];
  }
  delete realtimeSubscriptions[tableName];
  if (typeof window !== "undefined" && Object.keys(realtimeSubscriptions).length === 0) window.MAXIWA_REALTIME_ACTIVE = false;
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

async function getSupabaseSystemLinks() {
  const client = await initSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("app_system_links")
    .select("id,name,description,url,icon,status,visible_to_all,allowed_roles,allowed_team_names,allowed_emp_ids,sort_order,is_active")
    .eq("is_active", true)
    .neq("status", "Hidden")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map(systemLinkFromRow);
}

async function saveSupabaseSystemLinks(systemLinks) {
  const client = await initSupabaseClient();
  if (!client) throw new Error("Supabase client is not available");
  const rows = (systemLinks || []).map(systemLinkToRow);
  const { data: existingRows, error: existingError } = await client
    .from("app_system_links")
    .select("id");
  if (existingError) throw existingError;

  if (rows.length > 0) {
    const { error: upsertError } = await client
      .from("app_system_links")
      .upsert(rows, { onConflict: "id" });
    if (upsertError) throw upsertError;
  }

  const nextIds = new Set(rows.map((row) => row.id));
  const inactiveIds = (existingRows || [])
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id));
  if (inactiveIds.length > 0) {
    const { error: inactiveError } = await client
      .from("app_system_links")
      .update({ is_active: false, status: "Hidden" })
      .in("id", inactiveIds);
    if (inactiveError) throw inactiveError;
  }

  return { ok: true, systemLinks };
}

function taskExtraData(task) {
  const extra = task?.extra_data;
  if (!extra) return {};
  if (typeof extra === "string") {
    try { return JSON.parse(extra) || {}; } catch { return {}; }
  }
  return typeof extra === "object" ? extra : {};
}

function taskWeight(task) {
  const extra = taskExtraData(task);
  const raw = extra.kpi_effective_weight ?? task?.kpi_effective_weight ?? task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight ?? 1;
  const weight = typeof raw === "string"
    ? Number.parseFloat(raw.replace("%", "").trim())
    : Number(raw);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function kpiGroupKey(task) {
  return String(task?.subkpi ?? task?.subKpi ?? task?.sub ?? task?.mainkpi ?? task?.mainKpi ?? task?.main ?? "Other").trim() || "Other";
}

function isTaskCompletedOnTime(task) {
  const deadline = task?.deadline ? new Date(task.deadline) : null;
  const completedAt = task?.completiondate ? new Date(task.completiondate) : null;
  return Boolean(
    deadline &&
    completedAt &&
    !Number.isNaN(deadline.getTime()) &&
    !Number.isNaN(completedAt.getTime()) &&
    completedAt <= deadline
  );
}

function summarizeKpiGroups(kpiGroups) {
  let slaNum = 0;
  let slaDen = 0;
  let compNum = 0;
  let compDen = 0;
  let cancelledWeight = 0;

  Object.values(kpiGroups || {}).forEach((g) => {
    const groupWeight = taskWeight({ weight: g.weight });
    if (g.total > 0) {
      compNum += groupWeight * (g.completed / g.total);
      compDen += groupWeight;
    } else if (g.cancelled > 0) {
      cancelledWeight += groupWeight;
    }
    if (g.completed > 0) {
      slaNum += groupWeight * (g.onTime / g.completed);
      slaDen += groupWeight;
    }
  });

  return {
    sla: slaDen > 0 ? Math.round((slaNum / slaDen) * 100) : null,
    completion: compDen > 0 ? Math.round((compNum / compDen) * 100) : null,
    totalWeight: compDen,
    completedWeight: compNum,
    onTimeWeight: slaNum,
    slaWeight: slaDen,
    cancelledWeight,
  };
}

function calcWeightedScores(input) {
  if (Array.isArray(input)) {
    let totalWeight = 0;
    let completedWeight = 0;
    let onTimeWeight = 0;
    let cancelledWeight = 0;

    (input || []).forEach((task) => {
      const status = String(task?.status || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
      const weight = taskWeight(task);

      if (status === "cancelled") {
        cancelledWeight += weight;
        return;
      }

      totalWeight += weight;
      if (status === "completed") {
        completedWeight += weight;
        if (isTaskCompletedOnTime(task)) onTimeWeight += weight;
      }
    });

    return {
      sla: completedWeight > 0 ? Math.round((onTimeWeight / completedWeight) * 100) : null,
      completion: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : null,
      totalWeight,
      completedWeight,
      onTimeWeight,
      slaWeight: completedWeight,
      cancelledWeight,
    };
  }

  return summarizeKpiGroups(input);
}

window.API = API;
window.initSupabaseClient = initSupabaseClient;
window.getSupabaseSystemLinks = getSupabaseSystemLinks;
window.saveSupabaseSystemLinks = saveSupabaseSystemLinks;
window.subscribeToRealtime = subscribeToRealtime;
window.unsubscribeFromRealtime = unsubscribeFromRealtime;
window.calcWeightedScores = calcWeightedScores;
