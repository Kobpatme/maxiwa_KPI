import fs from "fs";
import path from "path";
import { createRequire } from "module";

const runtimeNodeModules = "C:/Users/kobpat_m/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
process.env.XDG_CACHE_HOME = path.resolve(".cache/fontconfig").replaceAll("\\", "/");
fs.mkdirSync(process.env.XDG_CACHE_HOME, { recursive: true });
const requirePptx = createRequire(`${runtimeNodeModules}/.pnpm/pptxgenjs@4.0.1/node_modules/pptxgenjs/package.json`);
const requireSharp = createRequire(`${runtimeNodeModules}/.pnpm/sharp@0.34.5/node_modules/sharp/package.json`);
const requireArtifact = createRequire(`${runtimeNodeModules}/@oai/artifact-tool/package.json`);
const pptxgen = requirePptx("pptxgenjs");
const sharp = requireSharp("sharp");
const { Canvas } = requireArtifact("skia-canvas");

const outDir = path.resolve("docs");
const previewDir = path.join(outDir, "metrix-verity-pptx-previews");
fs.mkdirSync(previewDir, { recursive: true });

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Codex";
pptx.company = "METRIX Verity";
pptx.subject = "Executive workflow and private cloud sizing";
pptx.title = "METRIX Verity - Executive System Workflow and Private Cloud Sizing";
pptx.lang = "th-TH";
pptx.theme = {
  headFontFace: "Leelawadee UI",
  bodyFontFace: "Leelawadee UI",
  lang: "th-TH",
};
pptx.defineLayout({ name: "LAYOUT_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "LAYOUT_WIDE";

const C = {
  ink: "162033",
  slate: "334155",
  muted: "667085",
  line: "D7DEE8",
  bg: "F7F8FA",
  white: "FFFFFF",
  blue: "1F6FEB",
  teal: "00A99D",
  green: "30A46C",
  amber: "D97706",
  red: "D64545",
  violet: "7657D6",
  navy: "0B1020",
};

const font = "Leelawadee UI";
const W = 13.333;
const H = 7.5;

function addBg(slide, color = C.bg) {
  slide.background = { color };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color }, line: { color } });
}

function addFooter(slide, n) {
  slide.addText("METRIX Verity | Executive architecture & private cloud sizing", {
    x: 0.55, y: 7.08, w: 8.4, h: 0.18, fontFace: font, fontSize: 6.8, color: "7A8699",
    margin: 0, breakLine: false,
  });
  slide.addText(String(n).padStart(2, "0"), {
    x: 12.25, y: 7.03, w: 0.55, h: 0.25, fontFace: font, fontSize: 9, bold: true, color: "7A8699",
    align: "right", margin: 0,
  });
}

function title(slide, t, st, dark = false) {
  slide.addText(t, {
    x: 0.55, y: 0.42, w: 9.2, h: 0.55, fontFace: font, fontSize: 21, bold: true,
    color: dark ? C.white : C.ink, margin: 0, fit: "shrink",
  });
  if (st) {
    slide.addText(st, {
      x: 0.57, y: 0.98, w: 9.8, h: 0.34, fontFace: font, fontSize: 9.5,
      color: dark ? "C8D4E6" : C.muted, margin: 0, fit: "shrink",
    });
  }
}

function pill(slide, text, x, y, w, color, txt = C.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.28, rectRadius: 0.06,
    fill: { color }, line: { color },
  });
  slide.addText(text, {
    x: x + 0.08, y: y + 0.055, w: w - 0.16, h: 0.12, fontFace: font, fontSize: 6.3,
    color: txt, bold: true, align: "center", margin: 0, breakLine: false, fit: "shrink",
  });
}

function metric(slide, value, label, x, y, color) {
  slide.addText(value, {
    x, y, w: 2.55, h: 0.55, fontFace: font, fontSize: 23, bold: true, color, margin: 0,
    fit: "shrink",
  });
  slide.addText(label, {
    x, y: y + 0.58, w: 2.45, h: 0.25, fontFace: font, fontSize: 7.8, bold: true, color: C.slate,
    margin: 0, fit: "shrink",
  });
}

function box(slide, x, y, w, h, fill = C.white, line = C.line, radius = 0.07) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: radius,
    fill: { color: fill }, line: { color: line, width: 0.8 },
  });
}

