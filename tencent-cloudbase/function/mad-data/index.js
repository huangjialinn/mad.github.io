const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({
  env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.ENV_ID
});

const db = app.database();
const COLLECTION = "mad_data";
const DOC_ID = "main";

exports.main = async (event) => {
  const method = String(event.httpMethod || "GET").toUpperCase();
  const headers = normalizeHeaders(event.headers || {});

  if (method === "OPTIONS") {
    return buildResponse(204, null);
  }

  if (method === "GET") {
    const data = await readData();
    return buildResponse(200, data);
  }

  if (method === "POST") {
    const expected = String(process.env.ADMIN_PASSWORD || "");
    const provided = String(headers["x-admin-password"] || "");
    if (!expected || provided !== expected) {
      return buildResponse(401, { message: "Unauthorized" });
    }

    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (error) {
      return buildResponse(400, { message: "Invalid JSON body" });
    }

    const data = normalizeData(payload);
    data.updatedAt = new Date().toISOString();
    await writeData(data);
    return buildResponse(200, { ok: true, updatedAt: data.updatedAt });
  }

  return buildResponse(404, { message: "Not Found" });
};

async function readData() {
  try {
    const res = await db.collection(COLLECTION).doc(DOC_ID).get();
    const doc = res.data || res.data?.[0];
    if (doc && doc.payload) {
      return normalizeData(doc.payload);
    }
  } catch (error) {
    // ignore and fallback
  }
  return createEmptyData();
}

async function writeData(payload) {
  await db.collection(COLLECTION).doc(DOC_ID).set({
    payload
  });
}

function normalizeHeaders(headers) {
  const next = {};
  Object.keys(headers).forEach((key) => {
    next[key.toLowerCase()] = headers[key];
  });
  return next;
}

function buildResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password"
    },
    body: data ? JSON.stringify(data) : ""
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

