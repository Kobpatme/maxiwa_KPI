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
  { id: 'K3', team: 'Beta', main: 'Quality', sub: 'Inspect', main_weight: 20 },
];
const staff = [
  { empid: 'E1', name: 'Fixture One', team: 'Alpha', role: 'Staff', permissions: { kpiAssignments: { K1: true, K2: true }, kpiOverrides: { K1: { weight: 25 } } } },
  { empid: 'E2', name: 'Fixture Two', team: 'Beta', role: 'Staff' },
  { empid: 'E3', name: 'No Work', team: 'Alpha', role: 'Staff' },
];
const make = (patch) => ({ id: 'T1', empid: 'E1', name: 'Fixture One', team: 'Alpha', mainkpi: 'Delivery', subkpi: 'Install', mainkpiweight: 30, status: 'Pending', startdate: '2025-12-01', deadline: '2026-11-18', job: 'JOB001_01 Fixture work', ...patch });
const tasks = [make({ status: 'Completed', completiondate: '2026-11-17' }), make({ id: 'T2', mainkpiweight: 40, job: 'JOB002_01 Overdue fixture' }), make({ id: 'T3', deadline: '2026-11-20', extra_data: { kpi_effective_weight: 35 }, mainkpiweight: undefined }),
  make({ id: 'T4', status: 'Cancelled', completiondate: '2026-11-17' }), make({ id: 'T5', empid: 'E2', name: 'Fixture Two', team: 'Beta', mainkpi: 'Quality', subkpi: 'Inspect', status: 'Completed', completiondate: '2026-11-19' }),
  make({ id: 'T6', mainkpi: 'Legacy', subkpi: '', deadline: null, mainkpiweight: undefined }),
];
let role = 'Admin'; let catalogFails = false; let taskFails = false; let empty = false; let dense = false;
const apiCalls = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (value) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname.startsWith('/api/')) {
    apiCalls.push({ method: req.method, endpoint: url.pathname, query: Object.fromEntries(url.searchParams) });
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
      return json({ tasks: filtered, holidays: [], hasMore: false, nextOffset: null });
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
  async function open(tab = 'overview', options = {}, expectError = false, details = true) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, ...options });
    page.on('pageerror', (error) => { results.push({ pageError: error.message }); });
    await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.clock.install({ time: new Date('2026-11-19T05:00:00Z') });
    await page.goto(base + '/dashboard?empId=VIEWER&year=2026&months=11&tab=' + tab);
    await page.getByRole('button', { name: 'รีเฟรช', exact: true }).waitFor();
    if (expectError) { await page.getByText('Fixture task failed', { exact: true }).waitFor(); return page; }
    await page.waitForFunction(() => document.querySelector('.scope-panel')?.textContent.includes('อัปเดตล่าสุด') && !document.querySelector('.scope-panel')?.textContent.includes('ยังไม่มีข้อมูล'));
    if (details) { await page.locator('.advanced-performance > summary').click(); await page.locator('.advanced-content').waitFor(); }
    return page;
  }
  const brief = await open('overview', {}, false, false);
  assert.equal(await brief.locator('.hero-band').count(), 0);
  assert.equal(await brief.locator('.tab-strip').count(), 0);
  assert.equal(await brief.locator('.score-method').count(), 0);
  assert.equal(await brief.locator('.executive-table th').count(), 6);
  assert.equal(await brief.locator('.executive-table tbody tr').count(), 4);
  assert.ok((await brief.locator('.executive-table tbody tr').first().innerText()).includes('Fixture One'));
  assert.ok((await brief.locator('.executive-table tbody tr').first().innerText()).includes('25%–50%'));
  assert.ok((await brief.locator('.executive-counts').innerText()).includes('3'));
  await brief.getByRole('textbox', { name: 'ค้นหาผู้รับผิดชอบหรือ KPI' }).fill('Fixture Two');
  assert.equal(await brief.locator('.executive-table tbody tr').count(), 1);
  await brief.getByRole('textbox', { name: 'ค้นหาผู้รับผิดชอบหรือ KPI' }).fill('');
  await brief.screenshot({ path: path.join(output, 'executive-brief-desktop.png'), fullPage: true });
  await brief.emulateMedia({ media: 'print' });
  assert.ok(await brief.locator('.executive-summary').isVisible());
  assert.equal(await brief.locator('.advanced-performance').isVisible(), false);
  await brief.emulateMedia({ media: 'screen' });
  await brief.getByRole('button', { name: 'Fixture One', exact: true }).first().click();
  await brief.getByRole('dialog', { name: 'รายละเอียดบุคคล' }).waitFor();
  await brief.keyboard.press('Escape');
  await brief.locator('.advanced-performance > summary').click();
  await brief.locator('.executive-summary').waitFor({ state: 'detached' });
  await brief.locator('.advanced-performance > summary').click();
  await brief.locator('.executive-summary').waitFor();
  await brief.close();
  const briefMobile = await open('overview', { viewport: { width: 390, height: 844 }, isMobile: true }, false, false);
  assert.equal(await briefMobile.evaluate(() => document.documentElement.scrollWidth > 390), false);
  await briefMobile.screenshot({ path: path.join(output, 'executive-brief-mobile.png'), fullPage: true });
  await briefMobile.close();
  results.push({ check: 'Executive brief: six columns, real personal weights, no invented targets, one count per person, search, mobile, print, details opt-in', passed: true });
  const page = await open();
  await page.getByRole('button', { name: 'เกินกำหนด', exact: true }).click();
  await page.getByRole('dialog', { name: 'เกินกำหนด', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'รายทีม', exact: true }).click();
  assert.equal(await page.locator('.team-card-button').count(), 2);
  await page.locator('.team-card-button').filter({ hasText: 'Alpha' }).click();
  await page.getByRole('dialog', { name: 'รายละเอียดทีม' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Active Weight', exact: true }).click();
  assert.equal(await page.locator('tbody tr').first().getByRole('button', { name: 'Alpha', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'รายบุคคล', exact: true }).click();
  await page.locator('.employee-card').filter({ hasText: 'Fixture One' }).click();
  let dialog = page.getByRole('dialog', { name: 'รายละเอียดบุคคล' });
  await dialog.waitFor();
  const kpiRow = dialog.locator('.personal-kpi-detail tbody tr').filter({ hasText: 'Install' });
  assert.ok((await kpiRow.innerText()).includes('25%'));
  assert.ok((await kpiRow.innerText()).includes('30% / 35% / 40%'));
  assert.ok((await dialog.innerText()).includes('ยังไม่มีงานในช่วงนี้'));
  await page.screenshot({ path: path.join(output, 'person-desktop.png'), fullPage: false });
  await dialog.getByRole('button', { name: 'Delivery / Install', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delivery / Install', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Delivery / Install', exact: true }).locator('tbody tr').count(), 4);
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
  assert.ok((await page.locator('.personal-kpi-detail').innerText()).includes('Audit'));
  assert.ok(!(await page.locator('.personal-kpi-detail').innerText()).includes('Legacy'));
  await page.getByRole('combobox', { name: 'มุมมอง', exact: true }).selectOption('actual');
  assert.ok(!(await page.locator('.personal-kpi-detail').innerText()).includes('Audit'));
  assert.ok((await page.locator('.personal-kpi-detail').innerText()).includes('Legacy'));
  await page.getByRole('combobox', { name: 'บุคคล', exact: true }).selectOption('all');

  await page.locator('.scope-controls').last().getByLabel('มุมมอง', { exact: true }).selectOption('actual');
  assert.ok((await page.locator('tbody').innerText()).includes('ไม่มีทะเบียนที่ตรงกัน'));
  await page.getByRole('button', { name: 'วิเคราะห์ KPI', exact: true }).click();
  assert.ok((await page.locator('.watch-row').first().innerText()).includes('Delivery'));
  await page.locator('.scope-panel').getByLabel('ทีม', { exact: true }).selectOption('Beta');
  assert.ok(!(await page.locator('.kpi-portfolio-list').innerText()).includes('Delivery'));
  await page.locator('.scope-panel').getByLabel('ทีม', { exact: true }).selectOption('all');
  await page.locator('.scope-panel').getByLabel('Main KPI', { exact: true }).selectOption('Delivery');
  assert.ok(!(await page.locator('.kpi-portfolio-list').innerText()).includes('Quality'));
  await page.locator('.scope-panel').getByLabel('Main KPI', { exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'ภาพรวม', exact: true }).click();
  await page.getByRole('button', { name: 'ไม่มีน้ำหนัก (ใช้ค่าสำรอง 1)', exact: true }).click();
  assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle Performance View theme' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: path.join(output, 'overview-dark.png'), fullPage: true });
  results.push({ check: 'Desktop: all tabs, nested drilldowns, zero-work staff, weights, quality, shared filters, theme, print', passed: true });
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
  assert.ok((await partial.locator('.scope-panel').innerText()).includes('โหลดทะเบียน KPI ไม่สำเร็จ'));
  await partial.close(); catalogFails = false;
  empty = true;
  const blank = await open('employees');
  assert.ok((await blank.locator('.hero-band').innerText()).includes('-'));
  await blank.close(); empty = false;
  results.push({ check: 'Partial catalog warning and empty dataset', passed: true });
  taskFails = true;
  const failed = await open('overview', {}, true);
  assert.ok((await failed.locator('.scope-panel').innerText()).includes('ยังไม่มีข้อมูล'));
  assert.ok((await failed.locator('.executive-summary').innerText()).includes('0'));
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
  await many.waitForFunction(() => document.querySelector('.advanced-content')?.textContent.includes('30 พ.ย. 2568') && !document.querySelector('.scope-panel')?.textContent.includes('ยังไม่มีข้อมูล'));
  assert.equal(await many.getByRole('button', { name: 'เกินกำหนด', exact: true }).innerText(), '0');
  await many.locator('.month-picker-btn').click();
  await many.getByTitle('September', { exact: true }).click();
  await many.waitForFunction(() => new URL(location.href).searchParams.get('months')?.split(',').length === 2 && !document.querySelector('.scope-panel')?.textContent.includes('ยังไม่มีข้อมูล'));
  await many.close(); dense = false;
  results.push({ check: 'Failed task API is visible; 43 staff show-all; 61-task pagination/search; historic year and multiple months', passed: true });

  assert.equal(results.filter((r) => r.pageError).length, 0, JSON.stringify(results));
  assert.ok(apiCalls.every((call) => call.method === 'GET' || call.endpoint === '/api/getInitialData'), 'Unexpected mutation');
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ results, apiCalls: apiCalls.length }, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
