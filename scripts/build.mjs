import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });
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
await writeFile(configPath, nextConfig, "utf8");

const jsxBuilds = [
  ["maxiwa.js", "MaxiwaKpiApp"],
  ["executive-dashboard.js", "MaxiwaExecutiveDashboard"],
];

await esbuild.build({
  entryPoints: [path.join(root, "src", "vendor-react.js")],
  outfile: path.join(distDir, "js", "vendor-react.js"),
  bundle: true,
  format: "iife",
  target: ["es2019"],
  logLevel: "silent",
});

for (const [fileName, globalName] of jsxBuilds) {
  await esbuild.build({
    entryPoints: [path.join(publicDir, "js", fileName)],
    outfile: path.join(distDir, "js", fileName),
    bundle: false,
    format: "iife",
    globalName,
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    loader: { ".js": "jsx" },
    target: ["es2019"],
    logLevel: "silent",
  });
}

for (const htmlFile of ["index.html", "maxiwa.html", "dashboard.html"]) {
  const htmlPath = path.join(distDir, htmlFile);
  const html = await readFile(htmlPath, "utf8");
  await writeFile(
    htmlPath,
    html
      .replace(
        '<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>\n  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>\n  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>',
        htmlFile === "dashboard.html" ? '<script src="/js/vendor-react.js"></script>' : '<script src="./js/vendor-react.js"></script>'
      )
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
      ),
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