function body(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h, fontFace: font, fontSize: opts.size || 10.2, color: opts.color || C.slate,
    bold: !!opts.bold, margin: 0.02, fit: "shrink", breakLine: false,
    valign: opts.valign || "top", align: opts.align || "left",
    paraSpaceAfterPt: 3,
  });
}

function node(slide, label, x, y, w, h, color, textColor = C.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color }, line: { color },
  });
  slide.addText(label, {
    x: x + 0.08, y: y + 0.12, w: w - 0.16, h: h - 0.18, fontFace: font, fontSize: 8,
    bold: true, color: textColor, align: "center", valign: "mid", margin: 0, fit: "shrink",
  });
}

function arrow(slide, x1, y1, x2, y2, color = "8090A5") {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 1.15, beginArrowType: "none", endArrowType: "triangle" },
  });
}

function addTable(slide, rows, x, y, widths, rowH, headerFill = C.navy) {
  const totalW = widths.reduce((a, b) => a + b, 0);
  rows.forEach((r, i) => {
    const fill = i === 0 ? headerFill : (i % 2 === 0 ? "F2F5F8" : C.white);
    const textColor = i === 0 ? C.white : C.slate;
    let cx = x;
    r.forEach((cell, j) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: cx, y: y + i * rowH, w: widths[j], h: rowH,
        fill: { color: fill }, line: { color: "E1E7EF", width: 0.45 },
      });
      slide.addText(cell, {
        x: cx + 0.08, y: y + i * rowH + 0.065, w: widths[j] - 0.16, h: rowH - 0.11,
        fontFace: font, fontSize: i === 0 ? 7.2 : 6.6, bold: i === 0, color: textColor,
        margin: 0, fit: "shrink", valign: "mid", align: j === 0 ? "left" : "center",
      });
      cx += widths[j];
    });
  });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: totalW, h: rows.length * rowH, fill: { color: C.white, transparency: 100 }, line: { color: "CCD6E2", width: 0.9 } });
}

function slide1() {
  const s = pptx.addSlide();
  addBg(s, C.navy);
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 5.75, w: W, h: 1.75, fill: { color: "101A2E" }, line: { color: "101A2E" } });
  s.addShape(pptx.ShapeType.line, { x: 0.65, y: 1.12, w: 2.0, h: 0, line: { color: C.teal, width: 3.2 } });
  s.addText("METRIX\nVerity", {
    x: 0.62, y: 1.32, w: 5.8, h: 1.45, fontFace: font, fontSize: 42, bold: true,
    color: C.white, margin: 0, breakLine: false, fit: "shrink",
  });
  s.addText("Executive system workflow and private cloud sizing", {
    x: 0.68, y: 3.06, w: 5.8, h: 0.32, fontFace: font, fontSize: 12.2, color: "CFD8E6", margin: 0,
  });
  s.addText("ระบบติดตาม SLA/KPI สำหรับการบริหารงานแบบ role-based พร้อมกรอบทรัพยากรสำหรับ private cloud", {
    x: 0.68, y: 3.55, w: 6.05, h: 0.65, fontFace: font, fontSize: 13.2, color: C.white,
    bold: true, margin: 0, fit: "shrink",
  });
  ["Workflow", "SLA/KPI", "Private Cloud", "UAT Readiness"].forEach((t, i) => pill(s, t, 0.68 + i * 1.42, 4.55, 1.15, [C.blue, C.teal, C.violet, C.green][i]));
  node(s, "Users", 7.1, 1.3, 1.25, 0.72, C.blue);
  node(s, "App UI", 8.8, 1.3, 1.25, 0.72, C.teal);
  node(s, "API", 10.5, 1.3, 1.25, 0.72, C.violet);
  node(s, "Postgres", 9.65, 2.75, 1.55, 0.72, C.green);
  arrow(s, 8.35, 1.66, 8.8, 1.66, "A8B4C5");
  arrow(s, 10.05, 1.66, 10.5, 1.66, "A8B4C5");
  arrow(s, 11.12, 2.02, 10.55, 2.75, "A8B4C5");
  s.addText("Prepared for leadership discussion", { x: 0.68, y: 6.55, w: 4.8, h: 0.2, fontFace: font, fontSize: 8.5, color: "9FB1C8", margin: 0 });
  return s;
}

