import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

const apiBase = process.env.MAXIWA_API_BASE || "https://spds-1.kobpatme.workers.dev/api";
const configPath = path.join(distDir, "config.js");
const configTemplate = await readFile(path.join(publicDir, "config.js"), "utf8");
const nextConfig = configTemplate.replace(
  /window\.API_BASE\s*=\s*window\.API_BASE\s*\|\|\s*["'][^"']+["'];/,
  `window.API_BASE = window.API_BASE || ${JSON.stringify(apiBase)};`
);
await writeFile(configPath, nextConfig, "utf8");

console.log(`Built MAXIWA KPI to dist with API base: ${apiBase}`);
