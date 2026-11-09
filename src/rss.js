import { XMLParser } from "fast-xml-parser";
import { cleanText, canonicalUrl, decodeEntities } from "./text.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  // Large feeds (Guardian, WHO) exceed the library's entity-expansion guard.
  // Leaving entities encoded is safe here: cleanText/URL handling decode them.
  processEntities: false,
  htmlEntities: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

function text(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") {
    if (node["#cdata"] != null) return text(node["#cdata"]);
    if (node["#text"] != null) return text(node["#text"]);
    if (node._ != null) return text(node._);
  }
  return "";
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function linkOf(entry) {
  const links = asArray(entry.link);
  const candidates = [];
  for (const link of links) {
    if (typeof link === "string") candidates.push({ href: link, rel: "alternate" });
    else if (link && typeof link === "object") {
      if (link["@_href"]) candidates.push({ href: link["@_href"], rel: link["@_rel"] || "alternate" });
      else candidates.push({ href: text(link), rel: "alternate" });
    }
  }
  const pick =
    candidates.find((c) => c.rel === "alternate") ||
    candidates.find((c) => !c.rel) ||
    candidates[0];
  let href = pick?.href || "";
  if (!href && entry.guid) {
    const g = typeof entry.guid === "object" ? entry.guid : { "#text": entry.guid };
    if (g?.["@_isPermaLink"] !== "false") href = text(g);
  }
  if (!href && entry.id) href = text(entry.id);
  return href;
}

function imageOf(entry, html) {
  const media = [
    ...asArray(entry["media:content"]),
    ...asArray(entry["media:thumbnail"]),
    ...asArray(entry["media:group"]?.["media:content"]),
    ...asArray(entry.enclosure),
  ];
  for (const m of media) {
    if (!m || typeof m !== "object") continue;
    const url = m["@_url"] || m["@_href"];
    const type = m["@_type"] || "";
    if (url && /^https?:/i.test(url) && (!type || type.startsWith("image"))) return url;
  }
  const match = String(html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && /^https?:/i.test(match[1])) return match[1];
  return "";
}

export function parseFeed(xml, source) {
  let doc;
  try {
    const parsed = parser.parse(xml);
    doc = parsed?.rss?.channel || parsed?.["rdf:RDF"] || parsed?.feed || parsed?.rss || parsed;
  } catch (err) {
    return { items: [], error: `XML parse failed: ${err.message}` };
  }
  if (!doc || typeof doc !== "object") return { items: [], error: "No RSS/Atom structure found" };

  const entries = [
    ...asArray(doc.item),
    ...asArray(doc.entry),
    ...asArray(doc["rss"]?.channel?.item),
  ];
  if (!entries.length) return { items: [], error: "Feed contained no items" };

  const items = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const title = cleanText(text(entry.title), { max: 280 })
      .replace(/^(?:editorial|opinion|explained|analysis|comment|interview|review)\s*[.:|-]\s*/i, "")
      .replace(/\s+-\s+[A-Za-z .]{3,30}$/, (m) => (m.toLowerCase().includes(source.outlet.toLowerCase().slice(0, 6)) ? "" : m));
    let url = decodeEntities(linkOf(entry) || "");
    if (!url) continue;
    try {
      url = new URL(url, source.url).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(url)) continue;

    const description = text(entry.description) || text(entry.summary) || "";
    const content = text(entry["content:encoded"]) || text(entry.content) || "";
    const dateRaw =
      text(entry.pubDate) || text(entry.published) || text(entry.updated) ||
      text(entry["dc:date"]) || text(entry.date) || "";
    const parsedDate = dateRaw ? new Date(dateRaw) : null;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.valueOf()) ? parsedDate.toISOString() : "";

    if (title.length < 12) continue;

    items.push({
      sourceId: source.id,
      outlet: source.outlet,
      sourceName: source.name,
      sourceKind: source.kind,
      sourceTier: source.tier,
      sourceRegion: source.region,
      title,
      url: canonicalUrl(url),
      rawUrl: url,
      summaryHtml: description || content.slice(0, 1200),
      contentHtml: content,
      publishedAt,
      image: imageOf(entry, content || description),
    });
  }
  return { items, error: "" };
}
