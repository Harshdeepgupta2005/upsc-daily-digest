import {
  cleanText, canonicalUrl, hashId, titleTokens, textTokens, jaccard, splitSentences,
  firstSentences, extractEntities, extractHooks, listJoin, clamp, escapeRegExp,
} from "./text.js";
import { THEMES, THEME_BY_ID, NEGATIVE_SIGNALS } from "./themes.js";

const THEME_MATCHERS = THEMES.map((theme) => ({
  theme,
  strong: theme.strong.map((kw) => ({ kw, re: keywordRegex(kw) })),
  medium: theme.medium.map((kw) => ({ kw, re: keywordRegex(kw) })),
}));

const NEGATIVE_MATCHERS = NEGATIVE_SIGNALS.map((kw) => ({ kw, re: keywordRegex(kw.trim()) }));

function keywordRegex(keyword) {
  const body = escapeRegExp(keyword).replace(/\\ /g, "\\s+");
  const suffix = keyword.length >= 5 ? "(?:s|es|ed|ing|al|ally|ment)?" : "";
  return new RegExp(`\\b${body}${suffix}\\b`, "i");
}

const GENERIC_ENTITIES = new Set([
  "india", "indian", "delhi", "new delhi", "modi", "government", "centre", "center",
  "union", "parliament", "supreme court", "world", "country", "state", "states", "pm",
  "cm", "bjp", "congress", "president", "ministry", "report", "study",
]);

