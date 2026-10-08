import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import worker, { validateServerSession, auditPayload, writeAudit, SESSION_VALIDATION_TTL_MS, SESSION_TOUCH_INTERVAL_MS } from "../public/_worker.js";

let fixtureId = 0;
async function fixture(run) {
  const realFetch = globalThis.fetch;
  const RealDate = globalThis.Date;
  const realWarn = console.warn;
  let now = RealDate.now();
  class Clock extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  globalThis.Date = Clock;
  const user = { empid: "EMP001", name: "Test", team: "Test", role: "Staff", active_session_id: "session-1", active_session_updated_at: new Clock().toISOString(), active_session_expires_at: new Clock(now + 8 * 3600000).toISOString() };
  const task = { id: "task-1", job: "Job", name: "Test", team: "Test", empid: "EMP001", status: "On Process", note: "", extra_data: {}, deadline: "2026-10-20", startdate: "2026-10-08", created_at: new Clock().toISOString() };
  const calls = [];
  const warnings = [];
  const state = { auditFails: false, takeoverOnTouch: false, touchFails: false, holidays: [] };
  console.warn = (value) => warnings.push(JSON.parse(value));
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    const table = url.pathname.split("/").pop();
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ table, method, body, query: url.searchParams });
    if (method === "GET") {
      return Response.json(table === "users" ? [user] : table === "tasks" ? [task] : table === "holidays" ? state.holidays : []);
    }
    if (table === "audit_log") {
      if (state.auditFails) return Response.json({ code: "PGRST204", message: "secret-bearing upstream message" }, { status: 400 });
      assert.deepEqual(Object.keys(body).sort(), ["action", "by_user", "details", "taskid", "timestamp"]);
      assert.equal(typeof body.details, "string");
      return new Response(null, { status: 201 });
    }
    if (table === "users") {
      if (state.touchFails) return Response.json({ code: "PGRST000" }, { status: 400 });
      if (state.takeoverOnTouch) user.active_session_id = "replacement-session";
      const expected = url.searchParams.get("active_session_id");
      if (!expected || expected === `eq.${user.active_session_id}`) Object.assign(user, body);
      return new Response(null, { status: 204 });
    }
    if (table === "holidays") { state.holidays = [body]; return Response.json(state.holidays); }
    return Response.json(Array.isArray(body) ? body : [{ ...task, ...body }]);
  };
  const env = { SUPABASE_URL: `https://fixture-${++fixtureId}.invalid`, SUPABASE_SERVICE_ROLE_KEY: "fixture-only" };
  const request = (path = "session/heartbeat", body, id = "session-1") => new Request(`https://app.invalid/api/${path}`, {
    method: body ? "POST" : "GET", headers: { "x-session-empid": "EMP001", "x-session-id": id, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try { await run({ env, user, task, calls, warnings, state, request, advance: (ms) => { now += ms; } }); }
  finally { globalThis.fetch = realFetch; globalThis.Date = RealDate; console.warn = realWarn; }
}

async function test(name, run) {
  await fixture(run);
  console.log(`ok - ${name}`);
}

await test("Concurrent session burst shares one authoritative read and no activity writes", async ({ env, calls, request }) => {
  const results = await Promise.all(Array.from({ length: 20 }, () => validateServerSession(request(), env)));
  assert.ok(results.every((result) => result.ok && result.enforced));
  assert.equal(calls.filter((call) => call.table === "users" && call.query.has("empid")).length, 1);
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 0);
});

await test("Session cache expires, touch is throttled, and takeover is rejected after 30 seconds", async ({ env, user, calls, request, advance }) => {
  await validateServerSession(request(), env);
  advance(SESSION_VALIDATION_TTL_MS + 1);
  await validateServerSession(request(), env);
  assert.equal(calls.filter((call) => call.query.has("empid") && call.method === "GET").length, 2);
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 0);
  advance(SESSION_TOUCH_INTERVAL_MS);
  await Promise.all(Array.from({ length: 20 }, () => validateServerSession(request(), env)));
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
  advance(SESSION_VALIDATION_TTL_MS + 1);
  await validateServerSession(request(), env);
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
  user.active_session_id = "new-session";
  advance(SESSION_VALIDATION_TTL_MS + 1);
  assert.equal((await validateServerSession(request(), env)).code, "SESSION_SUPERSEDED");
});

await test("Wrong, empty, missing and expired sessions are rejected", async ({ env, user, request }) => {
  assert.equal((await validateServerSession(request(undefined, undefined, "wrong"), env)).code, "SESSION_SUPERSEDED");
  assert.equal((await validateServerSession(new Request("https://app.invalid/api/session/heartbeat"), env)).ok, false);
  user.active_session_id = "";
  assert.equal((await validateServerSession(request(), env)).ok, false);
  user.active_session_id = "session-1";
  user.active_session_expires_at = new Date(Date.now() - 1).toISOString();
  assert.equal((await validateServerSession(request(), env)).code, "SESSION_EXPIRED");
  user.active_session_expires_at = "invalid";
  assert.equal((await validateServerSession(request(), env)).code, "SESSION_EXPIRED");
});

