import { createHash } from "node:crypto";

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", copy: "©", reg: "®",
  trade: "™", deg: "°", euro: "€", pound: "£", yen: "¥", times: "×", middot: "·",
  bull: "•", laquo: "«", raquo: "»", frac12: "½", frac14: "¼", frac34: "¾",
};

export function decodeEntities(input = "") {
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ""; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(Number(dec)); } catch { return ""; }
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

export function stripHtml(input = "") {
  let s = String(input);
  s = s.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<\/(p|div|li|h[1-6])>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  return decodeEntities(s);
}

const BOILERPLATE = [
  /the post .{0,160} appeared first on .{0,80}\.?/gi,
  /read more.{0,80}$/gi,
  /also read.{0,160}$/gi,
  /follow us on .{0,80}$/gi,
  /subscribe to .{0,120}$/gi,
  /click here to .{0,120}$/gi,
  /advertisement/gi,
  /share this article/gi,
  /comments?$/gi,
];

export function cleanText(input = "", { max = 4000 } = {}) {
  let s = stripHtml(input);
  for (const re of BOILERPLATE) s = s.replace(re, " ");
  s = s
    .replace(/\s*[|·•]\s*(?=[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}\s*$)/g, " ")
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\s+/g, " ")
    // Catches run-together sentences such as "reviewed.On Friday".
    .replace(/([a-z0-9][.!?])(?=[A-Z])/g, "$1 ")
    .trim();
  if (s.length > max) {
    const cut = s.slice(0, max);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    s = stop > max * 0.6 ? cut.slice(0, stop + 1) : cut.trimEnd() + "…";
  }
  return s;
}

export function canonicalUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = "";
    const drop = [];
    u.searchParams.forEach((_, key) => {
      if (/^(utm_|fbclid|gclid|ocid|mc_cid|mc_eid|ref|source|campaign|s$)/i.test(key)) drop.push(key);
    });
    for (const k of drop) u.searchParams.delete(k);
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const q = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${u.pathname}${q ? `?${q}` : ""}`;
  } catch {
    return String(raw || "").trim();
  }
}

export function hashId(value, len = 14) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, len);
}

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below
  between both but by can could did do does doing down during each few for from further had has have having
  he her here hers herself him himself his how i if in into is it its itself just know like may me might more
  most must my myself new news no nor not now of off on once only or other our ours ourselves out over own
  said says same she should so some such than that the their theirs them themselves then there these they
  this those through to too under until up very was we were what when where which while who whom why will
  with would you your yours yourself amid among after before today yesterday tomorrow report reports reported
  according latest update updates live watch video photos read full story top big key day week year
  indian india govt government centre central state states country world global international national
  s t will can could`
    .split(/\s+/)
    .filter(Boolean)
);

export function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem)
    .filter(Boolean);
}

function stem(w) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function jaccard(a, b) {
  if (!a?.size || !b?.size) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function titleTokens(title) {
  return new Set(tokenize(title));
}

export function textTokens(text, cap = 45) {
  return new Set(tokenize(text).slice(0, cap));
}

export function splitSentences(text = "") {
  const protectedText = String(text)
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Shri|Smt|St|No|vs|etc|i\.e|e\.g|U\.S|U\.K)\./gi, "$1<dot>")
    .replace(/(\d)\.(\d)/g, "$1<dot>$2");
  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(])|\n+/)
    .map((s) => s.replace(/<dot>/g, ".").trim())
    .filter((s) => s.length > 25);
}

export function firstSentences(text, count = 2, max = 420) {
  const sentences = splitSentences(text);
  if (!sentences.length) return cleanText(text, { max });
  let out = "";
  for (const s of sentences.slice(0, count)) {
    if ((out + " " + s).length > max && out) break;
    out = out ? `${out} ${s}` : s;
  }
  if (out.length > max) {
    const cut = out.slice(0, max);
    out = cut.slice(0, Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "))) + "…";
  }
  return out.trim();
}

const COMMON_CAPS = new Set(
  `the this that these those a an in on at by for from with and but or of to as is are was were be been
  it its he she they we you i his her their our your new latest update report reports according
  monday tuesday wednesday thursday friday saturday sunday january february march april may june july
  august september october november december today yesterday tomorrow`.split(/\s+/)
);

export function extractEntities(text = "", limit = 8) {
  const out = [];
  const seen = new Set();
  const push = (v) => {
    const clean = v.trim().replace(/\s+/g, " ");
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    if (clean.length < 3 || clean.length > 70) return;
    if (COMMON_CAPS.has(clean.toLowerCase())) return;
    seen.add(key);
    out.push(clean);
  };
  for (const m of String(text).matchAll(/\b([A-Z][a-z]{1,}(?:\s+(?:of|and|the|for|de|von)?\s*[A-Z][a-z]{1,}){1,3})\b/g)) {
    push(m[1]);
    if (out.length >= limit) return out;
  }
  for (const m of String(text).matchAll(/\b([A-Z]{2,6})\b/g)) {
    const v = m[1];
    if (/^(THE|AND|FOR|WITH|FROM|THIS|THAT|NEW|ALL|NOT|BUT|HAS|ARE|WAS|ITS|YOU|OUR|WHO|WHAT|HOW|WHY|CAN|MAY|WILL|HAD|ONE|TWO|THREE|INDIA|INDIAN|GOVT|GOVERNMENT|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)$/.test(v)) continue;
    push(v);
    if (out.length >= limit) return out;
  }
  return out;
}

const HOOK_PATTERNS = [
  { re: /(?:₹|Rs\.?|INR)\s?[\d,.]+(?:\s?(?:crore|lakh|billion|million|trillion))?/gi, weight: 3 },
  { re: /\b\d[\d,.]*\s?(?:%|per cent|percent|crore|lakh|billion|million|trillion|tonnes?|GW|MW|km|kg|metres?|years?|months?|days?|billion|million)\b/gi, weight: 2 },
  { re: /\b(?:19|20)\d{2}\b/g, weight: 1 },
];

export function extractHooks(text = "", limit = 6) {
  const found = new Map();
  for (const { re, weight } of HOOK_PATTERNS) {
    for (const m of String(text).matchAll(re)) {
      const v = m[0].replace(/\s+/g, " ").trim();
      if (!v || v.length > 40) continue;
      if (/^\d+$/.test(v) && v.length !== 4) continue;
      const key = v.toLowerCase();
      found.set(key, Math.max(found.get(key) || 0, weight));
    }
  }
  // "₹1,200 crore" and "1,200 crore" are the same fact — keep the richer form.
  let entries = [...found.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  entries = entries.filter(([value], index) => {
    const lower = value.toLowerCase();
    return !entries.some(([other], otherIndex) => {
      if (otherIndex === index) return false;
      const o = other.toLowerCase();
      return o !== lower && o.includes(lower) && other.length > value.length;
    });
  });
  return entries.slice(0, limit).map(([v]) => v);
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function uniqueBy(list, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function listJoin(items = []) {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
