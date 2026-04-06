const API = (() => {
  const BASE = (typeof window !== "undefined" && window.API_BASE) ? window.API_BASE : "/api";

  async function post(endpoint, body, headers = {}) {
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
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

function calcWeightedScores(kpiGroups) {
  let slaNum = 0;
  let slaDen = 0;
  let compNum = 0;
  let compDen = 0;
  Object.values(kpiGroups || {}).forEach((g) => {
    if (g.total > 0) {
      compNum += g.weight * (g.completed / g.total);
      compDen += g.weight;
    }
    if (g.completed > 0) {
      slaNum += g.weight * (g.onTime / g.completed);
      slaDen += g.weight;
    }
  });
  return {
    sla: slaDen > 0 ? Math.round((slaNum / slaDen) * 100) : null,
    completion: compDen > 0 ? Math.round((compNum / compDen) * 100) : null,
  };
}

window.API = API;
window.subscribeToRealtime = subscribeToRealtime;
window.unsubscribeFromRealtime = unsubscribeFromRealtime;
window.calcWeightedScores = calcWeightedScores;
