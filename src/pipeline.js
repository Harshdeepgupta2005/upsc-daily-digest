import { activeSources } from "./sources.js";
import { parseFeed } from "./rss.js";
import { prepareItem, clusterItems, buildFinalItem, selectItems } from "./analyzer.js";
import { enrichUrl } from "./enrich.js";
import { fetchText, mapLimit } from "./http.js";
import { dateKey, timeLabel } from "./store.js";
import {
  acquireLock, releaseLock, loadArticleCache, saveArticleCache, saveDigest,
  writeMeta, appendHistory, appendLog, readMeta,
} from "./store.js";

function clusterScore(cluster) {
  const outlets = new Set(cluster.members.map((m) => m.outlet));
  const official = cluster.members.some((m) => m.sourceKind === "official");
  return cluster.baseScore + Math.min(outlets.size - 1, 4) * 5 + (official ? 6 : 0);
}

function contentTarget(cluster) {
  const scored = cluster.members.map((m) => {
    let s = 0;
    if (["national", "specialist", "business"].includes(m.sourceKind)) s += 6;
    if (m.sourceKind === "official") s += 1;
    s += Math.min(m.summary.length / 90, 7);
    if (m.image) s += 1;
    if (m.dateEstimated) s -= 2;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].m;
}

function summariseBy(items, key) {
  const out = {};
  for (const item of items) out[item[key]] = (out[item[key]] || 0) + 1;
  return out;
}

export async function runResearch({ config, onProgress = () => {}, log = () => {} }) {
  const startedAt = Date.now();
  const now = Date.now();
  const date = dateKey(new Date(now), config.timezone);

  const locked = await acquireLock();
  if (!locked) {
    return { skipped: true, reason: "Another research run is already in progress." };
  }

  const progress = (stage, message, extra = {}) => {
    onProgress({ stage, message, startedAt, ...extra });
  };

  try {
    const sources = activeSources(config);
    progress("feeds", `Scanning ${sources.length} trusted feeds…`, { done: 0, total: sources.length });

    const feedResults = await mapLimit(
      sources,
      config.feedConcurrency || 8,
      async (source) => {
        const res = await fetchText(source.url, {
          timeout: 18000,
          retries: 1,
          headers: { accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*" },
        });
        if (!res.ok) return { source, items: [], error: res.error || "Fetch failed" };
        const parsed = parseFeed(res.text, source);
        return { source, items: parsed.items, error: parsed.error || "" };
      },
      (done, total, source) => {
        progress("feeds", `Scanned ${source.name}`, { done, total, feed: source.name });
      }
    );

    const feedStats = feedResults.map((r) => ({
      id: r.source.id,
      name: r.source.name,
      kind: r.source.kind,
      items: r.items?.length || 0,
      error: r.error || "",
    }));
    const feedsOk = feedStats.filter((f) => !f.error).length;
    const feedsFailed = feedStats.length - feedsOk;

    const rawItems = feedResults.flatMap((r) => r.items || []);
    if (!rawItems.length) throw new Error("No articles could be downloaded. Check the internet connection or feed status.");

    progress("analyze", `Reading ${rawItems.length} articles for UPSC relevance…`, {
      done: 0,
      total: rawItems.length,
    });

    const prepared = [];
    let processed = 0;
    for (const raw of rawItems) {
      const item = prepareItem(raw, now, config);
      if (item) prepared.push(item);
      processed++;
      if (processed % 120 === 0) {
        progress("analyze", `Scored ${processed} of ${rawItems.length} articles…`, {
          done: processed,
          total: rawItems.length,
        });
      }
    }

    // Collapse exact duplicate URLs across feeds, keeping the strongest version.
    const byUrl = new Map();
    for (const item of prepared) {
      const existing = byUrl.get(item.url);
      if (!existing || item.baseScore > existing.baseScore) byUrl.set(item.url, item);
    }
    const unique = [...byUrl.values()];

    progress("cluster", `Grouping coverage across outlets…`, { done: 0, total: unique.length });
    const clusters = clusterItems(unique).sort((a, b) => clusterScore(b) - clusterScore(a));

    const enrichLimit = Math.min(config.enrichTopStories || 32, clusters.length);
    const enrichTargets = clusters.slice(0, enrichLimit).map((c) => ({ cluster: c, target: contentTarget(c) }));

    const cache = await loadArticleCache();
    const enrichedMap = new Map();
    let enrichedOk = 0;
    progress("enrich", `Reading full articles (0/${enrichLimit})…`, { done: 0, total: enrichLimit });

    await mapLimit(
      enrichTargets,
      config.enrichConcurrency || 5,
      async ({ cluster, target }, i) => {
        const result = await enrichUrl(target.rawUrl || target.url, cache);
        enrichedMap.set(cluster, result);
        if (result.body || result.description) enrichedOk++;
        progress("enrich", `Extracted full text from ${target.outlet}`, {
          done: i + 1,
          total: enrichLimit,
        });
        return result;
      },
      (done, total) => {
        progress("enrich", `Reading full articles (${done}/${total})…`, { done, total });
      }
    ).catch(() => {});

    await saveArticleCache(cache).catch(() => {});

    progress("build", "Building verified notes, facts and MCQs…", { done: 0, total: clusters.length });
    const built = clusters.map((cluster) => {
      const enriched = enrichedMap.get(cluster) || null;
      return buildFinalItem(cluster, enriched);
    });

    const items = selectItems(built, config);
    if (!items.length) throw new Error("Articles were downloaded but none cleared the UPSC relevance threshold.");

    items.forEach((item, index) => {
      item.rank = index + 1;
    });

    const generatedAt = new Date().toISOString();
    const stats = {
      feedsTotal: feedStats.length,
      feedsOk,
      feedsFailed,
      articlesScanned: rawItems.length,
      articlesRelevant: unique.length,
      clusters: clusters.length,
      items: items.length,
      enriched: enrichedOk,
      sourcesUsed: new Set(items.flatMap((i) => i.sources.map((s) => s.name))).size,
      byPaper: summariseBy(items, "paper"),
      byTheme: summariseBy(items, "theme"),
      verification: {
        official: items.filter((i) => i.verification.officialCount > 0).length,
        multiSource: items.filter((i) => i.verification.outletCount > 1).length,
        single: items.filter((i) => i.verification.outletCount === 1).length,
      },
      durationMs: Date.now() - startedAt,
    };

    const errors = feedStats.filter((f) => f.error).map((f) => ({ source: f.name, message: f.error }));
    const digest = {
      date,
      generatedAt,
      timezone: config.timezone,
      stats,
      sourceStats: feedStats,
      errors,
      items,
    };

    progress("save", "Saving today's digest…");
    await saveDigest(digest);

    const prevMeta = await readMeta();
    const historyEntry = {
      date,
      at: generatedAt,
      durationMs: stats.durationMs,
      items: items.length,
      scanned: rawItems.length,
      feedsOk,
      feedsFailed,
      errors: errors.slice(0, 4),
    };
    await writeMeta({
      lastRunAt: generatedAt,
      lastSuccessAt: generatedAt,
      lastDate: date,
      lastRunLabel: timeLabel(new Date(generatedAt), config.timezone),
      durationMs: stats.durationMs,
      stats,
      errors: errors.slice(0, 8),
      history: [historyEntry, ...(prevMeta.history || [])].slice(0, 60),
    });

    progress("done", `Digest ready — ${items.length} stories from ${stats.sourcesUsed} sources.`, {
      done: items.length,
      total: items.length,
    });
    log(`Run complete: ${items.length} items, ${stats.sourcesUsed} sources, ${feedsFailed} feed errors, ${stats.durationMs}ms`);
    return digest;
  } catch (err) {
    await writeMeta({ lastRunAt: new Date().toISOString(), lastError: err.message }).catch(() => {});
    await appendHistory({
      date,
      at: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: err.message,
    }).catch(() => {});
    log(`Run failed: ${err.stack || err.message}`);
    onProgress({ stage: "error", message: err.message, startedAt });
    throw err;
  } finally {
    await releaseLock();
  }
}

export async function runAndLog(config) {
  return runResearch({ config, log: (line) => appendLog(line).catch(() => {}) });
}