await test("Cached validation never outlives authoritative session expiry", async ({ env, user, request, advance }) => {
  user.active_session_expires_at = new Date(Date.now() + 1000).toISOString();
  assert.equal((await validateServerSession(request(), env)).ok, true);
  // Simulate revocation at the original expiry after the touch.
  user.active_session_expires_at = new Date(Date.now() + 1000).toISOString();
  advance(1001);
  assert.equal((await validateServerSession(request(), env)).code, "SESSION_EXPIRED");
});

await test("Activity touch is conditional on session identity during concurrent takeover", async ({ env, user, calls, request, state, advance }) => {
  advance(SESSION_TOUCH_INTERVAL_MS + 1);
  const originalExpiry = user.active_session_expires_at;
  state.takeoverOnTouch = true;
  await validateServerSession(request(), env);
  const patch = calls.find((call) => call.method === "PATCH");
  assert.equal(patch.query.get("active_session_id"), "eq.session-1");
  assert.equal(user.active_session_expires_at, originalExpiry);
  advance(SESSION_VALIDATION_TTL_MS + 1);
  assert.equal((await validateServerSession(request(), env)).code, "SESSION_SUPERSEDED");
});

await test("Successful login invalidates old cached session immediately and failed persistence fails closed", async ({ env, request, state }) => {
  await validateServerSession(request(), env);
  const login = await worker.fetch(request("getInitialData", { empId: "EMP001", sessionId: "new-session" }), env);
  assert.equal(login.status, 200);
  assert.equal((await validateServerSession(request(), env)).code, "SESSION_SUPERSEDED");
  state.touchFails = true;
  assert.equal((await worker.fetch(request("getInitialData", { empId: "EMP001", sessionId: "third-session" }), env)).status, 500);
});

await test("Audit schema mapping handles text and JSON explicitly with a single insert", async ({ env, calls }) => {
  const event = { taskId: "task-1", action: "update_task", changedBy: "Test", details: { status: "Completed" } };
  assert.equal(auditPayload(event).by_user, "Test");
  assert.deepEqual(JSON.parse(auditPayload(event).details), event.details);
  assert.deepEqual(auditPayload(event, "jsonb").details, event.details);
  assert.equal(await writeAudit(env, event), true);
  assert.equal(calls.filter((call) => call.table === "audit_log").length, 1);
});

await test("Task mutation remains successful on one observable audit failure without retries or sensitive logs", async ({ env, request, state, calls, warnings }) => {
  state.auditFails = true;
  const response = await worker.fetch(request("updateTaskDetails", { id: "task-1", job: "Updated", changedBy: "Test" }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).task.job, "Updated");
  assert.equal(calls.filter((call) => call.table === "audit_log").length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].status, 400);
  assert.equal(warnings[0].code, "PGRST204");
  assert.ok(!JSON.stringify(warnings).includes("secret-bearing"));
});

for (const endpoint of ["saveNewTask", "assignNewTask"]) {
  await test(`${endpoint} preserves three jobs in one bulk task insert and one audit insert`, async ({ env, request, calls }) => {
    const response = await worker.fetch(request(endpoint, { jobs: ["Job A", "Job B", "Job C"], empId: "EMP001", team: "Test", name: "Test" }), env);
    assert.equal(response.status, 200);
    const { tasks } = await response.json();
    assert.deepEqual(tasks.map((task) => task.job), ["Job A", "Job B", "Job C"]);
    assert.equal(new Set(tasks.map((task) => task.id)).size, 3);
    assert.equal(calls.filter((call) => call.table === "tasks" && call.method === "POST").length, 1);
    assert.equal(calls.filter((call) => call.table === "audit_log").length, 1);
  });
}

await test("Static reads survive task refreshes and invalidate after an Admin mutation", async ({ env, request, calls }) => {
  await worker.fetch(request("admin/getHolidays"), env);
  await worker.fetch(request("admin/getHolidays"), env);
  assert.equal(calls.filter((call) => call.table === "holidays").length, 1);
  const saved = await worker.fetch(request("admin/saveHoliday", { holiday_date: "2026-10-09", name: "Test" }), env);
  assert.equal(saved.status, 200);
  const before = calls.filter((call) => call.table === "holidays" && call.method === "GET").length;
  const refreshed = await worker.fetch(request("admin/getHolidays"), env);
  assert.equal((await refreshed.json()).holidays[0].holiday_date, "2026-10-09");
  // Recalculation already repopulated the invalidated cache with the newly saved row.
  assert.equal(calls.filter((call) => call.table === "holidays" && call.method === "GET").length, before);
});