function slide2() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Executive Summary", "METRIX Verity ยกระดับข้อมูล SLA/KPI เดิมให้เป็น operating platform สำหรับผู้บริหาร");
  metric(s, "Role-based", "เห็นเฉพาะงานตามสิทธิ์", 0.72, 1.75, C.blue);
  metric(s, "No DB access", "Admin จัดการผ่าน UI", 3.55, 1.75, C.teal);
  metric(s, "Private-ready", "แยกชั้น frontend/API/DB", 6.38, 1.75, C.violet);
  metric(s, "Medium-lite", "baseline ที่แนะนำ", 9.2, 1.75, C.green);
  body(s, "ข้อเสนอหลัก: เริ่มใช้งานจริงด้วย private cloud spec ระดับ Medium-lite เพื่อบาลานซ์ต้นทุน ความเสี่ยง และ scalability จากนั้นวัด workload จริง 30-60 วันก่อน scale เพิ่ม", 0.72, 3.65, 7.2, 0.9, { size: 15.2, bold: true, color: C.ink });
  body(s, "ระบบยังคงใช้ data model และ workflow เดิมใน Release 1 เพื่อลดความเสี่ยงในการเปลี่ยนระบบ ขณะที่เพิ่ม dashboard, task center, job tracker, admin studio และ realtime refresh ให้พร้อมใช้งานเชิงบริหาร", 0.72, 4.85, 7.35, 0.95, { size: 11.2 });
  box(s, 8.65, 3.62, 3.75, 1.78, "EDF7F5", "B6E3DD");
  body(s, "Decision to unlock", 8.93, 3.92, 3.1, 0.25, { size: 8.5, bold: true, color: C.teal });
  body(s, "อนุมัติแนวทาง private cloud baseline และเริ่ม UAT/production parallel ด้วย metric ที่วัดได้", 8.93, 4.32, 3.05, 0.72, { size: 12.2, bold: true, color: C.ink });
  addFooter(s, 2);
  return s;
}

function slide3() {
  const s = pptx.addSlide();
  addBg(s, C.white);
  title(s, "System Architecture", "สถาปัตยกรรมปัจจุบันรองรับทั้ง Cloudflare-style deployment และ private cloud target");
  node(s, "Users\nStaff / Lead / Manager / Exec / Admin", 0.65, 2.1, 1.65, 0.85, C.blue);
  node(s, "Browser\nMETRIX Verity UI", 2.82, 2.1, 1.55, 0.85, C.teal);
  node(s, "Static Frontend\nNginx / Object Storage", 4.88, 1.45, 1.8, 0.85, C.violet);
  node(s, "API Layer\nWorker / Node Service", 4.88, 2.82, 1.8, 0.85, C.violet);
  node(s, "Postgres\nSystem of Record", 7.36, 2.1, 1.75, 0.85, C.green);
  node(s, "Realtime\nWebSocket events", 9.86, 1.45, 1.65, 0.85, C.amber);
  node(s, "Monitoring\nLogs / Alerts", 9.86, 2.82, 1.65, 0.85, C.slate);
  arrow(s, 2.3, 2.52, 2.82, 2.52);
  arrow(s, 4.37, 2.52, 4.88, 1.88);
  arrow(s, 4.37, 2.52, 4.88, 3.24);
  arrow(s, 6.68, 3.24, 7.36, 2.52);
  arrow(s, 9.11, 2.52, 9.86, 1.88);
  arrow(s, 9.11, 2.52, 9.86, 3.24);
  body(s, "หลักการ private cloud: แยกชั้นบริการให้ชัดเจน, ใช้ Postgres เป็น system of record, เพิ่ม Redis สำหรับ cache/session, และมี replica/backup สำหรับ recovery", 0.78, 5.35, 11.55, 0.55, { size: 13, bold: true, color: C.ink });
  addFooter(s, 3);
  return s;
}

