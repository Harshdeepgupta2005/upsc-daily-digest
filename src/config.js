import path from "node:path";
import { ROOT, readJson } from "./store.js";

export const DEFAULTS = {
  port: 4178,
  runAt: "06:00",
  timezone: "Asia/Kolkata",
  freshnessHours: 9,
  maxItemAgeHours: 40,
  enrichTopStories: 32,
  enrichConcurrency: 5,
  feedConcurrency: 8,
  minRelevance: 30,
  disabledFeeds: [],
  scheduler: { enabled: true, checkEveryMinutes: 20 },
};

export async function loadConfig() {
  const file = process.env.UPSC_CONFIG
    ? path.resolve(process.env.UPSC_CONFIG)
    : path.join(ROOT, "config.json");
  const raw = await readJson(file, {});
  const config = { ...DEFAULTS, ...raw };
  config.scheduler = { ...DEFAULTS.scheduler, ...(raw.scheduler || {}) };
  config.port = Number(process.env.PORT || config.port || DEFAULTS.port);
  config.freshnessHours = Number(config.freshnessHours) || DEFAULTS.freshnessHours;
  config.maxItemAgeHours = Number(config.maxItemAgeHours) || DEFAULTS.maxItemAgeHours;
  config.enrichTopStories = Number(config.enrichTopStories) || DEFAULTS.enrichTopStories;
  config.disabledFeeds = Array.isArray(config.disabledFeeds) ? config.disabledFeeds : [];
  return config;
}
