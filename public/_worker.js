const DEFAULT_BACKEND_API_BASE = "https://spds-1.kobpatme.workers.dev/api";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
  const key = env.SUPABASE_SERVICE_ROLE_KEY
    || env.MAXIWA_SUPABASE_SERVICE_ROLE_KEY
    || env.SUPABASE_ANON_KEY
    || env.MAXIWA_SUPABASE_ANON_KEY;
  const publicKey = env.SUPABASE_ANON_KEY || env.MAXIWA_SUPABASE_ANON_KEY || key;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key, publicKey };
}

async function supabaseFetch(env, table, query = "") {
  const settings = supabaseSettings(env);
  if (!settings) throw new Error("Supabase environment variables are not configured");
  const qs = query.startsWith("?") ? query : `?${query}`;
  const res = await fetch(`${settings.url}/rest/v1/${encodeURIComponent(table)}${qs}`, {
    headers: {
      apikey: settings.key,
      Authorization: `Bearer ${settings.key}`,
      Accept: "application/json",
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || `Supabase ${table} HTTP ${res.status}`);
  return Array.isArray(data) ? data : [];
}

async function readAll(env, table) {
  return supabaseFetch(env, table, "select=*");
}

async function findUserByEmpId(env, empId) {
  const cleanEmpId = String(empId || "").trim();
  if (!cleanEmpId) return null;
  const encoded = encodeURIComponent(cleanEmpId);
  const candidates = [
    `select=*&empid=eq.${encoded}&limit=1`,
    `select=*&empId=eq.${encoded}&limit=1`,
  ];
  for (const query of candidates) {
    try {
      const rows = await supabaseFetch(env, "users", query);
      if (rows[0]) return rows[0];
    } catch {}
  }
  const users = await readAll(env, "users");
  return users.find((user) => {
    const userEmpId = String(user.empid || user.empId || "").trim().toUpperCase();
    return userEmpId === cleanEmpId.toUpperCase();
  }) || null;
}

function dateInPeriod(value, month, year, allTime) {
  if (allTime) return true;
  if (!month || !year) return true;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return true;
  return date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month);
}

function filterTasks(tasks, params = {}) {
  const month = Number(params.month || 0);
  const year = Number(params.year || 0);
  const allTime = params.allTime === true || params.allTime === "true" || month === 0;
  return (tasks || []).filter((task) => {
    if (params.team && params.team !== "all" && task.team !== params.team) return false;
    if (params.name && String(task.name || "").trim() !== String(params.name || "").trim()) return false;
    return dateInPeriod(task.startdate || task.created_at || task.deadline, month, year, allTime);
  });
}

function summarizeTasks(tasks) {
  const people = new Map();
  for (const task of tasks || []) {
    const key = String(task.empId || task.empid || task.assignedToEmpId || `${task.name || ""}|${task.team || ""}`).trim();
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

async function handleSupabaseFallback(request, env, apiPath) {
  const url = new URL(request.url);
  const settings = supabaseSettings(env);
  if (!settings) return null;

  if (apiPath === "public-config") {
    return jsonResponse(request, { url: settings.url, key: settings.publicKey }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "getInitialData" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const user = await findUserByEmpId(env, body.empId || body.empid);
    if (!user) return jsonResponse(request, { error: "ไม่พบข้อมูลผู้ใช้งาน" }, 404, { "X-Maxiwa-Fallback": "supabase" });
    const team = String(user.team || "").trim();
    const kpis = team ? await supabaseFetch(env, "kpis", `select=*&team=eq.${encodeURIComponent(team)}`).catch(() => []) : [];
    return jsonResponse(request, { user, kpis }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "getKPIsByTeam") {
    const team = url.searchParams.get("team") || "";
    const kpis = team ? await supabaseFetch(env, "kpis", `select=*&team=eq.${encodeURIComponent(team)}`).catch(() => []) : await readAll(env, "kpis");
    return jsonResponse(request, { kpis }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "getAllStaff") {
    const staff = await readAll(env, "users");
    return jsonResponse(request, { staff }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "getAllStaffInTeam") {
    const team = url.searchParams.get("team") || "";
    const staff = team ? await supabaseFetch(env, "users", `select=*&team=eq.${encodeURIComponent(team)}`).catch(() => []) : await readAll(env, "users");
    return jsonResponse(request, { staff }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "getDashboardData") {
    const [tasks, kpis, holidays] = await Promise.all([
      readAll(env, "tasks").catch(() => []),
      readAll(env, "kpis").catch(() => []),
      readAll(env, "holidays").catch(() => []),
    ]);
    return jsonResponse(request, { tasks, kpis, holidays }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "getEmployeeTasks" || apiPath === "getAllTasks") {
    const params = Object.fromEntries(url.searchParams.entries());
    const tasks = filterTasks(await readAll(env, "tasks"), params);
    const holidays = await readAll(env, "holidays").catch(() => []);
    return jsonResponse(request, { tasks, holidays }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "getSummaryReport" || apiPath === "getTeamSummaryReport") {
    const params = Object.fromEntries(url.searchParams.entries());
    const tasks = filterTasks(await readAll(env, "tasks"), params);
    const holidays = await readAll(env, "holidays").catch(() => []);
    return jsonResponse(request, { summary: summarizeTasks(tasks), holidays }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "admin/getTeams") {
    return jsonResponse(request, { teams: await readAll(env, "teams") }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "admin/getHolidays") {
    return jsonResponse(request, { holidays: await readAll(env, "holidays") }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  if (apiPath === "admin/getAuditLogs") {
    return jsonResponse(request, { logs: await readAll(env, "audit_log").catch(() => []) }, 200, { "X-Maxiwa-Fallback": "supabase" });
  }

  return null;
}

async function proxyApiRequest(request, env) {
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/api\/?/, "");
  const backendBase = (env.MAXIWA_BACKEND_API_BASE || DEFAULT_BACKEND_API_BASE).replace(/\/+$/, "");
  const targetUrl = `${backendBase}/${apiPath}${url.search}`;
  const headers = new Headers(request.headers);
  const headersToStrip = [
    "host",
    "origin",
    "referer",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "x-forwarded-proto",
    "x-real-ip",
  ];

  headersToStrip.forEach((header) => headers.delete(header));

  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow",
  });

  const responseHeaders = new Headers(backendResponse.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    responseHeaders.set(key, value);
  }
  responseHeaders.set("X-Maxiwa-Proxy-Target", `/api/${apiPath}`);

  const contentType = backendResponse.headers.get("Content-Type") || "";
  if (!backendResponse.ok && contentType.includes("text/html")) {
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({
      error: "Backend API route is not available",
      status: backendResponse.status,
      endpoint: `/api/${apiPath}`,
      backend: targetUrl,
    }), {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      const fallbackRequest = request.clone();
      const proxied = await proxyApiRequest(request, env);
      if (proxied.ok) return proxied;
      const apiPath = url.pathname.replace(/^\/api\/?/, "");
      try {
        const fallback = await handleSupabaseFallback(fallbackRequest, env, apiPath);
        if (fallback) return fallback;
      } catch (error) {
        return jsonResponse(fallbackRequest, {
          error: error.message || "Supabase fallback failed",
          endpoint: `/api/${apiPath}`,
        }, 500, { "X-Maxiwa-Fallback": "supabase-error" });
      }
      return proxied;
    }

    return env.ASSETS.fetch(request);
  },
};