function slide4() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Operating Workflow", "การทำงานเริ่มจาก identity แล้วแยกประสบการณ์ตาม role และ scope");
  const xs = [0.68, 2.8, 4.92, 7.04, 9.16, 11.05];
  const labels = [
    ["Login", "Employee ID\nrole / team / permissions"],
    ["Staff", "My tasks\naccept / update"],
    ["Lead", "Team command\nassign / monitor"],
    ["Manager", "Task center\nedit / report"],
    ["Executive", "Dashboard\nSLA risk / KPI health"],
    ["Admin", "Studio\nusers / KPI / holidays"],
  ];
  labels.forEach(([h, b], i) => {
    node(s, h, xs[i], 1.9, i === 5 ? 1.55 : 1.45, 0.55, [C.navy, C.blue, C.teal, C.violet, C.green, C.amber][i]);
    body(s, b, xs[i], 2.62, i === 5 ? 1.55 : 1.45, 0.52, { size: 7.6, bold: true, align: "center", color: C.slate });
    if (i < labels.length - 1) arrow(s, xs[i] + 1.48, 2.18, xs[i + 1] - 0.08, 2.18, "98A6B8");
  });
  node(s, "Task Engine", 2.25, 4.05, 1.65, 0.72, C.blue);
  node(s, "SLA Engine\nworking days + holidays", 4.55, 4.05, 2.05, 0.72, C.teal);
  node(s, "Data Store\ntasks / audit / kpis", 7.25, 4.05, 2.0, 0.72, C.green);
  node(s, "Reports + Tracker", 9.9, 4.05, 1.75, 0.72, C.violet);
  arrow(s, 3.9, 4.41, 4.55, 4.41);
  arrow(s, 6.6, 4.41, 7.25, 4.41);
  arrow(s, 9.25, 4.41, 9.9, 4.41);
  body(s, "ผลลัพธ์: ข้อมูลสถานะงาน, deadline, SLA risk และ weighted KPI ถูกส่งกลับไปที่ dashboard ตามสิทธิ์ของแต่ละ role", 1.0, 5.62, 10.9, 0.42, { size: 12.5, bold: true, color: C.ink, align: "center" });
  addFooter(s, 4);
  return s;
}

function slide5() {
  const s = pptx.addSlide();
  addBg(s, C.white);
  title(s, "Task Lifecycle & Control Points", "วงจรชีวิตงานรองรับการรับงาน พักงาน ปิดงาน ยกเลิก และบันทึก audit");
  const y = 2.55;
  const stages = [
    ["Pending", C.amber, "assigned / created"],
    ["On Process", C.blue, "accepted"],
    ["On Hold", C.violet, "paused with reason"],
    ["Completed", C.green, "completion date"],
    ["Cancelled", C.red, "removed from active flow"],
  ];
  stages.forEach(([name, color, sub], i) => {
    const x = 0.72 + i * 2.48;
    node(s, name, x, y, 1.55, 0.68, color);
    body(s, sub, x, y + 0.86, 1.55, 0.25, { size: 7.2, bold: true, color: C.muted, align: "center" });
    if (i < 3) arrow(s, x + 1.55, y + 0.34, x + 2.42, y + 0.34);
  });
  arrow(s, 4.04, 3.24, 5.68, 3.24, "98A6B8");
  arrow(s, 5.68, 2.55, 4.04, 2.55, "98A6B8");
  body(s, "SLA Engine", 0.95, 5.0, 2.25, 0.32, { size: 15, bold: true, color: C.ink });
  body(s, "คำนวณ deadline จาก KPI days + start date โดยตัด weekend และ active holidays", 0.95, 5.45, 4.2, 0.42, { size: 10.5 });
  body(s, "Audit Trail", 6.2, 5.0, 2.25, 0.32, { size: 15, bold: true, color: C.ink });
  body(s, "ทุก action สำคัญ เช่น create, update, status change, delete และ admin operations ถูกบันทึกย้อนหลัง", 6.2, 5.45, 4.85, 0.42, { size: 10.5 });
  addFooter(s, 5);
  return s;
}

function slide6() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Functional Modules", "โมดูลหลักที่ต้องรองรับใน private cloud deployment");
  const rows = [
    ["Module", "Primary Users", "Business Job"],
    ["My Work", "Staff / Lead", "รับงาน อัปเดตสถานะ เพิ่ม note และดูงานตัวเอง"],
    ["Team Command", "Lead", "ดูสุขภาพทีม มอบหมายงาน และติดตามสมาชิก"],
    ["Task Center", "Lead / Manager / Admin", "ค้นหา กรอง แก้ไข ลบ และติดตามงาน"],
    ["Performance Dashboard", "Manager / Executive", "ดู SLA risk, weighted KPI และ team matrix"],
    ["Job Tracker", "All roles by permission", "ค้นหาประวัติงานจาก job code และ audit timeline"],
    ["Admin Studio", "Admin", "จัดการ users, teams, KPI, holidays, system links, audit"],
  ];
  addTable(s, rows, 0.72, 1.62, [2.25, 2.35, 7.05], 0.62, C.navy);
  body(s, "Private cloud implication: API และ database ต้องรองรับทั้ง write-heavy task operations และ read-heavy dashboard/report queries พร้อมกัน", 0.92, 6.08, 11.0, 0.35, { size: 11.5, bold: true, color: C.ink, align: "center" });
  addFooter(s, 6);
  return s;
}

