const API = (() => {
  const BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : "/api";

  async function post(endpoint, body, headers = {}) {
    const hasCustomHeaders = Object.keys(headers || {}).length > 0;
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": hasCustomHeaders ? "application/json" : "text/plain", ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const d = await res.json();
        if (d.error) msg += `: ${d.error}`;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  async function get(endpoint, params = {}, headers = {}) {
    const cleanParams = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") cleanParams[k] = v;
    }
    const qs = new URLSearchParams(cleanParams).toString();
    const res = await fetch(`${BASE}/${endpoint}${qs ? `?${qs}` : ""}`, { headers });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const d = await res.json();
        if (d.error) msg += `: ${d.error}`;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  return {
    getInitialData: (empId) => post("getInitialData", { empId }),
    getEmployeeTasks: (userData, month, year, allTime, requesterEmpId) =>
      get("getEmployeeTasks", { name: userData.name, month, year, allTime, requesterEmpId }),
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
    getSummaryReport: (month, year, requesterEmpId) => get("getSummaryReport", { month, year, requesterEmpId }),
    getTeamSummaryReport: (team, month, year, requesterEmpId) =>
      get("getTeamSummaryReport", { team, month, year, requesterEmpId }),
    getAllStaff: (requesterEmpId) => get("getAllStaff", { requesterEmpId }),
    getAllStaffInTeam: (team, requesterEmpId) => get("getAllStaffInTeam", { team, requesterEmpId }),
    getKPIsByTeam: (team) => get("getKPIsByTeam", { team }),
    getDashboardData: () => get("getDashboardData"),
    saveUser: (userData, headers = {}) => post("admin/saveUser", userData, headers),
    deleteUser: (empId, headers = {}) => fetch(`${BASE}/admin/deleteUser?empId=${encodeURIComponent(empId)}`, { method: "DELETE", headers }).then((r) => r.json()),
    saveKpi: (kpiData, headers = {}) => post("admin/saveKpi", kpiData, headers),
    deleteKpi: (id, headers = {}) => fetch(`${BASE}/admin/deleteKpi?id=${encodeURIComponent(id)}`, { method: "DELETE", headers }).then((r) => r.json()),
    getAuditLogs: (headers = {}) => get("admin/getAuditLogs", {}, headers),
    getTeams: (headers = {}) => get("admin/getTeams", {}, headers),
    saveTeam: (teamData, headers = {}) => post("admin/saveTeam", teamData, headers),
    deleteTeam: (id, headers = {}) => fetch(`${BASE}/admin/deleteTeam?id=${encodeURIComponent(id)}`, { method: "DELETE", headers }).then((r) => r.json()),
    getHolidays: (headers = {}) => get("admin/getHolidays", {}, headers),
    saveHoliday: (holidayData, headers = {}) => post("admin/saveHoliday", holidayData, headers),
    deleteHoliday: (id, headers = {}) => fetch(`${BASE}/admin/deleteHoliday?id=${encodeURIComponent(id)}`, { method: "DELETE", headers }).then((r) => r.json()),
    recalculateDeadlines: (headers = {}) => post("admin/recalculateDeadlines", {}, headers),
    deleteTask: (id, team, changedBy) => post("deleteTask", { id, team, changedBy }),
    getTasksByJob: (q) => get("getTasksByJob", { q }),
    getAuditLogsByTask: (taskId) => get("getAuditLogsByTask", { taskId }),
    getSystemLinks: (requesterEmpId) => get("systemLinks", { requesterEmpId }),
    saveSystemLinks: (systemLinks, headers = {}) => post("admin/saveSystemLinks", { systemLinks }, headers),
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
      const res = await fetch(configUrl);
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

function taskWeight(task) {
  const raw = task?.mainkpiweight ?? task?.main_weight ?? task?.weight ?? task?.kpiweight ?? 1;
  const weight = typeof raw === "string"
    ? Number.parseFloat(raw.replace("%", "").trim())
    : Number(raw);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

function kpiGroupKey(task) {
  return String(task?.mainkpi ?? task?.mainKpi ?? task?.main ?? task?.subkpi ?? task?.sub ?? "Other").trim() || "Other";
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
    const kpiGroups = {};

    input.forEach((task) => {
      const status = String(task?.status || "").toLowerCase();
      const key = kpiGroupKey(task);
      const weight = taskWeight(task);
      if (!kpiGroups[key]) {
        kpiGroups[key] = { weight, total: 0, completed: 0, onTime: 0, cancelled: 0 };
      } else if (kpiGroups[key].weight === 1 && weight !== 1) {
        kpiGroups[key].weight = weight;
      }

      if (status === "cancelled") {
        kpiGroups[key].cancelled += 1;
        return;
      }

      kpiGroups[key].total += 1;
      if (status === "completed") {
        kpiGroups[key].completed += 1;
        if (isTaskCompletedOnTime(task)) kpiGroups[key].onTime += 1;
      }
    });

    return summarizeKpiGroups(kpiGroups);
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
