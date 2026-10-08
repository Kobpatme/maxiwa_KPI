import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import worker from "../public/_worker.js";

const modulePath = process.env.MAXIWA_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const production = process.argv.includes("--production");
const base = production ? "https://metrixverity.pages.dev" : "http://127.0.0.1:8788";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const exceptions = [];
page.on("pageerror", (error) => exceptions.push(error.message));

const user = { empid: "EMP001", name: "Smoke Fixture", team: "Fixture", role: "Staff", permissions: {}, active_session_id: null, active_session_updated_at: null, active_session_expires_at: null };
const kpi = { id: "fixture-kpi", team: "Fixture", main: "Delivery", sub: "Fixture KPI", days: 2, main_weight: 100 };
const tasks = [];
const writes = [];
const apiRequests = [];
const schemaTask = { id: "schema", empid: "EMP001", name: user.name, team: user.team, job: "", mainkpi: "", subkpi: "", deadline: "", startdate: "", status: "On Process", note: "", extra_data: {}, mainkpiweight: 100, weight: 100, created_at: "", completiondate: null };

if (!production) {
  // Every browser API call is intercepted; synthetic writes never reach production.
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://browser-fixture.invalid");
    const table = url.pathname.split("/").at(-1);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    if (method !== "GET") {
      writes.push({ table, method, body });
      if (table === "users") { Object.assign(user, body); return new Response(null, { status: 204 }); }
      if (table === "tasks" && method === "POST") { tasks.push(...body); return Response.json(body); }
      if (table === "tasks" && method === "PATCH") {
        const task = tasks.find((row) => `eq.${row.id}` === url.searchParams.get("id"));
        Object.assign(task, body); return Response.json([task]);
      }
      return new Response(null, { status: 201 });
    }
    if (table === "users") return Response.json([user]);
    if (table === "kpis") return Response.json([kpi]);
    if (table === "tasks") {
      if (url.searchParams.get("limit") === "1" && !url.searchParams.has("id")) return Response.json([schemaTask]);
      const status = url.searchParams.get("status") || "";
      return Response.json(status.startsWith("in.") ? tasks.filter((task) => task.status === "Completed") : tasks);
    }
    return Response.json([]);
  };
  await context.route("**/api/**", async (route) => {
    const original = route.request();
    const url = new URL(original.url());
    apiRequests.push(url.pathname);
    if (/\/(?:tmd|weather|google)\//.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ weather: null, alerts: [], provinces: [] }) });
    }
    const request = new Request(original.url(), { method: original.method(), headers: original.headers(), ...(original.postData() ? { body: original.postData() } : {}) });
    const response = await worker.fetch(request, { SUPABASE_URL: "https://browser-fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-only" });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
}

try {
  const response = await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.getByPlaceholder("เช่น EMP001").waitFor();
  assert.equal(await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).count(), 1);
  console.log("ok - Homepage renders login controls without JavaScript exceptions");
  if (!production) {
    await page.getByPlaceholder("เช่น EMP001").fill("EMP001");
    await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
    await page.getByRole("button", { name: /Create Task/ }).first().waitFor();
    await page.getByRole("button", { name: /Create Task/ }).first().click();
    await page.getByText("Create Personal Task", { exact: true }).waitFor();
    await page.locator("textarea").first().fill("Job A\nJob B\nJob C");
    const preview = page.waitForResponse((response) => response.url().endsWith("/calculateDeadlinePreview"));
    await page.locator("select").filter({ has: page.locator('option[value="Fixture KPI"]') }).selectOption("Fixture KPI");
    await preview;
    const saved = page.waitForResponse((response) => response.url().endsWith("/saveNewTask"));
    await page.getByRole("button", { name: /Create Task/ }).last().click();
    assert.equal((await saved).status(), 200);
    await page.getByText("บันทึกงานเรียบร้อย", { exact: true }).waitFor();
    assert.equal(tasks.length, 3);
    assert.deepEqual(tasks.map((task) => task.job), ["Job A", "Job B", "Job C"]);
    assert.equal(writes.filter((write) => write.table === "tasks" && write.method === "POST").length, 1);
    assert.equal(writes.filter((write) => write.table === "audit_log").length, 1);
    assert.equal(writes.filter((write) => write.table === "users").length, 1);
    assert.equal(apiRequests.filter((path) => path.endsWith("saveNewTask")).length, 1);
    console.log("ok - Real login and multi-line UI create three tasks through one Worker bulk insert and one audit write");
  } else {
    const realtime = await page.evaluate(async () => {
      const statuses = [];
      const channel = await window.subscribeToRealtime("tasks", () => {}, (_active, status) => statuses.push(status));
      await window.unsubscribeFromRealtime("tasks");
      return { connected: Boolean(channel), statuses };
    });
    console.log(`Production realtime transport: ${JSON.stringify(realtime)} (event delivery also requires tasks publication)`);
  }
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  assert.ok((await page.locator("body").innerText()).length > 30);
  assert.deepEqual(exceptions, []);
  console.log("ok - Dashboard renders without JavaScript exceptions");
} catch (error) {
  console.error((await page.locator("body").innerText()).slice(0, 3500));
  throw error;
} finally { await browser.close(); }