// Format-level noise that never deserves a card, regardless of topic match.
const TITLE_NOISE = [
  /\b(?:live updates?|live blog|as it happened|news brief|evening brief|morning brief|daily brief|top 10|web story|photo gallery)\b/i,
  /^(?:watch|video|photos?|in pictures)\s*[:|-]/i,
  /\b(?:sensex|nifty|investor wealth|stock market rally|share market|market wrap)\b/i,
  /\b(?:bomb threat|ran out of fuel|coaches? gutted|fire broke out)\b/i,
  /\b(?:who is|meet the new|takes charge as|takes over as|appointed as director general|assumes charge as)\b/i,
  /\b(?:horoscope|zodiac|box office|streaming release|web series)\b/i,
  /\b(?:health quiz|quiz|crossword|word game)\b/i,
  /\b(?:india[- ]born|indian[- ]origin)\b.*\b(?:wins|elected|appointed|awarded|election|winners)\b/i,
  /\b(?:one-way traffic|traffic system|traffic advisory)\b/i,
  /\b(?:security cover|security category)\b/i,
  /\b(?:counting of votes|zptc|mptc)\b/i,
  /\b(?:ganja|narcotics|contraband|seized \d)/i,
  /\b(?:what we know|here'?s what|all you need to know)\b/i,
  /\brupee\b.*\b(?:surges?|falls?|rises?|closes?|weakens?|strengthens?|points)\b/i,
  /\b(?:market gains|markets rally|global markets|sensex|nifty)\b/i,
  /\b(?:flags?|orders?)\b.*\bviolation\b/i,
  /\b(?:jio|airtel|vodafone|broadband plan)\b/i,
  /\b(?:secures|raises)\s+₹/i,
  /\bpartners? with\b/i,
  /\b(?:x-70|flying lab)\b/i,
  // Partisan market commentary and foreign election horse-race coverage.
  /\b(?:market losses|blames? (?:democrats|republicans)|midterm elections?)\b/i,
  // Journal-article titles that read as lab reports, not current affairs.
  /\b(?:alkali-activated|multi-waste|physicochemical|intercropping|genome-wide|transcriptom\w*|catalyt\w*|nanoparticl\w*|adsorption|density functional)\b/i,
  // Local enforcement actions against individual officials.
  /\b(?:directs?|asks?|orders?)\b.*\bto prosecute\b/i,
  /\bprosecute\b.*\b(?:official|officer|engineer|department)\b/i,
  /\b(?:child sexual abuse|sexual abuse material|csam)\b/i,
  // Airport slot disputes, event logistics, festival wire-copy and gadget pricing.
  /\b(?:carriers?|airlines?)\b.*\b(?:airport slots?|slots? at|denied|blocks? \d+ airlines?|take fight)\b/i,
  /\b(?:partnership summit|make (?:fool ?proof )?arrangements?|fool ?proof arrangements?)\b/i,
  /\b(?:homes and temples glow|celebrations begin|festivities begin)\b/i,
  /\b(?:smartphone|laptop|gadget)\b.*\b(?:prices?|costlier|expensive|price hike)\b/i,
  // Foreign family-law colour, influencer feuds, local wildlife incidents and operational fluff.
  /\b(?:custody|visitation|divorce|alimony|child support|holiday visits?|parental rights?)\b/i,
  /\b(?:lambasts?|rage mounts|youtuber|influencer)\b/i,
  /\b(?:attacked by villagers|kills? (?:buffalo|calf|livestock|goat))\b/i,
  /\b(?:festive rush|handle \d+ (?:lakh|crore) passengers)\b/i,
  // Research-paper titles and festive cost-of-living features.
  /\b(?:two|three|four)-year field trial\b/i,
  /\b(?:yield, quality|soil acidity|eutrophication)\b/i,
  /\b(?:diwali|festival)\b.*\b(?:costlier|squeez\w* budgets?|price pinch)\b/i,
];

// Administrative circulars and auction notices from official feeds.
const RBI_ROUTINE = /\b(?:auction|underwriting|treasury bills?|variable rate repo|variable rate reverse repo|vrrr?|statistical supplement|weekly statistical|deployment of credit|extension of period|directions under section|corrigendum|penalty on|penalties on|know your customer|master direction)\b/i;
const OFFICIAL_ROUTINE = /\b(?:corrigendum|request for proposal|rfp|expression of interest|eoi|tender notice|tender for|cancellation of tender)\b/i;

const INDIA_RE = /\b(?:india|indian|delhi|modi|jaishankar|sitharaman|nirmala|rbi|isro|supreme court of india|parliament of india)\b/i;

// A story from a foreign outlet needs a clear India or global-governance hook.
const GLOBAL_INSTITUTION = /\b(?:united nations|unsc|u\.n\.|world health organization|wto|imf|world bank|nato|european union|g20|g7|brics|quad|sco|asean|opec|iaea|international criminal court|international court of justice|unesco|unicef|unhcr|cop\d*|ipcc|fatf|world economic forum|global south|indo-pacific)\b/i;
const GLOBAL_ISSUE = /\b(?:war|conflict|sanctions?|tariffs?|trade (?:deal|war|pact|agreement)|ceasefire|climate|pandemic|outbreak|inflation|crude oil|oil prices?|semiconductor|artificial intelligence|openai|nuclear|terrorism|refugee|humanitarian|arms control|el ni(?:ñ|n)o)\b/i;

function countMatches(matchers, text, cap) {
  const hits = [];
  for (const m of matchers) {
    if (hits.length >= cap) break;
    if (m.re.test(text)) hits.push(m.kw);
  }
  return hits;
}

export function detectTheme(text) {
  let best = null;
  for (const entry of THEME_MATCHERS) {
    const strongHits = countMatches(entry.strong, text, 6);
    const mediumHits = countMatches(entry.medium, text, 8);
    const score = strongHits.length * 4 + mediumHits.length * 2;
    // A theme with a genuine strong signal outranks one that only accumulated
    // generic words like "study" or "report".
    if (
      !best ||
      strongHits.length > best.strongCount ||
      (strongHits.length === best.strongCount && score > best.score)
    ) {
      best = {
        theme: entry.theme,
        score,
        strongCount: strongHits.length,
        strongHits,
        mediumHits,
        hits: [...strongHits, ...mediumHits],
      };
    }
  }
  return best;
}

function recencyBonus(publishedAt, now) {
  if (!publishedAt) return 2;
  const hours = (now - new Date(publishedAt).getTime()) / 36e5;
  if (!Number.isFinite(hours)) return 2;
  if (hours < 0) return 8;
  if (hours <= 6) return 9;
  if (hours <= 12) return 7;
  if (hours <= 24) return 5;
  if (hours <= 36) return 2;
  return 0;
}

export function prepareItem(raw, now, config) {
  if (TITLE_NOISE.some((re) => re.test(raw.title))) return null;
  if (raw.outlet === "RBI" && RBI_ROUTINE.test(raw.title)) return null;
  if (raw.sourceKind === "official" && OFFICIAL_ROUTINE.test(raw.title)) return null;

  let summary = cleanText(raw.summaryHtml || raw.contentHtml || "", { max: 700 });
  if (!summary || summary.length < 40) {
    summary = cleanText(raw.contentHtml || raw.summaryHtml || "", { max: 700 });
  }
  if (!summary) summary = raw.title;

  let published = raw.publishedAt ? new Date(raw.publishedAt).getTime() : NaN;
  let dateEstimated = false;
  if (!Number.isFinite(published)) {
    published = now;
    dateEstimated = true;
  }
  if (published > now + 6 * 36e5) published = now;
  const ageHours = (now - published) / 36e5;
  if (ageHours > config.maxItemAgeHours) return null;

  const baseText = `${raw.title}. ${summary}`.slice(0, 1400);
  let themeMatch = detectTheme(baseText);
  if (themeMatch.score < 4 && raw.contentHtml) {
    const bodyText = cleanText(raw.contentHtml, { max: 900 });
    themeMatch = detectTheme(`${raw.title}. ${summary}. ${bodyText}`);
  }

  const negativeHits = countMatches(NEGATIVE_MATCHERS, baseText, 3);
  if (themeMatch.score < 4) return null;
  if (negativeHits.length && themeMatch.score < 10) return null;

  // Foreign-domestic stories (courts, elections, local welfare) are not UPSC
  // current affairs unless they touch India, a major power, or global governance.
  if (raw.sourceRegion === "world" && raw.sourceKind !== "specialist") {
    const hasIndiaHook = INDIA_RE.test(baseText);
    const hasInstitutionHook = GLOBAL_INSTITUTION.test(baseText);
    const hasIssueHook = GLOBAL_ISSUE.test(raw.title);
    if (!hasIndiaHook && !hasInstitutionHook && !hasIssueHook) return null;
  }

  const keywords = [...themeMatch.strongHits, ...themeMatch.mediumHits];
  const entities = extractEntities(`${raw.title}. ${summary}`, 8).filter(
    (e) => !GENERIC_ENTITIES.has(e.toLowerCase())
  );

  const item = {
    sourceId: raw.sourceId,
    outlet: raw.outlet,
    sourceName: raw.sourceName,
    sourceKind: raw.sourceKind,
    sourceTier: raw.sourceTier,
    sourceRegion: raw.sourceRegion,
    title: raw.title,
    url: raw.url,
    rawUrl: raw.rawUrl || raw.url,
    summary,
    image: raw.image || "",
    publishedAt: new Date(published).toISOString(),
    dateEstimated,
    ageHours,
    theme: themeMatch.theme.id,
    themePaper: themeMatch.theme.paper,
    themeName: themeMatch.theme.name,
    themeScore: themeMatch.score,
    keywords,
    entities,
    negativeHits,
    region: themeMatch.theme.id === "gs2-ir" || raw.sourceRegion === "world" ? "world" : "india",
    // internals used for clustering, stripped before saving
    _titleTokens: titleTokens(raw.title),
    _descTokens: textTokens(summary, 40),
    _entitySet: new Set(entities.map((e) => e.toLowerCase())),
  };

  const base =
    8 +
    Math.min(themeMatch.score, 24) +
    raw.sourceTier * 2 +
    (raw.sourceKind === "official" ? 10 : 0) +
    recencyBonus(item.publishedAt, now) +
    Math.min(Math.round(summary.length / 140), 4) +
    (item.image ? 1 : 0) -
    negativeHits.length * 6;
  item.baseScore = Math.round(clamp(base, 0, 100));
  item._topicSet = new Set(keywords.map((k) => k.toLowerCase()));
  return item;
}

// Words that appear in many unrelated headlines of the same paper. They should
// not, on their own, make two stories look like the same event.
const CLUSTER_GENERIC = new Set([
  "supreme", "court", "high", "judg", "judgment", "judgement", "verdict", "order", "case",
  "bench", "justice", "hearing", "petition", "rule", "government", "govt", "india",
  "indian", "state", "national", "minister", "ministry", "report", "study", "policy",
  "commission", "committee", "scheme", "new", "top",
]);

function distinctiveTitleOverlap(a, b) {
  let count = 0;
  for (const token of a._titleTokens) {
    if (token.length > 3 && !CLUSTER_GENERIC.has(token) && b._titleTokens.has(token)) count++;
  }
  return count;
}

function similarity(a, b) {
  const titleSim = jaccard(a._titleTokens, b._titleTokens);
  const descSim = jaccard(a._descTokens, b._descTokens);
  let sharedEntities = 0;
  for (const e of a._entitySet) if (b._entitySet.has(e)) sharedEntities++;
  let sharedTopics = 0;
  for (const t of a._topicSet) if (b._topicSet.has(t)) sharedTopics++;
  const sharedTitle = distinctiveTitleOverlap(a, b);

  let score = 0.72 * titleSim + 0.28 * descSim;
  if (sharedEntities >= 2) score += 0.08;
  else if (sharedEntities === 1) score += 0.05;
  if (sharedTopics >= 2) score += 0.1;
  if (sharedTopics >= 4) score += 0.06;

  const sameTheme = a.theme === b.theme;
  const sameThemeMerge =
    titleSim >= 0.42 ||
    (score >= 0.4 && titleSim >= 0.22) ||
    (sharedTopics >= 2 && titleSim >= 0.15) ||
    (sharedEntities >= 2 && titleSim >= 0.2) ||
    (sharedEntities >= 1 && sharedTopics >= 1 && titleSim >= 0.18) ||
    // Headlines about one event often share a distinctive phrase ("creamy
    // layer") while using a different verb or sentence shape.
    (sharedTitle >= 2 && titleSim >= 0.12);
  // Cross-theme edge case: the same event can be tagged to different GS-2
  // sub-themes (polity vs social justice). Merge when headlines share
  // distinctive words and at least one entity or topic.
  const crossThemeMerge =
    !sameTheme && sharedTitle >= 2 && sharedEntities >= 1 && titleSim >= 0.15;

  return {
    score,
    titleSim,
    merge: titleSim >= 0.55 || score >= 0.58 || (sameTheme && sameThemeMerge) || crossThemeMerge,
  };
}

export function clusterItems(items) {
  const sorted = [...items].sort((a, b) => b.baseScore - a.baseScore);
  const clusters = [];
  for (const item of sorted) {
    let best = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      const sim = similarity(item, cluster.rep);
      if (sim.merge && sim.score > bestScore) {
        best = cluster;
        bestScore = sim.score;
      }
    }
    if (best) {
      best.members.push(item);
      if (item.baseScore > best.rep.baseScore) best.rep = item;
    } else {
      clusters.push({ rep: item, members: [item], baseScore: item.baseScore });
    }
  }
  return clusters;
}