const apiCode = fs.readFileSync(new URL("../public/js/api.js", import.meta.url), "utf8");
const browser = { window: {}, console, setTimeout, clearTimeout, URLSearchParams, AbortController };
vm.createContext(browser);
vm.runInContext(apiCode, browser);
const cacheReads = [];
browser.fetch = async (url, options = {}) => {
  cacheReads.push({ url: String(url), method: options.method || "GET" });
  return { ok: true, json: async () => ({ kpis: [], task: { id: "task-1" } }) };
};
await browser.window.API.getKPIsByTeam("Fixture");
await browser.window.API.validateSession();
await browser.window.API.getKPIsByTeam("Fixture");
browser.window.API.invalidateGetCache();
await browser.window.API.getKPIsByTeam("Fixture");
assert.equal(cacheReads.filter((call) => call.url.includes("getKPIsByTeam")).length, 1);
await browser.window.API.saveKpi({ id: "fixture-kpi" });
await browser.window.API.getKPIsByTeam("Fixture");
assert.equal(cacheReads.filter((call) => call.url.includes("getKPIsByTeam")).length, 2);
console.log("ok - Heartbeats and task events preserve static browser caches, Admin writes invalidate them");
let refreshes = 0;
let release;
const listeners = new Map();
const page = { visibilityState: "visible", addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key) };
let tick;
let interval;
let clears = 0;
const timers = { setInterval: (fn, ms) => { tick = fn; interval = ms; return 1; }, clearInterval: () => { clears += 1; } };
const stop = browser.window.startMaxiwaRefreshLoop(() => { refreshes += 1; return new Promise((resolve) => { release = resolve; }); }, false, page, timers);
assert.equal(interval, 30000);
const pending = tick();
await tick();
assert.equal(refreshes, 1);
release(); await pending;
page.visibilityState = "hidden"; await tick();
assert.equal(refreshes, 1);
page.visibilityState = "visible";
const visibleRefresh = listeners.get("visibilitychange")();
assert.equal(refreshes, 2);
release(); await visibleRefresh;
stop(); await tick();
assert.equal(refreshes, 2);
assert.equal(listeners.size, 0);
assert.equal(clears, 1);
browser.window.startMaxiwaRefreshLoop(async () => {}, true, page, timers)();
assert.equal(interval, 60000);
console.log("ok - Refresh loop uses 30/60 seconds, pauses hidden tabs, prevents overlap and cleans up");

// Real subscription callbacks, with a fake Supabase transport: no event loss or stale subscription.
const channels = [];
let removed = 0;
const client = {
  channel: () => {
    const channel = { on: (_type, _filter, fn) => { channel.change = fn; return channel; }, subscribe: (fn) => { channel.status = fn; } };
    channels.push(channel); return channel;
  },
  removeChannel: async () => { removed += 1; },
};
browser.fetch = async () => ({ ok: true, json: async () => ({ url: "https://fixture.invalid", key: "public-fixture" }) });
browser.window.supabase = { createClient: () => client };
const events = [];
const states = [];
const subscribing = browser.window.subscribeToRealtime("tasks", (payload) => events.push(payload), (active) => states.push(active));
await new Promise((resolve) => setTimeout(resolve, 0));
channels[0].status("SUBSCRIBED"); await subscribing;
channels[0].change({ eventType: "INSERT", new: { id: "one" } });
channels[0].change({ eventType: "UPDATE", new: { id: "two" } });
assert.deepEqual(events.map((event) => event.new.id), ["one", "two"]);
channels[0].status("CHANNEL_ERROR"); assert.equal(states.at(-1), false);
channels[0].status("SUBSCRIBED"); assert.equal(states.at(-1), true);
await browser.window.unsubscribeFromRealtime("tasks");
channels[0].change({ new: { id: "stale" } }); assert.equal(events.length, 2);
assert.equal(removed, 1);
const first = browser.window.subscribeToRealtime("tasks", () => {}, () => {});
const second = browser.window.subscribeToRealtime("tasks", () => {}, () => {});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(await first, null);
assert.equal(channels.length, 2);
channels[1].status("SUBSCRIBED"); await second;
await browser.window.unsubscribeFromRealtime("tasks");
const late = browser.window.subscribeToRealtime("tasks", () => {}, () => {});
await browser.window.unsubscribeFromRealtime("tasks");
assert.equal(await late, null);
assert.equal(channels.length, 2);
console.log("ok - Realtime delivers every row, reports disconnect/reconnect, and cancels stale subscriptions");

console.log("All reliability tests passed.");