function slide7() {
  const s = pptx.addSlide();
  addBg(s, C.white);
  title(s, "Private Cloud Sizing Scenarios", "ประเมินจากจำนวนผู้ใช้พร้อมกัน ปริมาณ task และ audit log");
  const rows = [
    ["Scenario", "Users", "Concurrent", "Task records", "Audit records", "Availability"],
    ["Small", "50-150", "10-30", "50k-200k", "100k-500k", "99.5%"],
    ["Medium", "150-500", "30-100", "200k-1M", "500k-3M", "99.9%"],
    ["Large", "500-1,500", "100-300", "1M-5M", "3M-15M", "99.9%+"],
  ];
  addTable(s, rows, 0.72, 1.75, [1.55, 1.55, 1.55, 2.1, 2.1, 1.7], 0.75, C.blue);
  body(s, "ข้อสังเกต: database เป็นตัวกำหนด capacity สำคัญกว่าตัว frontend เพราะระบบมี dashboard, filtering, job tracker, realtime และ audit log", 0.9, 5.08, 11.1, 0.58, { size: 14.2, bold: true, color: C.ink, align: "center" });
  pill(s, "Recommended starting point: Medium-lite", 4.55, 6.12, 4.05, C.green);
  addFooter(s, 7);
  return s;
}

function slide8() {
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Recommended Production Baseline", "Medium-lite spec สำหรับเริ่ม production แล้ววัด workload จริง 30-60 วัน");
  const rows = [
    ["Component", "Recommended Baseline"],
    ["Load Balancer", "2 nodes, 2 vCPU, 4 GB RAM"],
    ["Frontend", "2 nodes, 2 vCPU, 2 GB RAM"],
    ["API", "2 nodes, 4 vCPU, 8-16 GB RAM"],
    ["Realtime", "1-2 nodes, 4 vCPU, 8 GB RAM"],
    ["PostgreSQL Primary", "8 vCPU, 32 GB RAM, 1 TB NVMe/SSD"],
    ["PostgreSQL Replica", "8 vCPU, 32 GB RAM, 1 TB NVMe/SSD"],
    ["Redis", "2 nodes, 2-4 vCPU, 8 GB RAM"],
    ["Monitoring/Logging", "4 vCPU, 16 GB RAM, 500 GB disk"],
    ["Backup Storage", "3 TB"],
  ];
  addTable(s, rows, 0.72, 1.42, [3.2, 7.75], 0.48, C.green);
  body(s, "เหมาะกับ concurrent users ประมาณ 30-100 คน และ task records หลักแสนถึงประมาณ 1 ล้านรายการ", 1.0, 6.36, 10.7, 0.35, { size: 12.5, bold: true, color: C.ink, align: "center" });
  addFooter(s, 8);
  return s;
}

function slide9() {
  const s = pptx.addSlide();
  addBg(s, C.white);
  title(s, "Reliability, Security & DR", "สิ่งที่ต้องกำหนดให้ชัดก่อนเปิดใช้งานจริง");
  const blocks = [
    ["Network & Access", C.blue, "Public zone เฉพาะ reverse proxy\nAPI/DB อยู่ private zone\nAdmin access ผ่าน VPN/Bastion"],
    ["Database Reliability", C.green, "Postgres primary + replica\nSSD/NVMe + WAL archive\nindex ตาม filter สำคัญ"],
    ["Observability", C.violet, "API latency, 5xx, timeout\nDB slow query / locks\nbusiness health checks"],
    ["Backup & DR", C.amber, "Daily full + PITR เมื่อทำได้\nRPO 1-4 ชม. สำหรับ Medium\nrestore drill อย่างน้อยรายไตรมาส"],
  ];
  blocks.forEach(([h, c, b], i) => {
    const x = 0.78 + (i % 2) * 6.05;
    const y = 1.72 + Math.floor(i / 2) * 2.18;
    box(s, x, y, 5.25, 1.42, i % 2 ? "F7FBF8" : "F7F9FF", "D7DEE8");
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.08, h: 1.42, fill: { color: c }, line: { color: c } });
    body(s, h, x + 0.28, y + 0.22, 4.6, 0.25, { size: 12.2, bold: true, color: C.ink });
    body(s, b, x + 0.28, y + 0.62, 4.55, 0.55, { size: 9.1, color: C.slate });
  });
  addFooter(s, 9);
  return s;
}

