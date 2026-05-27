import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./public/_worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const distRoot = path.join(root, "dist");
const envFile = path.join(root, ".dev.vars");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 8788);

function parseEnvFile(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  const fileText = await readFile(envFile, "utf8").catch(() => "");
  return {
    CF_PAGES: "1",
    CF_PAGES_BRANCH: "local",
    CF_PAGES_COMMIT_SHA: "local-dev-server",
    CF_PAGES_URL: `http://${host}:${port}`,
    ...parseEnvFile(fileText),
  };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  }[ext] || "application/octet-stream";
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  if (!path.extname(pathname)) pathname = path.posix.join(pathname, "index.html");
  const filePath = path.normalize(path.join(distRoot, pathname));
  if (!filePath.startsWith(path.normalize(distRoot))) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function serveApi(req, res, env) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://${host}:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : body,
    duplex: "half",
  });
  const response = await worker.fetch(request, env);
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  const arrayBuffer = await response.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

const env = await loadEnv();

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url || "/").startsWith("/api")) {
      await serveApi(req, res, env);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error?.stack || error?.message || "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`MAXIWA local dev server ready on http://${host}:${port}`);
});
