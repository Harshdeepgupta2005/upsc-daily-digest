import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { runResearch } from "./pipeline.js";
import { SOURCES } from "./sources.js";
import { startScheduler, isStale, nextRunInfo } from "./scheduler.js";
import {
  ROOT, DATA_DIR, ensureDirs, readMeta, readDigest, listDigests,
  getItemById, dateKey, timeLabel,
} from "./store.js";

const PUBLIC_DIR = path.join(ROOT, "public");
const DEFAULT_HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req, limit = 1e6) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function serveStatic(res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname.replace(/^\//, ""));
  const file = path.resolve(PUBLIC_DIR, rel);
  if (file !== PUBLIC_DIR && !file.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "no-cache",
      "content-length": data.length,
      "x-content-type-options": "nosniff",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

/**
 * Create the local HTTP app server without starting it.
 *
 * Data and configuration paths are resolved by `src/store.js` and
 * `src/config.js` when this module is imported, so callers that need custom
 * paths (the Electron app) must set `UPSC_DATA_DIR` and `UPSC_CONFIG` before
 * importing this module.
 */
export function createAppServer({
  config,
  host = DEFAULT_HOST,
  appVersion = null,
  logger = console,
} = {}) {
  if (!config) throw new Error("createAppServer requires a config object");

  const state = {
    running: false,
    stage: "idle",
    message: "Ready",
    done: 0,
    total: 0,
    startedAt: null,
    finishedAt: null,
    trigger: "",
    lastError: "",
    version: 0,
  };

  let server = null;
  let actualPort = null;
  let stopScheduler = () => {};
  let startupTimer = null;
  let closed = false;

  function startRun(reason = "Manual refresh") {
    if (state.running) return false;
    state.running = true;
    state.stage = "starting";
    state.message = "Starting research run…";
    state.done = 0;
    state.total = 0;
    state.startedAt = new Date().toISOString();
    state.finishedAt = null;
    state.trigger = reason;
    state.lastError = "";

    runResearch({
      config,
      onProgress: (p) => {
        state.stage = p.stage;
        state.message = p.message;
        state.done = p.done ?? state.done;
        state.total = p.total ?? state.total;
      },
    })
      .then((result) => {
        if (result?.skipped) {
          state.stage = "idle";
          state.message = result.reason;
        } else {
          state.stage = "done";
          state.message = `Digest ready — ${result.items.length} stories.`;
        }
      })
      .catch((err) => {
        state.stage = "error";
        state.lastError = err.message;
        state.message = `Research failed: ${err.message}`;
        logger.error("[research]", err);
      })
      .finally(() => {
        state.running = false;
        state.finishedAt = new Date().toISOString();
        state.version += 1;
      });
    return true;
  }

  async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || host}`);
    const { pathname, searchParams } = url;

    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader(
      "content-security-policy",
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
    );

    try {
      if (!pathname.startsWith("/api/")) {
        return await serveStatic(res, pathname);
      }

      if (pathname === "/api/health") {
        return sendJson(res, 200, {
          ok: true,
          app: "upsc-daily-digest",
          version: appVersion,
          uptime: process.uptime(),
        });
      }

      if (pathname === "/api/status") {
        const meta = await readMeta();
        const stale = await isStale(config);
        const today = dateKey(new Date(), config.timezone);
        return sendJson(res, 200, {
          ok: true,
          date: today,
          running: state.running,
          stage: state.stage,
          message: state.message,
          done: state.done,
          total: state.total,
          startedAt: state.startedAt,
          finishedAt: state.finishedAt,
          trigger: state.trigger,
          lastError: state.lastError,
          version: state.version,
          hasToday: Boolean(stale.digest),
          generatedAt: stale.digest?.generatedAt || null,
          generatedLabel: stale.digest?.generatedAt
            ? timeLabel(new Date(stale.digest.generatedAt), config.timezone)
            : null,
          stale: stale.stale,
          staleReason: stale.reason,
          stats: stale.digest?.stats || meta.stats || null,
          lastSuccessAt: meta.lastSuccessAt,
          lastRunAt: meta.lastRunAt,
          errors: meta.errors || [],
          config: {
            runAt: config.runAt,
            timezone: config.timezone,
            freshnessHours: config.freshnessHours,
            schedulerEnabled: Boolean(config.scheduler?.enabled),
            dataPath: DATA_DIR,
            feeds: SOURCES.length,
            disabledFeeds: config.disabledFeeds || [],
          },
          nextRun: nextRunInfo(config.runAt, new Date(), config.timezone),
        });
      }

      if (pathname === "/api/digest") {
        const date = searchParams.get("date") || dateKey(new Date(), config.timezone);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: "Invalid date" });
        const digest = await readDigest(date);
        if (!digest) return sendJson(res, 404, { error: "No digest stored for this date", date });
        return sendJson(res, 200, digest);
      }

      if (pathname === "/api/dates") {
        const dates = await listDigests();
        return sendJson(res, 200, { dates });
      }

      if (pathname === "/api/item") {
        const id = searchParams.get("id") || "";
        if (!/^[a-f0-9]{8,40}$/.test(id)) return sendJson(res, 400, { error: "Invalid id" });
        const item = await getItemById(id);
        if (!item) return sendJson(res, 404, { error: "Item not found" });
        return sendJson(res, 200, item);
      }

      if (pathname === "/api/sources") {
        const latest = await readDigest(dateKey(new Date(), config.timezone));
        const index = latest ? null : await listDigests();
        const fallback = index?.length ? await readDigest(index[0].date) : null;
        const sourceStats = latest?.sourceStats || fallback?.sourceStats || [];
        return sendJson(res, 200, {
          sources: SOURCES.map((s) => ({
            id: s.id,
            name: s.name,
            outlet: s.outlet,
            kind: s.kind,
            region: s.region,
            url: s.url,
            enabled: !(config.disabledFeeds || []).includes(s.id),
          })),
          stats: sourceStats,
          generatedAt: latest?.generatedAt || fallback?.generatedAt || null,
        });
      }

      if (pathname === "/api/refresh" && req.method === "POST") {
        await readBody(req);
        if (state.running) return sendJson(res, 409, { error: "A research run is already in progress." });
        startRun("Manual refresh");
        return sendJson(res, 202, { ok: true, message: "Research run started." });
      }

      if (pathname === "/api/export") {
        const date = searchParams.get("date") || dateKey(new Date(), config.timezone);
        const digest = await readDigest(date);
        if (!digest) return sendJson(res, 404, { error: "No digest for this date" });
        const body = JSON.stringify(digest, null, 2);
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="upsc-digest-${date}.json"`,
          "cache-control": "no-store",
        });
        return res.end(body);
      }

      return sendJson(res, 404, { error: "Unknown API route" });
    } catch (err) {
      logger.error("[server]", err);
      return sendJson(res, 500, { error: err.message });
    }
  }

  function listen(portToTry) {
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(server.address().port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(portToTry, host);
    });
  }

  async function start({ port = config.port, fallbackToRandom = false } = {}) {
    if (server) throw new Error("Server has already been started");
    await ensureDirs();
    server = http.createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        logger.error("[server]", err);
        if (!res.headersSent) sendJson(res, 500, { error: err.message });
        else res.end();
      });
    });

    try {
      actualPort = await listen(port);
    } catch (err) {
      if (err.code === "EADDRINUSE" && fallbackToRandom) {
        logger.warn(`[server] Port ${port} is in use; using a free port instead.`);
        actualPort = await listen(0);
      } else {
        server = null;
        throw err;
      }
    }

    server.on("error", (err) => logger.error("[server] runtime error:", err));

    stopScheduler = startScheduler({
      config,
      startRun,
      getRunning: () => state.running,
    });

    return actualPort;
  }

  function scheduleStartupResearch(delayMs = 900) {
    if (closed) return;
    if (startupTimer) clearTimeout(startupTimer);
    startupTimer = setTimeout(async () => {
      startupTimer = null;
      try {
        const stale = await isStale(config);
        if (stale.stale) {
          startRun(stale.digest ? "Auto refresh (digest stale)" : "First run for today");
        }
      } catch (err) {
        logger.error("[startup]", err.message);
      }
    }, delayMs);
    startupTimer.unref?.();
  }

  async function close() {
    closed = true;
    if (startupTimer) {
      clearTimeout(startupTimer);
      startupTimer = null;
    }
    try {
      stopScheduler();
    } catch {
      // Ignore scheduler shutdown errors.
    }
    if (!server) return;
    await new Promise((resolve) => server.close(() => resolve()));
    server = null;
  }

  return {
    state,
    start,
    close,
    startRun,
    scheduleStartupResearch,
    get port() {
      return actualPort;
    },
    get url() {
      return actualPort ? `http://${host}:${actualPort}` : null;
    },
    get server() {
      return server;
    },
    config,
    dataDir: DATA_DIR,
  };
}