function slide10() {
  const s = pptx.addSlide();
  addBg(s, C.navy);
  title(s, "Go-live Recommendation", "ลำดับการตัดสินใจเพื่อย้ายจาก sizing ไปสู่การใช้งานจริง", true);
  const steps = [
    ["1", "Approve Medium-lite baseline", "ใช้เป็น production starting point"],
    ["2", "Configure private cloud environment", "network, secrets, Postgres, Redis, monitoring"],
    ["3", "Run side-by-side UAT", "เทียบ workflow และรายงานกับระบบเดิม"],
    ["4", "Measure 30-60 days", "เก็บ workload จริงก่อน scale เพิ่ม"],
  ];
  steps.forEach(([n, h, b], i) => {
    const y = 1.68 + i * 1.12;
    s.addText(n, { x: 0.82, y, w: 0.42, h: 0.42, fontFace: font, fontSize: 17, bold: true, color: C.teal, margin: 0, align: "center" });
    s.addText(h, { x: 1.45, y: y - 0.02, w: 4.4, h: 0.28, fontFace: font, fontSize: 14.5, bold: true, color: C.white, margin: 0 });
    s.addText(b, { x: 1.45, y: y + 0.38, w: 4.95, h: 0.25, fontFace: font, fontSize: 9.4, color: "C8D4E6", margin: 0 });
    if (i < steps.length - 1) s.addShape(pptx.ShapeType.line, { x: 1.03, y: y + 0.55, w: 0, h: 0.42, line: { color: "3B4A63", width: 1.5 } });
  });
  box(s, 7.15, 2.0, 4.85, 2.75, "111C30", "2C3B56");
  body(s, "Executive ask", 7.55, 2.35, 3.8, 0.28, { size: 11, bold: true, color: C.teal });
  body(s, "อนุมัติ baseline และให้ทีม IT/Operations เตรียม environment สำหรับ METRIX Verity พร้อม UAT checklist", 7.55, 2.85, 3.95, 0.92, { size: 18, bold: true, color: C.white });
  body(s, "Scale เพิ่มจากข้อมูลจริง ไม่ overprovision ตั้งแต่วันแรก", 7.55, 4.15, 3.6, 0.3, { size: 10, color: "AAB8CE" });
  addFooter(s, 10);
  return s;
}

const slides = [slide1(), slide2(), slide3(), slide4(), slide5(), slide6(), slide7(), slide8(), slide9(), slide10()];

const pptxPath = path.join(outDir, "METRIX-Verity-Executive-Workflow-Private-Cloud-Sizing.pptx");
await pptx.writeFile({ fileName: pptxPath });

const artifactTool = await import(`file:///${runtimeNodeModules.replaceAll("\\", "/")}/@oai/artifact-tool/dist/artifact_tool.mjs`);
const { FileBlob, PresentationFile, drawSlideToCtx } = artifactTool;
const imported = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
const previewPaths = [];
for (let i = 1; i <= imported.slides.items.length; i += 1) {
  const previewPath = path.join(previewDir, `slide-${String(i).padStart(2, "0")}.png`);
  const canvas = new Canvas(1280, 720);
  const ctx = canvas.getContext("2d");
  await drawSlideToCtx(imported.slides.items[i - 1], imported, ctx);
  await fs.promises.writeFile(previewPath, await canvas.toBuffer("png"));
  previewPaths.push(previewPath);
}

const thumbs = await Promise.all(previewPaths.map((p) => sharp(p).resize(400, 225).toBuffer()));
const montageW = 800;
const montageH = 1125;
const composite = thumbs.map((input, idx) => ({
  input,
  left: (idx % 2) * 400,
  top: Math.floor(idx / 2) * 225,
}));
const montagePath = path.join(previewDir, "montage.png");
await sharp({ create: { width: montageW, height: montageH, channels: 4, background: "#F7F8FA" } })
  .composite(composite)
  .png()
  .toFile(montagePath);

console.log(JSON.stringify({ pptxPath, previewDir, montagePath, slides: slides.length }, null, 2));
