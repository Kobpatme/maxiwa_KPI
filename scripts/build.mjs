import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");

async function gitValue(args, fallback) {
  try {
    const { stdout } = await execFileAsync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args], { cwd: root });
    return stdout.trim() || fallback;
  } catch { return fallback; }
}
const commit = process.env.CF_PAGES_COMMIT_SHA || await gitValue(["rev-parse", "HEAD"], "local");
const version = {
  app: "metrixverity",
  commit,
  shortCommit: commit.slice(0, 7),
  branch: process.env.CF_PAGES_BRANCH || await gitValue(["branch", "--show-current"], "local"),
  builtAt: new Date().toISOString(),
};

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });
await writeFile(path.join(distDir, "version.json"), JSON.stringify(version, null, 2) + "\n", "utf8");
await mkdir(path.join(distDir, "css"), { recursive: true });

await execFileAsync(process.execPath, [
  path.join(root, "node_modules", "tailwindcss", "lib", "cli.js"),
  "-c",
  path.join(root, "tailwind.config.cjs"),
  "-i",
  path.join(root, "src", "tailwind.css"),
  "-o",
  path.join(distDir, "css", "tailwind.css"),
  "--minify",
], { cwd: root });

const apiBase = process.env.MAXIWA_API_BASE || "/api";
const configPath = path.join(distDir, "config.js");
const configTemplate = await readFile(path.join(publicDir, "config.js"), "utf8");
const nextConfig = configTemplate.replace(
  /window\.API_BASE\s*=\s*window\.API_BASE\s*\|\|\s*["'][^"']+["'];/,
  `window.API_BASE = window.API_BASE || ${JSON.stringify(apiBase)};`
);
await writeFile(configPath, `${nextConfig}\nwindow.MAXIWA_BUILD_VERSION = ${JSON.stringify(version)};\n`, "utf8");

const jsxBuilds = [
  ["maxiwa.js", "MaxiwaKpiApp"],
  ["executive-dashboard.js", "MaxiwaExecutiveDashboard"],
];

for (const [fileName, globalName] of jsxBuilds) {
  await esbuild.build({
    entryPoints: [path.join(publicDir, "js", fileName)],
    outfile: path.join(distDir, "js", fileName),
    bundle: true,
    format: "iife",
    globalName,
    inject: [path.join(root, "src", "react-shim.js")],
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    loader: { ".js": "jsx" },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    minify: true,
    target: ["es2019"],
    logLevel: "silent",
  });
}

for (const htmlFile of (await readdir(distDir)).filter((name) => name.endsWith(".html"))) {
  const htmlPath = path.join(distDir, htmlFile);
  const html = await readFile(htmlPath, "utf8");
  await writeFile(
    htmlPath,
    html
      .replace(/^\s*<script src="https:\/\/unpkg\.com\/react@18\/umd\/react\.production\.min\.js"><\/script>\r?\n/m, "")
      .replace(/^\s*<script src="https:\/\/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js"><\/script>\r?\n/m, "")
      .replace(/^\s*<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\r?\n/m, "")
      .replace(/^\s*<script src="(?:\.\/|\/)js\/vendor-react\.js"><\/script>\r?\n/m, "")
      .replace(/^\s*<script>\r?\n\s*if \(!window\.React \|\| !window\.ReactDOM\) \{\r?\n\s*document\.write\('<script src="https:\/\/unpkg\.com\/react@18\/umd\/react\.production\.min\.js"><\\\/script>'\);\r?\n\s*document\.write\('<script src="https:\/\/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js"><\\\/script>'\);\r?\n\s*\}\r?\n\s*<\/script>\r?\n/m, "")
      .replace(
        '<script type="text/babel" src="./js/maxiwa.js"></script>',
        '<script src="./js/maxiwa.js"></script>'
      )
      .replace(
        '<script type="text/babel" src="./js/executive-dashboard.js"></script>',
        '<script src="./js/executive-dashboard.js"></script>'
      )
      .replace(
        '<script type="text/babel" src="/js/executive-dashboard.js"></script>',
        '<script src="/js/executive-dashboard.js"></script>'
      )
      .replace(/\b(src|href)=(['"])((?:\.\/|\/)?(?:css\/[^'"?]+\.css|js\/[^'"?]+\.js|config\.js))(?:\?[^'"]*)?\2/g,
        (_, attr, quote, asset) => `${attr}=${quote}${asset}?v=${encodeURIComponent(version.shortCommit)}${quote}`),
    "utf8"
  );
}

const dashboardHtml = await readFile(path.join(distDir, "dashboard.html"), "utf8");
for (const cleanRoute of ["dashboard", "executive"]) {
  const routeDir = path.join(distDir, cleanRoute);
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, "index.html"), dashboardHtml, "utf8");
}

console.log(`Built MAXIWA KPI to dist with API base: ${apiBase}`);
