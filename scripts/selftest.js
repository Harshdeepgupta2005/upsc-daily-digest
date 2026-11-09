import assert from "node:assert/strict";
import {
  canonicalUrl, decodeEntities, cleanText, splitSentences, extractHooks, tokenize,
  titleTokens, textTokens,
} from "../src/text.js";
import { parseFeed } from "../src/rss.js";
import { detectTheme, clusterItems } from "../src/analyzer.js";
import { nextRunInfo } from "../src/scheduler.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

console.log("\nUPSC Digest self-test\n");

test("canonicalUrl strips tracking parameters", () => {
  const out = canonicalUrl("https://www.thehindu.com/news/national/article123.ece?utm_source=x&fbclid=y#top");
  assert.equal(out, "https://thehindu.com/news/national/article123.ece");
});

test("decodeEntities handles named and numeric entities", () => {
  assert.equal(decodeEntities("A &amp; B &#8377;5,000 &nbsp; &quot;x&quot;"), 'A & B ₹5,000   "x"');
});

test("cleanText strips markup and boilerplate", () => {
  const out = cleanText("<p>RBI kept the <b>repo rate</b> unchanged.</p><p>The post X appeared first on Y.</p>");
  assert.match(out, /repo rate/);
  assert.doesNotMatch(out, /appeared first/);
});

test("splitSentences handles abbreviations", () => {
  const out = splitSentences("Dr. Rao said the repo rate is unchanged. Inflation remains a concern for the MPC.");
  assert.equal(out.length, 2);
});

test("extractHooks finds money and percentages", () => {
  const hooks = extractHooks("The allocation is ₹1,200 crore, a rise of 8 per cent over 2025.");
  assert.ok(hooks.some((h) => /1,200 crore/.test(h)));
  assert.ok(hooks.some((h) => /8 per cent/.test(h)));
});

test("tokenize drops stopwords and stems plurals", () => {
  const tokens = tokenize("The emissions from Indian industries are rising");
  assert.ok(tokens.includes("emission"));
  assert.ok(!tokens.includes("the"));
});

test("detectTheme recognises climate stories", () => {
  const match = detectTheme("COP30 climate summit agrees on a new adaptation fund for biodiversity");
  assert.equal(match.theme.id, "gs3-environment");
  assert.ok(match.score >= 8);
});

test("detectTheme recognises RBI monetary policy", () => {
  const match = detectTheme("RBI monetary policy committee keeps repo rate unchanged as inflation eases");
  assert.equal(match.theme.id, "gs3-economy");
});

function clusterCandidate(title, theme = "gs2-polity") {
  return {
    title,
    theme,
    baseScore: 40,
    _titleTokens: titleTokens(title),
    _descTokens: textTokens(title),
    _entitySet: new Set(),
    _topicSet: new Set(),
  };
}

test("clusterItems merges reworded coverage of one event", () => {
  const a = clusterCandidate(
    "OBC creamy layer verdict not a blanket revision of service allocations: Supreme Court"
  );
  const b = clusterCandidate(
    "SC stands firm by March 11 judgment on assessing OBC creamy layer policy"
  );
  assert.equal(clusterItems([a, b]).length, 1);
});

test("clusterItems keeps unrelated court stories apart", () => {
  const a = clusterCandidate("Supreme Court orders probe into forest rights claims");
  const b = clusterCandidate("Supreme Court dismisses plea on electoral bonds");
  assert.equal(clusterItems([a, b]).length, 2);
});

test("clusterItems merges same-event stories across GS-2 sub-themes", () => {
  const shared = new Set(["supreme court"]);
  const a = clusterCandidate(
    "OBC creamy layer verdict not a blanket revision of service allocations, seniority: Supreme Court",
    "gs2-polity"
  );
  const b = clusterCandidate(
    "SC stands firm by March 11 judgment on assessing OBC creamy layer policy",
    "gs2-social-justice"
  );
  a._entitySet = shared;
  b._entitySet = shared;
  assert.equal(clusterItems([a, b]).length, 1);
});

const sampleRss = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item><title><![CDATA[RBI keeps repo rate unchanged at 5.5%]]></title>
<link>https://example.com/a?utm_source=rss</link>
<description><![CDATA[<p>The monetary policy committee voted to hold rates.</p>]]></description>
<pubDate>Thu, 05 Nov 2026 10:00:00 +0530</pubDate></item>
</channel></rss>`;

test("parseFeed parses RSS items", () => {
  const { items, error } = parseFeed(sampleRss, {
    id: "test", name: "Test", outlet: "Test", kind: "national", tier: 2, region: "india",
    url: "https://example.com/rss",
  });
  assert.equal(error, "");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "RBI keeps repo rate unchanged at 5.5%");
  assert.equal(items[0].url, "https://example.com/a");
  assert.match(items[0].summaryHtml, /monetary policy/);
});

const sampleAtom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title>
<entry><title>India signs trade pact</title><link rel="alternate" href="https://example.com/b"/>
<summary>Details here.</summary><updated>2026-11-05T09:00:00Z</updated></entry></feed>`;

test("parseFeed parses Atom entries", () => {
  const { items } = parseFeed(sampleAtom, {
    id: "test", name: "Test", outlet: "Test", kind: "international", tier: 2, region: "world",
    url: "https://example.com/feed",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.com/b");
  assert.ok(items[0].publishedAt.startsWith("2026-11-05"));
});

test("nextRunInfo respects the configured timezone", () => {
  const now = new Date("2026-11-09T15:00:00Z"); // 20:30 in India, 10:00 in New York
  const ist = nextRunInfo("06:00", now, "Asia/Kolkata");
  const ny = nextRunInfo("06:00", now, "America/New_York");
  assert.equal(ist.at, "2026-11-10T00:30:00.000Z");
  assert.equal(ny.at, "2026-11-10T11:00:00.000Z");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(ny.at));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  assert.equal(`${get("hour")}:${get("minute")}`, "06:00");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