function pickLead(cluster) {
  const scored = cluster.members.map((m) => {
    let s = m.sourceTier * 2;
    if (m.sourceKind === "official") s += 7;
    if (m.sourceKind === "national" || m.sourceKind === "specialist") s += 5;
    s += Math.min(m.summary.length / 80, 8);
    if (m.image) s += 2;
    if (m.dateEstimated) s -= 2;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  // Prefer a readable national story as the face of the card, unless an
  // official release carries substantially more substance.
  const national = scored.find((x) => ["national", "specialist", "business"].includes(x.m.sourceKind) && x.m.summary.length > 110);
  const official = scored.find((x) => x.m.sourceKind === "official");
  if (official && (!national || official.s > national.s + 8)) return official.m;
  return (national || scored[0]).m;
}

function verificationOf(members) {
  const byOutlet = new Map();
  for (const m of members) {
    const existing = byOutlet.get(m.outlet);
    if (!existing) {
      byOutlet.set(m.outlet, { name: m.outlet, url: m.rawUrl || m.url, kind: m.sourceKind });
    } else if (m.sourceKind === "official" && existing.kind !== "official") {
      byOutlet.set(m.outlet, { name: m.outlet, url: m.rawUrl || m.url, kind: m.sourceKind });
    }
  }
  const sources = [...byOutlet.values()].sort((a, b) => {
    const rank = { official: 0, national: 1, specialist: 1, business: 2, international: 3 };
    return (rank[a.kind] ?? 4) - (rank[b.kind] ?? 4);
  });
  const officialCount = sources.filter((s) => s.kind === "official").length;
  const outletCount = sources.length;
  let status = "single";
  if (officialCount && outletCount >= 3) status = "official-confirmed";
  else if (officialCount) status = "official";
  else if (outletCount >= 3) status = "confirmed";
  else if (outletCount === 2) status = "corroborated";
  return { status, sources, outletCount, officialCount };
}

const VERIFICATION_LABEL = {
  "official-confirmed": (v) => `Official + ${v.outletCount} sources`,
  official: () => "Official source",
  confirmed: (v) => `Verified · ${v.outletCount} sources`,
  corroborated: () => "Corroborated · 2 sources",
  single: () => "Single source",
};

function factSentences(body, summary) {
  const text = [summary, body].filter(Boolean).join(" ");
  const sentences = splitSentences(text).filter((s) => s.length >= 45 && s.length <= 260);
  const scored = sentences.map((s, index) => {
    let score = 0;
    if (/\d/.test(s)) score += 2;
    if (/(?:₹|Rs\.?|%|per cent|crore|lakh|billion|million)/i.test(s)) score += 2;
    if (/\b(?:act|bill|scheme|mission|policy|committee|court|tribunal|agreement|treaty|target)\b/i.test(s)) score += 1;
    if (/^[A-Z][a-z]+ .{0,40}\b(?:said|stated|added|told)\b/.test(s)) score -= 1;
    if (/\b(?:would|could|might|likely|expected to)\b/i.test(s)) score -= 1;
    if (index === 0) score += 1;
    return { s, score, index };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const picked = [];
  const seen = new Set();
  for (const { s, index } of scored) {
    const key = s.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ s, index });
    if (picked.length >= 3) break;
  }
  picked.sort((a, b) => a.index - b.index);
  return picked.map((p) => p.s.replace(/\s+/g, " ").trim());
}

function shortTitle(title, max = 115) {
  const t = title.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMcq(item, theme) {
  const rand = mulberry32(parseInt(item.id.slice(0, 8), 16) || 1);
  const pool = THEMES.filter((t) => t.id !== theme.id);
  const differentPaper = pool.filter((t) => t.paper !== theme.paper);
  const distractors = [];
  const used = new Set([theme.id]);
  const pickFrom = (arr) => {
    for (let attempt = 0; attempt < 40 && distractors.length < 3; attempt++) {
      const cand = arr[Math.floor(rand() * arr.length)];
      if (!cand || used.has(cand.id)) continue;
      used.add(cand.id);
      distractors.push(cand);
    }
  };
  pickFrom(differentPaper);
  pickFrom(pool);
  const options = [theme, ...distractors].map((t) => ({ text: `${t.paper} · ${t.name}`, correct: t.id === theme.id }));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return {
    question: `The development reported as “${shortTitle(item.title, 120)}” is most directly connected to which of the following?`,
    options,
    answer: options.findIndex((o) => o.correct),
    explanation: `Filed under ${theme.paper} · ${theme.name}. The item matches signals such as ${listJoin(item.keywords.slice(0, 4))}. Verify specifics in ${item.sources[0]?.name || "the linked source"}.`,
  };
}

export function buildFinalItem(cluster, enriched) {
  const lead = pickLead(cluster);
  const verification = verificationOf(cluster.members);
  const theme = THEME_BY_ID.get(lead.theme) || THEMES[0];

  const body = enriched?.body || "";
  const description = enriched?.description || "";
  const summarySource = description && description.length > 60 ? description : lead.summary;
  const summary = firstSentences(summarySource, 3, 460);

  const facts = factSentences(body.slice(0, 7000), lead.summary);
  const factList = facts.length >= 2 ? facts : splitSentences(lead.summary).slice(0, 3);
  const prelimsHooks = extractHooks(`${lead.title}. ${body.slice(0, 4000)}`, 6);

  const keywordSet = new Set(lead.keywords);
  for (const m of cluster.members) for (const k of m.keywords) keywordSet.add(k);
  const keywords = [...keywordSet].slice(0, 10);

  const officialNames = verification.sources.filter((s) => s.kind === "official").map((s) => s.name);
  const evidence =
    verification.officialCount > 0
      ? ` An official source (${listJoin(officialNames)}) anchors the details.`
      : verification.outletCount >= 2
        ? ` Coverage is corroborated by ${verification.outletCount} independent outlets.`
        : " It currently rests on a single report, so cross-check before quoting figures.";

  const whyItMatters = `${theme.mainsAngle} The news centres on ${listJoin(keywords.slice(0, 3))}.${evidence} For Prelims, ${theme.prelimsFocus}.`;

  const id = hashId(lead.url);
  const item = {
    id,
    title: lead.title,
    url: lead.rawUrl || lead.url,
    summary,
    theme: theme.id,
    paper: theme.paper,
    themeName: theme.name,
    region: lead.region,
    publishedAt: lead.publishedAt,
    dateEstimated: lead.dateEstimated,
    image: enriched?.image || lead.image || "",
    keywords,
    primaryTopic: (keywords[0] || theme.name).toLowerCase(),
    prelimsHooks,
    facts: factList,
    whyItMatters,
    verification: {
      status: verification.status,
      label: VERIFICATION_LABEL[verification.status](verification),
      outletCount: verification.outletCount,
      officialCount: verification.officialCount,
    },
    sources: verification.sources.slice(0, 8),
    sourceName: lead.sourceName,
    sourceKind: lead.sourceKind,
    readingTime: Math.max(1, Math.round((summary.length + factList.join(" ").length) / 220)),
    enriched: Boolean(body),
    relevance: 0,
  };

  const ageHours = (Date.now() - new Date(lead.publishedAt).getTime()) / 36e5;
  const recency = ageHours <= 6 ? 9 : ageHours <= 12 ? 7 : ageHours <= 24 ? 5 : ageHours <= 36 ? 2 : 0;
  item.relevance = Math.round(
    clamp(
      8 +
        Math.min(lead.themeScore, 24) +
        Math.min(verification.outletCount, 4) * 6 +
        verification.officialCount * 10 +
        lead.sourceTier * 2 +
        recency +
        (item.enriched ? 7 : 0) +
        Math.min(item.facts.length, 3) * 2 -
        lead.negativeHits.length * 6,
      0,
      100
    )
  );
  item.mcq = buildMcq(item, theme);
  for (const m of cluster.members) {
    delete m._titleTokens;
    delete m._descTokens;
    delete m._entitySet;
    delete m._topicSet;
  }
  return item;
}

export function selectItems(items, config) {
  const sorted = [...items].sort((a, b) => b.relevance - a.relevance || new Date(b.publishedAt) - new Date(a.publishedAt));
  const counts = new Map();
  const topicCounts = new Map();
  const out = [];
  const topicKeyOf = (item) => {
    const text = `${item.title} ${(item.keywords || []).join(" ")}`.toLowerCase();
    // Delhi-NCR air-quality coverage arrives as several different headlines
    // (GRAP, AQI rankings, purifier prices). Treat it as one running story.
    if (/\b(?:air pollution|air quality|smog|grap|aqi|pm ?2\.5|stubble burning|toxic air|air purif\w*|prevent pollution)\b/.test(text)) {
      return "family|air-pollution";
    }
    if (/\b(?:cyclone|hurricane|typhoon)\b/.test(text)) {
      return "family|cyclone";
    }
    return `${item.theme}|${item.primaryTopic}`;
  };
  for (const item of sorted) {
    if (out.length >= config.maxItemsPerDay) break;
    if (item.relevance < config.minRelevance) continue;
    const n = counts.get(item.theme) || 0;
    if (n >= (config.maxPerTheme || 12)) continue;
    const topicKey = topicKeyOf(item);
    const topicLimit = topicKey.startsWith("family|") ? 1 : (config.maxPerTopic || 2);
    const t = topicCounts.get(topicKey) || 0;
    if (t >= topicLimit) continue;
    counts.set(item.theme, n + 1);
    topicCounts.set(topicKey, t + 1);
    out.push(item);
  }
  return out.sort((a, b) => b.relevance - a.relevance);
}

export function themeLabel(id) {
  const t = THEME_BY_ID.get(id);
  return t ? `${t.paper} · ${t.name}` : id;
}
