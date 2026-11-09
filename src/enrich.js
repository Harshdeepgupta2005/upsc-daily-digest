import { cleanText, decodeEntities } from "./text.js";
import { fetchText } from "./http.js";

const JUNK = /subscribe|cookie|sign in|log in|advertisement|download (the )?app|follow us|whatsapp|telegram|instagram|twitter|facebook|youtube|all rights reserved|copyright|terms of (use|service)|privacy policy|newsletter|share this|read more|also read|trending|related stories|watch:|listen:/i;

function metaTags(html) {
  const out = {};
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = {};
    for (const a of tag[0].matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? "");
    }
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content && !out[key]) out[key] = attrs.content;
  }
  return out;
}

function jsonLdBody(html) {
  const regex = /"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let best = "";
  for (const m of html.matchAll(regex)) {
    try {
      const decoded = JSON.parse(`"${m[1]}"`);
      if (decoded.length > best.length) best = decoded;
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return best;
}

function paragraphs(html) {
  const cleaned = html
    .replace(/<(script|style|noscript|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const picked = [];
  const seen = new Set();
  for (const m of cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = cleanText(m[1], { max: 1200 });
    if (text.length < 70) continue;
    if (JUNK.test(text)) continue;
    const key = text.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(text);
    if (picked.join(" ").length > 9000) break;
  }
  return picked.join(" ");
}

export function extractArticle(html) {
  const meta = metaTags(html);
  const ld = jsonLdBody(html);
  const text = paragraphs(html);
  const description = cleanText(
    meta["og:description"] || meta["twitter:description"] || meta["description"] || "",
    { max: 600 }
  );
  const image = meta["og:image"] || meta["twitter:image"] || "";
  const body = cleanText(ld || text || description, { max: 9000 });
  return { body, description, image: /^https?:/i.test(image) ? image : "" };
}

export async function enrichUrl(url, cache, { timeout = 12000 } = {}) {
  const key = url;
  const cached = cache[key];
  if (cached && Date.now() - cached.fetchedAt < 72 * 36e5 && cached.body) {
    return { ...cached, cached: true, error: "" };
  }
  const res = await fetchText(url, {
    timeout,
    retries: 0,
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  if (!res.ok) {
    return { body: "", description: "", image: "", fetchedAt: Date.now(), error: res.error, cached: false };
  }
  const extracted = extractArticle(res.text);
  const record = { ...extracted, fetchedAt: Date.now() };
  if (record.body || record.description) cache[key] = record;
  return { ...record, cached: false, error: "" };
}
