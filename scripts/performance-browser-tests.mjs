import { createPerformanceAdminFixture } from './performance-admin-fixture.mjs';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { performanceTaskInPeriod } from '../public/_worker.js';
const require = createRequire(import.meta.url);
let playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH;
if (!playwrightPath) {
  try { playwrightPath = require.resolve('playwright'); }
  catch { playwrightPath = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'); }
}
const { chromium } = await import(pathToFileURL(playwrightPath));
const output = path.resolve('.cache/performance-view-qa');
await mkdir(output, { recursive: true });
const kpis = [
  { id: 'K1', team: 'Alpha', main: 'Delivery', sub: 'Install', main_weight: 50 },
  { id: 'K2', team: 'Alpha', main: 'Delivery', sub: 'Audit', main_weight: 50 },
  { id: 'K4', team: 'Alpha', main: 'Unused Main', sub: 'Unused Sub', main_weight: 10 },
  { id: 'K3', team: 'Beta', main: 'Quality', sub: 'Inspect', main_weight: 20 },
];
const staff = [
  { empid: 'E1', name: 'Fixture One', team: 'Alpha', role: 'Staff', permissions: { kpiAssignments: { K1: true, K2: true, K4: true }, kpiOverrides: { K1: { weight: 25 } } } },
  { empid: 'E2', name: 'Fixture Two', team: 'Beta', role: 'Staff' },
  { empid: 'E3', name: 'No Work', team: 'Alpha', role: 'Staff' },
];
const make = (patch) => ({ id: 'T1', empid: 'E1', name: 'Fixture One', team: 'Alpha', mainkpi: 'Delivery', subkpi: 'Install', mainkpiweight: 30, weight: null, extra_data: {}, note: '', status: 'Pending', startdate: '2025-12-01', deadline: '2026-11-18', job: 'JOB001_01 Fixture work', ...patch });
const tasks = [make({ status: 'Completed', completiondate: '2026-11-17' }), make({ id: 'T2', mainkpiweight: 40, job: 'JOB002_01 Overdue fixture' }), make({ id: 'T3', deadline: '2026-11-20', extra_data: { kpi_effective_weight: 35 }, mainkpiweight: undefined }),
  make({ id: 'T4', status: 'Cancelled', completiondate: '2026-11-17' }), make({ id: 'T5', empid: 'E2', name: 'Fixture Two', team: 'Beta', mainkpi: 'Quality', subkpi: 'Inspect', status: 'Completed', completiondate: '2026-11-19' }),
  make({ id: 'T6', mainkpi: 'Legacy', subkpi: '', deadline: null, mainkpiweight: undefined }),
];
let role = 'Admin'; let catalogFails = false; let taskFails = false; let empty = false; let dense = false; let legacyFixture = false;
const apiCalls = [];
const adminActor = { empid: 'VIEWER', name: 'Fixture Viewer', team: 'Alpha', role: 'Admin', permissions: {}, active_session_id: 'fixture-session', active_session_updated_at: new Date().toISOString(), active_session_expires_at: new Date(Date.now() + 3600000).toISOString() };
const adminDatabase = createPerformanceAdminFixture({ users: [adminActor, ...staff], kpis, tasks });
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (value) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname.startsWith('/api/')) {
    apiCalls.push({ method: req.method, endpoint: url.pathname, query: Object.fromEntries(url.searchParams) });
    if (['/api/admin/previewPerformanceEdit', '/api/admin/applyPerformanceEdit'].includes(url.pathname)) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const result = await adminDatabase.request(url.pathname.slice(5), body, { empId: req.headers['x-session-empid'], sessionId: req.headers['x-session-id'] });
      res.statusCode = result.status; res.setHeader('content-type', 'application/json'); return res.end(await result.text());
    }
    if (url.pathname.endsWith('/getInitialData')) {
      const user = role === 'Staff' ? staff[0] : { empid: 'VIEWER', name: 'Fixture Viewer', team: 'Alpha', role, permissions: { allowedTeams: ['Alpha'] } };
      return json({ user, kpis, sessionId: 'fixture-session' });
    }
    if (/getAllStaff(InTeam)?$/.test(url.pathname)) return json({ staff: empty ? [] : dense ? [...staff, ...Array.from({ length: 40 }, (_, i) => ({ empid: 'D' + i, name: 'Dense Staff ' + i, team: 'Alpha', role: 'Staff' }))] : staff });
    if (url.pathname.endsWith('/getKPIsByTeam')) return json(catalogFails ? { error: 'Fixture catalog failed' } : { kpis });
    if (/get(All|Employee)Tasks$/.test(url.pathname)) {
      if (taskFails) return json({ error: 'Fixture task failed' });
      const months = url.searchParams.get('months') === 'all' ? [] : url.searchParams.get('months').split(',').map(Number);
      const kind = url.searchParams.get('kind');
      const filtered = (empty ? [] : dense ? [...tasks, ...Array.from({ length: 55 }, (_, i) => make({ id: 'DENSE' + i, job: 'DENSE work ' + i }))] : tasks).filter((task) => performanceTaskInPeriod(task, months, Number(url.searchParams.get('year')))
        && (kind === 'active' ? !['Completed', 'Cancelled'].includes(task.status) : ['Completed', 'Cancelled'].includes(task.status)));
      const rendered = legacyFixture ? filtered.map((task) => task.id === 'T2' ? { ...task, mainkpi: 'Old Delivery' } : task.id === 'T3' ? { ...task, subkpi: 'Unmatched Sub' } : task) : filtered;
      return json({ tasks: rendered, holidays: [], hasMore: false, nextOffset: null });
    }
    if (url.pathname.endsWith('/getHolidays')) return json({ holidays: [] });
    throw new Error('Unexpected API ' + url.pathname);
  }
  if (url.pathname === '/config.js') { res.setHeader('content-type', 'text/javascript'); return res.end("window.API_BASE='/api';"); }
  const relative = url.pathname === '/dashboard' ? 'dashboard.html' : url.pathname.slice(1);
  const file = path.resolve('dist', relative);
  if (!file.startsWith(path.resolve('dist') + path.sep)) { res.statusCode = 403; return res.end(); }
  try { res.setHeader('content-type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(await readFile(file)); }
  catch { res.statusCode = 404; res.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
const results = [];
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  async function open(tab = 'overview', options = {}, expectError = false) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, ...options });
    page.on('pageerror', (error) => { results.push({ pageError: error.message }); });
    await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.clock.install({ time: new Date('2026-11-19T05:00:00Z') });
    await page.goto(base + '/dashboard?empId=VIEWER&year=2026&months=11&tab=' + tab);
    await page.getByRole('button', { name: 'รีเฟรช', exact: true }).waitFor();
    if (expectError) { await page.getByText('Fixture task failed', { exact: true }).waitFor(); return page; }
    await page.waitForFunction(() => document.querySelector('.load-status')?.textContent.includes('อัปเดตล่าสุด'));
    return page;
  }
  const page = await open();
  assert.equal(await page.locator('.scope-panel').count(), 0);
  assert.equal(await page.getByText('ขอบเขตข้อมูลทุกแท็บ', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'เกินกำหนด', exact: true }).click();
  await page.getByRole('dialog', { name: 'เกินกำหนด', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'รายทีม', exact: true }).click();
  assert.equal(await page.locator('.team-card-button').count(), 2);
  assert.ok((await page.locator('.hero-band .score-basis-label').innerText()).includes('คะแนนทีม'));
  const alphaScore = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Alpha', exact: true }) });
  assert.equal(await alphaScore.locator('td').nth(11).innerText(), '33%');
  await page.locator('.team-card-button').filter({ hasText: 'Alpha' }).click();
  await page.getByRole('dialog', { name: 'รายละเอียดทีม' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Active Weight', exact: true }).click();
  assert.equal(await page.locator('tbody tr').first().getByRole('button', { name: 'Alpha', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'รายบุคคล', exact: true }).click();
  assert.ok((await page.locator('.hero-band .score-basis-label').innerText()).includes('คะแนนบุคคล'));
  const personScore = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Fixture One', exact: true }) });
  assert.equal(await personScore.locator('td').nth(11).innerText(), '28%');
  const cardWeights = page.locator('.employee-card').filter({ hasText: 'Fixture One' }).locator('.person-configured-weights');
  assert.ok((await cardWeights.innerText()).includes('25%'));
  assert.ok(!(await cardWeights.innerText()).includes('Audit'));
  await page.locator('.employee-card').filter({ hasText: 'Fixture One' }).click();
  let dialog = page.getByRole('dialog', { name: 'รายละเอียดบุคคล' });
  await dialog.waitFor();
  assert.ok(!(await dialog.locator('.personal-kpi-detail').innerText()).includes('Unused Main'));
  assert.equal(await dialog.locator('.personal-kpi-detail tbody tr').count(), 2);
  assert.equal(await dialog.locator('.personal-kpi-detail details[open]').count(), 0);
  const deliverySummary = dialog.locator('.personal-main-summary').filter({ hasText: 'Delivery' });
  assert.equal(await deliverySummary.locator('.personal-main-total').innerText(), 'รวม 25%');
  assert.ok((await dialog.locator('.personal-main-summary').filter({ hasText: 'Legacy' }).locator('.personal-main-total').innerText()).startsWith('รวม —'));
  assert.ok((await dialog.locator('.personal-main-summary').filter({ hasText: 'Legacy' }).innerText()).includes('ข้อมูลไม่ครบ 1 รายการ'));
  await dialog.locator('.personal-kpi-detail details > summary').filter({ hasText: 'Delivery' }).click();
  assert.equal(await dialog.locator('.personal-kpi-detail details[open]').count(), 1);
  const kpiRow = dialog.locator('.personal-kpi-detail tbody tr').filter({ hasText: 'Install' });
  assert.ok((await kpiRow.innerText()).includes('25%'));
  assert.ok((await kpiRow.innerText()).includes('30% / 35% / 40%'));
  assert.ok(!(await dialog.locator('.personal-kpi-detail').innerText()).includes('Audit'));
  await page.screenshot({ path: path.join(output, 'person-desktop.png'), fullPage: false });
  await dialog.getByRole('button', { name: 'Delivery / Install', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delivery / Install', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Delivery / Install', exact: true }).locator('tbody tr').count(), 4);
  const inspected = page.getByRole('dialog', { name: 'Delivery / Install', exact: true }).locator('tbody tr').filter({ hasText: '• T1' }).first();
  assert.ok((await inspected.locator('td').nth(4).innerText()).includes('30%'));
  assert.ok((await inspected.locator('td').nth(5).innerText()).includes('50%'));
  await page.keyboard.press('Escape');
  await dialog.waitFor();
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('header').isVisible(), false);
  assert.ok(await dialog.isVisible());
  await page.screenshot({ path: path.join(output, 'person-print.png'), fullPage: true });
  await page.pdf({ path: path.join(output, 'person-print.pdf'), format: 'A4', landscape: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await dialog.getByRole('button', { name: 'ดูทีม Alpha', exact: true }).click();
  await page.getByRole('dialog', { name: 'รายละเอียดทีม' }).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: /No Work/ }).click();
  dialog = page.getByRole('dialog', { name: 'รายละเอียดบุคคล' });
  assert.ok((await dialog.innerText()).includes('ยังไม่มีงานในช่วงนี้'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'น้ำหนัก KPI', exact: true }).click();
  assert.ok((await page.locator('tbody').innerText()).includes('Audit'));
  await page.getByRole('combobox', { name: 'บุคคล', exact: true }).selectOption('emp:e1');
  assert.equal(await page.locator('.personal-kpi-detail details[open]').count(), 0);
  await page.locator('.personal-kpi-detail details > summary').filter({ hasText: 'Delivery' }).click();
  assert.ok((await page.locator('.personal-kpi-detail').innerText()).includes('Audit'));
  assert.equal(await page.locator('.personal-main-summary').filter({ hasText: 'Delivery' }).locator('.personal-main-total').innerText(), 'รวม 75%');
  assert.ok(!(await page.locator('.personal-kpi-detail').innerText()).includes('Legacy'));
  await page.getByRole('combobox', { name: 'มุมมอง', exact: true }).selectOption('actual');
  assert.ok(!(await page.locator('.personal-kpi-detail').innerText()).includes('Audit'));
  assert.ok((await page.locator('.personal-kpi-detail').innerText()).includes('Legacy'));
  await page.getByRole('combobox', { name: 'บุคคล', exact: true }).selectOption('all');

  await page.locator('.scope-controls').last().getByLabel('มุมมอง', { exact: true }).selectOption('actual');
  assert.ok((await page.locator('tbody').innerText()).includes('ไม่มีทะเบียนที่ตรงกัน'));
  await page.getByRole('button', { name: 'วิเคราะห์ KPI', exact: true }).click();
  assert.ok((await page.locator('.watch-row').first().innerText()).includes('Delivery'));
  await page.locator('.kpi-intelligence input').fill('Delivery');
  assert.ok(!(await page.locator('.kpi-portfolio-list').innerText()).includes('Quality'));
  await page.locator('.kpi-intelligence input').fill('');
  await page.getByRole('button', { name: 'ภาพรวม', exact: true }).click();
  await page.getByRole('button', { name: 'ไม่มีน้ำหนักมาตรฐานทีม (ใช้ค่าสำรอง 1)', exact: true }).click();
  assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle Performance View theme' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: path.join(output, 'overview-dark.png'), fullPage: true });
  results.push({ check: 'Desktop: all tabs, nested drilldowns, zero-work staff, weights, quality, tab search, theme, print, collapsed KPI groups, no scope panel', passed: true });
  await page.close();
  const mobile = await open('employees', { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > 390), false);
  await mobile.locator('.employee-card').filter({ hasText: 'Fixture One' }).scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: path.join(output, 'mobile-before.png'), fullPage: false });
  await mobile.locator('.employee-card').filter({ hasText: 'Fixture One' }).click();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > 390), false);
  await mobile.screenshot({ path: path.join(output, 'person-mobile.png'), fullPage: false });
  await mobile.close();
  results.push({ check: 'Mobile 390px: page and person dialog stay within viewport', passed: true });
  for (const nextRole of ['Staff', 'Lead', 'Manager', 'Director', 'Executive', 'SrManager']) {
    role = nextRole;
    const scoped = await open('employees');
    const text = await scoped.locator('.employee-grid').innerText();
    assert.ok(!text.includes('Fixture Two'), nextRole + ' leaked Beta');
    if (nextRole === 'Staff') assert.ok(!text.includes('No Work'));
    await scoped.getByRole('button', { name: 'น้ำหนัก KPI', exact: true }).click();
    assert.ok(!(await scoped.locator('tbody').innerText()).includes('Inspect'));
    await scoped.close();
  }
  results.push({ check: 'Six role boundaries in rendered tasks, people and catalog', passed: true });
  role = 'Admin'; catalogFails = true;
  const partial = await open('weights');
  assert.ok((await partial.locator('header').innerText()).includes('โหลดทะเบียน KPI ไม่สำเร็จ'));
  await partial.close(); catalogFails = false;
  empty = true;
  const blank = await open('employees');
  assert.ok((await blank.locator('.hero-band').innerText()).includes('-'));
  await blank.close(); empty = false;
  results.push({ check: 'Partial catalog warning and empty dataset', passed: true });
  legacyFixture = true;
  const legacyPage = await open('employees');
  await legacyPage.locator('.employee-card').filter({ hasText: 'Fixture One' }).click();
  const legacyDialog = legacyPage.getByRole('dialog', { name: 'รายละเอียดบุคคล' });
  const renamedSummary = legacyDialog.locator('.personal-main-summary').filter({ hasText: 'Old Delivery' });
  assert.equal(await renamedSummary.locator('.personal-main-total').innerText(), 'รวม 25%');
  const partialSummary = legacyDialog.locator('.personal-main-summary').filter({ hasText: /^Delivery/ });
  assert.ok((await partialSummary.innerText()).includes('รวมที่ทราบ 25%'));
  assert.ok((await partialSummary.innerText()).includes('ข้อมูลไม่ครบ 1 รายการ'));
  assert.equal(await legacyDialog.locator('.personal-kpi-detail details[open]').count(), 0);
  await legacyPage.screenshot({ path: path.join(output, 'partial-person-weights.png'), fullPage: false });
  await legacyPage.close(); legacyFixture = false;
  results.push({ check: 'Renamed Main KPI resolves personal setting; incomplete group shows confirmed subtotal with missing count', passed: true });

  taskFails = true;
  const failed = await open('overview', {}, true);
  assert.ok((await failed.locator('header').innerText()).includes('Fixture task failed'));
  assert.ok((await failed.locator('.hero-band').innerText()).includes('0'));
  await failed.close(); taskFails = false;
  dense = true;
  const many = await open('employees');
  assert.equal(await many.locator('.employee-card').count(), 12);
  await many.getByRole('button', { name: /^ดูทั้งหมด/ }).click();
  assert.equal(await many.locator('.employee-card').count(), 43);
  await many.getByRole('button', { name: 'งานทั้งหมด', exact: true }).click();
  let explorer = many.getByRole('dialog', { name: 'งานทั้งหมด', exact: true });
  assert.equal(await explorer.locator('tbody tr').count(), 50);
  await explorer.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  assert.equal(await explorer.locator('tbody tr').count(), 11);
  await explorer.getByRole('textbox').fill('DENSE54');
  assert.equal(await explorer.locator('tbody tr').count(), 1);
  await explorer.getByRole('textbox').fill('');
  await explorer.getByRole('button', { name: 'แสดงทั้งหมดเพื่อพิมพ์', exact: true }).click();
  assert.equal(await explorer.locator('tbody tr').count(), 61);
  await many.emulateMedia({ media: 'print' });
  assert.ok((await many.locator('.print-only').last().innerText()).includes('รายการงานทั้งหมด'));
  await many.emulateMedia({ media: 'screen' });

  await many.keyboard.press('Escape');
  await many.getByRole('combobox', { name: 'Filter year', exact: true }).selectOption('2025');
  await many.waitForFunction(() => new URL(location.href).searchParams.get('year') === '2025' && document.querySelector('.load-status')?.textContent.includes('อัปเดตล่าสุด'));
  assert.equal(await many.getByRole('button', { name: 'เกินกำหนด', exact: true }).innerText(), '0');
  await many.locator('.month-picker-btn').click();
  await many.getByTitle('September', { exact: true }).click();
  await many.waitForFunction(() => new URL(location.href).searchParams.get('months')?.split(',').length === 2 && document.querySelector('.load-status')?.textContent.includes('อัปเดตล่าสุด'));
  await many.close(); dense = false;
  results.push({ check: 'Failed task API is visible; 43 staff show-all; 61-task pagination/search; historic year and multiple months', passed: true });

  const adminPage = await open('employees');
  await adminPage.locator('.employee-card').filter({ hasText: 'Fixture One' }).click();
  const adminPerson = adminPage.getByRole('dialog', { name: 'รายละเอียดบุคคล' });
  await adminPerson.locator('.personal-main-summary').filter({ hasText: 'Legacy' }).click();
  await adminPerson.getByRole('button', { name: 'แก้ไข KPI General', exact: true }).click();
  const editor = adminPage.getByRole('dialog', { name: 'แอดมินแก้ไข KPI และน้ำหนัก' });
  await editor.getByRole('combobox', { name: 'KPI ปลายทาง', exact: true }).selectOption('K1');
  await editor.getByRole('checkbox', { name: 'ปรับน้ำหนักมาตรฐานทีม', exact: true }).check();
  await editor.getByRole('spinbutton', { name: 'น้ำหนักมาตรฐานทีม', exact: true }).fill('60');
  await editor.getByRole('combobox', { name: 'รูปแบบน้ำหนักบุคคล', exact: true }).selectOption('custom');
  await editor.getByRole('spinbutton', { name: 'น้ำหนักเฉพาะบุคคล', exact: true }).fill('20');
  await editor.getByRole('textbox', { name: 'เหตุผลการแก้ไข', exact: true }).fill('Fix legacy fixture KPI and selected task weight');
  await editor.getByRole('checkbox', { name: 'เลือกงาน T6', exact: true }).check();
  await editor.getByRole('button', { name: 'ตรวจรายการและคะแนนก่อนบันทึก', exact: true }).click();
  await editor.locator('.admin-edit-preview').waitFor();
  assert.ok((await editor.locator('.admin-edit-preview').innerText()).includes('คะแนน'));
  assert.equal(adminDatabase.state.calls.filter((call) => call.method !== 'GET').length, 0);
  await editor.getByRole('spinbutton', { name: 'น้ำหนักเฉพาะบุคคล', exact: true }).fill('21');
  await editor.locator('.admin-edit-preview').waitFor({ state: 'detached' });
  await editor.getByRole('spinbutton', { name: 'น้ำหนักเฉพาะบุคคล', exact: true }).fill('20');
  await editor.getByRole('button', { name: 'ตรวจรายการและคะแนนก่อนบันทึก', exact: true }).click();
  await editor.locator('.admin-edit-preview').waitFor();
  await adminPage.screenshot({ path: path.join(output, 'admin-edit-preview.png'), fullPage: false });
  await editor.getByRole('button', { name: 'ยืนยันบันทึกลงฐานข้อมูล', exact: true }).click();
  await editor.getByRole('button', { name: 'ปิดและดูข้อมูลล่าสุด', exact: true }).click();
  await editor.waitFor({ state: 'detached' });
  assert.equal(tasks.find((task) => task.id === 'T6').mainkpi, 'Delivery');
  assert.equal(tasks.find((task) => task.id === 'T6').subkpi, 'Install');
  assert.equal(tasks.find((task) => task.id === 'T6').mainkpiweight, 20);
  assert.equal(tasks.find((task) => task.id === 'T1').mainkpiweight, 30);
  assert.equal(kpis.find((kpi) => kpi.id === 'K1').main_weight, 60);
  assert.equal(staff[0].permissions.kpiOverrides.K1.weight, 20);
  assert.ok((await adminPage.locator('.employee-card').filter({ hasText: 'Fixture One' }).innerText()).includes('20%'));
  await adminPage.close();
  const mobileAdmin = await open('employees', { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  await mobileAdmin.locator('.employee-card').filter({ hasText: 'Fixture One' }).click();
  await mobileAdmin.locator('.personal-main-summary').filter({ hasText: 'Delivery' }).click();
  await mobileAdmin.getByRole('button', { name: 'แก้ไข KPI Install', exact: true }).click();
  const mobileEditor = mobileAdmin.getByRole('dialog', { name: 'แอดมินแก้ไข KPI และน้ำหนัก' });
  await mobileEditor.getByRole('combobox', { name: 'รูปแบบน้ำหนักบุคคล', exact: true }).selectOption('custom');
  await mobileEditor.getByRole('spinbutton', { name: 'น้ำหนักเฉพาะบุคคล', exact: true }).fill('21');
  await mobileEditor.getByRole('textbox', { name: 'เหตุผลการแก้ไข', exact: true }).fill('Mobile preview only');
  const beforeMobileWrites = adminDatabase.state.calls.filter((call) => call.method !== 'GET').length;
  await mobileEditor.getByRole('button', { name: 'ตรวจรายการและคะแนนก่อนบันทึก', exact: true }).click();
  await mobileEditor.getByRole('region', { name: 'ผลกระทบก่อนบันทึก', exact: true }).waitFor();
  assert.equal(await mobileAdmin.evaluate(() => document.documentElement.scrollWidth > 390), false);
  assert.equal(adminDatabase.state.calls.filter((call) => call.method !== 'GET').length, beforeMobileWrites);
  await mobileAdmin.screenshot({ path: path.join(output, 'admin-edit-mobile.png'), fullPage: false });
  await mobileAdmin.close();
  results.push({ check: 'Admin editor and score preview at 390px stay within viewport and preview performs no writes', passed: true });
  role = 'Staff'; const readOnly = await open('employees');
  await readOnly.locator('.employee-card').filter({ hasText: 'Fixture One' }).click();
  await readOnly.locator('.personal-main-summary').filter({ hasText: 'Delivery' }).click();
  assert.equal(await readOnly.getByRole('button', { name: /^แก้ไข KPI/ }).count(), 0);
  await readOnly.close(); role = 'Admin';
  results.push({ check: 'Admin edits KPI mapping/team and personal settings with real worker preview/apply against fixture DB; only selected task updated; Staff is read-only', passed: true });
  assert.equal(results.filter((r) => r.pageError).length, 0, JSON.stringify(results));
  assert.ok(apiCalls.every((call) => call.method === 'GET' || ['/api/getInitialData', '/api/admin/previewPerformanceEdit', '/api/admin/applyPerformanceEdit'].includes(call.endpoint)), 'Unexpected mutation');
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ results, apiCalls: apiCalls.length }, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
