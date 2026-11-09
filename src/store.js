import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// The packaged desktop app points this at the OS application-data folder so
// that digests survive app updates and are never written inside the install.
export const DATA_DIR = process.env.UPSC_DATA_DIR
  ? path.resolve(process.env.UPSC_DATA_DIR)
  : path.join(ROOT, "data");
export const DIGEST_DIR = path.join(DATA_DIR, "digests");
export const LOG_DIR = path.join(DATA_DIR, "logs");
export const CACHE_FILE = path.join(DATA_DIR, "cache", "articles.json");
export const INDEX_FILE = path.join(DATA_DIR, "index.json");
export const META_FILE = path.join(DATA_DIR, "meta.json");
export const LOCK_FILE = path.join(DATA_DIR, "run.lock");

export async function ensureDirs() {
  await Promise.all([
    fs.mkdir(DIGEST_DIR, { recursive: true }),
    fs.mkdir(LOG_DIR, { recursive: true }),
    fs.mkdir(path.dirname(CACHE_FILE), { recursive: true }),
  ]);
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export function dateKey(date = new Date(), timeZone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function timeLabel(date, timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export async function saveDigest(digest) {
  await ensureDirs();
  await writeJsonAtomic(path.join(DIGEST_DIR, `${digest.date}.json`), digest);
  await updateIndex(digest);
}

export async function readDigest(date) {
  return readJson(path.join(DIGEST_DIR, `${date}.json`), null);
}

export async function updateIndex(digest) {
  const index = await readJson(INDEX_FILE, []);
  const entry = {
    date: digest.date,
    generatedAt: digest.generatedAt,
    count: digest.items.length,
    topHeadline: digest.items[0]?.title || "",
    byPaper: digest.stats?.byPaper || {},
    sources: digest.stats?.sourcesUsed || 0,
  };
  const next = [entry, ...index.filter((x) => x.date !== digest.date)]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 400);
  await writeJsonAtomic(INDEX_FILE, next);
  return next;
}

export async function listDigests() {
  const index = await readJson(INDEX_FILE, null);
  if (Array.isArray(index)) return index;
  // Rebuild index from files if it is missing.
  await ensureDirs();
  const files = (await fs.readdir(DIGEST_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  const entries = [];
  for (const file of files.sort().reverse()) {
    const digest = await readJson(path.join(DIGEST_DIR, file), null);
    if (!digest) continue;
    entries.push({
      date: digest.date,
      generatedAt: digest.generatedAt,
      count: digest.items.length,
      topHeadline: digest.items[0]?.title || "",
      byPaper: digest.stats?.byPaper || {},
      sources: digest.stats?.sourcesUsed || 0,
    });
  }
  await writeJsonAtomic(INDEX_FILE, entries);
  return entries;
}

export async function getItemById(id) {
  await ensureDirs();
  const files = (await fs.readdir(DIGEST_DIR)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
  for (const file of files) {
    const digest = await readJson(path.join(DIGEST_DIR, file), null);
    const found = digest?.items?.find((item) => item.id === id);
    if (found) return { ...found, date: digest.date };
  }
  return null;
}

export async function readMeta() {
  return readJson(META_FILE, {
    lastRunAt: null,
    lastSuccessAt: null,
    lastDate: null,
    stats: null,
    errors: [],
    history: [],
  });
}

export async function writeMeta(patch) {
  const current = await readMeta();
  const next = { ...current, ...patch };
  await writeJsonAtomic(META_FILE, next);
  return next;
}

export async function appendHistory(entry) {
  const meta = await readMeta();
  const history = [entry, ...(meta.history || [])].slice(0, 60);
  await writeJsonAtomic(META_FILE, { ...meta, history });
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to another user.
    return err.code === "EPERM";
  }
}

export async function acquireLock(maxAgeMinutes = 25) {
  await ensureDirs();
  try {
    await fs.writeFile(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), { flag: "wx" });
    return true;
  } catch {
    try {
      const raw = await fs.readFile(LOCK_FILE, "utf8");
      const lock = JSON.parse(raw);
      const expired = Date.now() - lock.startedAt > maxAgeMinutes * 60000;
      const abandoned = !isProcessAlive(Number(lock.pid));
      if (expired || abandoned) {
        await fs.unlink(LOCK_FILE).catch(() => {});
        await fs.writeFile(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), { flag: "wx" });
        return true;
      }
    } catch {
      await fs.unlink(LOCK_FILE).catch(() => {});
    }
    return false;
  }
}

export async function releaseLock() {
  await fs.unlink(LOCK_FILE).catch(() => {});
}

export async function appendLog(line) {
  await ensureDirs();
  const file = path.join(LOG_DIR, `${dateKey()}.log`);
  await fs.appendFile(file, `[${new Date().toISOString()}] ${line}\n`, "utf8").catch(() => {});
}

export async function loadArticleCache() {
  const cache = await readJson(CACHE_FILE, {});
  const cutoff = Date.now() - 7 * 24 * 36e5;
  const entries = Object.entries(cache).filter(([, v]) => v?.fetchedAt > cutoff);
  entries.sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  return Object.fromEntries(entries.slice(0, 1500));
}

export async function saveArticleCache(cache) {
  const entries = Object.entries(cache)
    .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
    .slice(0, 1500);
  await writeJsonAtomic(CACHE_FILE, Object.fromEntries(entries));
}
