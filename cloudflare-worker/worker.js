/**
 * Cloudflare Worker for MAD data persistence.
 *
 * Required bindings:
 * - KV namespace: MAD_DATA_KV
 * - Secret: ADMIN_PASSWORD
 *
 * Optional:
 * - ALLOW_ORIGIN (default: "*")
 */

const DATA_KEY = "mad-data-v1";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({ ok: true, service: "mad-worker" }, env);
    }

    if (url.pathname === "/auth" && request.method === "POST") {
      if (!isAuthorized(request, env)) {
        return jsonResponse({ message: "Unauthorized" }, env, 401);
      }
      return jsonResponse({ ok: true }, env);
    }

    if (url.pathname === "/mad-data" && request.method === "GET") {
      const raw = await env.MAD_DATA_KV.get(DATA_KEY);
      if (!raw) {
        return jsonResponse(createEmptyData(), env);
      }
      try {
        return jsonResponse(normalizeData(JSON.parse(raw)), env);
      } catch {
        return jsonResponse(createEmptyData(), env);
      }
    }

    if (url.pathname === "/mad-data" && request.method === "POST") {
      if (!isAuthorized(request, env)) {
        return jsonResponse({ message: "Unauthorized" }, env, 401);
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ message: "Invalid JSON body" }, env, 400);
      }

      const data = normalizeData(payload);
      data.updatedAt = new Date().toISOString();
      await env.MAD_DATA_KV.put(DATA_KEY, JSON.stringify(data));
      return jsonResponse({ ok: true, updatedAt: data.updatedAt }, env);
    }

    return jsonResponse({ message: "Not Found" }, env, 404);
  }
};

function isAuthorized(request, env) {
  const input = request.headers.get("X-Admin-Password") || "";
  const expected = env.ADMIN_PASSWORD || "";
  return Boolean(input) && Boolean(expected) && input === expected;
}

function jsonResponse(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env)
    }
  });
}

function corsHeaders(env) {
  const allowOrigin = env.ALLOW_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password"
  };
}

function normalizeData(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    version: Number(source.version || 1),
    updatedAt: source.updatedAt || new Date().toISOString(),
    events: Array.isArray(source.events) ? source.events : [],
    honors: Array.isArray(source.honors) ? source.honors : [],
    pets: Array.isArray(source.pets) ? source.pets : [],
    logs: Array.isArray(source.logs) ? source.logs : []
  };
}

function createEmptyData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    events: [],
    honors: [],
    pets: [],
    logs: []
  };
}

