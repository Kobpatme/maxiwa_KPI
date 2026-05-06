var MaxiwaKpiApp = (() => {
  const { useEffect, useMemo, useState, useCallback } = React;
  const SESSION_KEY = "maxiwa-kpi-session";
  const SESSION_ID_KEY = "maxiwa-kpi-session-id";
  const SESSION_LOCK_KEY = "maxiwa-kpi-active-session";
  const SESSION_LOCK_TTL = 45e3;
  const THEME_KEY = "maxiwa-kpi-theme";
  const SYSTEM_LINKS_KEY = "maxiwa-system-links";
  const RUNTIME_SESSION_ID = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const APP_NAME = "METRIX Verity";
  const APP_TAGLINE = "Executive Performance System";
  const APP_LOGO_URL = "https://img2.pic.in.th/Logo40f6c473c9a46acd.png";
  const MONTH_NAMES = [
    "\u0E21\u0E01\u0E23\u0E32\u0E04\u0E21",
    "\u0E01\u0E38\u0E21\u0E20\u0E32\u0E1E\u0E31\u0E19\u0E18\u0E4C",
    "\u0E21\u0E35\u0E19\u0E32\u0E04\u0E21",
    "\u0E40\u0E21\u0E29\u0E32\u0E22\u0E19",
    "\u0E1E\u0E24\u0E29\u0E20\u0E32\u0E04\u0E21",
    "\u0E21\u0E34\u0E16\u0E38\u0E19\u0E32\u0E22\u0E19",
    "\u0E01\u0E23\u0E01\u0E0E\u0E32\u0E04\u0E21",
    "\u0E2A\u0E34\u0E07\u0E2B\u0E32\u0E04\u0E21",
    "\u0E01\u0E31\u0E19\u0E22\u0E32\u0E22\u0E19",
    "\u0E15\u0E38\u0E25\u0E32\u0E04\u0E21",
    "\u0E1E\u0E24\u0E28\u0E08\u0E34\u0E01\u0E32\u0E22\u0E19",
    "\u0E18\u0E31\u0E19\u0E27\u0E32\u0E04\u0E21"
  ];
  const ROLE_DEFINITIONS = {
    Staff: { scope: "Self", level: 10, label: "Staff" },
    Lead: { scope: "Team", level: 20, label: "Lead" },
    Manager: { scope: "Department", level: 30, label: "Manager" },
    SrManager: { scope: "Division", level: 40, label: "Sr. Manager" },
    Director: { scope: "Division", level: 50, label: "Director" },
    Executive: { scope: "Organization", level: 60, label: "Executive" },
    Admin: { scope: "System", level: 90, label: "System Admin" }
  };
  const ROLE_OPTIONS = Object.entries(ROLE_DEFINITIONS).map(([value, config]) => ({ value, label: config.label }));
  const SCOPE_OPTIONS = ["Self", "Team", "Department", "Division", "Organization", "System"];
  const ADMIN_ROLES = ["Admin"];
  const TEAM_MANAGER_ROLES = ["Lead"];
  const DEPARTMENT_MANAGER_ROLES = ["Manager"];
  const STRATEGIC_VIEW_ROLES = ["SrManager", "Director", "Executive"];
  const EXECUTIVE_VIEW_ROLES = ["Manager", "SrManager", "Director", "Executive", "Admin"];
  const DEFAULT_SYSTEM_LINKS = [
    {
      id: "maxiwa-kpi",
      name: "METRIX Verity",
      description: "KPI, SLA, task tracking, and executive performance dashboard",
      url: "./maxiwa.html",
      icon: "fa-chart-line",
      status: "Active",
      visibleToAll: true,
      allowedRoles: [],
      allowedTeams: [],
      allowedEmpIds: [],
      isActive: true
    },
    {
      id: "executive-view",
      name: "Executive Dashboard",
      description: "Portfolio, risk, SLA, and weighted KPI view for management",
      url: "./dashboard.html",
      icon: "fa-display",
      status: "Active",
      visibleToAll: false,
      allowedRoles: EXECUTIVE_VIEW_ROLES,
      allowedTeams: [],
      allowedEmpIds: [],
      isActive: true
    },
    {
      id: "pr-system",
      name: "PR System",
      description: "Create and track purchase request work outside MAXIWA",
      url: "",
      icon: "fa-file-invoice",
      status: "Coming Soon",
      visibleToAll: false,
      allowedRoles: ["Staff", "Lead", "Manager", "Admin"],
      allowedTeams: [],
      allowedEmpIds: [],
      isActive: true
    }
  ];
  function roleConfig(role) {
    return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.Staff;
  }
  function roleLabel(role) {
    return roleConfig(role).label || role || "-";
  }
  function roleScope(user) {
    const role = typeof user === "string" ? user : user == null ? void 0 : user.role;
    const permissions = userPermissions(user);
    return (user == null ? void 0 : user.accessScope) || (user == null ? void 0 : user.scope) || permissions.scope || roleConfig(role).scope;
  }
  function userPermissions(user) {
    const raw = user == null ? void 0 : user.permissions;
    if (!raw) return {};
    if (typeof raw === "string") return parseJsonSafe(raw, {}) || {};
    return typeof raw === "object" ? raw : {};
  }
  function allowedTeamsForUser(user) {
    const permissions = userPermissions(user);
    return Array.isArray(permissions.allowedTeams) ? permissions.allowedTeams.map((team) => String(team || "").trim()).filter(Boolean) : [];
  }
  function isAdminRole(role) {
    return ADMIN_ROLES.includes(role);
  }
  function isTeamManagerRole(role) {
    return TEAM_MANAGER_ROLES.includes(role);
  }
  function isDepartmentManagerRole(role) {
    return DEPARTMENT_MANAGER_ROLES.includes(role);
  }
  function isStrategicViewRole(role) {
    return STRATEGIC_VIEW_ROLES.includes(role);
  }
  function canOpenExecutiveView(role) {
    return EXECUTIVE_VIEW_ROLES.includes(role);
  }
  function roleRequiresTeam(role) {
    return ["Staff", "Lead"].includes(role);
  }
  function roleRequiresDepartment(role) {
    return ["Manager", "SrManager", "Director", "Executive"].includes(role);
  }
  function shouldUsePersonalWork(user, view) {
    return (user == null ? void 0 : user.role) === "Staff" || ["my-dashboard", "my-tasks"].includes(view);
  }
  function taskScopeForUser(user) {
    if (isTeamManagerRole(user == null ? void 0 : user.role)) return (user == null ? void 0 : user.team) || "all";
    return "all";
  }
  function shouldApplyAllowedTeamFilter(user) {
    return (isDepartmentManagerRole(user == null ? void 0 : user.role) || isStrategicViewRole(user == null ? void 0 : user.role)) && allowedTeamsForUser(user).length > 0;
  }
  function filterByAllowedTeams(user, items, getTeam = (item) => item == null ? void 0 : item.team) {
    if (!shouldApplyAllowedTeamFilter(user)) return items || [];
    const allowed = new Set(allowedTeamsForUser(user));
    return (items || []).filter((item) => allowed.has(String(getTeam(item) || "").trim()));
  }
  function normalizeList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  function normalizeSystemLink(item = {}) {
    var _a, _b, _c, _d;
    const id = String(item.id || item.name || `system-${Date.now()}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id,
      name: String(item.name || "").trim(),
      description: String(item.description || "").trim(),
      url: String(item.url || "").trim(),
      icon: String(item.icon || "fa-up-right-from-square").trim(),
      status: item.status || "Active",
      visibleToAll: item.visibleToAll === true || item.visible_to_all === true || String((_a = item.visibleToAll) != null ? _a : item.visible_to_all).toLowerCase() === "true",
      allowedRoles: normalizeList((_b = item.allowedRoles) != null ? _b : item.allowed_roles),
      allowedTeams: normalizeList((_c = item.allowedTeams) != null ? _c : item.allowed_team_names),
      allowedEmpIds: normalizeList((_d = item.allowedEmpIds) != null ? _d : item.allowed_emp_ids).map((empId) => empId.toUpperCase()),
      isActive: item.isActive !== false && item.is_active !== false
    };
  }
  function normalizeSystemLinks(links, fallback = DEFAULT_SYSTEM_LINKS) {
    const source = Array.isArray(links) ? links : fallback;
    return source.map(normalizeSystemLink).filter((item) => item.name);
  }
  function loadSystemLinks() {
    return normalizeSystemLinks(parseJsonSafe(safeLocalGet(SYSTEM_LINKS_KEY), DEFAULT_SYSTEM_LINKS));
  }
  function cacheSystemLinks(links) {
    const normalized = normalizeSystemLinks(links);
    safeLocalSet(SYSTEM_LINKS_KEY, JSON.stringify(normalized));
    return normalized;
  }
  async function fetchSystemLinksFromApi(user) {
    const empId = String((user == null ? void 0 : user.empId) || (user == null ? void 0 : user.empid) || "").trim();
    const qs = new URLSearchParams(empId ? { requesterEmpId: empId } : {}).toString();
    if (window.getSupabaseSystemLinks) {
      try {
        const links = await window.getSupabaseSystemLinks();
        if (Array.isArray(links) && links.length > 0) return normalizeSystemLinks(links, []);
      } catch (supabaseError) {
        console.warn("Supabase system links are not available yet; falling back to API/local cache.", supabaseError);
      }
    }
    try {
      const res = await fetch(`${apiBase()}/systemLinks${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`System links API ${res.status}`);
      const data = await res.json();
      return normalizeSystemLinks(data.systemLinks || data.systems || data.links || []);
    } catch (apiError) {
      throw apiError;
    }
  }
  async function saveSystemLinksToApi(links, empId) {
    const normalized = normalizeSystemLinks(links);
    try {
      return await adminPost("admin/saveSystemLinks", { systemLinks: normalized }, empId);
    } catch (apiError) {
      if (window.saveSupabaseSystemLinks) return window.saveSupabaseSystemLinks(normalized);
      throw apiError;
    }
  }
  function systemVisibleToUser(system, user) {
    const item = normalizeSystemLink(system);
    if (!item.isActive || item.status === "Hidden") return false;
    if (isAdminRole(user == null ? void 0 : user.role)) return true;
    const empId = String((user == null ? void 0 : user.empId) || (user == null ? void 0 : user.empid) || "").trim().toUpperCase();
    if (item.visibleToAll) return true;
    if (item.allowedEmpIds.includes(empId)) return true;
    if (item.allowedRoles.includes(user == null ? void 0 : user.role)) return true;
    if (item.allowedTeams.includes(String((user == null ? void 0 : user.team) || "").trim())) return true;
    return false;
  }
  function visibleSystemLinksForUser(links, user) {
    return normalizeSystemLinks(links).filter((item) => systemVisibleToUser(item, user));
  }
  const NAV_BY_ROLE = {
    Staff: [
      { id: "dashboard", label: "My Dashboard", icon: "fa-chart-line", group: "\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19" },
      { id: "tasks", label: "My Tasks", icon: "fa-list-check", group: "\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19" },
      { id: "create", label: "Create Task", icon: "fa-square-plus", group: "\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project", group: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D" }
    ],
    Lead: [
      { id: "my-dashboard", label: "My Dashboard", icon: "fa-chart-line", group: "\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19" },
      { id: "my-tasks", label: "My Tasks", icon: "fa-list-check", group: "\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19" },
      { id: "create", label: "Create Task", icon: "fa-square-plus", group: "\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19" },
      { id: "dashboard", label: "Team Command", icon: "fa-people-roof", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E17\u0E35\u0E21" },
      { id: "tasks", label: "Team Tasks", icon: "fa-list-check", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E17\u0E35\u0E21" },
      { id: "assign", label: "Assign Task", icon: "fa-user-plus", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E17\u0E35\u0E21" },
      { id: "people", label: "Team People", icon: "fa-users", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E17\u0E35\u0E21" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project", group: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D" }
    ],
    Manager: [
      { id: "dashboard", label: "Operations Dashboard", icon: "fa-chart-line", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23" },
      { id: "tasks", label: "Task Center", icon: "fa-list-check", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23" },
      { id: "assign", label: "Assign Task", icon: "fa-user-plus", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23" },
      { id: "people", label: "People", icon: "fa-users-viewfinder", group: "\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project", group: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D" },
      { id: "admin", label: "System Control", icon: "fa-shield-halved", group: "\u0E23\u0E30\u0E1A\u0E1A" }
    ],
    SrManager: [
      { id: "executive", label: "Executive View", icon: "fa-display", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "dashboard", label: "Division Dashboard", icon: "fa-chart-line", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "tasks", label: "Work Portfolio", icon: "fa-list-check", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "people", label: "People Overview", icon: "fa-users-viewfinder", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project", group: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D" }
    ],
    Director: [
      { id: "executive", label: "Executive View", icon: "fa-display", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "dashboard", label: "Director Dashboard", icon: "fa-chart-line", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "tasks", label: "Work Portfolio", icon: "fa-list-check", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "people", label: "People Overview", icon: "fa-users-viewfinder", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project", group: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D" }
    ],
    Executive: [
      { id: "executive", label: "Executive View", icon: "fa-display", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "dashboard", label: "Organization Dashboard", icon: "fa-chart-line", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "tasks", label: "Work Portfolio", icon: "fa-list-check", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "people", label: "People Overview", icon: "fa-users-viewfinder", group: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project", group: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D" }
    ],
    Admin: [
      { id: "dashboard", label: "System Dashboard", icon: "fa-chart-line", group: "\u0E23\u0E30\u0E1A\u0E1A" },
      { id: "admin", label: "System Control", icon: "fa-shield-halved", group: "\u0E23\u0E30\u0E1A\u0E1A" },
      { id: "tracker", label: "Job Tracker", icon: "fa-diagram-project", group: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D" }
    ]
  };
  const ROLE_HOME = {
    Staff: "dashboard",
    Lead: "my-dashboard",
    Manager: "dashboard",
    SrManager: "executive",
    Director: "executive",
    Executive: "executive",
    Admin: "dashboard"
  };
  function navItemsForUser(user) {
    const base = NAV_BY_ROLE[user == null ? void 0 : user.role] || NAV_BY_ROLE.Staff;
    if (base.some((item) => item.id === "systems")) return base;
    const systemsItem = { id: "systems", label: "Systems", icon: "fa-table-cells-large", group: "Tools" };
    const adminIndex = base.findIndex((item) => item.id === "admin");
    if (adminIndex < 0) return [...base, systemsItem];
    return [...base.slice(0, adminIndex), systemsItem, ...base.slice(adminIndex)];
  }
  function cn(...values) {
    return values.filter(Boolean).join(" ");
  }
  function BrandLogo({ className = "w-14 h-14", imgClassName = "" }) {
    return /* @__PURE__ */ React.createElement("div", { className: cn("mx-brand-mark rounded-lg overflow-hidden grid place-items-center flex-shrink-0 bg-white", className) }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: APP_LOGO_URL,
        alt: `${APP_NAME} logo`,
        className: cn("w-full h-full object-contain p-1.5", imgClassName),
        referrerPolicy: "no-referrer"
      }
    ));
  }
  function BrandPill({ className = "" }) {
    return /* @__PURE__ */ React.createElement("div", { className: cn("mx-brand-pill inline-flex items-center gap-2 rounded-lg font-extrabold", className) }, /* @__PURE__ */ React.createElement("img", { src: APP_LOGO_URL, alt: "", className: "w-5 h-5 object-contain", referrerPolicy: "no-referrer" }), APP_NAME);
  }
  function apiBase() {
    return typeof window !== "undefined" && window.API_BASE ? window.API_BASE : "/api";
  }
  function adminHeaders(empId) {
    return { "Content-Type": "application/json", "x-admin-empid": empId || "" };
  }
  async function adminGet(path, empId) {
    const res = await fetch(`${apiBase()}/${path}`, { headers: adminHeaders(empId) });
    return res.json();
  }
  async function adminPost(path, payload, empId) {
    const res = await fetch(`${apiBase()}/${path}`, {
      method: "POST",
      headers: adminHeaders(empId),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || `Request failed (${res.status})`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  }
  async function adminDelete(path, empId) {
    const res = await fetch(`${apiBase()}/${path}`, {
      method: "DELETE",
      headers: adminHeaders(empId)
    });
    return res.json();
  }
  function formatDate(value, withTime = false) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("th-TH", withTime ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { year: "numeric", month: "short", day: "numeric" });
  }
  function parseJsonSafe(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  function safeSessionGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function safeSessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
    }
  }
  function safeSessionRemove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
    }
  }
  function safeLocalGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function safeLocalSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
    }
  }
  function safeLocalRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
    }
  }
  function getBrowserSessionId() {
    safeSessionSet(SESSION_ID_KEY, RUNTIME_SESSION_ID);
    return RUNTIME_SESSION_ID;
  }
  function getActiveSessionLock() {
    const lock = parseJsonSafe(safeLocalGet(SESSION_LOCK_KEY), null);
    if (!(lock == null ? void 0 : lock.empId) || !(lock == null ? void 0 : lock.sessionId) || !(lock == null ? void 0 : lock.expiresAt)) return null;
    if (Number(lock.expiresAt) <= Date.now()) {
      safeLocalRemove(SESSION_LOCK_KEY);
      return null;
    }
    return lock;
  }
  function writeActiveSessionLock(user) {
    if (!(user == null ? void 0 : user.empId) && !(user == null ? void 0 : user.empid)) return;
    safeLocalSet(SESSION_LOCK_KEY, JSON.stringify({
      empId: String(user.empId || user.empid).trim(),
      name: user.name || "",
      sessionId: getBrowserSessionId(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_LOCK_TTL
    }));
  }
  function clearActiveSessionLock() {
    const lock = getActiveSessionLock();
    if (!lock || lock.sessionId === getBrowserSessionId()) safeLocalRemove(SESSION_LOCK_KEY);
  }
  function isSessionSuperseded(userOrEmpId) {
    const lock = getActiveSessionLock();
    if (!lock) return false;
    const empId = typeof userOrEmpId === "string" ? userOrEmpId : (userOrEmpId == null ? void 0 : userOrEmpId.empId) || (userOrEmpId == null ? void 0 : userOrEmpId.empid);
    return String(lock.empId).toLowerCase() === String(empId || "").trim().toLowerCase() && lock.sessionId !== getBrowserSessionId();
  }
  function getStatusClass(status) {
    if (status === "Completed") return "mx-status-completed";
    if (status === "On Process") return "mx-status-process";
    if (status === "Pending") return "mx-status-pending";
    if (status === "On Hold") return "mx-status-hold";
    return "mx-status-cancelled";
  }
  function extractJobCode(jobStr) {
    if (!jobStr) return "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2B\u0E31\u0E2A";
    const match = jobStr.match(/^([A-Za-z]+\d+_\d+)/);
    return match ? match[1].toUpperCase() : jobStr.substring(0, 20);
  }
  function getTimestamp() {
    const now = /* @__PURE__ */ new Date();
    return `[${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}]`;
  }
  function renderExtraData(extraData) {
    const ed = extraData || {};
    const entries = [
      ["Building", ed.building],
      ["Client", ed.client],
      ["Contractor", ed.contractor],
      ["Contractor Name", ed.contractorName],
      ["Type", ed.contractorType],
      ["SSR", ed.ssrNumber],
      ["OSP", ed.ospNumber],
      ["Fund", ed.fundNumber],
      ["Amount", ed.amount ? Number(ed.amount).toLocaleString("th-TH") : ""]
    ].filter(([, v]) => v !== void 0 && v !== null && v !== "");
    if (entries.length === 0) return null;
    return /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, entries.map(([label, value]) => /* @__PURE__ */ React.createElement("span", { key: label, className: "mx-badge mx-status-process" }, label, ": ", value)));
  }
  function getTaskWeight(task) {
    var _a, _b, _c, _d;
    const raw = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpiweight) != null ? _a : task == null ? void 0 : task.main_weight) != null ? _b : task == null ? void 0 : task.weight) != null ? _c : task == null ? void 0 : task.kpiweight) != null ? _d : 1;
    const weight = typeof raw === "string" ? Number.parseFloat(raw.replace("%", "").trim()) : Number(raw);
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  }
  function formatWeight(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0";
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, "");
  }
  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }
  function formatWeightPercent(value) {
    return `${formatWeight(value)}%`;
  }
  function getKpiGroupKey(task) {
    var _a, _b, _c, _d, _e;
    return String((_e = (_d = (_c = (_b = (_a = task == null ? void 0 : task.mainkpi) != null ? _a : task == null ? void 0 : task.mainKpi) != null ? _b : task == null ? void 0 : task.main) != null ? _c : task == null ? void 0 : task.subkpi) != null ? _d : task == null ? void 0 : task.sub) != null ? _e : "Other").trim() || "Other";
  }
  function isCompletedOnTime(task) {
    const deadline = (task == null ? void 0 : task.deadline) ? new Date(task.deadline) : null;
    const completedAt = (task == null ? void 0 : task.completiondate) ? new Date(task.completiondate) : null;
    return Boolean(deadline && completedAt && !Number.isNaN(deadline.getTime()) && !Number.isNaN(completedAt.getTime()) && completedAt <= deadline);
  }
  function getSlaWeight(scores) {
    var _a, _b;
    return (_b = (_a = scores == null ? void 0 : scores.slaWeight) != null ? _a : scores == null ? void 0 : scores.completedWeight) != null ? _b : 0;
  }
  function formatScorePercent(value) {
    return value !== null && value !== void 0 ? `${value}%` : "-";
  }
  function completionMetricSub(scores) {
    if (!scores || scores.completion === null || scores.completion === void 0) return "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19";
    return `\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 ${scores.completion}% \u0E08\u0E32\u0E01\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E23\u0E27\u0E21 ${formatWeightPercent(scores.totalWeight)}`;
  }
  function slaMetricSub(scores, score = scores == null ? void 0 : scores.sla) {
    if (!scores || score === null || score === void 0) return "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01\u0E10\u0E32\u0E19 SLA";
    return `\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32 ${score}% \u0E08\u0E32\u0E01\u0E10\u0E32\u0E19 SLA ${formatWeightPercent(getSlaWeight(scores))}`;
  }
  function calcTaskWeightedScores(tasks) {
    if (window.calcWeightedScores) return window.calcWeightedScores(tasks || []);
    const groups = {};
    (tasks || []).forEach((task) => {
      const key = getKpiGroupKey(task);
      const weight = getTaskWeight(task);
      const status = String((task == null ? void 0 : task.status) || "").toLowerCase();
      if (!groups[key]) groups[key] = { weight, total: 0, completed: 0, onTime: 0, cancelled: 0 };
      else if (groups[key].weight === 1 && weight !== 1) groups[key].weight = weight;
      if (status === "cancelled") {
        groups[key].cancelled += 1;
        return;
      }
      groups[key].total += 1;
      if (status === "completed") {
        groups[key].completed += 1;
        if (isCompletedOnTime(task)) groups[key].onTime += 1;
      }
    });
    let totalWeight = 0;
    let completedWeight = 0;
    let slaWeight = 0;
    let onTimeWeight = 0;
    Object.values(groups).forEach((group) => {
      const weight = getTaskWeight({ weight: group.weight });
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
      sla: slaWeight > 0 ? Math.round(onTimeWeight / slaWeight * 100) : null,
      completion: totalWeight > 0 ? Math.round(completedWeight / totalWeight * 100) : null,
      totalWeight,
      completedWeight,
      onTimeWeight,
      slaWeight
    };
  }
  function WeightFormulaStrip({ scores }) {
    if (!scores) return null;
    return /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "\u0E2A\u0E39\u0E15\u0E23\u0E04\u0E33\u0E19\u0E27\u0E13\u0E41\u0E1A\u0E1A\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, "SLA = \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32 / \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 \u0E41\u0E25\u0E30 Completion = \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08 / \u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32 ", formatWeightPercent(scores.onTimeWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E40\u0E2A\u0E23\u0E47\u0E08 ", formatWeightPercent(scores.completedWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, "\u0E10\u0E32\u0E19 SLA ", formatWeightPercent(getSlaWeight(scores))), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "\u0E23\u0E27\u0E21 ", formatWeightPercent(scores.totalWeight)))));
  }
  function personKey(value) {
    return String(value || "").trim().toLowerCase();
  }
  function taskMatchesPerson(task, person) {
    const taskEmp = personKey(task.empId || task.empid || task.assignedToEmpId);
    const personEmp = personKey(person.empId || person.empid);
    if (taskEmp && personEmp && taskEmp === personEmp) return true;
    return personKey(task.name) === personKey(person.name) && (!person.team || task.team === person.team);
  }
  function enrichSummaryWithTaskWeights(summary, tasks) {
    const sourceSummary = summary || [];
    const sourceTasks = tasks || [];
    return sourceSummary.map((person) => {
      const personTasks = sourceTasks.filter((task) => taskMatchesPerson(task, person));
      if (personTasks.length === 0) return person;
      const weighted = calcTaskWeightedScores(personTasks);
      return {
        ...person,
        totalTasks: personTasks.length,
        completedTasks: personTasks.filter((task) => String(task.status || "").toLowerCase() === "completed").length,
        weightedSlaScore: weighted.sla,
        weightedCompletionScore: weighted.completion,
        totalWeight: weighted.totalWeight,
        completedWeight: weighted.completedWeight,
        onTimeWeight: weighted.onTimeWeight,
        slaWeight: weighted.slaWeight
      };
    });
  }
  function MetricCard({ label, value, sub, icon, accent = "var(--mx-blue)" }) {
    return /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[20px] p-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] uppercase tracking-[0.14em] text-[var(--mx-muted)] font-extrabold" }, label), /* @__PURE__ */ React.createElement("div", { className: "w-11 h-11 rounded-2xl grid place-items-center", style: { background: `color-mix(in srgb, ${accent} 16%, transparent)` } }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${icon}`, style: { color: accent } }))), /* @__PURE__ */ React.createElement("div", { className: "mt-5 text-[34px] font-extrabold tracking-normal" }, value), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, sub));
  }
  function Panel({ title, subtitle, actions, children }) {
    return /* @__PURE__ */ React.createElement("section", { className: "mx-shell-card rounded-[28px] p-5 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-[22px] font-extrabold tracking-normal m-0" }, title), subtitle && /* @__PURE__ */ React.createElement("p", { className: "mt-1 mb-0 text-sm text-[var(--mx-muted)]" }, subtitle)), actions && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, actions)), children);
  }
  function ThemeToggle({ theme, onToggle }) {
    const isDark = theme === "dark";
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !py-2 !px-3 inline-flex items-center gap-2",
        onClick: onToggle,
        title: isDark ? "Switch to light mode" : "Switch to dark mode",
        "aria-label": isDark ? "Switch to light mode" : "Switch to dark mode"
      },
      /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${isDark ? "fa-sun" : "fa-moon"}` }),
      /* @__PURE__ */ React.createElement("span", { className: "text-sm font-extrabold" }, isDark ? "Light" : "Dark")
    );
  }
  function UserAvatar({ user, size = "lg" }) {
    const [imgFailed, setImgFailed] = useState(false);
    const rawPhoto = (user == null ? void 0 : user.pigurl) || (user == null ? void 0 : user.pigUrl) || (user == null ? void 0 : user.pigURL) || (user == null ? void 0 : user.picurl) || (user == null ? void 0 : user.picUrl) || (user == null ? void 0 : user.picture) || (user == null ? void 0 : user.pictureUrl) || (user == null ? void 0 : user.profilePicture) || (user == null ? void 0 : user.profile_picture) || (user == null ? void 0 : user.avatar) || (user == null ? void 0 : user.avatarUrl) || (user == null ? void 0 : user.photoUrl) || (user == null ? void 0 : user.photo_url) || (user == null ? void 0 : user.profileUrl) || (user == null ? void 0 : user.profile_url) || (user == null ? void 0 : user.imageUrl) || (user == null ? void 0 : user.image_url) || (user == null ? void 0 : user.image) || (user == null ? void 0 : user.photo) || "";
    const normalizePhotoUrl = (value) => {
      const src = String(value || "").trim();
      if (!src) return "";
      const driveMatch = src.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (driveMatch) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w240`;
      const driveOpenMatch = src.match(/[?&]id=([^&]+)/);
      if (src.includes("drive.google.com") && driveOpenMatch) return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w240`;
      if (/^[A-Za-z0-9_-]{20,}$/.test(src)) return `https://drive.google.com/thumbnail?id=${src}&sz=w240`;
      if (src.startsWith("//")) return `https:${src}`;
      if (src.startsWith("/")) {
        const base = typeof window !== "undefined" && window.API_BASE ? window.API_BASE.replace(/\/api\/?$/, "") : "";
        return `${base}${src}`;
      }
      return src;
    };
    const photo = normalizePhotoUrl(rawPhoto);
    const initials = String((user == null ? void 0 : user.name) || (user == null ? void 0 : user.empId) || "U").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "U";
    const box = size === "xl" ? "w-20 h-20 text-2xl" : "w-14 h-14 text-lg";
    return /* @__PURE__ */ React.createElement("div", { className: cn("relative rounded-lg overflow-hidden mx-brand-mark grid place-items-center font-black flex-shrink-0", box) }, photo && !imgFailed ? /* @__PURE__ */ React.createElement(
      "img",
      {
        src: photo,
        alt: "User profile",
        className: "w-full h-full object-cover",
        referrerPolicy: "no-referrer",
        onError: () => setImgFailed(true)
      }
    ) : /* @__PURE__ */ React.createElement("span", null, initials));
  }
  function ActionModal({ config, onClose }) {
    const [inputVal, setInputVal] = useState("");
    useEffect(() => {
      if (config.show) setInputVal(config.inputValue || "");
    }, [config.show, config.inputValue]);
    if (!config.show) return null;
    const colorMap = {
      blue: "mx-btn-primary",
      rose: "mx-action-danger",
      emerald: "mx-action-success",
      amber: "mx-action-warning",
      slate: "mx-action-muted"
    };
    const btnClass = colorMap[config.color] || colorMap.blue;
    const handleConfirm = () => {
      if (config.type === "prompt") {
        if (config.action) config.action(inputVal);
      } else {
        if (config.action) config.action();
      }
      onClose();
    };
    return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-md shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-2" }, config.title), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--mx-muted)] mb-4" }, config.message), config.type === "prompt" && /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "mx-textarea min-h-[80px] mb-4",
        placeholder: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14...",
        value: inputVal,
        onChange: (e) => setInputVal(e.target.value),
        autoFocus: true
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, config.type !== "alert" && /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: onClose }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement("button", { className: `mx-btn flex-1 ${btnClass}`, onClick: handleConfirm }, config.type === "alert" ? "\u0E23\u0E31\u0E1A\u0E17\u0E23\u0E32\u0E1A" : "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19"))));
  }
  function StatusChangeModal({ task, onSave, onClose }) {
    var _a;
    const [newStatus, setNewStatus] = useState(task.status || "On Process");
    const [reason, setReason] = useState("");
    return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-1" }, "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--mx-muted)] mb-5 break-all" }, (task.job || "").substring(0, 60), ((_a = task.job) == null ? void 0 : _a.length) > 60 ? "..." : ""), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E43\u0E2B\u0E21\u0E48"), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: newStatus, onChange: (e) => setNewStatus(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "Pending" }, "Pending"), /* @__PURE__ */ React.createElement("option", { value: "On Process" }, "On Process"), /* @__PURE__ */ React.createElement("option", { value: "On Hold" }, "On Hold"), /* @__PURE__ */ React.createElement("option", { value: "Completed" }, "Completed"), /* @__PURE__ */ React.createElement("option", { value: "Cancelled" }, "Cancelled"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25 / \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "mx-textarea min-h-[80px]",
        placeholder: "\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E2B\u0E23\u0E37\u0E2D\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21...",
        value: reason,
        onChange: (e) => setReason(e.target.value),
        autoFocus: true
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: onClose }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-primary flex-1",
        onClick: () => {
          onSave(newStatus, reason);
          onClose();
        }
      },
      "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19"
    ))));
  }
  const SYSTEM_CONTROL_SECTIONS = [
    { id: "overview", label: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E23\u0E30\u0E1A\u0E1A", icon: "fa-gauge-high" },
    { id: "users", label: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C", icon: "fa-users-gear" },
    { id: "systems", label: "Systems", icon: "fa-table-cells-large" },
    { id: "teams", label: "\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19", icon: "fa-people-group" },
    { id: "kpi", label: "\u0E01\u0E0E KPI/SLA", icon: "fa-scale-balanced" },
    { id: "calendar", label: "\u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 SLA", icon: "fa-calendar-days" },
    { id: "audit", label: "\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02", icon: "fa-shield-halved" }
  ];
  function Sidebar({ user, view, setView, onLogout, notifCount = 0, adminSection = "overview", setAdminSection = () => {
  } }) {
    const navItems = navItemsForUser(user);
    const [expanded, setExpanded] = useState(() => view === "admin");
    useEffect(() => {
      if (view === "admin") setExpanded(true);
    }, [view]);
    return /* @__PURE__ */ React.createElement("aside", { className: "mx-shell-card rounded-[28px] p-5 md:p-6 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4 mb-7" }, /* @__PURE__ */ React.createElement(BrandLogo, { className: "w-14 h-14" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-xl font-extrabold tracking-[0.02em]" }, APP_NAME), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, APP_TAGLINE))), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement(UserAvatar, { user, size: "xl" }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Signed In"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 font-extrabold text-base truncate" }, user == null ? void 0 : user.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)] truncate" }, roleLabel(user == null ? void 0 : user.role), " \u2022 ", user == null ? void 0 : user.team))), /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, roleLabel(user == null ? void 0 : user.role)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-pending" }, "Scope: ", roleScope(user)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Emp ID: ", user == null ? void 0 : user.empId))), /* @__PURE__ */ React.createElement("div", { className: "mt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Navigation"), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid gap-2" }, navItems.map((item, index) => {
      var _a;
      const isSystemControl = item.id === "admin";
      const showGroup = item.group && item.group !== ((_a = navItems[index - 1]) == null ? void 0 : _a.group);
      const groupLabel = showGroup ? /* @__PURE__ */ React.createElement("div", { className: "pt-3 first:pt-0 text-[10px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, item.group) : null;
      if (isSystemControl) {
        return /* @__PURE__ */ React.createElement(React.Fragment, { key: item.id }, groupLabel, /* @__PURE__ */ React.createElement("div", { className: "grid gap-2" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setExpanded((current) => !current);
              setView("admin");
            },
            className: cn(
              "mx-btn text-left flex items-center gap-3 px-4 py-4 rounded-[18px]",
              view === item.id ? "mx-nav-active" : "bg-transparent border border-transparent"
            )
          },
          /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${item.icon} w-5 text-center text-[var(--mx-accent-2)]` }),
          /* @__PURE__ */ React.createElement("span", { className: "flex-1" }, item.label),
          /* @__PURE__ */ React.createElement("i", { className: cn("fa-solid fa-chevron-right text-xs transition-transform", expanded ? "rotate-90" : "") })
        ), expanded && /* @__PURE__ */ React.createElement("div", { className: "ml-4 pl-3 border-l border-[var(--mx-line)] grid gap-1" }, SYSTEM_CONTROL_SECTIONS.map((section) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: section.id,
            onClick: () => {
              setView("admin");
              setAdminSection(section.id);
            },
            className: cn(
              "mx-btn text-left flex items-center gap-3 px-3 py-3 rounded-[14px] text-sm",
              view === "admin" && adminSection === section.id ? "mx-nav-active" : "bg-transparent border border-transparent"
            )
          },
          /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${section.icon} w-4 text-center text-[var(--mx-accent-2)]` }),
          /* @__PURE__ */ React.createElement("span", { className: "truncate" }, section.label)
        )))));
      }
      return /* @__PURE__ */ React.createElement(React.Fragment, { key: item.id }, groupLabel, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setView(item.id),
          className: cn(
            "mx-btn text-left flex items-center gap-3 px-4 py-4 rounded-[18px]",
            view === item.id ? "mx-nav-active" : "bg-transparent border border-transparent"
          )
        },
        /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${item.icon} w-5 text-center text-[var(--mx-accent-2)]` }),
        /* @__PURE__ */ React.createElement("span", null, item.label),
        ["tasks", "my-tasks"].includes(item.id) && notifCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black" }, notifCount)
      ));
    })), /* @__PURE__ */ React.createElement("button", { onClick: onLogout, className: "mx-btn mx-btn-soft w-full mt-6" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-right-from-bracket mr-2" }), "\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A"));
  }
  function LoginScreenPro({ onLogin, loading, error, theme, onToggleTheme }) {
    const [empId, setEmpId] = useState("");
    const accessHighlights = [
      ["fa-chart-line", "Weighted KPI", "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E04\u0E30\u0E41\u0E19\u0E19\u0E15\u0E32\u0E21\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 KPI \u0E02\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E25\u0E30\u0E07\u0E32\u0E19"],
      ["fa-clock", "SLA Monitoring", "\u0E40\u0E2B\u0E47\u0E19\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E35\u0E48\u0E22\u0E07 \u0E07\u0E32\u0E19\u0E04\u0E49\u0E32\u0E07 \u0E41\u0E25\u0E30 deadline \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21"],
      ["fa-building-user", "Role Based View", "\u0E41\u0E2A\u0E14\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C"]
    ];
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen grid place-items-center p-4 md:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-[1180px] mx-shell-card overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-[0.95fr_1.05fr]" }, /* @__PURE__ */ React.createElement("section", { className: "p-6 md:p-9 border-b lg:border-b-0 lg:border-r border-[var(--mx-line)] bg-[var(--mx-surface)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement(BrandPill, { className: "px-4 py-2 text-xs tracking-[0.14em]" }), /* @__PURE__ */ React.createElement(ThemeToggle, { theme, onToggle: onToggleTheme })), /* @__PURE__ */ React.createElement("div", { className: "mt-10 max-w-[520px]" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] uppercase tracking-[0.18em] text-[var(--mx-muted)] font-extrabold" }, "Performance Portal"), /* @__PURE__ */ React.createElement("h1", { className: "mt-4 mb-0 text-[34px] md:text-[46px] leading-tight font-extrabold tracking-normal" }, "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21 KPI \u0E41\u0E25\u0E30 SLA"), /* @__PURE__ */ React.createElement("p", { className: "mt-5 mb-0 text-[15px] leading-7 text-[var(--mx-muted)]" }, "\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E01\u0E25\u0E32\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E07\u0E32\u0E19 \u0E04\u0E30\u0E41\u0E19\u0E19\u0E16\u0E48\u0E27\u0E07\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 \u0E2A\u0E16\u0E32\u0E19\u0E30 SLA \u0E41\u0E25\u0E30\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21\u0E43\u0E19\u0E17\u0E35\u0E48\u0E40\u0E14\u0E35\u0E22\u0E27")), /* @__PURE__ */ React.createElement("div", { className: "mt-9 grid gap-3 max-w-[560px]" }, accessHighlights.map(([icon, title, desc]) => /* @__PURE__ */ React.createElement("div", { key: title, className: "flex items-start gap-3 rounded-lg border border-[var(--mx-line)] bg-[var(--mx-panel)] p-4" }, /* @__PURE__ */ React.createElement("span", { className: "w-10 h-10 rounded-lg mx-brand-mark grid place-items-center flex-shrink-0" }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${icon} text-[var(--mx-accent)]` })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold" }, title), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm leading-6 text-[var(--mx-muted)]" }, desc)))))), /* @__PURE__ */ React.createElement("section", { className: "p-6 md:p-10 lg:p-12 flex items-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-[460px] mx-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement(BrandLogo, { className: "w-14 h-14" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] uppercase tracking-[0.18em] text-[var(--mx-muted)] font-extrabold" }, "Secure Access"), /* @__PURE__ */ React.createElement("h2", { className: "mt-1 mb-0 text-[28px] md:text-[34px] tracking-normal font-extrabold" }, "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A"))), /* @__PURE__ */ React.createElement("p", { className: "mt-5 mb-0 text-[var(--mx-muted)] leading-7" }, "\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48 ", APP_NAME, " \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E42\u0E14\u0E22\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34"), /* @__PURE__ */ React.createElement("div", { className: "mt-8" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--mx-muted)]" }, "Employee ID"), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-id-badge absolute left-4 top-1/2 -translate-y-1/2 text-[var(--mx-muted)]" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input !pl-11 !py-4 text-[18px] font-extrabold tracking-[0.08em]",
        placeholder: "\u0E40\u0E0A\u0E48\u0E19 EMP001",
        value: empId,
        onChange: (e) => setEmpId(e.target.value.toUpperCase()),
        onKeyDown: (e) => e.key === "Enter" && onLogin(empId),
        autoFocus: true
      }
    )), error && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-lg border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)] px-4 py-3 text-sm text-[#ffb7b7] font-bold" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-circle-exclamation mr-2" }), error)), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary mt-6 w-full !py-4 flex items-center justify-center gap-2", disabled: loading, onClick: () => onLogin(empId) }, loading ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate-right fa-spin" }), /* @__PURE__ */ React.createElement("span", null, "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25...")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A"), /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-arrow-right" }))), /* @__PURE__ */ React.createElement("div", { className: "mt-6 flex items-center gap-3 text-xs text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-shield-halved" }), /* @__PURE__ */ React.createElement("span", null, "\u0E43\u0E0A\u0E49\u0E23\u0E2B\u0E31\u0E2A\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E25\u0E07\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E44\u0E27\u0E49\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19")))))));
  }
  function useAppData(user, view) {
    const [state, setState] = useState({
      loading: false,
      error: "",
      dashboard: null,
      tasks: [],
      people: [],
      admin: null,
      holidays: []
    });
    const [filterMonth, setFilterMonth] = useState((/* @__PURE__ */ new Date()).getMonth() + 1);
    const [filterYear, setFilterYear] = useState((/* @__PURE__ */ new Date()).getFullYear());
    const safeSet = (patch) => setState((prev) => ({ ...prev, ...patch }));
    const loadHolidays = useCallback(async () => {
      if (!user) return;
      try {
        const res = await API.getHolidays({ "x-admin-empid": user.empId || "" });
        safeSet({ holidays: res.holidays || [] });
      } catch {
      }
    }, [user]);
    const loadDashboard = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      const monthParam = filterMonth === 0 ? null : filterMonth;
      try {
        if (shouldUsePersonalWork(user, view)) {
          const res = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
          safeSet({ dashboard: { tasks: res.tasks || res || [], holidays: res.holidays || [] }, loading: false });
          return;
        }
        if (isTeamManagerRole(user.role)) {
          const [summaryRes, tasksRes] = await Promise.all([
            API.getTeamSummaryReport(user.team, monthParam, filterYear, user.empId),
            API.getAllTasks(monthParam, filterYear, user.team, user.empId)
          ]);
          safeSet({ dashboard: { summary: summaryRes.summary || [], tasks: tasksRes.tasks || [], period: summaryRes.period, holidays: tasksRes.holidays || summaryRes.holidays || [] }, loading: false });
          return;
        }
        if (isDepartmentManagerRole(user.role) || isStrategicViewRole(user.role)) {
          const [summaryRes, tasksRes] = await Promise.all([
            API.getSummaryReport(monthParam, filterYear, user.empId),
            API.getAllTasks(monthParam, filterYear, "all", user.empId)
          ]);
          safeSet({
            dashboard: {
              summary: filterByAllowedTeams(user, summaryRes.summary || []),
              tasks: filterByAllowedTeams(user, tasksRes.tasks || []),
              period: summaryRes.period,
              holidays: tasksRes.holidays || summaryRes.holidays || []
            },
            loading: false
          });
          return;
        }
        const [dashboardRes, staffRes] = await Promise.all([
          API.getDashboardData(),
          API.getAllStaff(user.empId)
        ]);
        safeSet({
          dashboard: { summary: dashboardRes.tasks || [], staff: staffRes.staff || [], kpis: dashboardRes.kpis || [], holidays: dashboardRes.holidays || [] },
          loading: false
        });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14 dashboard \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user, view, filterMonth, filterYear]);
    const loadTasks = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      const monthParam = filterMonth === 0 ? null : filterMonth;
      try {
        if (shouldUsePersonalWork(user, view)) {
          const res2 = await API.getEmployeeTasks(user, monthParam, filterYear, filterMonth === 0, user.empId);
          safeSet({ tasks: res2.tasks || res2 || [], loading: false });
          return;
        }
        const team = taskScopeForUser(user);
        const res = await API.getAllTasks(monthParam, filterYear, team, user.empId);
        safeSet({ tasks: filterByAllowedTeams(user, res.tasks || []), loading: false });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14 tasks \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user, view, filterMonth, filterYear]);
    const loadPeople = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      try {
        let res;
        if (isTeamManagerRole(user.role)) res = await API.getAllStaffInTeam(user.team, user.empId);
        else if (user.role === "Staff") res = { staff: [user] };
        else res = await API.getAllStaff(user.empId);
        safeSet({ people: filterByAllowedTeams(user, res.staff || []), loading: false });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user]);
    const loadAdmin = useCallback(async () => {
      if (!user) return;
      safeSet({ loading: true, error: "" });
      try {
        const [logs, teams, holidays, staff, dashboardRes] = await Promise.all([
          adminGet("admin/getAuditLogs", user.empId),
          adminGet("admin/getTeams", user.empId),
          adminGet("admin/getHolidays", user.empId),
          API.getAllStaff(user.empId),
          API.getDashboardData()
        ]);
        safeSet({
          admin: {
            logs: logs.logs || [],
            teams: teams.teams || [],
            holidays: holidays.holidays || [],
            staff: staff.staff || [],
            kpis: dashboardRes.kpis || [],
            tasks: dashboardRes.tasks || []
          },
          holidays: holidays.holidays || [],
          loading: false
        });
      } catch (e) {
        safeSet({ loading: false, error: e.message || "\u0E42\u0E2B\u0E25\u0E14 admin data \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
      }
    }, [user]);
    useEffect(() => {
      if (!user) return;
      loadHolidays();
      if (view === "executive") loadDashboard();
      if (["dashboard", "my-dashboard"].includes(view)) loadDashboard();
      if (["tasks", "my-tasks"].includes(view)) loadTasks();
      if (view === "people") loadPeople();
      if (view === "assign") loadPeople();
      if (view === "admin") loadAdmin();
    }, [user, view, loadDashboard, loadTasks, loadPeople, loadAdmin, loadHolidays]);
    useEffect(() => {
      if (!user || !window.subscribeToRealtime) return;
      window.subscribeToRealtime("tasks", () => {
        if (view === "executive") loadDashboard();
        if (["dashboard", "my-dashboard"].includes(view)) loadDashboard();
        if (["tasks", "my-tasks"].includes(view)) loadTasks();
      });
      return () => {
        if (window.unsubscribeFromRealtime) window.unsubscribeFromRealtime("tasks");
      };
    }, [user, view]);
    return {
      state,
      filterMonth,
      setFilterMonth,
      filterYear,
      setFilterYear,
      reloadDashboard: loadDashboard,
      reloadTasks: loadTasks,
      reloadPeople: loadPeople,
      reloadAdmin: loadAdmin
    };
  }
  function getExecutiveTasks(data) {
    if (!data) return [];
    if (Array.isArray(data.tasks)) return data.tasks;
    if (Array.isArray(data.summary) && data.summary.some((item) => item.job || item.status || item.deadline)) return data.summary;
    return [];
  }
  function isActiveTask(task) {
    return !["completed", "cancelled"].includes(String((task == null ? void 0 : task.status) || "").toLowerCase());
  }
  function normalizeDateOnly(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }
  function dateKey(value) {
    const date = normalizeDateOnly(value);
    if (!date) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }
  function isActiveHoliday(holiday) {
    var _a, _b;
    const active = (_b = (_a = holiday == null ? void 0 : holiday.is_active) != null ? _a : holiday == null ? void 0 : holiday.active) != null ? _b : true;
    return active === true || active === 1 || String(active).toLowerCase() === "true";
  }
  function buildHolidaySet(holidays = []) {
    if (holidays instanceof Set) return holidays;
    return new Set((holidays || []).filter(isActiveHoliday).map((holiday) => dateKey(holiday.holiday_date || holiday.date || holiday.day)).filter(Boolean));
  }
  function isWorkingDay(date, holidaySet = /* @__PURE__ */ new Set()) {
    const day = date.getDay();
    return day !== 0 && day !== 6 && !holidaySet.has(dateKey(date));
  }
  function businessDaysBetween(startValue, endValue, holidays = []) {
    const start = normalizeDateOnly(startValue);
    const end = normalizeDateOnly(endValue);
    if (!start || !end) return null;
    if (start.getTime() === end.getTime()) return 0;
    const holidaySet = buildHolidaySet(holidays);
    const direction = end > start ? 1 : -1;
    const cursor = new Date(start);
    let count = 0;
    while (cursor.getTime() !== end.getTime()) {
      cursor.setDate(cursor.getDate() + direction);
      if (isWorkingDay(cursor, holidaySet)) count += direction;
    }
    return count;
  }
  function addBusinessDays(startValue, days, holidays = []) {
    const start = normalizeDateOnly(startValue);
    const amount = Math.max(0, Number(days || 0));
    if (!start || amount === 0) return start;
    const holidaySet = buildHolidaySet(holidays);
    const cursor = new Date(start);
    let remaining = amount;
    while (remaining > 0) {
      cursor.setDate(cursor.getDate() + 1);
      if (isWorkingDay(cursor, holidaySet)) remaining -= 1;
    }
    return cursor;
  }
  function toDateInputValue(value) {
    const date = normalizeDateOnly(value);
    return date ? dateKey(date) : "";
  }
  function getActiveHoldStart(task) {
    const extra = normalizeExtraData(task == null ? void 0 : task.extra_data);
    return extra.hold_started_at || extra.holdStartAt || extra.holdStart || null;
  }
  function normalizeExtraData(extraData) {
    if (!extraData) return {};
    if (typeof extraData === "string") return parseJsonSafe(extraData, {});
    return typeof extraData === "object" ? extraData : {};
  }
  function getTaskHoldDays(task, holidays = [], endValue = /* @__PURE__ */ new Date()) {
    const start = getActiveHoldStart(task);
    if (!start) return 0;
    const days = businessDaysBetween(start, endValue, holidays);
    return Math.max(0, Number(days || 0));
  }
  function getEffectiveDeadline(task, holidays = []) {
    if (!(task == null ? void 0 : task.deadline)) return null;
    const activeHoldDays = String((task == null ? void 0 : task.status) || "").toLowerCase() === "on hold" ? getTaskHoldDays(task, holidays) : 0;
    return activeHoldDays > 0 ? addBusinessDays(task.deadline, activeHoldDays, holidays) : normalizeDateOnly(task.deadline);
  }
  function getHoldSummary(task, holidays = []) {
    const extra = normalizeExtraData(task == null ? void 0 : task.extra_data);
    const activeDays = getTaskHoldDays(task, holidays);
    const totalDays = Number(extra.hold_days_total || extra.holdDaysTotal || 0) + activeDays;
    return {
      activeStart: getActiveHoldStart(task),
      activeDays,
      totalDays: Number.isFinite(totalDays) ? totalDays : activeDays,
      effectiveDeadline: getEffectiveDeadline(task, holidays)
    };
  }
  function buildHoldExtraData(task, nextStatus, holidays = [], changedBy = "") {
    const currentStatus = String((task == null ? void 0 : task.status) || "").toLowerCase();
    const targetStatus = String(nextStatus || "").toLowerCase();
    const extra = { ...normalizeExtraData(task == null ? void 0 : task.extra_data) };
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const activeStart = getActiveHoldStart(task);
    if (targetStatus === "on hold") {
      if (!activeStart) {
        extra.hold_started_at = now;
        extra.hold_started_by = changedBy || extra.hold_started_by || "";
        extra.hold_deadline_before = (task == null ? void 0 : task.deadline) || "";
      }
      return { extraData: extra, deadline: (task == null ? void 0 : task.deadline) || "", holdDays: 0, changed: !activeStart };
    }
    if (currentStatus !== "on hold" || !activeStart) {
      return { extraData: extra, deadline: (task == null ? void 0 : task.deadline) || "", holdDays: 0, changed: false };
    }
    const holdDays = getTaskHoldDays(task, holidays);
    const nextDeadline = holdDays > 0 ? toDateInputValue(addBusinessDays(task.deadline, holdDays, holidays)) : (task == null ? void 0 : task.deadline) || "";
    const history = Array.isArray(extra.hold_history) ? [...extra.hold_history] : [];
    history.push({
      start: activeStart,
      end: now,
      businessDays: holdDays,
      deadlineBefore: extra.hold_deadline_before || (task == null ? void 0 : task.deadline) || "",
      deadlineAfter: nextDeadline || (task == null ? void 0 : task.deadline) || "",
      changedBy: changedBy || ""
    });
    delete extra.hold_started_at;
    delete extra.hold_started_by;
    delete extra.hold_deadline_before;
    extra.hold_days_total = Number(extra.hold_days_total || 0) + holdDays;
    extra.hold_history = history.slice(-20);
    return {
      extraData: extra,
      deadline: nextDeadline || (task == null ? void 0 : task.deadline) || "",
      holdDays,
      changed: true
    };
  }
  function getDaysUntilDeadline(task, holidays = []) {
    if (!(task == null ? void 0 : task.deadline)) return null;
    return businessDaysBetween(/* @__PURE__ */ new Date(), getEffectiveDeadline(task, holidays), holidays);
  }
  function getExecutiveHealthClass(value) {
    if (value === null || value === void 0) return "mx-status-cancelled";
    if (value >= 90) return "mx-status-completed";
    if (value >= 75) return "mx-status-process";
    if (value >= 60) return "mx-status-pending";
    return "mx-status-hold";
  }
  function ExecutiveView({ data, filterMonth, filterYear, holidays = [], onNavigate }) {
    var _a;
    if (!data) {
      return /* @__PURE__ */ React.createElement(Panel, { title: "Executive View", subtitle: "Preparing executive summary..." }, /* @__PURE__ */ React.createElement("div", { className: "text-[var(--mx-muted)]" }, "Loading..."));
    }
    const tasks = getExecutiveTasks(data);
    const holidaySet = useMemo(() => buildHolidaySet([...holidays || [], ...data && data.holidays || []]), [holidays, data]);
    const activeTasks = tasks.filter(isActiveTask);
    const completedTasks = tasks.filter((task) => String(task.status || "").toLowerCase() === "completed");
    const overdueTasks = activeTasks.filter((task) => {
      const days = getDaysUntilDeadline(task, holidaySet);
      return days !== null && days < 0;
    });
    const atRiskTasks = activeTasks.filter((task) => {
      const days = getDaysUntilDeadline(task, holidaySet);
      return days !== null && days >= 0 && days <= 3;
    });
    const scores = calcTaskWeightedScores(tasks);
    const completion = (_a = scores.completion) != null ? _a : tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : null;
    const sla = scores.sla;
    const periodLabel = `${filterMonth === 0 ? "All Months" : MONTH_NAMES[filterMonth - 1]} ${filterYear}`;
    const weightedScore = completion !== null && sla !== null ? Math.round((completion + sla) / 2) : completion != null ? completion : sla;
    const teamMap = {};
    tasks.forEach((task) => {
      const team = task.team || "Unassigned";
      if (!teamMap[team]) teamMap[team] = [];
      teamMap[team].push(task);
    });
    const teamRows = Object.entries(teamMap).map(([team, teamTasks]) => {
      var _a2, _b, _c, _d;
      const teamScores = calcTaskWeightedScores(teamTasks);
      const active = teamTasks.filter(isActiveTask);
      const overdue = active.filter((task) => {
        const days = getDaysUntilDeadline(task, holidaySet);
        return days !== null && days < 0;
      }).length;
      const atRisk = active.filter((task) => {
        const days = getDaysUntilDeadline(task, holidaySet);
        return days !== null && days >= 0 && days <= 3;
      }).length;
      const teamCompletion = (_a2 = teamScores.completion) != null ? _a2 : teamTasks.length ? Math.round(teamTasks.filter((task) => String(task.status || "").toLowerCase() === "completed").length / teamTasks.length * 100) : null;
      const health = Math.round((((_c = (_b = teamScores.sla) != null ? _b : teamCompletion) != null ? _c : 0) + ((_d = teamCompletion != null ? teamCompletion : teamScores.sla) != null ? _d : 0)) / 2) - overdue * 5 - atRisk * 2;
      return { team, total: teamTasks.length, active: active.length, overdue, atRisk, sla: teamScores.sla, completion: teamCompletion, health };
    }).sort((a, b) => a.overdue - b.overdue || a.atRisk - b.atRisk || b.health - a.health);
    const criticalQueue = activeTasks.map((task) => ({ task, days: getDaysUntilDeadline(task, holidaySet), weight: getTaskWeight(task) })).filter((item) => item.days !== null).sort((a, b) => {
      const riskA = a.days < 0 ? 0 : a.days <= 3 ? 1 : 2;
      const riskB = b.days < 0 ? 0 : b.days <= 3 ? 1 : 2;
      return riskA - riskB || a.days - b.days || b.weight - a.weight;
    }).slice(0, 8);
    const insights = [];
    if (overdueTasks.length > 0) insights.push(`${overdueTasks.length} overdue task(s) need executive attention before status review.`);
    if (atRiskTasks.length > 0) insights.push(`${atRiskTasks.length} task(s) are due within 3 business days and may affect SLA.`);
    if (teamRows[0]) insights.push(`${teamRows[0].team} is the highest risk team in the current scope.`);
    if (sla !== null) insights.push(`Current weighted SLA is ${sla}%, with completion at ${completion != null ? completion : "-"}%.`);
    if (insights.length === 0) insights.push("No critical SLA risk is visible in the current scope.");
    const maxTeamTotal = Math.max(...teamRows.map((row) => row.total), 1);
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 2xl:grid-cols-5 gap-4" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Overall SLA", value: formatScorePercent(sla), sub: "Weighted on-time performance", icon: "fa-stopwatch", accent: "var(--mx-info)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Completion", value: formatScorePercent(completion), sub: `${completedTasks.length}/${tasks.length} task(s) completed`, icon: "fa-circle-check", accent: "var(--mx-success)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Overdue", value: overdueTasks.length, sub: "Active tasks past deadline (business days)", icon: "fa-triangle-exclamation", accent: "var(--mx-danger)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "At Risk", value: atRiskTasks.length, sub: "Due within 3 business days", icon: "fa-clock", accent: "var(--mx-warning)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted Score", value: formatScorePercent(weightedScore), sub: "SLA and completion blend", icon: "fa-ranking-star", accent: "var(--mx-accent-2)" })), /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: "Management Summary",
        subtitle: `Executive readout for ${periodLabel}`,
        actions: /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2", onClick: () => window.print() }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-print mr-2" }), "Presentation")
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-[1.15fr_0.85fr] gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, insights.slice(0, 5).map((insight, index) => /* @__PURE__ */ React.createElement("div", { key: insight, className: "mx-data-card flex items-start gap-3" }, /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge flex-shrink-0", index === 0 && overdueTasks.length > 0 ? "mx-status-hold" : "mx-status-process") }, index + 1), /* @__PURE__ */ React.createElement("div", { className: "font-bold leading-6" }, insight)))), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.16em] text-[var(--mx-muted)] font-black" }, "Decision Lens"), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-[var(--mx-muted)]" }, "Scope"), /* @__PURE__ */ React.createElement("span", { className: "font-extrabold" }, periodLabel)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-[var(--mx-muted)]" }, "Active workload"), /* @__PURE__ */ React.createElement("span", { className: "font-extrabold" }, activeTasks.length)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm text-[var(--mx-muted)]" }, "Teams monitored"), /* @__PURE__ */ React.createElement("span", { className: "font-extrabold" }, teamRows.length)), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary mt-2", onClick: () => onNavigate("tasks") }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-list-check mr-2" }), "Open Task Center"))))
    ), /* @__PURE__ */ React.createElement("div", { className: "grid 2xl:grid-cols-[1.1fr_0.9fr] gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Team Performance Matrix", subtitle: "Ranked by overdue, near-deadline risk, and weighted health" }, /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full min-w-[760px] text-sm" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[11px] uppercase tracking-[0.14em] text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Team"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Workload"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "SLA"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Completion"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Risk"), /* @__PURE__ */ React.createElement("th", { className: "pb-3" }, "Status"))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[var(--mx-line)]" }, teamRows.map((row) => /* @__PURE__ */ React.createElement("tr", { key: row.team }, /* @__PURE__ */ React.createElement("td", { className: "py-4 font-extrabold" }, row.team), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-28 h-2 rounded-full mx-progress-track overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full mx-progress-fill", style: { width: `${Math.max(6, row.total / maxTeamTotal * 100)}%` } })), /* @__PURE__ */ React.createElement("span", null, row.total))), /* @__PURE__ */ React.createElement("td", { className: "py-4 font-bold" }, formatScorePercent(row.sla)), /* @__PURE__ */ React.createElement("td", { className: "py-4 font-bold" }, formatScorePercent(row.completion)), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", row.overdue > 0 ? "mx-status-hold" : row.atRisk > 0 ? "mx-status-pending" : "mx-status-completed") }, row.overdue, " overdue / ", row.atRisk, " risk")), /* @__PURE__ */ React.createElement("td", { className: "py-4" }, /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getExecutiveHealthClass(row.health)) }, row.health >= 90 ? "Healthy" : row.health >= 75 ? "Watch" : row.health >= 60 ? "Pressure" : "Critical")))), teamRows.length === 0 && /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { className: "py-8 text-center text-[var(--mx-muted)]", colSpan: "6" }, "No team data in this scope.")))))), /* @__PURE__ */ React.createElement(Panel, { title: "Critical Work Queue", subtitle: "Highest SLA and KPI exposure" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, criticalQueue.map(({ task, days, weight }) => /* @__PURE__ */ React.createElement("div", { key: task.id || `${task.job}-${task.deadline}`, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold truncate" }, extractJobCode(task.job)), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)] line-clamp-2" }, task.job || "-")), /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge flex-shrink-0", days < 0 ? "mx-status-hold" : days <= 3 ? "mx-status-pending" : "mx-status-process") }, days < 0 ? `${Math.abs(days)} bd late` : `${days} bd left`)), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, task.team || "-"), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, "weight ", formatWeight(weight)), /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getStatusClass(task.status)) }, task.status || "-")))), criticalQueue.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "mx-data-card text-center text-[var(--mx-muted)]" }, "No critical active work in this scope.")))));
  }
  function DashboardView({ user, data, filterMonth, filterYear, holidays = [], onAccept, onStatusChange, onNavigate }) {
    if (!data) {
      return /* @__PURE__ */ React.createElement(Panel, { title: "Executive Overview", subtitle: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25..." }, /* @__PURE__ */ React.createElement("div", { className: "text-[var(--mx-muted)]" }, "Loading..."));
    }
    if (user.role === "Staff") {
      const tasks2 = data.tasks || [];
      const completed = tasks2.filter((t) => t.status === "Completed").length;
      const active = tasks2.filter((t) => ["On Process", "Pending", "On Hold"].includes(t.status)).length;
      const holidaySet = buildHolidaySet([...holidays || [], ...data && data.holidays || []]);
      const scores = calcTaskWeightedScores(tasks2);
      const kpiDist = {};
      tasks2.forEach((t) => {
        if (String(t.status || "").toLowerCase() === "cancelled") return;
        const k = t.mainkpi || "Other";
        const weight = getTaskWeight(t);
        if (!kpiDist[k] || kpiDist[k] === 1 && weight !== 1) kpiDist[k] = weight;
      });
      const kpiEntries = Object.entries(kpiDist).sort((a, b) => b[1] - a[1]);
      const maxKpi = kpiEntries.length > 0 ? kpiEntries[0][1] : 1;
      const activeTasks = tasks2.filter((t) => !["Completed", "Cancelled"].includes(t.status));
      const periodLabel = filterMonth === 0 ? `\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19 ${filterYear}` : `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`;
      const [dashModal, setDashModal] = useState({ show: false });
      const [dashNotePopup, setDashNotePopup] = useState({ show: false, note: "" });
      const handleDashAction = (task, action) => {
        const ts = getTimestamp();
        if (action === "accept") {
          setDashModal({ show: true, title: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19", message: "\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E23\u0E34\u0E48\u0E21\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?", color: "blue", type: "confirm", action: () => onAccept(task) });
        } else if (action === "complete") {
          setDashModal({ show: true, title: "\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19", message: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E27\u0E48\u0E32\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?", color: "emerald", type: "confirm", action: () => onStatusChange(task, "Completed", `${ts} \u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19`) });
        } else if (action === "hold") {
          setDashModal({ show: true, title: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19", message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E01\u0E32\u0E23\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19:", color: "amber", type: "prompt", action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "On Hold", `${ts} [On Hold] ${reason}`);
          } });
        } else if (action === "resume") {
          onStatusChange(task, "On Process", `${ts} \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D`);
        } else if (action === "cancel") {
          setDashModal({ show: true, title: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19", message: "\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19:", color: "rose", type: "prompt", action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "Cancelled", `${ts} [Cancelled] ${reason}`);
          } });
        } else if (action === "note") {
          setDashModal({ show: true, title: "\u0E40\u0E1E\u0E34\u0E48\u0E21 Note", message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21:", color: "blue", type: "prompt", action: (note) => {
            if (note == null ? void 0 : note.trim()) onStatusChange(task, task.status, `${ts} ${note}`, "note_only");
          } });
        }
      };
      const ActionBtn = ({ icon, color, onClick, label }) => {
        const variants = {
          emerald: "mx-action-success",
          amber: "mx-action-warning",
          rose: "mx-action-danger",
          blue: "mx-action-info",
          indigo: "mx-action-muted"
        };
        return /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement("button", { onClick, className: `w-10 h-10 flex items-center justify-center rounded-lg border transition-colors duration-200 ${variants[color] || ""}` }, /* @__PURE__ */ React.createElement("i", { className: `fas ${icon} text-sm` })), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50" }, label, /* @__PURE__ */ React.createElement("div", { className: "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" })));
      };
      return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(ActionModal, { config: dashModal, onClose: () => setDashModal({ show: false }) }), dashNotePopup.show && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-4" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-2 text-[var(--mx-info)]" }), "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "max-h-80 overflow-y-auto rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm leading-7 whitespace-pre-wrap" }, dashNotePopup.note)), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft w-full mt-5", onClick: () => setDashNotePopup({ show: false, note: "" }) }, "\u0E1B\u0E34\u0E14"))), /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Tasks", value: tasks2.length, sub: `\u0E07\u0E32\u0E19\u0E43\u0E19${periodLabel}`, icon: "fa-list-check" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Weight", value: formatWeightPercent(scores.totalWeight), sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13 KPI", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted Completion", value: formatScorePercent(scores.completion), sub: completionMetricSub(scores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted SLA", value: formatScorePercent(scores.sla), sub: slaMetricSub(scores), icon: "fa-chart-line", accent: "var(--mx-amber)" })), /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores }), kpiEntries.length > 0 && /* @__PURE__ */ React.createElement(Panel, { title: "KPI Weight Distribution", subtitle: "\u0E2A\u0E31\u0E14\u0E2A\u0E48\u0E27\u0E19\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E41\u0E22\u0E01\u0E15\u0E32\u0E21 Main KPI" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, kpiEntries.map(([kpi, count]) => /* @__PURE__ */ React.createElement("div", { key: kpi, className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold w-44 truncate flex-shrink-0" }, kpi), /* @__PURE__ */ React.createElement("div", { className: "flex-1 h-3 rounded-full mx-progress-track overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full mx-progress-fill", style: { width: `${count / maxKpi * 100}%` } })), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)] w-20 text-right flex-shrink-0" }, formatWeightPercent(count)))))), /* @__PURE__ */ React.createElement(
        Panel,
        {
          title: "\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23",
          subtitle: "\u0E07\u0E32\u0E19 Pending / On Process / On Hold \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21",
          actions: [
            /* @__PURE__ */ React.createElement("button", { key: "add", className: "mx-btn mx-btn-primary", onClick: () => onNavigate("create") }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-plus mr-2" }), "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19\u0E43\u0E2B\u0E21\u0E48")
          ]
        },
        /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, activeTasks.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23"), activeTasks.map((task) => {
          const daysLeft = getDaysUntilDeadline(task, holidaySet);
          const isOverdue = daysLeft !== null && daysLeft < 0;
          const holdSummary = getHoldSummary(task, holidaySet);
          return /* @__PURE__ */ React.createElement("div", { key: task.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold break-all" }, task.job), /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getStatusClass(task.status)) }, task.status), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(getTaskWeight(task))), task.note && /* @__PURE__ */ React.createElement("button", { onClick: () => setDashNotePopup({ show: true, note: task.note }), className: "mx-note-btn text-xs px-3 py-1.5 rounded-lg font-bold" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-1" }), "\u0E14\u0E39\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01")), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, task.mainkpi || "-", " \u2022 ", task.subkpi || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, "Deadline ", formatDate(task.deadline), holdSummary.activeStart && holdSummary.activeDays > 0 && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-[var(--mx-info)] font-bold" }, "Effective ", formatDate(holdSummary.effectiveDeadline)), isOverdue && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-red-400 font-bold" }, "\u0E40\u0E01\u0E34\u0E19 ", Math.abs(daysLeft), " \u0E27\u0E31\u0E19\u0E17\u0E33\u0E01\u0E32\u0E23"), !isOverdue && daysLeft !== null && daysLeft <= 3 && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-[var(--mx-warning)] font-bold" }, "\u0E2D\u0E35\u0E01 ", daysLeft, " \u0E27\u0E31\u0E19\u0E17\u0E33\u0E01\u0E32\u0E23")), holdSummary.activeStart && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-warning)] font-bold" }, "SLA paused since ", formatDate(holdSummary.activeStart), " - ", holdSummary.activeDays, " business day(s) will be added on resume")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 flex-shrink-0 items-start" }, task.status === "Pending" && /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-play", color: "blue", onClick: () => handleDashAction(task, "accept"), label: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19" }), task.status === "On Process" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-check", color: "emerald", onClick: () => handleDashAction(task, "complete"), label: "\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19" }), /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-pause", color: "amber", onClick: () => handleDashAction(task, "hold"), label: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19" }), /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-comment-dots", color: "blue", onClick: () => handleDashAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), task.status === "On Hold" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-play", color: "blue", onClick: () => handleDashAction(task, "resume"), label: "\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D" }), /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-comment-dots", color: "blue", onClick: () => handleDashAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), !["Completed", "Cancelled"].includes(task.status) && /* @__PURE__ */ React.createElement(ActionBtn, { icon: "fa-trash", color: "rose", onClick: () => handleDashAction(task, "cancel"), label: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01" }))));
        }))
      ));
    }
    if (user.role === "Lead") {
      const tasks2 = data.tasks || [];
      const summary = enrichSummaryWithTaskWeights(data.summary || [], tasks2);
      const teamScores = tasks2.length > 0 ? calcTaskWeightedScores(tasks2) : null;
      const avgSla = teamScores && teamScores.sla !== null ? teamScores.sla : summary.length ? Math.round(summary.reduce((s, p) => s + (Number(p.weightedSlaScore) || 0), 0) / summary.length) : 0;
      return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Team Members", value: summary.length, sub: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E41\u0E2A\u0E14\u0E07\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E02\u0E2D\u0E07 Lead", icon: "fa-users" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Team Weight", value: teamScores ? formatWeightPercent(teamScores.totalWeight) : "-", sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E23\u0E27\u0E21\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E21", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted Completion", value: teamScores ? formatScorePercent(teamScores.completion) : "-", sub: completionMetricSub(teamScores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Avg SLA", value: `${avgSla}%`, sub: teamScores ? slaMetricSub(teamScores, avgSla) : "\u0E04\u0E48\u0E32\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22 weighted SLA score", icon: "fa-chart-line", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Period", value: data.period || "-", sub: "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E39", icon: "fa-calendar-days", accent: "var(--mx-amber)" })), teamScores && /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores: teamScores }), /* @__PURE__ */ React.createElement(Panel, { title: "Team Performance Pulse", subtitle: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E17\u0E35\u0E21\u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E2D\u0E48\u0E32\u0E19\u0E07\u0E48\u0E32\u0E22\u0E02\u0E36\u0E49\u0E19" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, summary.map((person) => {
        var _a, _b;
        return /* @__PURE__ */ React.createElement("div", { key: person.empId || person.name, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, person.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, person.team, " \u2022 Total ", person.totalTasks, " \u2022 Completed ", person.completedTasks), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(person.totalWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, "Completion ", (_a = person.weightedCompletionScore) != null ? _a : "-", "%"))), /* @__PURE__ */ React.createElement("div", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold text-lg" }, (_b = person.weightedSlaScore) != null ? _b : "-", "%"), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-[var(--mx-muted)]" }, "Weighted SLA"))));
      }))));
    }
    if (user.role === "Manager") {
      const tasks2 = data.tasks || [];
      const summary = enrichSummaryWithTaskWeights(data.summary || [], tasks2);
      const risky = tasks2.filter((t) => ["Pending", "On Hold"].includes(t.status)).length;
      const orgScores = tasks2.length > 0 ? calcTaskWeightedScores(tasks2) : null;
      const avgSla = orgScores && orgScores.sla !== null ? orgScores.sla : summary.length ? Math.round(summary.reduce((s, p) => s + (Number(p.weightedSlaScore) || 0), 0) / summary.length) : 0;
      const topPeople = [...summary].sort((a, b) => (b.weightedSlaScore || 0) - (a.weightedSlaScore || 0)).slice(0, 6);
      return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Active Tasks", value: tasks2.length, sub: "\u0E42\u0E2B\u0E25\u0E14\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E14\u0E34\u0E21\u0E41\u0E1A\u0E1A\u0E15\u0E23\u0E07 \u0E46", icon: "fa-briefcase" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Risk Queue", value: risky, sub: "Pending / On Hold \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21", icon: "fa-triangle-exclamation", accent: "var(--mx-amber)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Weight", value: orgScores ? formatWeightPercent(orgScores.totalWeight) : "-", sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E23\u0E27\u0E21\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Completion", value: orgScores ? formatScorePercent(orgScores.completion) : "-", sub: completionMetricSub(orgScores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Avg SLA", value: `${avgSla}%`, sub: orgScores ? slaMetricSub(orgScores, avgSla) : "weighted SLA across visible staff", icon: "fa-chart-line", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "People", value: summary.length, sub: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E04\u0E19\u0E43\u0E19\u0E21\u0E38\u0E21\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23", icon: "fa-users-viewfinder", accent: "var(--mx-blue)" })), orgScores && /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores: orgScores }), /* @__PURE__ */ React.createElement(Panel, { title: "Executive Scoreboard", subtitle: "\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23\u0E40\u0E2B\u0E47\u0E19\u0E04\u0E30\u0E41\u0E19\u0E19, \u0E1B\u0E23\u0E34\u0E21\u0E32\u0E13\u0E07\u0E32\u0E19, \u0E41\u0E25\u0E30\u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23 intervene \u0E17\u0E31\u0E19\u0E17\u0E35" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-3" }, topPeople.map((person) => {
        var _a, _b;
        return /* @__PURE__ */ React.createElement("div", { key: person.empId || person.name, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, person.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, person.team, " \u2022 Total ", person.totalTasks), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(person.totalWeight)), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, "Completion ", (_a = person.weightedCompletionScore) != null ? _a : "-", "%"))), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, (_b = person.weightedSlaScore) != null ? _b : "-", "%")));
      }))));
    }
    const tasks = data.summary || [];
    const staff = data.staff || [];
    const kpis = data.kpis || [];
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Tasks", value: tasks.length, sub: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E27\u0E21\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E14\u0E34\u0E21", icon: "fa-briefcase" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Users", value: staff.length, sub: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A", icon: "fa-users", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "KPI Items", value: kpis.length, sub: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 KPI \u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19", icon: "fa-sliders", accent: "var(--mx-amber)" })), /* @__PURE__ */ React.createElement(Panel, { title: "System Overview", subtitle: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, APP_NAME, " \u0E43\u0E0A\u0E49 backend \u0E40\u0E14\u0E34\u0E21\u0E41\u0E25\u0E30\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E14\u0E34\u0E21\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07 \u0E41\u0E15\u0E48\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E1B\u0E23\u0E30\u0E2A\u0E1A\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E21\u0E32\u0E01\u0E02\u0E36\u0E49\u0E19")));
  }
  function TaskCenterView({ user, tasks, holidays = [], onAccept, onStatusChange, onDelete, onRefresh }) {
    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [modal, setModal] = useState({ show: false });
    const closeModal = () => setModal({ show: false });
    const showModal = (cfg) => setModal({ show: true, ...cfg });
    const [statusTarget, setStatusTarget] = useState(null);
    const [notePopup, setNotePopup] = useState({ show: false, note: "" });
    const [editingTask, setEditingTask] = useState(null);
    const [editForm, setEditForm] = useState({ job: "", subkpi: "", extra_data: {} });
    const [savingEdit, setSavingEdit] = useState(false);
    const [prModal, setPrModal] = useState({ show: false, task: null, fundNumber: "", amount: "" });
    const [savingPr, setSavingPr] = useState(false);
    const ActionButton = ({ icon, color, onClick, label }) => {
      const variants = {
        emerald: "mx-action-success",
        amber: "mx-action-warning",
        rose: "mx-action-danger",
        slate: "mx-action-muted",
        blue: "mx-action-info",
        indigo: "mx-action-muted"
      };
      return /* @__PURE__ */ React.createElement("div", { className: "relative group" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick,
          className: `w-10 h-10 flex items-center justify-center rounded-lg border transition-colors duration-200 ${variants[color] || variants.slate}`
        },
        /* @__PURE__ */ React.createElement("i", { className: `fas ${icon} text-sm` })
      ), /* @__PURE__ */ React.createElement("div", { className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50" }, label, /* @__PURE__ */ React.createElement("div", { className: "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" })));
    };
    const filtered = useMemo(() => {
      return (tasks || []).filter((task) => {
        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [task.job, task.name, task.team, task.subkpi, task.status].some((v) => String(v || "").toLowerCase().includes(q));
      });
    }, [tasks, statusFilter, search]);
    const taskSummary = useMemo(() => ({
      total: (tasks || []).length,
      active: (tasks || []).filter((t) => ["On Process", "Pending", "On Hold"].includes(t.status)).length,
      completed: (tasks || []).filter((t) => t.status === "Completed").length,
      risk: (tasks || []).filter((t) => ["Pending", "On Hold"].includes(t.status)).length
    }), [tasks]);
    const taskScores = useMemo(() => calcTaskWeightedScores(tasks || []), [tasks]);
    const holidaySet = useMemo(() => buildHolidaySet(holidays || []), [holidays]);
    const handleStaffAction = (task, action) => {
      var _a, _b;
      const ts = getTimestamp();
      if (action === "accept") {
        showModal({
          title: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19",
          message: "\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E23\u0E34\u0E48\u0E21\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?",
          color: "blue",
          type: "confirm",
          action: () => onAccept(task)
        });
      } else if (action === "complete") {
        if ((task.subkpi || "").toLowerCase().includes("open pr")) {
          setPrModal({ show: true, task, fundNumber: ((_a = task.extra_data) == null ? void 0 : _a.fundNumber) || "", amount: ((_b = task.extra_data) == null ? void 0 : _b.amount) || "" });
        } else {
          showModal({
            title: "\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19",
            message: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E27\u0E48\u0E32\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E43\u0E0A\u0E48\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48?",
            color: "emerald",
            type: "confirm",
            action: () => onStatusChange(task, "Completed", `${ts} \u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19`)
          });
        }
      } else if (action === "hold") {
        showModal({
          title: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19",
          message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E01\u0E32\u0E23\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19:",
          color: "amber",
          type: "prompt",
          action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "On Hold", `${ts} [On Hold] ${reason}`);
          }
        });
      } else if (action === "resume") {
        onStatusChange(task, "On Process", `${ts} \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D`);
      } else if (action === "cancel") {
        showModal({
          title: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19",
          message: "\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E17\u0E35\u0E48\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E07\u0E32\u0E19:",
          color: "rose",
          type: "prompt",
          action: (reason) => {
            if (reason == null ? void 0 : reason.trim()) onStatusChange(task, "Cancelled", `${ts} [Cancelled] ${reason}`);
          }
        });
      } else if (action === "note") {
        showModal({
          title: "\u0E40\u0E1E\u0E34\u0E48\u0E21 Note",
          message: "\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21:",
          color: "blue",
          type: "prompt",
          action: (note) => {
            if (note == null ? void 0 : note.trim()) onStatusChange(task, task.status, `${ts} ${note}`, "note_only");
          }
        });
      }
    };
    const handleEditOpen = (task) => {
      setEditForm({ job: task.job || "", subkpi: task.subkpi || "", extra_data: task.extra_data || {} });
      setEditingTask(task);
    };
    const handleEditSave = async () => {
      if (!editForm.job.trim() || !editForm.subkpi.trim()) {
        alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 Job \u0E41\u0E25\u0E30 Sub KPI");
        return;
      }
      setSavingEdit(true);
      try {
        await API.updateTaskDetails({
          id: editingTask.id,
          team: editingTask.team,
          job: editForm.job,
          subkpi: editForm.subkpi,
          mainkpi: editingTask.mainkpi,
          deadline: editingTask.deadline,
          extra_data: editForm.extra_data || {}
        });
        setEditingTask(null);
        onRefresh();
      } catch (e) {
        alert(e.message || "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setSavingEdit(false);
      }
    };
    const handlePrComplete = async () => {
      if (!prModal.task) return;
      setSavingPr(true);
      const ts = getTimestamp();
      try {
        const newExtra = { ...prModal.task.extra_data || {}, fundNumber: prModal.fundNumber, amount: prModal.amount };
        await Promise.all([
          API.updateTaskStatus(prModal.task.id, prModal.task.team, "Completed", `${ts} \u0E07\u0E32\u0E19\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19`, "append"),
          API.updateTaskDetails({
            id: prModal.task.id,
            team: prModal.task.team,
            job: prModal.task.job,
            subkpi: prModal.task.subkpi,
            mainkpi: prModal.task.mainkpi,
            deadline: prModal.task.deadline,
            extra_data: newExtra
          })
        ]);
        setPrModal({ show: false, task: null, fundNumber: "", amount: "" });
        onRefresh();
      } catch (e) {
        alert(e.message || "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setSavingPr(false);
      }
    };
    const canEdit = (task) => !["Completed", "Cancelled"].includes(task.status);
    const canCancel = (task) => !["Completed", "Cancelled"].includes(task.status);
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(ActionModal, { config: modal, onClose: closeModal }), notePopup.show && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-4" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-2 text-[var(--mx-info)]" }), "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "max-h-80 overflow-y-auto rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm leading-7 whitespace-pre-wrap" }, notePopup.note || "-")), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft w-full mt-5", onClick: () => setNotePopup({ show: false, note: "" }) }, "\u0E1B\u0E34\u0E14"))), statusTarget && /* @__PURE__ */ React.createElement(
      StatusChangeModal,
      {
        task: statusTarget,
        onSave: (status, reason) => onStatusChange(statusTarget, status, reason),
        onClose: () => setStatusTarget(null)
      }
    ), editingTask && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-5" }, "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Job / \u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        className: "mx-textarea min-h-[100px]",
        value: editForm.job,
        onChange: (e) => setEditForm((p) => ({ ...p, job: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Sub KPI"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        value: editForm.subkpi,
        onChange: (e) => setEditForm((p) => ({ ...p, subkpi: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement(
      ExtraDataFields,
      {
        subkpi: editForm.subkpi,
        extraData: editForm.extra_data,
        onChange: (ed) => setEditForm((p) => ({ ...p, extra_data: ed }))
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "Main KPI: ", editingTask.mainkpi || "-", " \u2022 Deadline: ", formatDate(editingTask.deadline))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: () => setEditingTask(null) }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary flex-1", disabled: savingEdit, onClick: handleEditSave }, savingEdit ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01")))), prModal.show && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(0,0,0,0.75)" } }, /* @__PURE__ */ React.createElement("div", { className: "mx-shell-card rounded-[24px] p-7 w-full max-w-lg shadow-2xl" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-extrabold mb-2" }, "Complete Open PR"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-[var(--mx-muted)] mb-5" }, "\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E48\u0E2D\u0E19\u0E1B\u0E34\u0E14\u0E07\u0E32\u0E19 PR"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Fund Number"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        placeholder: "\u0E40\u0E25\u0E02\u0E01\u0E2D\u0E07\u0E17\u0E38\u0E19",
        value: prModal.fundNumber,
        onChange: (e) => setPrModal((p) => ({ ...p, fundNumber: e.target.value }))
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Amount (\u0E1A\u0E32\u0E17)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        type: "number",
        placeholder: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19",
        value: prModal.amount,
        onChange: (e) => setPrModal((p) => ({ ...p, amount: e.target.value }))
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-6" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft flex-1", onClick: () => setPrModal({ show: false, task: null, fundNumber: "", amount: "" }) }, "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn flex-1 mx-action-success",
        disabled: savingPr,
        onClick: handlePrComplete
      },
      savingPr ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1B\u0E34\u0E14\u0E07\u0E32\u0E19 PR"
    )))), /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Tasks", value: taskSummary.total, sub: "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E43\u0E19\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E19\u0E35\u0E49", icon: "fa-list-check" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Total Weight", value: formatWeightPercent(taskScores.totalWeight), sub: "\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13", icon: "fa-scale-balanced", accent: "var(--mx-blue)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Completion", value: formatScorePercent(taskScores.completion), sub: completionMetricSub(taskScores), icon: "fa-check-double", accent: "var(--mx-green)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Weighted SLA", value: formatScorePercent(taskScores.sla), sub: slaMetricSub(taskScores), icon: "fa-chart-line", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "Need Attention", value: taskSummary.risk, sub: "Pending / On Hold", icon: "fa-triangle-exclamation", accent: "var(--mx-amber)" })), /* @__PURE__ */ React.createElement(WeightFormulaStrip, { scores: taskScores }), /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: "Task Center",
        subtitle: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E07\u0E32\u0E19\u0E41\u0E1A\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2D\u0E48\u0E32\u0E19\u0E40\u0E23\u0E47\u0E27\u0E41\u0E25\u0E30\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E07\u0E48\u0E32\u0E22\u0E01\u0E27\u0E48\u0E32\u0E40\u0E14\u0E34\u0E21",
        actions: [
          /* @__PURE__ */ React.createElement("button", { key: "refresh", className: "mx-btn mx-btn-soft", onClick: onRefresh }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate-right mr-2" }), "Refresh")
        ]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-[1fr_220px] gap-3 mb-5" }, /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32 job / \u0E04\u0E19 / team / status",
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }
      ), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "all" }, "\u0E17\u0E38\u0E01\u0E2A\u0E16\u0E32\u0E19\u0E30"), /* @__PURE__ */ React.createElement("option", { value: "Pending" }, "Pending"), /* @__PURE__ */ React.createElement("option", { value: "On Process" }, "On Process"), /* @__PURE__ */ React.createElement("option", { value: "On Hold" }, "On Hold"), /* @__PURE__ */ React.createElement("option", { value: "Completed" }, "Completed"), /* @__PURE__ */ React.createElement("option", { value: "Cancelled" }, "Cancelled"))),
      /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, filtered.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19"), filtered.map((task) => {
        const holdSummary = getHoldSummary(task, holidaySet);
        return /* @__PURE__ */ React.createElement("div", { key: task.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-base break-all" }, task.job), /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getStatusClass(task.status)) }, task.status), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Weight ", formatWeightPercent(getTaskWeight(task))), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "mx-btn mx-btn-soft !py-2 !px-3",
            onClick: () => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
          },
          expandedTaskId === task.id ? "\u0E0B\u0E48\u0E2D\u0E19" : "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14"
        ), task.note && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setNotePopup({ show: true, note: task.note }),
            className: "mx-note-btn text-xs px-3 py-1.5 rounded-lg transition-colors font-bold"
          },
          /* @__PURE__ */ React.createElement("i", { className: "fas fa-sticky-note mr-1" }),
          "\u0E14\u0E39\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"
        )), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, task.name || "-", " \u2022 ", task.team || "-", " \u2022 ", task.subkpi || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38 Sub KPI"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, "Start ", formatDate(task.startdate), " \u2022 Deadline ", formatDate(task.deadline), task.completiondate ? ` \u2022 \u0E40\u0E2A\u0E23\u0E47\u0E08 ${formatDate(task.completiondate)}` : ""), holdSummary.activeStart && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-warning)] font-bold" }, "SLA paused since ", formatDate(holdSummary.activeStart), " - effective deadline ", formatDate(holdSummary.effectiveDeadline)), expandedTaskId === task.id && /* @__PURE__ */ React.createElement("div", { className: "mt-4 rounded-[18px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-xs text-[var(--mx-muted)]" }, "Task ID: ", task.id), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)]" }, "Weight: ", formatWeightPercent(getTaskWeight(task))), holdSummary.totalDays > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)]" }, "Total hold: ", holdSummary.totalDays, " business day(s)"), task.note ? /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-sm leading-7 whitespace-pre-wrap" }, task.note) : /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35 note"), renderExtraData(task.extra_data))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2 flex-shrink-0 items-start" }, user.role === "Staff" && /* @__PURE__ */ React.createElement(React.Fragment, null, task.status === "Pending" && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-play", color: "blue", onClick: () => handleStaffAction(task, "accept"), label: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19" }), task.status === "On Process" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-check", color: "emerald", onClick: () => handleStaffAction(task, "complete"), label: "\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19" }), /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-pause", color: "amber", onClick: () => handleStaffAction(task, "hold"), label: "\u0E1E\u0E31\u0E01\u0E07\u0E32\u0E19" }), /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-comment-dots", color: "blue", onClick: () => handleStaffAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), task.status === "On Hold" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-play", color: "blue", onClick: () => handleStaffAction(task, "resume"), label: "\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D" }), /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-comment-dots", color: "blue", onClick: () => handleStaffAction(task, "note"), label: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01" })), canCancel(task) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-trash", color: "rose", onClick: () => handleStaffAction(task, "cancel"), label: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01" }), canEdit(task) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-edit", color: "indigo", onClick: () => handleEditOpen(task), label: "\u0E41\u0E01\u0E49\u0E44\u0E02" })), ["Lead", "Manager", "Admin"].includes(user.role) && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-arrow-right-arrow-left", color: "blue", onClick: () => setStatusTarget(task), label: "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30" }), canEdit(task) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-edit", color: "indigo", onClick: () => handleEditOpen(task), label: "\u0E41\u0E01\u0E49\u0E44\u0E02" }), ["Manager", "Admin"].includes(user.role) && /* @__PURE__ */ React.createElement(ActionButton, { icon: "fa-trash", color: "rose", onClick: () => onDelete(task), label: "\u0E25\u0E1A\u0E07\u0E32\u0E19" })))));
      }))
    ));
  }
  function TrackerViewNew() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [logsByTask, setLogsByTask] = useState({});
    const [expandedJob, setExpandedJob] = useState(null);
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const handleSearch = async () => {
      if (query.trim().length < 3) {
        setError("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 3 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await API.getTasksByJob(query.trim());
        const tasks = res.tasks || [];
        setItems(tasks);
        setExpandedJob(null);
        setExpandedTaskId(null);
        const logPairs = await Promise.all(
          tasks.map(async (task) => {
            try {
              const logRes = await API.getAuditLogsByTask(task.id);
              return [task.id, logRes.logs || []];
            } catch {
              return [task.id, []];
            }
          })
        );
        setLogsByTask(Object.fromEntries(logPairs));
      } catch (e) {
        setError(e.message || "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setLoading(false);
      }
    };
    const grouped = useMemo(() => {
      const groups = {};
      items.forEach((task) => {
        const code = extractJobCode(task.job);
        if (!groups[code]) groups[code] = [];
        groups[code].push(task);
      });
      return Object.entries(groups);
    }, [items]);
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Job Tracker", subtitle: "\u0E41\u0E22\u0E01\u0E43\u0E2B\u0E49\u0E0A\u0E31\u0E14\u0E27\u0E48\u0E32 Job \u0E2B\u0E19\u0E36\u0E48\u0E07\u0E2D\u0E32\u0E08\u0E21\u0E35\u0E2B\u0E25\u0E32\u0E22 Task \u0E22\u0E48\u0E2D\u0E22" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-[1fr_180px] gap-3 mb-5" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "mx-input",
        placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32 job code \u0E2B\u0E23\u0E37\u0E2D\u0E0A\u0E37\u0E48\u0E2D\u0E07\u0E32\u0E19",
        value: query,
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: (e) => e.key === "Enter" && handleSearch()
      }
    ), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: handleSearch, disabled: loading }, loading ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E49\u0E19\u0E2B\u0E32..." : "Search")), error && /* @__PURE__ */ React.createElement("div", { className: "mb-4 text-sm text-[#ffb7b7] font-bold" }, error), /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, grouped.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E25\u0E01\u0E32\u0E23\u0E04\u0E49\u0E19\u0E2B\u0E32"), grouped.map(([code, tasks]) => /* @__PURE__ */ React.createElement("div", { key: code, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold text-lg" }, code), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, tasks.length, " task(s) under this job")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, [...new Set(tasks.map((t) => t.name).filter(Boolean))].length, " owner(s)"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !py-2 !px-3",
        onClick: () => setExpandedJob(expandedJob === code ? null : code)
      },
      expandedJob === code ? "Collapse" : "Open Timeline"
    ))), expandedJob === code && /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid gap-3" }, tasks.map((task, idx) => /* @__PURE__ */ React.createElement("div", { key: task.id, className: "rounded-[16px] p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, "Task ", idx + 1, " \u2022 ", task.name || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, task.team || "-", " \u2022 ", task.subkpi || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38 Sub KPI", " \u2022 Start ", formatDate(task.startdate)), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, "Deadline ", formatDate(task.deadline), " \u2022 Completed ", formatDate(task.completiondate))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", getStatusClass(task.status)) }, task.status), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !py-2 !px-3",
        onClick: () => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
      },
      expandedTaskId === task.id ? "Hide Detail" : "View Detail"
    ))), expandedTaskId === task.id && /* @__PURE__ */ React.createElement("div", { className: "mt-4 rounded-[18px] p-4 bg-[rgba(0,0,0,0.16)] border border-[rgba(255,255,255,0.06)]" }, task.note ? /* @__PURE__ */ React.createElement("div", { className: "text-sm leading-7 whitespace-pre-wrap" }, task.note) : /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35 note \u0E02\u0E2D\u0E07 task \u0E19\u0E35\u0E49"), renderExtraData(task.extra_data), /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold mb-3" }, "Audit Timeline"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, (logsByTask[task.id] || []).length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 audit log"), (logsByTask[task.id] || []).map((log) => /* @__PURE__ */ React.createElement("div", { key: log.id, className: "rounded-[14px] p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-sm" }, log.action || "Activity"), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-[var(--mx-muted)]" }, formatDate(log.timestamp, true))), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, log.details || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)]" }, "By ", log.by_user || "-"))))))))))))));
  }
  function ExtraDataFields({ subkpi, extraData, onChange, hideSsr = false }) {
    if (!subkpi) return null;
    const sub = subkpi;
    const isCoord = sub.includes("\u0E1B\u0E23\u0E30\u0E2A\u0E32\u0E19\u0E07\u0E32\u0E19\u0E2D\u0E32\u0E04\u0E32\u0E23");
    const isNotify = sub.includes("\u0E41\u0E08\u0E49\u0E07 Job \u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E21\u0E32");
    const isSAP = sub.toLowerCase().includes("open job sap");
    const isOWF = sub.toLowerCase().includes("open job owf");
    if (!isCoord && !isNotify && !isSAP && !isOWF) return null;
    const ed = extraData || {};
    const upd = (k, v) => onChange({ ...ed, [k]: v });
    return /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2 rounded-[18px] p-4 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.25)]" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs font-extrabold text-[var(--mx-warning)] uppercase tracking-widest mb-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-clipboard-list" }), "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, isCoord && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E2D\u0E32\u0E04\u0E32\u0E23", value: ed.building || "", onChange: (e) => upd("building", e.target.value) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32", value: ed.client || "", onChange: (e) => upd("client", e.target.value) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E21\u0E32", value: ed.contractor || "", onChange: (e) => upd("contractor", e.target.value) })), isNotify && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E40\u0E2B\u0E21\u0E32", value: ed.contractorName || "", onChange: (e) => upd("contractorName", e.target.value) }), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: ed.contractorType || "", onChange: (e) => upd("contractorType", e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01 TYPE"), ["B1", "C1", "C2", "E1"].map((t) => /* @__PURE__ */ React.createElement("option", { key: t, value: t }, t)))), isSAP && !hideSsr && /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "SSR Number", value: ed.ssrNumber || "", onChange: (e) => upd("ssrNumber", e.target.value) }), isOWF && /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "OSP Number", value: ed.ospNumber || "", onChange: (e) => upd("ospNumber", e.target.value) })));
  }
  function QuickCreateView({ user, people, onSaved, mode = "auto" }) {
    var _a;
    const isPersonalTask = user.role === "Staff" || mode === "personal";
    const teamKpis = useMemo(() => {
      const kpis = (user == null ? void 0 : user.kpis) || [];
      if (isPersonalTask) return kpis.filter((k) => !k.team || k.team === user.team);
      return kpis;
    }, [user, isPersonalTask]);
    const [loadedStaffKpis, setLoadedStaffKpis] = useState([]);
    useEffect(() => {
      if (!isPersonalTask) return;
      API.getKPIsByTeam(user.team).then((res) => {
        if (res && res.kpis && res.kpis.length > 0) setLoadedStaffKpis(res.kpis);
      }).catch(() => {
      });
    }, [user.team, isPersonalTask]);
    const [form, setForm] = useState({
      job: "",
      note: "",
      subkpi: "",
      mainkpi: "",
      deadline: "",
      assignedToName: isPersonalTask ? user.name : "",
      assignedToTeam: (user == null ? void 0 : user.team) || "",
      assignedToEmpId: "",
      extra_data: {}
    });
    const [assigneeKpis, setAssigneeKpis] = useState([]);
    const [loadingDeadline, setLoadingDeadline] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState("");
    useEffect(() => {
      if (isPersonalTask) return;
      if (!form.assignedToEmpId) {
        setAssigneeKpis([]);
        return;
      }
      const person = (people || []).find((p) => p.empId === form.assignedToEmpId);
      if (!person) return;
      setForm((prev) => ({ ...prev, assignedToName: person.name, assignedToTeam: person.team, subkpi: "", mainkpi: "", deadline: "", extra_data: {} }));
      API.getKPIsByTeam(person.team).then((res) => setAssigneeKpis(res.kpis || [])).catch(() => setAssigneeKpis([]));
    }, [form.assignedToEmpId, isPersonalTask, people]);
    const activeKpis = isPersonalTask ? loadedStaffKpis.length > 0 ? loadedStaffKpis : teamKpis : assigneeKpis;
    const handleSubKpiChange = async (subkpi) => {
      if (!subkpi) {
        setForm((p) => ({ ...p, subkpi: "", mainkpi: "", deadline: "", extra_data: {} }));
        return;
      }
      const kpi = activeKpis.find((k) => k.sub === subkpi);
      setForm((p) => ({ ...p, subkpi, mainkpi: (kpi == null ? void 0 : kpi.main) || "", extra_data: {} }));
      setLoadingDeadline(true);
      try {
        const targetTeam = isPersonalTask ? user.team : form.assignedToTeam;
        const res = await API.calculateDeadlinePreview({
          team: targetTeam,
          subkpi,
          startDate: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (res && !res.error) {
          setForm((p) => ({ ...p, mainkpi: res.mainkpi || (kpi == null ? void 0 : kpi.main) || "", deadline: res.deadline || "" }));
        }
      } catch {
      }
      setLoadingDeadline(false);
    };
    const handleSave = async () => {
      if (!form.job.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38 job");
      if (!form.subkpi.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI");
      if (!isPersonalTask && !form.assignedToName.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A");
      setSaving(true);
      setSaveResult("");
      try {
        let res;
        if (isPersonalTask) {
          res = await API.saveNewTask({
            name: user.name,
            team: user.team,
            empId: user.empId,
            job: form.job,
            subkpi: form.subkpi,
            mainkpi: form.mainkpi,
            deadline: form.deadline,
            note: form.note,
            extra_data: form.extra_data
          });
        } else {
          const jobs = form.job.split("\n").map((j) => j.trim()).filter(Boolean);
          res = await API.saveNewTask({
            jobs,
            name: form.assignedToName,
            team: form.assignedToTeam || user.team,
            mainkpi: form.mainkpi,
            subkpi: form.subkpi,
            deadline: form.deadline,
            note: form.note
          });
        }
        const msg = res && res.message ? res.message : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22";
        setSaveResult(msg);
        setForm({
          job: "",
          note: "",
          subkpi: "",
          mainkpi: "",
          deadline: "",
          assignedToName: isPersonalTask ? user.name : "",
          assignedToTeam: user.team,
          assignedToEmpId: "",
          extra_data: {}
        });
        setAssigneeKpis([]);
        onSaved == null ? void 0 : onSaved();
      } catch (e) {
        alert(e.message || "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setSaving(false);
      }
    };
    return /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: isPersonalTask ? "Create Personal Task" : "Assign Task",
        subtitle: isPersonalTask ? "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E08\u0E32\u0E01 shell \u0E43\u0E2B\u0E21\u0E48" : "\u0E21\u0E2D\u0E1A\u0E2B\u0E21\u0E32\u0E22\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49\u0E04\u0E23\u0E31\u0E49\u0E07\u0E25\u0E30\u0E2B\u0E25\u0E32\u0E22 Job (\u0E41\u0E15\u0E48\u0E25\u0E30\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 = 1 \u0E07\u0E32\u0E19)"
      },
      saveResult && /* @__PURE__ */ React.createElement("div", { className: "mb-4 rounded-[14px] p-3 mx-status-completed text-sm font-bold" }, /* @__PURE__ */ React.createElement("i", { className: "fas fa-check-circle mr-2" }), saveResult),
      /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-4" }, isPersonalTask && /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold uppercase tracking-[0.08em] text-[var(--mx-muted)]" }, "SSR Number"), /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          placeholder: "\u0E40\u0E0A\u0E48\u0E19 DS01_0123",
          value: ((_a = form.extra_data) == null ? void 0 : _a.ssrNumber) || "",
          onChange: (e) => setForm((p) => ({ ...p, extra_data: { ...p.extra_data || {}, ssrNumber: e.target.value } }))
        }
      )), /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Job / \u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19", !isPersonalTask && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-xs text-[var(--mx-muted)] font-normal" }, "(\u0E41\u0E15\u0E48\u0E25\u0E30\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 = 1 \u0E07\u0E32\u0E19)")), /* @__PURE__ */ React.createElement(
        "textarea",
        {
          className: "mx-textarea min-h-[110px]",
          value: form.job,
          onChange: (e) => setForm((p) => ({ ...p, job: e.target.value })),
          placeholder: isPersonalTask ? "\u0E23\u0E30\u0E1A\u0E38 job \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19" : "Job 1\nJob 2\nJob 3 (\u0E41\u0E15\u0E48\u0E25\u0E30\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E08\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19 1 \u0E07\u0E32\u0E19)"
        }
      )), !isPersonalTask && /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A"), /* @__PURE__ */ React.createElement(
        "select",
        {
          className: "mx-select",
          value: form.assignedToEmpId,
          onChange: (e) => setForm((p) => ({ ...p, assignedToEmpId: e.target.value }))
        },
        /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A"),
        (people || []).map((person) => /* @__PURE__ */ React.createElement("option", { key: person.empId, value: person.empId }, person.name, " (", person.team, ")"))
      )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Sub KPI"), activeKpis.length > 0 ? /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: form.subkpi, onChange: (e) => handleSubKpiChange(e.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI"), activeKpis.map((k) => /* @__PURE__ */ React.createElement("option", { key: `${k.main}-${k.sub}`, value: k.sub }, k.sub, " (", k.main, ")"))) : /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          value: form.subkpi,
          onChange: (e) => setForm((p) => ({ ...p, subkpi: e.target.value })),
          placeholder: isPersonalTask ? "Sub KPI" : "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A\u0E01\u0E48\u0E2D\u0E19"
        }
      )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Main KPI"), /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          value: form.mainkpi,
          readOnly: true,
          placeholder: loadingDeadline ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13..." : "\u0E01\u0E23\u0E2D\u0E01\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI"
        }
      )), /* @__PURE__ */ React.createElement(
        ExtraDataFields,
        {
          subkpi: form.subkpi,
          extraData: form.extra_data,
          onChange: (ed) => setForm((p) => ({ ...p, extra_data: ed })),
          hideSsr: isPersonalTask
        }
      ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Deadline (\u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01 SLA)"), /* @__PURE__ */ React.createElement(
        "input",
        {
          className: "mx-input",
          value: form.deadline ? formatDate(form.deadline) : "",
          readOnly: true,
          placeholder: loadingDeadline ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13..." : "\u0E01\u0E23\u0E2D\u0E01\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01 Sub KPI"
        }
      )), isPersonalTask && /* @__PURE__ */ React.createElement("div", { className: "md:col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "block mb-2 text-sm font-bold" }, "Note (optional)"), /* @__PURE__ */ React.createElement(
        "textarea",
        {
          className: "mx-textarea min-h-[80px]",
          value: form.note,
          onChange: (e) => setForm((p) => ({ ...p, note: e.target.value })),
          placeholder: "\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21"
        }
      ))),
      /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", disabled: saving, onClick: handleSave }, saving ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : isPersonalTask ? "Create Task" : "Assign Task"))
    );
  }
  function PeopleView({ user, people, onRefresh }) {
    return /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: user.role === "Lead" ? "Team People" : "People Directory",
        subtitle: "\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E48\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E44\u0E14\u0E49\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E14\u0E34\u0E21 \u0E41\u0E15\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E43\u0E19\u0E42\u0E04\u0E23\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2D\u0E48\u0E32\u0E19\u0E07\u0E48\u0E32\u0E22\u0E01\u0E27\u0E48\u0E32",
        actions: [/* @__PURE__ */ React.createElement("button", { key: "refresh", className: "mx-btn mx-btn-soft", onClick: onRefresh }, "Refresh")]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 xl:grid-cols-3 gap-3" }, (people || []).map((person) => /* @__PURE__ */ React.createElement("div", { key: `${person.empId}-${person.name}`, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, person.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, person.department || person.departmentId || "-", " \u2022 ", person.team, " \u2022 ", roleLabel(person.role)), /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-xs text-[var(--mx-muted)]" }, "Emp ID: ", person.empId))), (!people || people.length === 0) && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D"))
    );
  }
  function SystemsView({ user, systemLinks }) {
    const systems = visibleSystemLinksForUser(systemLinks, user);
    const statusClass = (status) => {
      if (status === "Active") return "mx-status-completed";
      if (status === "Maintenance") return "mx-status-pending";
      if (status === "Coming Soon") return "mx-status-process";
      return "mx-status-cancelled";
    };
    const openSystem = (system) => {
      if (!system.url || system.status === "Coming Soon" || system.status === "Hidden") return;
      window.open(system.url, "_blank", "noopener,noreferrer");
    };
    return /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: "Systems",
        subtitle: "\u0E23\u0E30\u0E1A\u0E1A\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19",
        actions: [/* @__PURE__ */ React.createElement("span", { key: "count", className: "mx-badge mx-status-process" }, systems.length, " systems")]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 xl:grid-cols-3 gap-3" }, systems.map((system) => {
        const disabled = !system.url || system.status === "Coming Soon" || system.status === "Hidden";
        return /* @__PURE__ */ React.createElement("div", { key: system.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "w-10 h-10 rounded-lg grid place-items-center bg-[var(--mx-surface)] border border-[var(--mx-line)] flex-shrink-0" }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${system.icon || "fa-up-right-from-square"} text-[var(--mx-accent)]` })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold truncate" }, system.name), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: cn("mx-badge", statusClass(system.status)) }, system.status), !system.visibleToAll && /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, "Restricted")), /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-sm text-[var(--mx-muted)] leading-6" }, system.description || "-"))), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: cn("mx-btn w-full mt-4", disabled ? "mx-btn-soft opacity-60 cursor-not-allowed" : "mx-btn-primary"),
            disabled,
            onClick: () => openSystem(system)
          },
          /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-up-right-from-square mr-2" }),
          disabled ? "Unavailable" : "Open System"
        ));
      }), systems.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E30\u0E1A\u0E1A\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E2B\u0E49\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19"))
    );
  }
  function AdminStudio({ user, adminData, systemLinks, onSystemLinksChange, onRefresh, adminSection = "overview", setAdminSection = () => {
  } }) {
    var _a;
    const [userForm, setUserForm] = useState({ empid: "", name: "", department: "", team: "", role: "Staff", accessScope: "Self", pigurl: "" });
    const [teamForm, setTeamForm] = useState({ id: "", name: "" });
    const [kpiForm, setKpiForm] = useState({ main: "", sub: "", team: "", days: 1, main_weight: 1 });
    const [holidayForm, setHolidayForm] = useState({ holiday_date: "", name: "", is_active: true });
    const emptySystemForm = { id: "", name: "", description: "", url: "", icon: "fa-up-right-from-square", status: "Active", visibleToAll: false, allowedRoles: [], allowedTeams: [], allowedEmpIds: "", isActive: true };
    const [systemForm, setSystemForm] = useState(emptySystemForm);
    const [previewEmpId, setPreviewEmpId] = useState("");
    const [adminSearch, setAdminSearch] = useState("");
    const [saving, setSaving] = useState("");
    const teams = (adminData == null ? void 0 : adminData.teams) || [];
    const staff = (adminData == null ? void 0 : adminData.staff) || [];
    const kpis = (adminData == null ? void 0 : adminData.kpis) || [];
    const holidays = (adminData == null ? void 0 : adminData.holidays) || [];
    const logs = (adminData == null ? void 0 : adminData.logs) || [];
    const q = adminSearch.trim().toLowerCase();
    const matches = (...values) => !q || values.some((value) => String(value || "").toLowerCase().includes(q));
    const filteredStaff = staff.filter((s) => matches(s.name, s.empId, s.empid, s.department, s.departmentId, s.team, s.role, roleScope(s)));
    const filteredKpis = kpis.filter((k) => matches(k.main, k.sub, k.team, k.days, k.main_weight));
    const filteredHolidays = holidays.filter((h) => matches(h.name, h.holiday_date, h.is_active ? "active" : "inactive"));
    const normalizedSystemLinks = normalizeSystemLinks(systemLinks);
    const filteredSystems = normalizedSystemLinks.filter((s) => matches(s.name, s.description, s.url, s.status, s.allowedRoles.join(" "), s.allowedTeams.join(" "), s.allowedEmpIds.join(" ")));
    const selectedRoleNeedsTeam = roleRequiresTeam(userForm.role);
    const selectedRoleNeedsDepartment = roleRequiresDepartment(userForm.role);
    const selectedRoleUsesTeamVisibility = isDepartmentManagerRole(userForm.role) || isStrategicViewRole(userForm.role);
    const userDepartmentValue = (item) => {
      const permissions = userPermissions(item);
      const explicitDepartment = item.department || item.departmentId || item.division || permissions.department || permissions.division;
      if (explicitDepartment) return explicitDepartment;
      return item.team || "";
    };
    const userTeamValue = (item) => {
      return roleRequiresTeam(item.role) ? item.team || "" : "";
    };
    const toPositiveNumber = (value, fallback = 1) => {
      const normalized = String(value != null ? value : "").trim().replace(",", ".");
      const number = Number(normalized);
      return Number.isFinite(number) && number > 0 ? number : fallback;
    };
    const runAdminAction = async (key, action, successMessage) => {
      setSaving(key);
      try {
        const res = await action();
        if (res == null ? void 0 : res.error) return alert(res.error);
        await onRefresh();
        if (successMessage) alert(successMessage);
      } catch (error) {
        alert(error.message || "\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setSaving("");
      }
    };
    const editUser = (item) => {
      setUserForm({
        empid: item.empId || item.empid || "",
        name: item.name || "",
        department: userDepartmentValue(item),
        team: userTeamValue(item),
        role: item.role || "Staff",
        accessScope: item.accessScope || item.scope || userPermissions(item).scope || roleScope(item.role || "Staff"),
        pigurl: item.pigurl || item.pigUrl || item.avatar || item.photoUrl || "",
        permissions: { allowedTeams: [], allowedStaff: [], ...userPermissions(item) }
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const toggleAllowedTeam = (teamName) => {
      setUserForm((prev) => {
        var _a2;
        const current = Array.isArray((_a2 = prev.permissions) == null ? void 0 : _a2.allowedTeams) ? prev.permissions.allowedTeams : [];
        const allowedTeams = current.includes(teamName) ? current.filter((team) => team !== teamName) : [...current, teamName];
        return { ...prev, permissions: { ...prev.permissions || {}, allowedTeams } };
      });
    };
    const persistSystemLinks = async (nextLinks) => {
      const normalized = cacheSystemLinks(nextLinks);
      onSystemLinksChange == null ? void 0 : onSystemLinksChange(normalized);
      try {
        await saveSystemLinksToApi(normalized, user.empId);
      } catch (error) {
        console.warn("System links saved locally; backend endpoint is not available yet.", error);
        alert("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E19\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E19\u0E35\u0E49\u0E41\u0E25\u0E49\u0E27 \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1B backend \u0E01\u0E25\u0E32\u0E07\u0E44\u0E14\u0E49");
      }
    };
    const toggleSystemRole = (role) => {
      setSystemForm((prev) => {
        const current = normalizeList(prev.allowedRoles);
        return {
          ...prev,
          allowedRoles: current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
        };
      });
    };
    const toggleSystemTeam = (teamName) => {
      setSystemForm((prev) => {
        const current = normalizeList(prev.allowedTeams);
        return {
          ...prev,
          allowedTeams: current.includes(teamName) ? current.filter((item) => item !== teamName) : [...current, teamName]
        };
      });
    };
    const editSystem = (item) => {
      setSystemForm({
        ...normalizeSystemLink(item),
        allowedEmpIds: normalizeList(item.allowedEmpIds).join(", ")
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const saveSystem = async () => {
      if (!systemForm.name.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E23\u0E30\u0E1A\u0E1A");
      const next = normalizeSystemLink({
        ...systemForm,
        id: systemForm.id || systemForm.name,
        allowedEmpIds: normalizeList(systemForm.allowedEmpIds)
      });
      const others = normalizedSystemLinks.filter((item) => item.id !== next.id);
      setSaving("systems");
      await persistSystemLinks([...others, next]);
      setSaving("");
      setSystemForm(emptySystemForm);
    };
    const duplicateSystem = async (item) => {
      const copy = normalizeSystemLink({ ...item, id: `${item.id}-copy`, name: `${item.name} Copy` });
      setSaving("systems");
      await persistSystemLinks([...normalizedSystemLinks, copy]);
      setSaving("");
    };
    const removeSystem = async (id) => {
      if (!window.confirm("\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E23\u0E30\u0E1A\u0E1A\u0E19\u0E35\u0E49?")) return;
      setSaving("systems");
      await persistSystemLinks(normalizedSystemLinks.filter((item) => item.id !== id));
      setSaving("");
    };
    const previewUser = (staff || []).find((person) => String(person.empId || person.empid || "").toUpperCase() === previewEmpId.trim().toUpperCase());
    const previewSystems = previewUser ? visibleSystemLinksForUser(normalizedSystemLinks, previewUser) : [];
    const editKpi = (item) => {
      setKpiForm({
        id: item.id,
        main: item.main || item.mainkpi || "",
        sub: item.sub || item.subkpi || "",
        team: item.team || "",
        days: item.days || 1,
        main_weight: item.main_weight || item.mainWeight || 1
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const editHoliday = (item) => {
      setHolidayForm({
        id: item.id,
        holiday_date: item.holiday_date || "",
        name: item.name || "",
        is_active: item.is_active !== false
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const saveUser = async () => {
      var _a2, _b;
      if (!userForm.empid || !userForm.name || !userForm.role) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 Emp ID, \u0E0A\u0E37\u0E48\u0E2D \u0E41\u0E25\u0E30\u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E43\u0E2B\u0E49\u0E04\u0E23\u0E1A");
      if (selectedRoleNeedsTeam && !userForm.team) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E35\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A Staff \u0E2B\u0E23\u0E37\u0E2D Lead");
      if (selectedRoleNeedsDepartment && !userForm.department) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 Department / Division \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E34\u0E2B\u0E32\u0E23");
      const accessScope = userForm.accessScope || roleScope(userForm.role);
      const legacyTeam = userForm.team || userForm.department || accessScope;
      const permissions = {
        ...userForm.permissions || {},
        scope: accessScope,
        department: String(userForm.department || "").trim(),
        allowedTeams: ((_a2 = userForm.permissions) == null ? void 0 : _a2.allowedTeams) || [],
        allowedStaff: ((_b = userForm.permissions) == null ? void 0 : _b.allowedStaff) || []
      };
      const basePayload = {
        empid: String(userForm.empid || "").trim().toUpperCase(),
        name: String(userForm.name || "").trim(),
        role: userForm.role,
        team: legacyTeam,
        pigurl: String(userForm.pigurl || "").trim()
      };
      const payload = { ...basePayload, permissions };
      await runAdminAction("user", async () => {
        try {
          return await adminPost("admin/saveUser", payload, user.empId);
        } catch (error) {
          if (error.status >= 500) {
            return adminPost("admin/saveUser", basePayload, user.empId);
          }
          throw error;
        }
      }, "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      setUserForm({ empid: "", name: "", department: "", team: "", role: "Staff", accessScope: "Self", pigurl: "" });
    };
    const saveTeam = async () => {
      if (!teamForm.name.trim()) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E21");
      await runAdminAction("team", async () => adminPost("admin/saveTeam", { id: teamForm.id || void 0, name: teamForm.name.trim() }, user.empId), "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E17\u0E35\u0E21\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      setTeamForm({ id: "", name: "" });
    };
    const saveKpi = async () => {
      const main = kpiForm.main.trim();
      const sub = kpiForm.sub.trim();
      const team = kpiForm.team.trim();
      const days = Math.round(toPositiveNumber(kpiForm.days, 1));
      const mainWeight = toPositiveNumber(kpiForm.main_weight, 1);
      if (!main || !sub || !team) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 Main KPI, Sub KPI \u0E41\u0E25\u0E30\u0E17\u0E35\u0E21\u0E43\u0E2B\u0E49\u0E04\u0E23\u0E1A");
      if (!days || days < 1) return alert("SLA Days \u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32 0");
      if (!mainWeight || mainWeight <= 0) return alert("Weight \u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32 0");
      const payload = {
        ...kpiForm.id ? { id: kpiForm.id } : {},
        main,
        sub,
        team,
        days,
        main_weight: mainWeight,
        mainWeight
      };
      await runAdminAction("kpi", async () => adminPost("admin/saveKpi", payload, user.empId), "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 KPI \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      setKpiForm({ main: "", sub: "", team: "", days: 1, main_weight: 1 });
    };
    const saveHoliday = async () => {
      if (!holidayForm.holiday_date || !holidayForm.name) return alert("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E43\u0E2B\u0E49\u0E04\u0E23\u0E1A");
      await runAdminAction("holiday", async () => adminPost("admin/saveHoliday", holidayForm, user.empId), "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      setHolidayForm({ holiday_date: "", name: "", is_active: true });
    };
    const recalc = async () => {
      await runAdminAction("recalc", async () => adminPost("admin/recalculateDeadlines", {}, user.empId), "\u0E04\u0E33\u0E19\u0E27\u0E13\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E2A\u0E48\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const removeUser = async (empId) => {
      if (!window.confirm(`\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 ${empId}?`)) return;
      await runAdminAction(`delete-user-${empId}`, async () => adminDelete(`admin/deleteUser?empId=${encodeURIComponent(empId)}`, user.empId), "\u0E25\u0E1A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const removeTeam = async (id) => {
      if (!window.confirm("\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E17\u0E35\u0E21\u0E19\u0E35\u0E49?")) return;
      await runAdminAction(`delete-team-${id}`, async () => adminDelete(`admin/deleteTeam?id=${encodeURIComponent(id)}`, user.empId), "\u0E25\u0E1A\u0E17\u0E35\u0E21\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const removeHoliday = async (id) => {
      if (!window.confirm("\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E19\u0E35\u0E49?")) return;
      await runAdminAction(`delete-holiday-${id}`, async () => adminDelete(`admin/deleteHoliday?id=${encodeURIComponent(id)}`, user.empId), "\u0E25\u0E1A\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const removeKpi = async (id) => {
      if (!window.confirm("\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E25\u0E1A KPI \u0E19\u0E35\u0E49?")) return;
      await runAdminAction(`delete-kpi-${id}`, async () => adminDelete(`admin/deleteKpi?id=${encodeURIComponent(id)}`, user.empId), "\u0E25\u0E1A KPI \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
    };
    const sectionItems = [
      { id: "overview", label: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E23\u0E30\u0E1A\u0E1A", icon: "fa-gauge-high", count: staff.length + teams.length + kpis.length + holidays.length },
      { id: "users", label: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C", icon: "fa-users-gear", count: staff.length },
      { id: "systems", label: "Systems", icon: "fa-table-cells-large", count: normalizedSystemLinks.length },
      { id: "teams", label: "\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19", icon: "fa-people-group", count: teams.length },
      { id: "kpi", label: "\u0E01\u0E0E KPI/SLA", icon: "fa-scale-balanced", count: kpis.length },
      { id: "calendar", label: "\u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 SLA", icon: "fa-calendar-days", count: holidays.length },
      { id: "audit", label: "\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02", icon: "fa-shield-halved", count: logs.length }
    ];
    const UserEditor = () => {
      var _a2, _b;
      return /* @__PURE__ */ React.createElement(Panel, { title: "\u0E40\u0E1E\u0E34\u0E48\u0E21 / \u0E41\u0E01\u0E49\u0E44\u0E02\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49", subtitle: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E15\u0E31\u0E27\u0E15\u0E19 \u0E1A\u0E17\u0E1A\u0E32\u0E17 \u0E17\u0E35\u0E21 \u0E41\u0E25\u0E30\u0E23\u0E39\u0E1B\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Emp ID", value: userForm.empid, onChange: (e) => setUserForm((p) => ({ ...p, empid: e.target.value.toUpperCase() })) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49", value: userForm.name, onChange: (e) => setUserForm((p) => ({ ...p, name: e.target.value })) }), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Department / Division ", selectedRoleNeedsDepartment ? /* @__PURE__ */ React.createElement("span", { className: "text-rose-500" }, "Required") : /* @__PURE__ */ React.createElement("span", null, "Optional"), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E40\u0E0A\u0E48\u0E19 IT Division, Operations, Service", value: userForm.department, onChange: (e) => setUserForm((p) => ({ ...p, department: e.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Team ", selectedRoleNeedsTeam ? /* @__PURE__ */ React.createElement("span", { className: "text-rose-500" }, "Required") : /* @__PURE__ */ React.createElement("span", null, "Optional"), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: userForm.team, onChange: (e) => setUserForm((p) => ({ ...p, team: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "" }, selectedRoleNeedsTeam ? "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E35\u0E21" : "\u0E44\u0E21\u0E48\u0E1C\u0E39\u0E01\u0E17\u0E35\u0E21\u0E40\u0E14\u0E35\u0E22\u0E27"), teams.map((team) => /* @__PURE__ */ React.createElement("option", { key: team.id || team.name, value: team.name }, team.name)))), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: userForm.role, onChange: (e) => setUserForm((p) => ({ ...p, role: e.target.value, accessScope: roleScope(e.target.value) })) }, ROLE_OPTIONS.map((option) => /* @__PURE__ */ React.createElement("option", { key: option.value, value: option.value }, option.label))), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: userForm.accessScope, onChange: (e) => setUserForm((p) => ({ ...p, accessScope: e.target.value })) }, SCOPE_OPTIONS.map((scope) => /* @__PURE__ */ React.createElement("option", { key: scope, value: scope }, "Scope: ", scope))), selectedRoleUsesTeamVisibility && /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "Team Visibility"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-xs text-[var(--mx-muted)]" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E35\u0E21\u0E17\u0E35\u0E48\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E19\u0E35\u0E49\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19 \u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E35\u0E21\u0E43\u0E14\u0E40\u0E25\u0E22\u0E08\u0E30\u0E40\u0E2B\u0E47\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14")), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, ((_b = (_a2 = userForm.permissions) == null ? void 0 : _a2.allowedTeams) == null ? void 0 : _b.length) || 0, " teams")), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1" }, teams.map((team) => {
        var _a3;
        const teamName = team.name || "";
        const checked = (((_a3 = userForm.permissions) == null ? void 0 : _a3.allowedTeams) || []).includes(teamName);
        return /* @__PURE__ */ React.createElement("label", { key: team.id || teamName, className: "flex items-center gap-2 rounded-lg border border-[var(--mx-line)] bg-[var(--mx-panel)] px-3 py-2 text-sm font-bold" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked, onChange: () => toggleAllowedTeam(teamName) }), /* @__PURE__ */ React.createElement("span", { className: "truncate" }, teamName));
      }), teams.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E17\u0E35\u0E21"))), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E23\u0E39\u0E1B\u0E42\u0E1B\u0E23\u0E44\u0E1F\u0E25\u0E4C (\u0E16\u0E49\u0E32\u0E21\u0E35)", value: userForm.pigurl, onChange: (e) => setUserForm((p) => ({ ...p, pigurl: e.target.value })) }), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: saveUser, disabled: saving === "user" }, saving === "user" ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft", onClick: () => setUserForm({ empid: "", name: "", department: "", team: "", role: "Staff", accessScope: "Self", pigurl: "" }) }, "\u0E25\u0E49\u0E32\u0E07\u0E1F\u0E2D\u0E23\u0E4C\u0E21"))));
    };
    const UsersList = () => /* @__PURE__ */ React.createElement(Panel, { title: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C", subtitle: "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E1A\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A \u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E41\u0E15\u0E30 data source \u0E42\u0E14\u0E22\u0E15\u0E23\u0E07" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, filteredStaff.slice(0, 60).map((s) => {
      const department = userDepartmentValue(s) || "-";
      const team = userTeamValue(s) || "-";
      return /* @__PURE__ */ React.createElement("div", { key: s.empId || s.empid, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, s.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, s.empId || s.empid, " / ", department, " / ", team, " / ", roleLabel(s.role), " / Scope: ", roleScope(s))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => editUser(s) }, "\u0E41\u0E01\u0E49\u0E44\u0E02"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeUser(s.empId || s.empid) }, "\u0E25\u0E1A"))));
    }), filteredStaff.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49")));
    const TeamControls = () => /* @__PURE__ */ React.createElement(Panel, { title: "\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19", subtitle: "\u0E40\u0E1E\u0E34\u0E48\u0E21 \u0E41\u0E01\u0E49\u0E44\u0E02 \u0E41\u0E25\u0E30\u0E25\u0E1A\u0E17\u0E35\u0E21\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col lg:flex-row lg:items-end gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, teamForm.id ? "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E17\u0E35\u0E21" : "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E17\u0E35\u0E21\u0E43\u0E2B\u0E21\u0E48"), /* @__PURE__ */ React.createElement("input", { className: "mx-input mt-3", placeholder: "\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E21", value: teamForm.name, onChange: (e) => setTeamForm((p) => ({ ...p, name: e.target.value })) })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:w-[260px] gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: saveTeam, disabled: saving === "team" }, saving === "team" ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E17\u0E35\u0E21"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft", onClick: () => setTeamForm({ id: "", name: "" }) }, "\u0E25\u0E49\u0E32\u0E07\u0E1F\u0E2D\u0E23\u0E4C\u0E21")))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, teams.map((team) => /* @__PURE__ */ React.createElement("div", { key: team.id || team.name, className: "mx-data-card flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, team.name), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => setTeamForm({ id: team.id || "", name: team.name || "" }) }, "\u0E41\u0E01\u0E49\u0E44\u0E02"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeTeam(team.id), disabled: !team.id }, "\u0E25\u0E1A")))), teams.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E17\u0E35\u0E21"))));
    const KpiControls = () => /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: "\u0E01\u0E0E KPI/SLA",
        subtitle: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E08\u0E33\u0E19\u0E27\u0E19\u0E27\u0E31\u0E19 SLA \u0E41\u0E25\u0E30\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 KPI \u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13\u0E04\u0E30\u0E41\u0E19\u0E19",
        actions: [
          /* @__PURE__ */ React.createElement("button", { key: "recalc", className: "mx-btn mx-btn-soft", onClick: recalc, disabled: saving === "recalc" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate mr-2" }), saving === "recalc" ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13..." : "\u0E04\u0E33\u0E19\u0E27\u0E13 Deadline \u0E43\u0E2B\u0E21\u0E48")
        ]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Main KPI", /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Main KPI", value: kpiForm.main, onChange: (e) => setKpiForm((p) => ({ ...p, main: e.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Sub KPI", /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "Sub KPI", value: kpiForm.sub, onChange: (e) => setKpiForm((p) => ({ ...p, sub: e.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Team", /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: kpiForm.team, onChange: (e) => setKpiForm((p) => ({ ...p, team: e.target.value })) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E17\u0E35\u0E21"), teams.map((team) => /* @__PURE__ */ React.createElement("option", { key: team.id || team.name, value: team.name }, team.name)))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "SLA Days", /* @__PURE__ */ React.createElement("input", { className: "mx-input", type: "number", min: "1", placeholder: "1", value: kpiForm.days, onChange: (e) => setKpiForm((p) => ({ ...p, days: e.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "grid gap-2 text-xs font-bold text-[var(--mx-muted)]" }, "Weight", /* @__PURE__ */ React.createElement("input", { className: "mx-input", type: "number", min: "1", step: "0.1", placeholder: "1", value: kpiForm.main_weight, onChange: (e) => setKpiForm((p) => ({ ...p, main_weight: e.target.value })) })))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3 mt-3" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary w-full", onClick: saveKpi, disabled: saving === "kpi" }, saving === "kpi" ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 KPI"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft w-full", onClick: () => setKpiForm({ main: "", sub: "", team: "", days: 1, main_weight: 1 }) }, "\u0E25\u0E49\u0E32\u0E07\u0E1F\u0E2D\u0E23\u0E4C\u0E21"))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, filteredKpis.slice(0, 80).map((kpi) => /* @__PURE__ */ React.createElement("div", { key: kpi.id || `${kpi.team}-${kpi.main}-${kpi.sub}`, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, kpi.main, " / ", kpi.sub), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, kpi.team, " / ", kpi.days, " day(s) / weight ", kpi.main_weight)), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => editKpi(kpi) }, "\u0E41\u0E01\u0E49\u0E44\u0E02"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeKpi(kpi.id), disabled: !kpi.id }, "\u0E25\u0E1A"))))), filteredKpis.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E01\u0E0E KPI/SLA")))
    );
    const CalendarControls = () => /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: "\u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 SLA",
        subtitle: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E17\u0E35\u0E48\u0E21\u0E35\u0E1C\u0E25\u0E15\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E04\u0E33\u0E19\u0E27\u0E13\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E2A\u0E48\u0E07",
        actions: [
          /* @__PURE__ */ React.createElement("button", { key: "recalc", className: "mx-btn mx-btn-soft", onClick: recalc, disabled: saving === "recalc" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate mr-2" }), saving === "recalc" ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13..." : "\u0E04\u0E33\u0E19\u0E27\u0E13 Deadline \u0E43\u0E2B\u0E21\u0E48")
        ]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-[180px_1fr_150px] gap-3" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input", type: "date", value: holidayForm.holiday_date, onChange: (e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value })) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14", value: holidayForm.name, onChange: (e) => setHolidayForm((p) => ({ ...p, name: e.target.value })) }), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: saveHoliday, disabled: saving === "holiday" }, saving === "holiday" ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01..." : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01"))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, filteredHolidays.slice(0, 80).map((holiday) => /* @__PURE__ */ React.createElement("div", { key: holiday.id || holiday.holiday_date, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold" }, holiday.name), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, holiday.holiday_date, " / ", holiday.is_active ? "Active" : "Inactive")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => editHoliday(holiday) }, "\u0E41\u0E01\u0E49\u0E44\u0E02"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeHoliday(holiday.id), disabled: !holiday.id }, "\u0E25\u0E1A"))))), filteredHolidays.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14")))
    );
    const AuditPanel = () => /* @__PURE__ */ React.createElement(Panel, { title: "\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02", subtitle: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E41\u0E1B\u0E25\u0E07\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E02\u0E49\u0E32 backend" }, /* @__PURE__ */ React.createElement("div", { className: "admin-audit-scroll grid gap-3" }, logs.slice(0, 80).map((log) => /* @__PURE__ */ React.createElement("div", { key: log.id || `${log.action}-${log.timestamp}`, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-sm" }, log.action || "Activity"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, log.details || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-[var(--mx-muted)]" }, log.by_user || "-", " / ", formatDate(log.timestamp, true)))), logs.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02")));
    const SystemsControls = () => /* @__PURE__ */ React.createElement("div", { className: "grid xl:grid-cols-[0.9fr_1.1fr] gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "System Link Editor", subtitle: "\u0E40\u0E1E\u0E34\u0E48\u0E21 \u0E41\u0E01\u0E49\u0E44\u0E02 \u0E41\u0E25\u0E30\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E23\u0E30\u0E1A\u0E1A\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E40\u0E2B\u0E47\u0E19\u0E43\u0E19 Sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "System name", value: systemForm.name, onChange: (e) => setSystemForm((p) => ({ ...p, name: e.target.value })) }), /* @__PURE__ */ React.createElement("textarea", { className: "mx-textarea min-h-[80px]", placeholder: "Description", value: systemForm.description, onChange: (e) => setSystemForm((p) => ({ ...p, description: e.target.value })) }), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "URL", value: systemForm.url, onChange: (e) => setSystemForm((p) => ({ ...p, url: e.target.value })) }), /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "FontAwesome icon \u0E40\u0E0A\u0E48\u0E19 fa-file-invoice", value: systemForm.icon, onChange: (e) => setSystemForm((p) => ({ ...p, icon: e.target.value })) }), /* @__PURE__ */ React.createElement("select", { className: "mx-select", value: systemForm.status, onChange: (e) => setSystemForm((p) => ({ ...p, status: e.target.value })) }, ["Active", "Maintenance", "Coming Soon", "Hidden"].map((status) => /* @__PURE__ */ React.createElement("option", { key: status, value: status }, status)))), /* @__PURE__ */ React.createElement("label", { className: "flex items-center gap-2 rounded-lg border border-[var(--mx-line)] bg-[var(--mx-panel)] px-3 py-3 text-sm font-bold" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: systemForm.visibleToAll, onChange: (e) => setSystemForm((p) => ({ ...p, visibleToAll: e.target.checked })) }), /* @__PURE__ */ React.createElement("span", null, "Visible to all users")), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold mb-3" }, "Allowed Roles"), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-2" }, ROLE_OPTIONS.map((role) => /* @__PURE__ */ React.createElement("label", { key: role.value, className: "flex items-center gap-2 text-sm font-bold" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: normalizeList(systemForm.allowedRoles).includes(role.value), onChange: () => toggleSystemRole(role.value) }), /* @__PURE__ */ React.createElement("span", null, role.label))))), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold mb-3" }, "Allowed Teams"), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto" }, teams.map((team) => {
      const teamName = team.name || "";
      return /* @__PURE__ */ React.createElement("label", { key: team.id || teamName, className: "flex items-center gap-2 text-sm font-bold" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: normalizeList(systemForm.allowedTeams).includes(teamName), onChange: () => toggleSystemTeam(teamName) }), /* @__PURE__ */ React.createElement("span", { className: "truncate" }, teamName));
    }), teams.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E17\u0E35\u0E21"))), /* @__PURE__ */ React.createElement("textarea", { className: "mx-textarea min-h-[70px]", placeholder: "Allowed Emp IDs \u0E04\u0E31\u0E48\u0E19\u0E14\u0E49\u0E27\u0E22 comma \u0E40\u0E0A\u0E48\u0E19 EMP001, EMP002", value: systemForm.allowedEmpIds, onChange: (e) => setSystemForm((p) => ({ ...p, allowedEmpIds: e.target.value })) }), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary", onClick: saveSystem, disabled: saving === "systems" }, saving === "systems" ? "Saving..." : "Save System"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft", onClick: () => setSystemForm(emptySystemForm) }, "Clear")))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(Panel, { title: "Systems Registry", subtitle: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E23\u0E30\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E41\u0E2A\u0E14\u0E07\u0E43\u0E2B\u0E49\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, filteredSystems.map((system) => /* @__PURE__ */ React.createElement("div", { key: system.id, className: "mx-data-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${system.icon} text-[var(--mx-accent)]` }), /* @__PURE__ */ React.createElement("div", { className: "font-extrabold truncate" }, system.name)), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, system.description || "-"), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, system.status), system.visibleToAll && /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, "All users"), system.allowedRoles.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, system.allowedRoles.length, " roles"), system.allowedTeams.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, system.allowedTeams.length, " teams"), system.allowedEmpIds.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-cancelled" }, system.allowedEmpIds.length, " emp"))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => editSystem(system) }, "\u0E41\u0E01\u0E49\u0E44\u0E02"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => duplicateSystem(system) }, "Duplicate"), /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3", onClick: () => removeSystem(system.id) }, "\u0E25\u0E1A"))))), filteredSystems.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E30\u0E1A\u0E1A\u0E07\u0E32\u0E19"))), /* @__PURE__ */ React.createElement(Panel, { title: "Preview As User", subtitle: "\u0E43\u0E2A\u0E48 Emp ID \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E14\u0E39\u0E27\u0E48\u0E32\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E19\u0E31\u0E49\u0E19\u0E08\u0E30\u0E40\u0E2B\u0E47\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E2D\u0E30\u0E44\u0E23" }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-3" }, /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "EMP ID", value: previewEmpId, onChange: (e) => setPreviewEmpId(e.target.value.toUpperCase()) }), previewUser ? /* @__PURE__ */ React.createElement("div", { className: "grid gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, previewUser.name, " / ", roleLabel(previewUser.role), " / ", previewUser.team), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, previewSystems.map((system) => /* @__PURE__ */ React.createElement("span", { key: system.id, className: "mx-badge mx-status-process" }, system.name)), previewSystems.length === 0 && /* @__PURE__ */ React.createElement("span", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E30\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E44\u0E14\u0E49"))) : /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E23\u0E2D\u0E01 Emp ID \u0E17\u0E35\u0E48\u0E21\u0E35\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A")))));
    const AdminOverview = () => {
      const setupItems = [
        { id: "users", label: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C", value: staff.length, icon: "fa-users-gear", detail: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1A\u0E31\u0E0D\u0E0A\u0E35 \u0E1A\u0E17\u0E1A\u0E32\u0E17 \u0E17\u0E35\u0E21 \u0E41\u0E25\u0E30 scope" },
        { id: "systems", label: "Systems", value: normalizedSystemLinks.length, icon: "fa-table-cells-large", detail: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E23\u0E30\u0E1A\u0E1A\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E01\u0E32\u0E23\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19" },
        { id: "teams", label: "\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19", value: teams.length, icon: "fa-people-group", detail: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E17\u0E35\u0E21\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30 KPI" },
        { id: "kpi", label: "\u0E01\u0E0E KPI/SLA", value: kpis.length, icon: "fa-scale-balanced", detail: "\u0E01\u0E33\u0E2B\u0E19\u0E14 SLA days \u0E41\u0E25\u0E30\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01 KPI" },
        { id: "calendar", label: "\u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 SLA", value: holidays.length, icon: "fa-calendar-days", detail: "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14\u0E41\u0E25\u0E30 recalculation" },
        { id: "audit", label: "\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02", value: logs.length, icon: "fa-shield-halved", detail: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A action \u0E17\u0E35\u0E48\u0E40\u0E01\u0E34\u0E14\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" }
      ];
      return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "mx-grid-auto" }, /* @__PURE__ */ React.createElement(MetricCard, { label: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49", value: staff.length, sub: "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A", icon: "fa-users" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "\u0E17\u0E35\u0E21", value: teams.length, sub: "\u0E01\u0E25\u0E38\u0E48\u0E21\u0E07\u0E32\u0E19\u0E1B\u0E0F\u0E34\u0E1A\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23", icon: "fa-people-group", accent: "var(--mx-teal)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "\u0E01\u0E0E KPI/SLA", value: kpis.length, sub: "\u0E27\u0E31\u0E19 SLA \u0E41\u0E25\u0E30\u0E19\u0E49\u0E33\u0E2B\u0E19\u0E31\u0E01\u0E04\u0E30\u0E41\u0E19\u0E19", icon: "fa-scale-balanced", accent: "var(--mx-indigo)" }), /* @__PURE__ */ React.createElement(MetricCard, { label: "\u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14", value: holidays.length, sub: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 SLA", icon: "fa-calendar-days", accent: "var(--mx-amber)" })), /* @__PURE__ */ React.createElement(Panel, { title: "\u0E17\u0E32\u0E07\u0E25\u0E31\u0E14\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E30\u0E1A\u0E1A", subtitle: "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2B\u0E21\u0E27\u0E14\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E41\u0E22\u0E01\u0E07\u0E32\u0E19 setup, SLA \u0E41\u0E25\u0E30 audit \u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E01\u0E31\u0E19\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-2 xl:grid-cols-3 gap-3" }, setupItems.map((item) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: item.id,
          className: "mx-data-card text-left hover:border-[var(--mx-accent)] transition-colors",
          onClick: () => setAdminSection(item.id)
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-extrabold" }, item.label), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, item.detail)), /* @__PURE__ */ React.createElement("span", { className: "w-10 h-10 rounded-lg grid place-items-center bg-[var(--mx-surface)] border border-[var(--mx-line)]" }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${item.icon} text-[var(--mx-accent)]` }))),
        /* @__PURE__ */ React.createElement("div", { className: "mt-4 text-2xl font-extrabold" }, formatNumber(item.value))
      )))), /* @__PURE__ */ React.createElement(Panel, { title: "\u0E01\u0E15\u0E34\u0E01\u0E32\u0E01\u0E32\u0E23\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E23\u0E30\u0E1A\u0E1A", subtitle: "Admin \u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E30\u0E1A\u0E1A\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E1C\u0E48\u0E32\u0E19 UI \u0E41\u0E25\u0E30 API \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19" }, /* @__PURE__ */ React.createElement("div", { className: "grid md:grid-cols-3 gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "\u0E44\u0E21\u0E48\u0E41\u0E15\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E14\u0E34\u0E1A"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, "\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49 master data \u0E41\u0E25\u0E30\u0E07\u0E32\u0E19\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E33\u0E1C\u0E48\u0E32\u0E19 System Control")), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "Recalculate \u0E2D\u0E22\u0E39\u0E48\u0E01\u0E31\u0E1A SLA"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13 deadline \u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E01\u0E0E KPI/SLA \u0E41\u0E25\u0E30\u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 SLA \u0E41\u0E25\u0E49\u0E27")), /* @__PURE__ */ React.createElement("div", { className: "mx-muted-card rounded-lg p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "Audit \u0E41\u0E22\u0E01\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-sm text-[var(--mx-muted)]" }, "\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E2B\u0E21\u0E27\u0E14\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E25\u0E14\u0E04\u0E27\u0E32\u0E21\u0E0B\u0E49\u0E33\u0E0B\u0E49\u0E2D\u0E19")))));
    };
    return /* @__PURE__ */ React.createElement("div", { className: "grid gap-5" }, /* @__PURE__ */ React.createElement(
      Panel,
      {
        title: ((_a = sectionItems.find((item) => item.id === adminSection)) == null ? void 0 : _a.label) || "System Control",
        subtitle: "\u0E17\u0E38\u0E01\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02\u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E41\u0E25\u0E30 API \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E41\u0E01\u0E49\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07",
        actions: [
          /* @__PURE__ */ React.createElement("button", { key: "refresh", className: "mx-btn mx-btn-soft", onClick: onRefresh, disabled: !!saving }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-arrows-rotate mr-2" }), "Refresh")
        ]
      },
      /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-[1fr_360px] gap-4 lg:items-center" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold" }, "\u0E01\u0E15\u0E34\u0E01\u0E32\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E23\u0E30\u0E1A\u0E1A"), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-sm text-[var(--mx-muted)]" }, "\u0E2B\u0E49\u0E32\u0E21\u0E41\u0E01\u0E49\u0E10\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07 \u0E01\u0E32\u0E23\u0E41\u0E01\u0E49 master data, \u0E01\u0E0E SLA, \u0E1B\u0E0F\u0E34\u0E17\u0E34\u0E19 \u0E41\u0E25\u0E30\u0E07\u0E32\u0E19\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E07\u0E1C\u0E48\u0E32\u0E19 System Control \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19")), /* @__PURE__ */ React.createElement("input", { className: "mx-input", placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E43\u0E19\u0E2B\u0E21\u0E27\u0E14\u0E19\u0E35\u0E49...", value: adminSearch, onChange: (e) => setAdminSearch(e.target.value) }))
    ), adminSection === "overview" && AdminOverview(), adminSection === "users" && /* @__PURE__ */ React.createElement("div", { className: "grid xl:grid-cols-[0.85fr_1.15fr] gap-5" }, UserEditor(), UsersList()), adminSection === "systems" && SystemsControls(), adminSection === "teams" && TeamControls(), adminSection === "kpi" && KpiControls(), adminSection === "calendar" && CalendarControls(), adminSection === "audit" && AuditPanel());
  }
  function App() {
    var _a, _b;
    const [user, setUser] = useState(() => {
      safeLocalRemove(SESSION_KEY);
      return parseJsonSafe(safeSessionGet(SESSION_KEY), null);
    });
    const [theme, setTheme] = useState(() => safeLocalGet(THEME_KEY) || "light");
    const [view, setView] = useState(() => {
      const saved = parseJsonSafe(safeSessionGet(SESSION_KEY), null);
      return ROLE_HOME[saved == null ? void 0 : saved.role] || "dashboard";
    });
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [showNotif, setShowNotif] = useState(false);
    const [showDashboardCreate, setShowDashboardCreate] = useState(false);
    const [adminSection, setAdminSection] = useState("overview");
    const [systemLinks, setSystemLinks] = useState(loadSystemLinks);
    const {
      state,
      filterMonth,
      setFilterMonth,
      filterYear,
      setFilterYear,
      reloadDashboard,
      reloadTasks,
      reloadPeople,
      reloadAdmin
    } = useAppData(user, view);
    useEffect(() => {
      document.documentElement.dataset.theme = theme;
      safeLocalSet(THEME_KEY, theme);
    }, [theme]);
    useEffect(() => {
      if (!user) return void 0;
      let cancelled = false;
      fetchSystemLinksFromApi(user).then((links) => {
        if (cancelled) return;
        const normalized = cacheSystemLinks(links);
        setSystemLinks(normalized);
      }).catch(() => {
        if (!cancelled) setSystemLinks(loadSystemLinks());
      });
      return () => {
        cancelled = true;
      };
    }, [user]);
    const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");
    const availableYears = useMemo(() => {
      const y = (/* @__PURE__ */ new Date()).getFullYear();
      const years = [];
      for (let i = y - 3; i <= y + 1; i++) years.push(i);
      return years;
    }, []);
    const notifications = useMemo(() => {
      if (!state.tasks || !state.tasks.length) return [];
      const holidaySet = buildHolidaySet(state.holidays || []);
      const result = [];
      state.tasks.forEach((task) => {
        var _a2;
        const st = (task.status || "").toLowerCase();
        if (st === "pending") {
          result.push({
            id: `pending-${task.id}`,
            type: "pending",
            icon: "fa-circle-exclamation",
            color: "#f59e0b",
            message: `Pending: ${(task.job || "").substring(0, 35)}${((_a2 = task.job) == null ? void 0 : _a2.length) > 35 ? "..." : ""}`
          });
        }
        if (["on process", "pending", "on hold"].includes(st) && task.deadline) {
          const daysLeft = getDaysUntilDeadline(task, holidaySet);
          if (daysLeft === null) return;
          if (daysLeft < 0) {
            result.push({
              id: `overdue-${task.id}`,
              type: "overdue",
              icon: "fa-triangle-exclamation",
              color: "#ef4444",
              message: `\u0E40\u0E01\u0E34\u0E19 deadline ${Math.abs(daysLeft)} \u0E27\u0E31\u0E19\u0E17\u0E33\u0E01\u0E32\u0E23: ${(task.job || "").substring(0, 28)}`
            });
          } else if (daysLeft <= 3) {
            result.push({
              id: `deadline-${task.id}`,
              type: "deadline",
              icon: "fa-clock",
              color: "#f59e0b",
              message: `\u0E2D\u0E35\u0E01 ${daysLeft} \u0E27\u0E31\u0E19\u0E17\u0E33\u0E01\u0E32\u0E23: ${(task.job || "").substring(0, 30)}`
            });
          }
        }
      });
      return result;
    }, [state.tasks, state.holidays]);
    useEffect(() => {
      if (!user) {
        safeSessionRemove(SESSION_KEY);
        return;
      }
      if (isSessionSuperseded(user)) {
        safeSessionRemove(SESSION_KEY);
        setUser(null);
        setView("dashboard");
        setLoginError("\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E2D\u0E37\u0E48\u0E19 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E36\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34");
        return;
      }
      safeSessionSet(SESSION_KEY, JSON.stringify(user));
      writeActiveSessionLock(user);
    }, [user]);
    useEffect(() => {
      if (!user) return void 0;
      const forceLogoutIfSuperseded = () => {
        if (!isSessionSuperseded(user)) return false;
        safeSessionRemove(SESSION_KEY);
        setUser(null);
        setView("dashboard");
        setLoginError("\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E2D\u0E37\u0E48\u0E19 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E36\u0E07\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34");
        return true;
      };
      if (forceLogoutIfSuperseded()) return void 0;
      writeActiveSessionLock(user);
      const timer = setInterval(() => {
        if (!forceLogoutIfSuperseded()) writeActiveSessionLock(user);
      }, 15e3);
      const handleStorage = (event) => {
        if (event.key === SESSION_LOCK_KEY) forceLogoutIfSuperseded();
      };
      const handleBeforeUnload = () => clearActiveSessionLock();
      window.addEventListener("storage", handleStorage);
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        clearInterval(timer);
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }, [user]);
    const handleLogin = async (empId) => {
      const cleanEmpId = empId == null ? void 0 : empId.trim();
      if (!cleanEmpId) {
        setLoginError("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E2B\u0E31\u0E2A\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19");
        return;
      }
      setLoginLoading(true);
      setLoginError("");
      try {
        const res = await API.getInitialData(cleanEmpId);
        if (res == null ? void 0 : res.error) throw new Error(res.error);
        if (!(res == null ? void 0 : res.user)) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19");
        const nextUser = { ...res.user, kpis: res.kpis || [] };
        writeActiveSessionLock(nextUser);
        setUser(nextUser);
        setView(ROLE_HOME[nextUser.role] || "dashboard");
      } catch (e) {
        setLoginError(e.message || "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setLoginLoading(false);
      }
    };
    const logout = () => {
      clearActiveSessionLock();
      safeSessionRemove(SESSION_KEY);
      setUser(null);
      setView("dashboard");
      setLoginError("");
    };
    const handleAccept = async (task) => {
      setActionLoading(true);
      try {
        await API.acceptTask(task.id, task.team);
        await reloadTasks();
        await reloadDashboard();
      } catch (e) {
        alert(e.message || "\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setActionLoading(false);
      }
    };
    const handleStatusChange = async (task, status, note = "", mode = "normal") => {
      setActionLoading(true);
      try {
        const holdUpdate = mode === "note_only" ? null : buildHoldExtraData(task, status, state.holidays || [], user.name);
        if (mode === "note_only") {
          await API.updateTaskStatus(task.id, task.team, task.status, note, "append");
        } else if (user.role === "Staff") {
          await API.updateTaskStatus(task.id, task.team, status, note, "append");
        } else {
          await API.updateTaskStatusWithLog(task.id, task.team, status, note, user.name);
        }
        if (holdUpdate == null ? void 0 : holdUpdate.changed) {
          await API.updateTaskDetails({
            id: task.id,
            team: task.team,
            job: task.job,
            subkpi: task.subkpi,
            mainkpi: task.mainkpi,
            deadline: holdUpdate.deadline || task.deadline,
            extra_data: holdUpdate.extraData
          });
        }
        await reloadTasks();
        await reloadDashboard();
      } catch (e) {
        alert(e.message || "\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setActionLoading(false);
      }
    };
    const handleDelete = async (task) => {
      if (!window.confirm(`\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E07\u0E32\u0E19 "${(task.job || "").substring(0, 40)}"?`)) return;
      setActionLoading(true);
      try {
        await API.deleteTask(task.id, task.team, user.name);
        await reloadTasks();
        await reloadDashboard();
      } catch (e) {
        alert(e.message || "\u0E25\u0E1A\u0E07\u0E32\u0E19\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } finally {
        setActionLoading(false);
      }
    };
    const downloadCSV = () => {
      const src = state.tasks || [];
      if (src.length === 0) return alert("\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A export");
      const headers = ["\u0E25\u0E33\u0E14\u0E31\u0E1A", "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E07\u0E32\u0E19", "Main KPI", "Sub KPI", "\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E1C\u0E34\u0E14\u0E0A\u0E2D\u0E1A", "\u0E17\u0E35\u0E21", "\u0E2A\u0E16\u0E32\u0E19\u0E30", "\u0E27\u0E31\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19", "Deadline", "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08", "\u0E1C\u0E25"];
      const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
      const rows = src.map((t, i) => {
        const dl = t.deadline ? new Date(t.deadline) : null;
        const cp = t.completiondate ? new Date(t.completiondate) : null;
        const onTime = t.status === "Completed" && dl && cp && cp <= dl;
        return [
          i + 1,
          esc(t.job),
          esc(t.mainkpi),
          esc(t.subkpi),
          esc(t.name),
          esc(t.team),
          esc(t.status),
          esc(formatDate(t.startdate)),
          esc(formatDate(t.deadline)),
          esc(formatDate(t.completiondate)),
          t.status === "Completed" ? onTime ? "\u0E15\u0E23\u0E07\u0E40\u0E27\u0E25\u0E32" : "\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14" : "-"
        ].join(",");
      });
      const period = filterMonth === 0 ? `all_${filterYear}` : `${filterMonth}_${filterYear}`;
      const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
    const handleNavigate = (nextView) => {
      if (nextView === "create" && ["dashboard", "my-dashboard"].includes(view) && ["Staff", "Lead"].includes(user.role)) {
        setShowDashboardCreate(true);
        return;
      }
      setView(nextView);
    };
    const openExecutiveView = () => {
      const executiveUrl = new URL("/dashboard", window.location.origin);
      executiveUrl.searchParams.set("empId", user.empId || user.empid || "");
      executiveUrl.searchParams.set("month", String(filterMonth));
      executiveUrl.searchParams.set("year", String(filterYear));
      window.open(executiveUrl.toString(), "_blank", "noopener,noreferrer");
    };
    if (!user) {
      return /* @__PURE__ */ React.createElement(LoginScreenPro, { onLogin: handleLogin, loading: loginLoading, error: loginError, theme, onToggleTheme: toggleTheme });
    }
    const showFilterBar = ["executive", "dashboard", "tasks", "my-dashboard", "my-tasks"].includes(view);
    const peopleForAssign = ((_a = state.people) == null ? void 0 : _a.length) ? state.people : ((_b = state.admin) == null ? void 0 : _b.staff) || [];
    const personalWorkUser = user.role === "Lead" ? { ...user, role: "Staff" } : user;
    const currentRoleLabel = roleLabel(user.role);
    const currentScopeLabel = roleScope(user);
    const pageTitle = view === "executive" ? "Executive View" : view === "my-dashboard" ? "My Dashboard" : view === "my-tasks" ? "My Tasks" : view === "dashboard" ? isStrategicViewRole(user.role) ? "Strategic Performance Dashboard" : user.role === "Manager" ? "Executive Dashboard" : user.role === "Lead" ? "Team Command Center" : isAdminRole(user.role) ? "System Control Center" : "My Work Dashboard" : view === "tasks" ? "Task Center" : view === "create" ? "Create Task" : view === "assign" ? "Assignment Center" : view === "people" ? "People Overview" : view === "tracker" ? "Job Tracker" : view === "systems" ? "Systems" : view === "admin" ? "\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E23\u0E30\u0E1A\u0E1A" : APP_NAME;
    const pageSubtitle = view === "executive" ? "Board-ready view for SLA risk, weighted KPI health, team performance, and critical work." : view === "my-dashboard" ? "\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A Lead \u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E2B\u0E21\u0E37\u0E2D\u0E19 Staff: KPI, SLA, \u0E07\u0E32\u0E19\u0E04\u0E49\u0E32\u0E07 \u0E41\u0E25\u0E30 action \u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19" : view === "my-tasks" ? "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07 \u0E1E\u0E23\u0E49\u0E2D\u0E21 action \u0E41\u0E1A\u0E1A\u0E1C\u0E39\u0E49\u0E1B\u0E0F\u0E34\u0E1A\u0E31\u0E15\u0E34\u0E07\u0E32\u0E19" : view === "dashboard" ? "KPI, SLA, \u0E07\u0E32\u0E19\u0E04\u0E49\u0E32\u0E07 \u0E41\u0E25\u0E30\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01" : view === "tasks" ? "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19 \u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E2A\u0E16\u0E32\u0E19\u0E30 \u0E41\u0E25\u0E30\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A SLA" : view === "tracker" ? "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E41\u0E25\u0E30\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E07\u0E32\u0E19\u0E08\u0E32\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E07\u0E32\u0E19" : view === "systems" ? "\u0E23\u0E30\u0E1A\u0E1A\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 \u0E01\u0E14\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E30\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E02\u0E49\u0E2D\u0E07\u0E44\u0E14\u0E49\u0E08\u0E32\u0E01\u0E17\u0E35\u0E48\u0E40\u0E14\u0E35\u0E22\u0E27" : view === "admin" ? "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 \u0E17\u0E35\u0E21 KPI/SLA \u0E27\u0E31\u0E19\u0E2B\u0E22\u0E38\u0E14 \u0E07\u0E32\u0E19\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A \u0E41\u0E25\u0E30 audit log \u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E14\u0E35\u0E22\u0E27" : "\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E07\u0E32\u0E19\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E02\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E1A\u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13";
    const activePeriodLabel = showFilterBar ? `${filterMonth === 0 ? "\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19" : MONTH_NAMES[filterMonth - 1]} ${filterYear}` : user.team;
    return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen p-4 md:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[1640px] mx-auto grid xl:grid-cols-[320px_1fr] gap-5 items-start" }, /* @__PURE__ */ React.createElement(
      Sidebar,
      {
        user,
        view,
        setView,
        onLogout: logout,
        notifCount: notifications.length,
        adminSection,
        setAdminSection
      }
    ), /* @__PURE__ */ React.createElement("main", { className: "grid content-start gap-5" }, /* @__PURE__ */ React.createElement("header", { className: "mx-shell-card overflow-visible" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-5 md:px-6 md:py-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement(BrandPill, { className: "px-3 py-2 text-[11px] tracking-[0.16em]" }), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-process" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-user" }), currentRoleLabel), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-pending" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-layer-group" }), currentScopeLabel), /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-completed" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-building-user" }), user.team)), /* @__PURE__ */ React.createElement("h1", { className: "mt-4 mb-0 text-[30px] md:text-[38px] leading-tight font-extrabold tracking-normal" }, pageTitle), /* @__PURE__ */ React.createElement("p", { className: "mt-2 mb-0 max-w-[64ch] text-sm md:text-[15px] leading-6 text-[var(--mx-muted)]" }, pageSubtitle)), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center xl:justify-end gap-2" }, canOpenExecutiveView(user.role) && /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-primary !py-2 inline-flex items-center gap-2", onClick: openExecutiveView, title: "Open Executive View" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-display" }), /* @__PURE__ */ React.createElement("span", null, "Executive View")), /* @__PURE__ */ React.createElement(ThemeToggle, { theme, onToggle: toggleTheme }), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2 !px-3 relative", onClick: () => setShowNotif((v) => !v), title: "Notifications", "aria-label": "Notifications" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-bell" }), notifications.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center" }, notifications.length > 9 ? "9+" : notifications.length)), showNotif && /* @__PURE__ */ React.createElement("div", { className: "absolute right-0 top-12 z-40 w-80 mx-shell-card rounded-[20px] p-4 shadow-2xl border border-[rgba(255,255,255,0.08)]" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-extrabold mb-3 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", null, "\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19"), /* @__PURE__ */ React.createElement("button", { className: "text-[var(--mx-muted)] hover:text-[var(--mx-text)]", onClick: () => setShowNotif(false) }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-xmark" }))), notifications.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-[var(--mx-muted)]" }, "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19"), /* @__PURE__ */ React.createElement("div", { className: "grid gap-2 max-h-72 overflow-y-auto" }, notifications.slice(0, 10).map((n) => /* @__PURE__ */ React.createElement("div", { key: n.id, className: "rounded-[14px] p-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-2 text-sm" }, /* @__PURE__ */ React.createElement("i", { className: `fa-solid ${n.icon} mt-0.5 flex-shrink-0`, style: { color: n.color } }), /* @__PURE__ */ React.createElement("span", null, n.message))))))), ["tasks", "my-tasks"].includes(view) && state.tasks.length > 0 && /* @__PURE__ */ React.createElement("button", { className: "mx-btn mx-btn-soft !py-2", onClick: downloadCSV, title: "Export CSV" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-file-csv mr-1" }), "CSV"), (state.loading || actionLoading) && /* @__PURE__ */ React.createElement("span", { className: "mx-badge mx-status-pending" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-rotate-right fa-spin" }), "Loading")))), /* @__PURE__ */ React.createElement("div", { className: "border-t border-[var(--mx-line)] bg-[var(--mx-surface)] px-5 py-3 md:px-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 text-sm text-[var(--mx-muted)]" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-lg mx-brand-mark grid place-items-center" }, /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-calendar-check text-[var(--mx-accent)]" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] uppercase tracking-[0.14em] font-extrabold" }, "Current Scope"), /* @__PURE__ */ React.createElement("div", { className: "mt-0.5 text-[var(--mx-text)] font-bold" }, activePeriodLabel))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, showFilterBar && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "mx-select !w-[160px] !py-2 !text-sm",
        value: filterMonth,
        onChange: (e) => setFilterMonth(Number(e.target.value))
      },
      /* @__PURE__ */ React.createElement("option", { value: 0 }, "\u0E17\u0E38\u0E01\u0E40\u0E14\u0E37\u0E2D\u0E19"),
      MONTH_NAMES.map((name, i) => /* @__PURE__ */ React.createElement("option", { key: i + 1, value: i + 1 }, name))
    ), /* @__PURE__ */ React.createElement(
      "select",
      {
        className: "mx-select !w-[116px] !py-2 !text-sm",
        value: filterYear,
        onChange: (e) => setFilterYear(Number(e.target.value))
      },
      availableYears.map((y) => /* @__PURE__ */ React.createElement("option", { key: y, value: y }, y))
    ))))), state.error && /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-4 md:px-6 text-sm text-[#ffb7b7] font-bold" }, state.error)), showDashboardCreate && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", style: { background: "rgba(15, 23, 42, 0.56)" } }, /* @__PURE__ */ React.createElement("div", { className: "relative w-full max-w-3xl max-h-[92vh] overflow-y-auto" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "mx-btn mx-btn-soft !p-0 absolute right-4 top-4 z-10 w-10 h-10 grid place-items-center",
        onClick: () => setShowDashboardCreate(false),
        "aria-label": "Close create task popup",
        title: "Close"
      },
      /* @__PURE__ */ React.createElement("i", { className: "fa-solid fa-xmark" })
    ), /* @__PURE__ */ React.createElement(
      QuickCreateView,
      {
        user,
        people: peopleForAssign,
        mode: "personal",
        onSaved: () => {
          reloadTasks();
          reloadDashboard();
          setShowDashboardCreate(false);
        }
      }
    ))), view === "executive" && /* @__PURE__ */ React.createElement(
      ExecutiveView,
      {
        data: state.dashboard,
        filterMonth,
        filterYear,
        holidays: state.holidays,
        onNavigate: handleNavigate
      }
    ), view === "dashboard" && /* @__PURE__ */ React.createElement(
      DashboardView,
      {
        user,
        data: state.dashboard,
        filterMonth,
        filterYear,
        holidays: state.holidays,
        onAccept: handleAccept,
        onStatusChange: handleStatusChange,
        onNavigate: handleNavigate
      }
    ), view === "my-dashboard" && /* @__PURE__ */ React.createElement(
      DashboardView,
      {
        user: personalWorkUser,
        data: state.dashboard,
        filterMonth,
        filterYear,
        holidays: state.holidays,
        onAccept: handleAccept,
        onStatusChange: handleStatusChange,
        onNavigate: handleNavigate
      }
    ), view === "tasks" && /* @__PURE__ */ React.createElement(
      TaskCenterView,
      {
        user,
        tasks: state.tasks,
        holidays: state.holidays,
        onAccept: handleAccept,
        onStatusChange: handleStatusChange,
        onDelete: handleDelete,
        onRefresh: reloadTasks
      }
    ), view === "my-tasks" && /* @__PURE__ */ React.createElement(
      TaskCenterView,
      {
        user: personalWorkUser,
        tasks: state.tasks,
        holidays: state.holidays,
        onAccept: handleAccept,
        onStatusChange: handleStatusChange,
        onDelete: handleDelete,
        onRefresh: reloadTasks
      }
    ), view === "create" && /* @__PURE__ */ React.createElement(QuickCreateView, { user, people: peopleForAssign, mode: "personal", onSaved: () => {
      reloadTasks();
      reloadDashboard();
    } }), view === "assign" && /* @__PURE__ */ React.createElement(QuickCreateView, { user, people: peopleForAssign, mode: "assign", onSaved: () => {
      reloadTasks();
      reloadDashboard();
      reloadPeople();
    } }), view === "people" && /* @__PURE__ */ React.createElement(PeopleView, { user, people: state.people, onRefresh: reloadPeople }), view === "tracker" && /* @__PURE__ */ React.createElement(TrackerViewNew, null), view === "systems" && /* @__PURE__ */ React.createElement(SystemsView, { user, systemLinks }), view === "admin" && /* @__PURE__ */ React.createElement(
      AdminStudio,
      {
        user,
        adminData: state.admin,
        systemLinks,
        onSystemLinksChange: setSystemLinks,
        onRefresh: reloadAdmin,
        adminSection,
        setAdminSection
      }
    ))));
  }
  const _root = ReactDOM.createRoot(document.getElementById("root"));
  _root.render(/* @__PURE__ */ React.createElement(App, null));
})();
