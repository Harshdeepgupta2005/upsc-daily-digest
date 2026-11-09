import { readMeta, readDigest, dateKey } from "./store.js";

export function istParts(date = new Date(), timeZone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function addDaysToKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// Convert a wall-clock time in an IANA timezone to the matching UTC instant.
// Intl gives us the zone offset for a guessed instant; a couple of correction
// passes are enough even across daylight-saving transitions.
function zonedTimeToUtc(dateKey, hour, minute, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = istParts(new Date(timestamp), timeZone);
    const [y, m, d] = parts.date.split("-").map(Number);
    const localAsUtc = Date.UTC(y, m - 1, d, parts.hour, parts.minute);
    const offset = localAsUtc - timestamp;
    const desired = targetAsUtc - offset;
    if (desired === timestamp) break;
    timestamp = desired;
  }
  return new Date(timestamp);
}

export function nextRunInfo(runAt, now = new Date(), timeZone = "Asia/Kolkata") {
  const [hour, minute] = String(runAt || "06:00").split(":").map(Number);
  const today = istParts(now, timeZone).date;
  let date = today;
  let candidate = zonedTimeToUtc(date, hour, minute, timeZone);
  if (candidate.getTime() <= now.getTime()) {
    date = addDaysToKey(date, 1);
    candidate = zonedTimeToUtc(date, hour, minute, timeZone);
  }
  return { at: candidate.toISOString(), date: istParts(candidate, timeZone).date };
}

export function startScheduler({ config, startRun, getRunning }) {
  if (!config.scheduler?.enabled) return () => {};
  const every = Math.max(5, config.scheduler?.checkEveryMinutes || 20) * 60000;

  const check = async () => {
    try {
      if (getRunning()) return;
      const now = new Date();
      const { date, hour, minute } = istParts(now, config.timezone);
      const [runHour, runMinute] = String(config.runAt || "06:00").split(":").map(Number);
      if (hour < runHour || (hour === runHour && minute < runMinute)) return;

      const meta = await readMeta();
      if (meta.lastDate === date) return;
      if (meta.lastRunAt && Date.now() - new Date(meta.lastRunAt).getTime() < 75 * 60000) return;

      const today = await readDigest(date);
      if (today) return;
      startRun(`Scheduled run for ${date}`);
    } catch (err) {
      console.error("[scheduler]", err.message);
    }
  };

  const timer = setInterval(check, every);
  timer.unref?.();
  setTimeout(check, 15000).unref?.();
  return () => clearInterval(timer);
}

export async function isStale(config) {
  const today = dateKey(new Date(), config.timezone);
  const digest = await readDigest(today);
  if (!digest) return { stale: true, reason: "No digest for today yet", digest: null };
  const ageHours = (Date.now() - new Date(digest.generatedAt).getTime()) / 36e5;
  return {
    stale: ageHours > (config.freshnessHours || 9),
    ageHours,
    reason: ageHours > (config.freshnessHours || 9) ? `Digest is ${Math.round(ageHours)}h old` : "",
    digest,
  };
}
