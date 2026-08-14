import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  activeHolidayDates,
  addWorkingDays,
  bangkokDateKey,
  businessDaysBetween,
  normalizeCompletionDate,
  normalizeThaiHolidayDate,
  normalizeThaiHolidayResponse,
  performanceTaskInPeriod,
  taskInPeriod,
} from "../public/_worker.js";

function loadApiWeightedScores() {
  const code = fs.readFileSync(new URL("../public/js/api.js", import.meta.url), "utf8");
  const sandbox = {
    window: {},
    console,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    URLSearchParams,
    setTimeout,
    clearTimeout,
    AbortController,
    Error,
    Map,
    Promise,
    Date,
    Number,
    String,
    JSON,
    Array,
    Object,
    Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.calcWeightedScores;
}

function loadApiRuntime(fetchImpl, eventSink = [], broadcastSink = []) {
  class TestCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  class TestBroadcastChannel {
    constructor(name) { this.name = name; }
    postMessage(detail) { broadcastSink.push({ name: this.name, detail }); }
    close() {}
  }
  const window = {
    dispatchEvent(event) { eventSink.push(event); },
  };
  const sandbox = {
    window,
    console,
    fetch: fetchImpl,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    AbortController,
    CustomEvent: TestCustomEvent,
    BroadcastChannel: TestBroadcastChannel,
    crypto: { randomUUID: () => "test-source" },
    Error,
    Map,
    Set,
    Promise,
    Date,
    Math,
    Number,
    String,
    JSON,
    Array,
    Object,
    Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL("../public/js/api.js", import.meta.url), "utf8"), sandbox);
  return sandbox.window.API;
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("Bangkok date key respects UTC boundary", () => {
  assert.equal(bangkokDateKey("2026-05-24T18:30:00.000Z"), "2026-05-25");
  assert.equal(bangkokDateKey("2026-05-24T10:00:00.000Z"), "2026-05-24");
  assert.equal(bangkokDateKey("2026-05-24"), "2026-05-24");
});

test("Deadline skips weekends and active holidays", () => {
  assert.equal(addWorkingDays("2026-05-22", 1), "2026-05-25");
  assert.equal(addWorkingDays("2026-05-22", 1, [{ holiday_date: "2026-05-25", is_active: true }]), "2026-05-26");
  assert.equal(addWorkingDays("2026-05-22", 1, [{ holiday_date: "2026-05-25", is_active: "false" }]), "2026-05-25");
});

test("Business days between uses active holiday normalization", () => {
  assert.equal(businessDaysBetween("2026-05-22", "2026-05-26", [{ holiday_date: "2026-05-25", is_active: true }]), 1);
  assert.equal(businessDaysBetween("2026-05-22", "2026-05-26", [{ holiday_date: "2026-05-25", is_active: "false" }]), 2);
});

test("Active holiday flags handle strings and numbers", () => {
  const dates = activeHolidayDates([
    { holiday_date: "2026-01-01", is_active: true },
    { holiday_date: "2026-01-02", is_active: "false" },
    { holiday_date: "2026-01-03", is_active: 0 },
    { holiday_date: "2026-01-04", active: "inactive" },
    { holiday_date: "2026-01-05" },
  ]);
  assert.deepEqual([...dates].sort(), ["2026-01-01", "2026-01-05"]);
});

test("Completion date normalizes to Bangkok date", () => {
  assert.equal(normalizeCompletionDate("2026-05-24T18:30:00.000Z"), "2026-05-25");
  assert.equal(normalizeCompletionDate("2026-05-24"), "2026-05-24");
});

test("Thai holiday parser handles AD, Buddhist year, and nested arrays", () => {
  assert.equal(normalizeThaiHolidayDate("2026-04-13"), "2026-04-13");
  assert.equal(normalizeThaiHolidayDate("13/04/2569"), "2026-04-13");
  const rows = normalizeThaiHolidayResponse({
    result: {
      data: [
        { holiday_date_th: "13/04/2569", name_th: "Songkran" },
        { date: "2027-01-01", name: "Different year" },
      ],
    },
  }, 2026, "iapp");
  assert.deepEqual(rows.map((row) => row.date), ["2026-04-13"]);
  assert.equal(rows[0].provider, "iapp");
});

test("Monthly task filter excludes undated completed work", () => {
  assert.equal(taskInPeriod({ status: "Completed" }, 6, 2026, false), false);
  assert.equal(taskInPeriod({ status: "Completed", completiondate: "2026-05-31" }, 6, 2026, false), false);
  assert.equal(taskInPeriod({ status: "Completed", startdate: "2026-05-11", deadline: "2026-06-24", completiondate: "2026-05-12" }, 6, 2026, false), false);
  assert.equal(taskInPeriod({ status: "Completed", completiondate: "2026-06-01" }, 6, 2026, false), true);
  assert.equal(taskInPeriod({ status: "On Process", startdate: "2026-05-10" }, 6, 2026, false), true);
  assert.equal(taskInPeriod({ status: "On Process" }, 6, 2026, false), false);
});

test("Performance period keeps active backlog but bounds completed history", () => {
  assert.equal(performanceTaskInPeriod({ status: "Completed", completiondate: "2025-12-31" }, [], 2026), false);
  assert.equal(performanceTaskInPeriod({ status: "Completed", completiondate: "2026-06-15" }, [], 2026), true);
  assert.equal(performanceTaskInPeriod({ status: "Completed", completiondate: "2026-06-15" }, [5, 7], 2026), false);
  assert.equal(performanceTaskInPeriod({ status: "Completed", completiondate: "2026-07-15" }, [5, 7], 2026), true);
  assert.equal(performanceTaskInPeriod({ status: "On Process", startdate: "2024-01-01" }, [5], 2026), true);
  assert.equal(performanceTaskInPeriod({ status: "Pending", startdate: "2026-08-01" }, [5], 2026), false);
});

test("Weighted score uses task-level effective weights", () => {
  const calcWeightedScores = loadApiWeightedScores();
  const result = calcWeightedScores([
    { status: "Completed", deadline: "2026-04-10", completiondate: "2026-04-09", extra_data: { kpi_effective_weight: 80 } },
    { status: "Completed", deadline: "2026-04-10", completiondate: "2026-04-12", mainkpiweight: 20 },
    { status: "On Process", mainkpiweight: 50 },
    { status: "Cancelled", mainkpiweight: 30 },
  ]);
  assert.equal(result.sla, 80);
  assert.equal(result.completion, 67);
  assert.equal(result.totalWeight, 150);
  assert.equal(result.completedWeight, 100);
  assert.equal(result.onTimeWeight, 80);
  assert.equal(result.cancelledWeight, 30);
});

await testAsync("Task mutations carry one dedupe id across local and broadcast events", async () => {
  const events = [];
  const broadcasts = [];
  const api = loadApiRuntime(async () => ({
    ok: true,
    json: async () => ({ tasks: [{ id: "task-1", status: "On Process" }] }),
  }), events, broadcasts);
  await api.saveNewTask({ jobs: ["test"] });
  assert.equal(events.length, 1);
  assert.equal(broadcasts.length, 1);
  assert.equal(events[0].type, "maxiwa:task-mutation");
  assert.ok(events[0].detail.mutationId);
  assert.equal(events[0].detail.mutationId, broadcasts[0].detail.mutationId);
});

await testAsync("Performance task reads request 1000 rows per page", async () => {
  const urls = [];
  const api = loadApiRuntime(async (url) => {
    urls.push(String(url));
    return { ok: true, json: async () => ({ tasks: [], holidays: [], hasMore: false, nextOffset: null }) };
  });
  await api.getPerformanceTasks([8], 2026, "all", "EMP001");
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.includes("limit=1000")));
});

console.log("All logic tests passed.");
