const DEFAULT_BACKEND_API_BASE = "https://spds-1.kobpatme.workers.dev/api";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-empid",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function proxyApiRequest(request, env) {
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/api\/?/, "");
  const backendBase = (env.MAXIWA_BACKEND_API_BASE || DEFAULT_BACKEND_API_BASE).replace(/\/+$/, "");
  const targetUrl = `${backendBase}/${apiPath}${url.search}`;
  const headers = new Headers(request.headers);
  const headersToStrip = [
    "host",
    "origin",
    "referer",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "x-forwarded-proto",
    "x-real-ip",
  ];

  headersToStrip.forEach((header) => headers.delete(header));

  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow",
  });

  const responseHeaders = new Headers(backendResponse.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    responseHeaders.set(key, value);
  }
  responseHeaders.set("X-Maxiwa-Proxy-Target", `/api/${apiPath}`);

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      return proxyApiRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
