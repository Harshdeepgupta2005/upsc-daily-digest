/* ============================================================
   UPSC Daily Digest — client application
   Plain ES module. No framework, no build step, no tracking.
   ============================================================ */

const TZ = "Asia/Kolkata";
const BK_KEY = "upsc.bookmarks.v1";
const THEME_KEY = "upsc.theme";

const ICONS = {
  today:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M7 14h3M7 17h7"/>',
  archive:
    '<path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 3h18v4H3zM9 12h6"/>',
  bookmark:
    '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  sources:
    '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"/>',
  about:
    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3.2 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9z"/>',
  refresh:
    '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5V9h-5.5"/>',
  external:
    '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  print:
    '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  download:
    '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
};

const KIND_LABELS = {
  official: "Official & institutional",
  national: "National dailies",
  business: "Business & markets",
  specialist: "Specialist & research",
  international: "International",
};
const KIND_ORDER = ["official", "national", "business", "specialist", "international"];
const PAPER_FILTERS = ["GS-1", "GS-2", "GS-3", "GS-4"];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  route: { name: "today" },  theme: "light",
  digest: null,
  fallbackNote: "",
  status: null,
  loading: false,
  error: null,
  query: "",
  gs: "all",
  verification: "all",
  openMcq: new Set(),
  answered: new Map(),
  revealed: new Set(),
  bookmarks: loadBookmarks(),
  offline: false,
  dismissStatus: false,
  pollTimer: null,
  toastTimer: null,
  reqSeq: 0,
};

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */

let scrollFrame = 0;

init();

function init() {
  state.theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  hydrateIcons();
  setTheme(state.theme, false);
  bindEvents();
  updateBookmarkBadge();
  onScroll();

  if (!location.hash) history.replaceState(null, "", "#/today");
  renderRoute();
  pollStatus();
}

function hydrateIcons() {
  $$("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}

function bindEvents() {
  $("#main").addEventListener("click", handleClick);
  $("#main").addEventListener("input", handleInput);
  $("#main").addEventListener("change", handleChange);
  $("#theme-toggle").addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark", true);
  });
  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("keydown", handleKeydown);
}

function setTheme(theme, persist) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
  const wrap = $(".theme-toggle");
  if (wrap) {
    wrap.querySelector(".theme-toggle-icon").innerHTML = icon(theme === "dark" ? "sun" : "moon");
    wrap.querySelector(".theme-toggle-label").textContent =
      theme === "dark" ? "Light mode" : "Dark mode";
    wrap.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}

function handleKeydown(e) {
  const tag = (e.target?.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;

  if (e.key === "/" && !typing) {
    const search = $("#search");
    if (search) {
      e.preventDefault();
      search.focus();
      search.select();
    }
  }

  if (e.key === "Escape") {
    if (state.query) {
      state.query = "";
      const search = $("#search");
      if (search) search.value = "";
      renderStories();
      syncFilterControls();
    } else if (typing) {
      e.target.blur();
    }
  }
}

/* ------------------------------------------------------------
   Data helpers
   ------------------------------------------------------------ */

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { accept: "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function loadBookmarks() {
  try {
    const raw = JSON.parse(localStorage.getItem(BK_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((b) => b && typeof b.id === "string" && b.title);
  } catch {
    return [];
  }
}

function persistBookmarks() {
  try {
    localStorage.setItem(BK_KEY, JSON.stringify(state.bookmarks.slice(0, 500)));
  } catch {
    toast("Bookmarks could not be saved — browser storage is full.", "error");
  }
}

function findItem(id) {
  const inDigest = state.digest?.items?.find((i) => i.id === id);
  if (inDigest) return inDigest;
  return state.bookmarks.find((b) => b.id === id) || null;
}

function snapshot(item) {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    summary: item.summary,
    theme: item.theme,
    paper: item.paper,
    themeName: item.themeName,
    region: item.region,
    publishedAt: item.publishedAt,
    facts: Array.isArray(item.facts) ? item.facts.slice(0, 3) : [],
    whyItMatters: item.whyItMatters,
    verification: item.verification,
    sources: item.sources,
    sourceName: item.sourceName,
    readingTime: item.readingTime,
    relevance: item.relevance,
    mcq: item.mcq,
    rank: item.rank,
    date: state.digest?.date || state.route.date || todayKey(),
    savedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------
   Formatting
   ------------------------------------------------------------ */

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));

function icon(name) {
  const filled = name.endsWith("Filled");
  const body = ICONS[filled ? name.slice(0, -6) : name] || "";
  return `<svg viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return /^https?:$/.test(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function parseDay(dateStr) {
  return new Date(`${dateStr}T12:00:00+05:30`);
}

function fmtLong(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDay(dateStr));
}

function fmtLongShort(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseDay(dateStr));
}

function fmtShort(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseDay(dateStr));
}

function fmtShortNoYear(dateStr) {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    parseDay(dateStr)
  );
}

function weekday(dateStr) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(parseDay(dateStr));
}

function monthLabel(monthKey) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(`${monthKey}-01T12:00:00+05:30`)
  );
}

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

const fmtNum = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
};

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function countOutlets(digest) {
  const names = new Set();
  for (const item of digest?.items || []) {
    for (const source of item.sources || []) {
      if (source?.name) names.add(source.name);
    }
  }
  return names.size;
}

/* ------------------------------------------------------------
   Routing
   ------------------------------------------------------------ */

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const path = raw.split("?")[0];
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "date" && /^\d{4}-\d{2}-\d{2}$/.test(parts[1] || "")) {
    return { name: "date", date: parts[1] };
  }
  if (["archive", "bookmarks", "sources", "about"].includes(parts[0])) {
    return { name: parts[0] };
  }
  return { name: "today" };
}

function setActiveNav(name) {
  $$(".nav-item").forEach((el) => {
    const active = el.dataset.nav === name;
    el.classList.toggle("is-active", active);
    if (active) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}

async function renderRoute() {
  const route = parseRoute();
  state.route = route;
  state.error = null;
  state.dismissStatus = false;
  const seq = ++state.reqSeq;

  setActiveNav(route.name === "date" ? "today" : route.name);
  window.scrollTo(0, 0);

  if (route.name !== "today" && route.name !== "date") {
    state.digest = null;
    updateChrome();
  }

  if (route.name === "today" || route.name === "date") await loadDigest(route, seq);
  else if (route.name === "archive") await loadArchive(seq);
  else if (route.name === "bookmarks") renderBookmarks();
  else if (route.name === "sources") await loadSources(seq);
  else if (route.name === "about") renderAbout();
}

/* ------------------------------------------------------------
   Header & chrome
   ------------------------------------------------------------ */

function setHeader({ kicker, title, sub, actions = "", docTitle }) {
  $("#page-kicker").textContent = kicker || "";
  $("#page-title").textContent = title || "";
  $("#page-sub").textContent = sub || "";
  $("#title-actions").innerHTML = actions;
  if (docTitle) document.title = docTitle;
  updateChrome();
}

function refreshButton() {
  return `<button class="btn btn--primary" type="button" data-action="refresh" title="Fetch the latest news now">
    ${icon("refresh")}<span class="btn-label">Refresh</span>
  </button>`;
}

function updateChrome() {
  const status = state.status;
  const digest = state.digest;

  const dateStr = digest?.date || status?.date || todayKey();
  const generated = digest?.generatedAt || status?.generatedAt;

  const parts = [];
  if (digest) parts.push(`${digest.items.length} STORIES`);
  if (digest?.stats?.sourcesUsed) parts.push(`${digest.stats.sourcesUsed} SOURCES`);
  if (generated) parts.push(`UPDATED ${fmtTime(generated)}`);

  $("#masthead-date").textContent = dateStr ? fmtLong(dateStr).toUpperCase() : "LOCAL EDITION";
  $("#masthead-meta").textContent = parts.length ? parts.join(" · ") : "DAILY BRIEFING";

  if (status) {
    const nr = status.nextRun;
    if (nr?.at) {
      let dayLabel = "";
      if (nr.date === status.date) dayLabel = "Today";
      else if (nr.date === addDays(status.date, 1)) dayLabel = "Tomorrow";
      else dayLabel = fmtShort(nr.date);
      $("#next-run").textContent = `${dayLabel}, ${fmtTime(nr.at)} IST`;
    } else {
      $("#next-run").textContent = `Daily at ${status.config?.runAt || "06:00"} IST`;
    }
    $("#schedule-note").textContent = status.config?.schedulerEnabled
      ? "Automatic daily run"
      : "Automatic run paused";

    const lastIso = status.lastSuccessAt || generated;
    $("#last-update").textContent = lastIso ? fmtTime(lastIso) : "—";
    $("#last-update-detail").textContent = lastIso
      ? `${fmtShort(dateStr)} · ${digest?.items?.length ?? status.stats?.items ?? 0} stories`
      : "No completed run yet";
  }

  $("#footer-stamp").textContent = `Local edition · ${fmtShort(dateStr)}`;

  const refresh = $('[data-action="refresh"]');
  if (refresh) {
    const running = Boolean(status?.running);
    refresh.classList.toggle("is-busy", running);
    if (refresh.tagName === "BUTTON") refresh.disabled = running;
    const label = refresh.querySelector(".btn-label");
    if (label) label.textContent = running ? "Researching…" : "Refresh";
  }
}

function addDays(dateStr, days) {
  if (!dateStr) return "";
  const d = parseDay(dateStr);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function renderRunStatus() {
  const box = $("#run-status");
  const s = state.status;
  if (!box) return;

  if (!s || state.dismissStatus) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  let html = "";
  if (s.running) {
    const total = Number(s.total) || 0;
    const done = Number(s.done) || 0;
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    html = `<div class="run-status-inner">
      <span class="status-dot status-dot--busy"></span>
      <span class="status-text"><strong>Researching the day&rsquo;s news…</strong> ${esc(s.message || "Working")}${total ? ` <span class="muted">(${done}/${total})</span>` : ""}</span>
    </div>
    <div class="status-progress ${total ? "" : "status-progress--indeterminate"}"><span style="width:${pct}%"></span></div>`;
  } else if (s.stage === "error" && s.lastError) {
    html = `<div class="run-status-inner">
      <span class="status-dot status-dot--error"></span>
      <span class="status-text"><strong>Last research run failed.</strong> ${esc(s.lastError)}</span>
      <button class="btn btn--ghost" type="button" data-action="refresh">${icon("refresh")}<span class="btn-label">Try again</span></button>
      <button class="status-dismiss" type="button" data-action="dismiss-status" aria-label="Dismiss status message">&times;</button>
    </div>`;
  } else if (s.stale) {
    const isToday = s.hasToday;
    html = `<div class="run-status-inner">
      <span class="status-dot status-dot--warn"></span>
      <span class="status-text"><strong>${isToday ? "This briefing is older than usual." : "No briefing for today yet."}</strong> ${esc(
        s.staleReason || "The desk will refresh when it can."
      )}</span>
      <button class="btn btn--ghost" type="button" data-action="refresh">${icon("refresh")}<span class="btn-label">${isToday ? "Refresh" : "Start now"}</span></button>
      <button class="status-dismiss" type="button" data-action="dismiss-status" aria-label="Dismiss status message">&times;</button>
    </div>`;
  }

  if (!html) {
    box.hidden = true;
    box.innerHTML = "";
  } else {
    box.innerHTML = html;
    box.hidden = false;
  }
}

/* ------------------------------------------------------------
   Status polling
   ------------------------------------------------------------ */

async function pollStatus() {
  clearTimeout(state.pollTimer);
  try {
    const status = await api("/api/status");
    const previous = state.status;
    state.status = status;
    if (state.offline) {
      state.offline = false;
      toast("Reconnected to the local research desk.");
    }

    updateChrome();
    renderRunStatus();

    const completed = previous && previous.running && !status.running && previous.version !== status.version;
    if (completed) {
      if (status.stage === "error") {
        toast(`Research run failed: ${status.lastError || "unknown error"}`, "error");
      } else {
        toast("Briefing updated.");
        if (state.route.name === "today" || state.route.name === "date") {
          await renderRoute();
        } else if (state.route.name === "archive") {
          await renderRoute();
        }
      }
    }
  } catch {
    if (!state.offline) {
      state.offline = true;
      renderOffline();
    }
  }
  state.pollTimer = setTimeout(pollStatus, state.status?.running ? 1500 : 12000);
}

function renderOffline() {
  const box = $("#run-status");
  if (!box) return;
  box.innerHTML = `<div class="run-status-inner">
    <span class="status-dot status-dot--error"></span>
    <span class="status-text"><strong>Local server not responding.</strong> Retrying automatically. If this persists, close this tab and start the digest again.</span>
  </div>`;
  box.hidden = false;
}

async function triggerRefresh(button) {
  if (state.status?.running) {
    toast("A research run is already in progress.");
    return;
  }
  if (button) {
    button.disabled = true;
    button.classList.add("is-busy");
    const label = button.querySelector(".btn-label");
    if (label) label.textContent = "Starting…";
  }
  try {
    await api("/api/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    toast("Research run started. This usually takes under a minute.");
    state.dismissStatus = false;
    clearTimeout(state.pollTimer);
    pollStatus();
  } catch (err) {
    toast(err.message, "error");
    if (button) {
      button.disabled = false;
      button.classList.remove("is-busy");
      const label = button.querySelector(".btn-label");
      if (label) label.textContent = "Refresh";
    }
  }
}

/* ------------------------------------------------------------
   Digest view
   ------------------------------------------------------------ */

async function loadDigest(route, seq) {
  state.loading = true;
  state.fallbackNote = "";
  showLoading();
  setHeader({
    kicker: "Daily current-affairs briefing",
    title: route.name === "date" ? fmtLongShort(route.date) : "Today&rsquo;s Briefing".replace("&rsquo;", "’"),
    sub: "Reading the day&rsquo;s news against the syllabus.".replace("&rsquo;", "’"),
    actions: "",
    docTitle: "UPSC Daily Digest",
  });

  const wanted = route.name === "date" ? route.date : "";
  try {
    let digest = null;
    let note = "";

    try {
      digest = await api(wanted ? `/api/digest?date=${wanted}` : "/api/digest");
    } catch (err) {
      if (err.status !== 404) throw err;
      const listing = await api("/api/dates");
      const dates = Array.isArray(listing?.dates) ? listing.dates : [];
      const fallback = dates.find((d) => d.date !== wanted) || dates[0];
      if (fallback) {
        digest = await api(`/api/digest?date=${fallback.date}`);
        note = wanted
          ? `No briefing is stored for ${fmtShort(wanted)}. Showing the latest available edition.`
          : `Today&rsquo;s edition is still being prepared. Showing the latest available briefing from ${fmtShort(digest.date)}.`.replace("&rsquo;", "’");
      }
    }

    if (seq !== state.reqSeq) return;
    if (!digest) {
      renderNoDigest();
      return;
    }

    state.loading = false;
    state.digest = digest;
    state.fallbackNote = note;
    renderDigest(digest, note);
  } catch (err) {
    if (seq !== state.reqSeq) return;
    renderError(err);
  }
}

function renderDigest(digest, note) {
  const isToday = digest.date === (state.status?.date || todayKey());
  const title = isToday ? "Today’s Briefing" : fmtLongShort(digest.date);
  const outlets = digest.stats?.sourcesUsed || countOutlets(digest);
  const sub = `${digest.items.length} ${digest.items.length === 1 ? "story" : "stories"} mapped to the syllabus, drawn from ${outlets} ${outlets === 1 ? "outlet" : "outlets"}.`;

  setHeader({
    kicker: isToday ? "Daily current-affairs briefing" : "Archived edition",
    title,
    sub,
    actions: `
      <a class="btn btn--ghost" href="/api/export?date=${encodeURIComponent(digest.date)}" title="Download this briefing as JSON">
        ${icon("download")}<span>Export</span>
      </a>
      <button class="btn btn--ghost" type="button" data-action="print" title="Print this briefing">
        ${icon("print")}<span>Print</span>
      </button>
      ${refreshButton()}
    `,
    docTitle: `${isToday ? "Today's Briefing" : fmtShort(digest.date)} · UPSC Daily Digest`,
  });

  const stats = digest.stats || {};
  const crossChecked = digest.items.filter((i) => {
    const v = i.verification || {};
    return Number(v.officialCount) > 0 || Number(v.outletCount) > 1;
  }).length;

  const edition = `<section class="edition-row" aria-label="Edition summary">
    <div class="edition-stat"><strong>${fmtNum(digest.items.length)}</strong><span>stories selected</span></div>
    <div class="edition-stat"><strong>${fmtNum(stats.articlesScanned ?? "—")}</strong><span>articles screened</span></div>
    <div class="edition-stat"><strong>${fmtNum(stats.sourcesUsed ?? outlets)}</strong><span>outlets cited</span></div>
    <div class="edition-stat"><strong>${fmtNum(crossChecked)}</strong><span>cross-checked</span></div>
    <div class="edition-time">Generated ${esc(fmtTime(digest.generatedAt))} IST${
      stats.durationMs ? ` · ${(stats.durationMs / 1000).toFixed(1)}s` : ""
    }</div>
  </section>`;

  const noteHtml = note
    ? `<div class="notice">${icon("clock")}<span>${esc(note)}</span></div>`
    : "";

  $("#view").innerHTML = `${noteHtml}${edition}${toolbarHtml(digest)}
    <div class="result-line"><span id="result-count"></span><span id="result-note">Ranked by UPSC relevance</span></div>
    <div class="stories" id="stories"></div>`;

  renderStories();
  syncFilterControls();
}

function toolbarHtml(digest) {
  const counts = { all: digest.items.length, "GS-1": 0, "GS-2": 0, "GS-3": 0, "GS-4": 0 };
  for (const item of digest.items) {
    if (counts[item.paper] != null) counts[item.paper] += 1;
  }

  const chip = (value, label, count, cls = "") => {
    const active = state.gs === value;
    return `<button type="button" class="chip ${cls} ${active ? "is-active" : ""}" data-action="set-gs" data-gs="${value}" aria-pressed="${active}">
      ${esc(label)} <span class="chip-count">${count}</span>
    </button>`;
  };

  const options = [
    ["all", "All sources"],
    ["official", "Official only"],
    ["corroborated", "Cross-checked"],
    ["single", "Single source"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${state.verification === value ? "selected" : ""}>${label}</option>`
    )
    .join("");

  return `<div class="toolbar">
    <div class="search">
      <span class="search-icon">${icon("search")}</span>
      <input id="search" type="search" placeholder="Search headlines, topics, facts…" value="${esc(
        state.query
      )}" autocomplete="off" spellcheck="false" aria-label="Search this briefing">
      <button class="search-clear" id="search-clear" type="button" data-action="clear-search" aria-label="Clear search" ${
        state.query ? "" : "hidden"
      }>${icon("x")}</button>
    </div>
    <div class="filters" role="group" aria-label="Filter by General Studies paper">
      ${chip("all", "All", counts.all)}
      ${PAPER_FILTERS.map((p) => chip(p, p, counts[p], `chip--gs${p.slice(3)}`)).join("")}
    </div>
    <label class="select-wrap">
      <select id="verification-filter" aria-label="Filter by verification level">${options}</select>
    </label>
  </div>`;
}

function filteredStories() {
  if (!state.digest) return [];
  const q = state.query.trim().toLowerCase();
  return state.digest.items.filter((item) => {
    if (state.gs !== "all" && item.paper !== state.gs) return false;
    if (state.verification !== "all") {
      const v = item.verification || {};
      const status = v.status || "single";
      const outlets = Number(v.outletCount) || 0;
      const official = Number(v.officialCount) || 0;
      if (state.verification === "official") {
        if (official === 0 && status !== "official" && status !== "official-confirmed") return false;
      } else if (state.verification === "corroborated") {
        const multiSource =
          outlets > 1 ||
          official > 0 ||
          ["official", "official-confirmed", "corroborated", "confirmed"].includes(status);
        if (!multiSource) return false;
      } else if (state.verification === "single") {
        if (status !== "single" || outlets > 1 || official > 0) return false;
      }
    }
    if (!q) return true;
    const haystack = [
      item.title,
      item.summary,
      item.themeName,
      item.paper,
      ...(item.keywords || []),
      ...(item.facts || []),
      item.whyItMatters,
      ...(item.sources || []).map((s) => s.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function renderStories() {
  const host = $("#stories");
  if (!host || !state.digest) return;

  const items = filteredStories();
  const unfiltered =
    state.gs === "all" && state.verification === "all" && !state.query.trim();

  let html = "";
  if (!items.length) {
    html = `<div class="empty" style="grid-column:1/-1">
      <div class="empty-glyph">∅</div>
      <h2>No stories match these filters</h2>
      <p>Try a broader search term, another General Studies paper, or reset the verification filter.</p>
      <button class="btn" type="button" data-action="clear-filters">Reset filters</button>
    </div>`;
  } else if (unfiltered) {
    html = storyCard(items[0], true) + items.slice(1).map((i) => storyCard(i, false)).join("");
  } else {
    html = items.map((i) => storyCard(i, false)).join("");
  }

  host.innerHTML = html;
  updateResultLine(items.length);

  const clear = $("#search-clear");
  if (clear) clear.hidden = !state.query;
}

function updateResultLine(count) {
  const host = $("#result-count");
  const note = $("#result-note");
  if (!host) return;
  const total = state.digest?.items?.length || 0;
  const filters = [];
  if (state.gs !== "all") filters.push(state.gs);
  if (state.verification !== "all") {
    filters.push(
      state.verification === "corroborated"
        ? "cross-checked"
        : state.verification === "official"
        ? "official sources"
        : "single source"
    );
  }
  if (state.query.trim()) filters.push(`matching “${state.query.trim()}”`);

  host.innerHTML = `Showing <strong>${fmtNum(count)}</strong> of ${fmtNum(total)} stories${
    filters.length ? ` · ${esc(filters.join(" · "))}` : ""
  }`;
  if (note) note.textContent = state.query.trim() ? "Filtered results" : "Ranked by UPSC relevance";
}

function syncFilterControls() {
  $$("[data-action='set-gs']").forEach((el) => {
    const active = el.dataset.gs === state.gs;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-pressed", String(active));
  });
  const select = $("#verification-filter");
  if (select) select.value = state.verification;
  const clear = $("#search-clear");
  if (clear) clear.hidden = !state.query;
}

/* ------------------------------------------------------------
   Story rendering
   ------------------------------------------------------------ */

function storyCard(item, lead = false, options = {}) {
  if (!item) return "";
  const id = esc(item.id);
  const paper = item.paper || "";
  const paperKey = PAPER_FILTERS.includes(paper) ? `pill--${paper.toLowerCase().replace("-", "")}` : "pill--other";
  const saved = state.bookmarks.some((b) => b.id === item.id);
  const facts = (item.facts || []).filter(Boolean).slice(0, lead ? 3 : 2);
  const sources = (item.sources || []).filter((s) => s && s.name);
  const reading = item.readingTime || 3;
  const url = safeUrl(item.url);

  const head = `<div class="story-head">
    <div class="story-meta">
      <span class="rank">${
        options.dateLabel ? esc(options.dateLabel) : String(item.rank || 0).padStart(2, "0")
      }</span>
      ${paper ? `<span class="pill ${paperKey}">${esc(paper)}</span>` : ""}
      ${item.themeName ? `<span class="theme-label">${esc(item.themeName)}</span>` : ""}
    </div>
    <button class="icon-btn ${saved ? "is-saved" : ""}" type="button" data-action="bookmark" data-item="${id}"
      aria-pressed="${saved}" aria-label="${saved ? "Remove bookmark" : "Save to bookmarks"}"
      title="${saved ? "Remove bookmark" : "Save to bookmarks"}">${icon(saved ? "starFilled" : "star")}</button>
  </div>`;

  const title = `<h2 class="story-title"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(
    item.title
  )}</a></h2>`;

  const summary = item.summary ? `<p class="story-summary">${esc(item.summary)}</p>` : "";
  const why = item.whyItMatters
    ? `<div class="why"><span class="label">Why it matters</span><p>${esc(item.whyItMatters)}</p></div>`
    : "";

  const factList = facts.length
    ? `<ul class="facts">${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`
    : "";

  const mcq = item.mcq && Array.isArray(item.mcq.options) && item.mcq.options.length ? mcqBlock(item) : "";

  const chips = sources.length
    ? sources
        .slice(0, 3)
        .map(
          (s) =>
            `<a class="source-chip ${s.kind === "official" ? "source-chip--official" : ""}" href="${esc(
              safeUrl(s.url)
            )}" target="_blank" rel="noopener noreferrer" title="${esc(s.name)}">${esc(s.name)}${icon(
              "external"
            )}</a>`
        )
        .join("") +
      (sources.length > 3 ? `<span class="source-more">+${sources.length - 3} more</span>` : "")
    : `<span class="source-more">Source link unavailable</span>`;

  const foot = `<footer class="story-foot">
    <div class="source-chips">${chips}</div>
    <div class="foot-meta">
      ${verificationBadge(item.verification)}
      <span class="dot">·</span>
      <span>${esc(reading)} min</span>
    </div>
  </footer>`;

  if (lead) {
    return `<article class="story story--lead" data-id="${id}">
      ${head}
      ${title}
      <div class="lead-grid">
        <div class="lead-main">${summary}${why}</div>
        ${
          facts.length
            ? `<aside class="lead-facts"><span class="label">Key facts</span>${factList}</aside>`
            : ""
        }
      </div>
      ${mcq}
      ${foot}
    </article>`;
  }

  return `<article class="story" data-id="${id}">
    ${head}
    ${title}
    ${summary}
    ${why}
    ${factList}
    ${mcq}
    ${foot}
  </article>`;
}

function verificationBadge(verification) {
  const status = verification?.status || "single";
  const count = Number(verification?.outletCount) || 0;
  const fallbackLabel =
    status === "official" || status === "official-confirmed"
      ? status === "official-confirmed"
        ? `Official + ${count} sources`
        : "Official source"
      : status === "confirmed"
      ? `Verified · ${count} sources`
      : status === "corroborated"
      ? `Corroborated${count > 1 ? ` ×${count}` : ""}`
      : "Single source";
  const label = verification?.label || fallbackLabel;
  const title =
    status === "official" || status === "official-confirmed"
      ? "Anchored to an official government or institutional release."
      : status === "confirmed" || status === "corroborated"
      ? `Carried by ${count || "multiple"} distinct outlets in the watchlist.`
      : "Only one outlet in the watchlist carried this story. Treat specifics with care.";
  return `<span class="verify verify--${esc(status)}" title="${esc(title)}">
    <span class="verify-dot"></span>${esc(label)}
  </span>`;
}

/* ------------------------------------------------------------
   MCQ
   ------------------------------------------------------------ */

function mcqBlock(item) {
  const mcq = item.mcq;
  if (!mcq) return "";
  const id = esc(item.id);
  const open = state.openMcq.has(item.id);
  const chosen = state.answered.has(item.id) ? state.answered.get(item.id) : null;
  const revealed = state.revealed.has(item.id);
  const locked = chosen != null || revealed;
  const answer =
    typeof mcq.answer === "number"
      ? mcq.answer
      : mcq.options.findIndex((o) => o.correct === true);

  const options = mcq.options
    .map((option, index) => {
      const correct = index === answer || option.correct === true;
      let cls = "mcq-option";
      if (locked) {
        cls += " is-locked";
        if (correct) cls += " is-correct";
        else if (chosen === index) cls += " is-wrong";
      }
      return `<button type="button" class="${cls}" data-action="answer" data-item="${id}" data-opt="${index}" ${
        locked ? "disabled" : ""
      }>
        <span class="opt-letter">${"ABCD"[index] || index + 1}</span>
        <span>${esc(option.text)}</span>
      </button>`;
    })
    .join("");

  let result = "";
  if (locked) {
    const isRight = chosen != null && chosen === answer;
    result = `<div class="mcq-result ${chosen != null ? (isRight ? "is-right" : "is-wrong") : ""}">
      ${chosen != null ? (isRight ? "Correct — well spotted." : "Not quite — the correct option is highlighted.") : "Answer highlighted below."}
    </div>`;
    if (mcq.explanation) {
      result += `<p class="mcq-explanation"><strong>Why:</strong> ${esc(mcq.explanation)}</p>`;
    }
  } else {
    result = `<button type="button" class="mcq-reveal" data-action="reveal" data-item="${id}">Reveal answer</button>`;
  }

  return `<div class="mcq" data-mcq="${id}">
    <button class="mcq-toggle" type="button" data-action="mcq" data-item="${id}" aria-expanded="${open}">
      <span class="mcq-tag">Prelims</span>
      <span>Practice MCQ</span>
      <span class="chev">${icon("chevron")}</span>
    </button>
    <div class="mcq-body" ${open ? "" : "hidden"}>
      <p class="mcq-question">${esc(mcq.question)}</p>
      <div class="mcq-options">${options}</div>
      ${result}
    </div>
  </div>`;
}

function refreshMcq(id) {
  const item = findItem(id);
  const host = document.querySelector(`[data-mcq="${id}"]`);
  if (!item || !host) return;
  host.outerHTML = mcqBlock(item);
}

/* ------------------------------------------------------------
   Actions
   ------------------------------------------------------------ */

function handleClick(event) {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.item;

  if (action === "refresh") {
    event.preventDefault();
    triggerRefresh(el);
    return;
  }

  if (action === "print") {
    window.print();
    return;
  }

  if (action === "set-gs") {
    state.gs = el.dataset.gs || "all";
    syncFilterControls();
    renderStories();
    return;
  }

  if (action === "clear-search") {
    state.query = "";
    const search = $("#search");
    if (search) {
      search.value = "";
      search.focus();
    }
    renderStories();
    syncFilterControls();
    return;
  }

  if (action === "clear-filters") {
    state.gs = "all";
    state.verification = "all";
    state.query = "";
    const search = $("#search");
    if (search) search.value = "";
    renderStories();
    syncFilterControls();
    return;
  }

  if (action === "bookmark") {
    event.preventDefault();
    toggleBookmark(id);
    return;
  }

  if (action === "remove-bookmark") {
    removeBookmark(id);
    return;
  }

  if (action === "clear-bookmarks") {
    if (!state.bookmarks.length) return;
    if (!window.confirm("Remove all saved bookmarks? This cannot be undone.")) return;
    state.bookmarks = [];
    persistBookmarks();
    updateBookmarkBadge();
    toast("Bookmarks cleared.");
    renderBookmarks();
    return;
  }

  if (action === "mcq") {
    if (state.openMcq.has(id)) state.openMcq.delete(id);
    else state.openMcq.add(id);
    refreshMcq(id);
    return;
  }

  if (action === "answer") {
    const item = findItem(id);
    if (!item?.mcq) return;
    if (state.answered.has(id) || state.revealed.has(id)) return;
    state.answered.set(id, Number(el.dataset.opt));
    state.openMcq.add(id);
    refreshMcq(id);
    return;
  }

  if (action === "reveal") {
    state.revealed.add(id);
    state.openMcq.add(id);
    refreshMcq(id);
    return;
  }

  if (action === "dismiss-status") {
    state.dismissStatus = true;
    renderRunStatus();
    return;
  }

  if (action === "retry") {
    renderRoute();
  }
}

function handleInput(event) {
  if (event.target.id !== "search") return;
  state.query = event.target.value;
  renderStories();
  const clear = $("#search-clear");
  if (clear) clear.hidden = !state.query;
}

function handleChange(event) {
  if (event.target.id !== "verification-filter") return;
  state.verification = event.target.value;
  renderStories();
}

/* ------------------------------------------------------------
   Bookmarks
   ------------------------------------------------------------ */

function toggleBookmark(id) {
  const index = state.bookmarks.findIndex((b) => b.id === id);
  if (index >= 0) {
    state.bookmarks.splice(index, 1);
    toast("Removed from bookmarks.");
  } else {
    const item = findItem(id);
    if (!item) return;
    state.bookmarks.unshift(snapshot(item));
    state.bookmarks = state.bookmarks.slice(0, 500);
    toast("Saved to bookmarks.");
  }
  persistBookmarks();
  updateBookmarkBadge();
  updateBookmarkButtons(id);

  if (state.route.name === "bookmarks") renderBookmarks();
}

function removeBookmark(id) {
  state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
  persistBookmarks();
  updateBookmarkBadge();
  toast("Removed from bookmarks.");
  renderBookmarks();
}

function updateBookmarkButtons(id) {
  const saved = state.bookmarks.some((b) => b.id === id);
  $$(`[data-action="bookmark"][data-item="${id}"]`).forEach((btn) => {
    btn.classList.toggle("is-saved", saved);
    btn.setAttribute("aria-pressed", String(saved));
    btn.setAttribute("aria-label", saved ? "Remove bookmark" : "Save to bookmarks");
    btn.title = saved ? "Remove bookmark" : "Save to bookmarks";
    btn.innerHTML = icon(saved ? "starFilled" : "star");
  });
}

function updateBookmarkBadge() {
  const badge = $("#nav-bookmark-count");
  if (!badge) return;
  const count = state.bookmarks.length;
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

function renderBookmarks() {
  const count = state.bookmarks.length;
  setHeader({
    kicker: "Your desk",
    title: "Bookmarks",
    sub: count
      ? `${count} saved ${count === 1 ? "story" : "stories"}, kept in this browser for revision.`
      : "Save any story with the star to build a revision list.",
    actions: count
      ? `<button class="btn" type="button" data-action="clear-bookmarks">${icon("trash")}<span>Clear all</span></button>
         <a class="btn btn--primary" href="#/today">Today’s briefing</a>`
      : `<a class="btn btn--primary" href="#/today">Today’s briefing</a>`,
    docTitle: "Bookmarks · UPSC Daily Digest",
  });

  if (!count) {
    $("#view").innerHTML = `<div class="empty">
      <div class="empty-glyph">☆</div>
      <h2>No bookmarks yet</h2>
      <p>Tap the star on any story to keep it here. Bookmarks live in this browser — they stay even when the digest refreshes.</p>
      <a class="btn btn--primary" href="#/today">Open today’s briefing</a>
    </div>`;
    return;
  }

  $("#view").innerHTML = `<div class="bookmark-toolbar">
      <span>Newest saved first</span>
    </div>
    <div class="stories">
      ${state.bookmarks
        .map((item) => storyCard(item, false, { dateLabel: fmtShortNoYear(item.date) }))
        .join("")}
    </div>`;
}

/* ------------------------------------------------------------
   Archive
   ------------------------------------------------------------ */

async function loadArchive(seq) {
  setHeader({
    kicker: "Past editions",
    title: "Archive",
    sub: "Every briefing is stored on this computer. Open any day to revisit its stories and practice questions.",
    actions: refreshButton(),
    docTitle: "Archive · UPSC Daily Digest",
  });
  showLoading();

  try {
    const data = await api("/api/dates");
    if (seq !== state.reqSeq) return;
    renderArchive(Array.isArray(data?.dates) ? data.dates : []);
  } catch (err) {
    if (seq !== state.reqSeq) return;
    renderError(err, "archive");
  }
}

function renderArchive(dates) {
  if (!dates.length) {
    setHeader({
      kicker: "Past editions",
      title: "Archive",
      sub: "No earlier editions are stored yet.",
      actions: refreshButton(),
      docTitle: "Archive · UPSC Daily Digest",
    });
    $("#view").innerHTML = `<div class="empty">
      <div class="empty-glyph">◫</div>
      <h2>The archive is empty</h2>
      <p>Once a daily run completes, that edition is saved here and stays available offline.</p>
      <button class="btn btn--primary" type="button" data-action="refresh">${icon("refresh")}<span class="btn-label">Run research now</span></button>
    </div>`;
    return;
  }

  const totalStories = dates.reduce((sum, d) => sum + (Number(d.count) || 0), 0);
  setHeader({
    kicker: "Past editions",
    title: "Archive",
    sub: `${dates.length} ${dates.length === 1 ? "briefing" : "briefings"} · ${fmtNum(
      totalStories
    )} stories stored locally. Open any day to revisit it.`,
    actions: refreshButton(),
    docTitle: "Archive · UPSC Daily Digest",
  });

  const groups = [];
  for (const entry of dates) {
    const key = String(entry.date).slice(0, 7);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }

  $("#view").innerHTML = groups
    .map(
      (group) => `<section class="archive-group">
        <h2 class="group-title">${esc(monthLabel(group.key))} · ${group.entries.length}</h2>
        <div class="archive-grid">${group.entries.map(archiveCard).join("")}</div>
      </section>`
    )
    .join("");
}

function archiveCard(entry) {
  const counts = entry.byPaper || {};
  const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const bars = PAPER_FILTERS.filter((p) => Number(counts[p]) > 0)
    .map(
      (p) =>
        `<span class="gs-bar gs-bar--gs${p.slice(3)}" style="width:${(
          (Number(counts[p]) / total) *
          100
        ).toFixed(1)}%" title="${p}: ${counts[p]} ${counts[p] === 1 ? "story" : "stories"}"></span>`
    )
    .join("");

  return `<a class="archive-card" href="#/date/${esc(entry.date)}" aria-label="Open briefing for ${esc(
    fmtLong(entry.date)
  )}">
    <div class="ac-head">
      <span class="ac-date">${esc(fmtShortNoYear(entry.date))}</span>
      <span class="ac-day">${esc(weekday(entry.date))}</span>
    </div>
    <h3 class="ac-title">${esc(entry.topHeadline || "Untitled briefing")}</h3>
    <div class="ac-meta">${fmtNum(entry.count || 0)} stories · ${fmtNum(
      entry.sources || 0
    )} sources</div>
    <div class="gs-bars">${bars}</div>
  </a>`;
}

/* ------------------------------------------------------------
   Sources
   ------------------------------------------------------------ */

async function loadSources(seq) {
  setHeader({
    kicker: "Watchlist",
    title: "Sources",
    sub: "The feeds this desk reads on every run.",
    actions: "",
    docTitle: "Sources · UPSC Daily Digest",
  });
  showLoading();

  try {
    const data = await api("/api/sources");
    if (seq !== state.reqSeq) return;
    renderSources(data);
  } catch (err) {
    if (seq !== state.reqSeq) return;
    renderError(err, "sources");
  }
}

function renderSources(data) {
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const stats = Array.isArray(data?.stats) ? data.stats : [];
  const statById = new Map(stats.map((s) => [s.id, s]));
  const healthy = stats.filter((s) => !s.error).length;
  const articles = stats.reduce((sum, s) => sum + (Number(s.items) || 0), 0);

  setHeader({
    kicker: "Watchlist",
    title: "Sources",
    sub: `${sources.length} trusted feeds — official releases, national dailies, business press and specialist publications.`,
    actions: "",
    docTitle: "Sources · UPSC Daily Digest",
  });

  const summary = `<div class="stat-row">
    <div class="stat-card"><strong>${fmtNum(sources.length)}</strong><span>Feeds watched</span></div>
    <div class="stat-card ${healthy === sources.length ? "stat-card--good" : "stat-card--warn"}"><strong>${fmtNum(
    healthy
  )}</strong><span>Healthy on last run</span></div>
    <div class="stat-card"><strong>${fmtNum(articles)}</strong><span>Items fetched</span></div>
    <div class="stat-card"><strong>${esc(fmtTime(data?.generatedAt))}</strong><span>Last checked (IST)</span></div>
  </div>`;

  const groups = KIND_ORDER.map((kind) => {
    const list = sources.filter((s) => s.kind === kind);
    if (!list.length) return "";
    const rows = list
      .map((source) => {
        const stat = statById.get(source.id);
        const down = Boolean(stat?.error);
        return `<div class="source-row">
          <span class="source-health ${down ? "source-health--down" : ""}" title="${down ? "Last fetch failed" : "Last fetch OK"}"></span>
          <span class="source-name">${esc(source.name)}</span>
          <span class="source-outlet" title="${esc(source.outlet || "")}">${esc(source.outlet || "—")}</span>
          <span class="source-kind">${esc(source.kind || "")}</span>
          <span class="source-count" title="Items returned in the last run">${stat ? fmtNum(stat.items || 0) : "—"}</span>
          <a class="source-link" href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">Feed ↗</a>
        </div>`;
      })
      .join("");

    return `<section class="source-group">
      <h2 class="group-title">${esc(KIND_LABELS[kind] || kind)} · ${list.length}</h2>
      <div class="source-list">
        <div class="source-row source-row--head">
          <span></span><span>Source</span><span>Outlet</span><span>Type</span><span>Items</span><span>Link</span>
        </div>
        ${rows}
      </div>
    </section>`;
  }).join("");

  const note = `<p class="offline-note">Feeds are polled directly over RSS. Some publishers expose only headlines or partial summaries; every story links to the original. A feed marked unhealthy failed on the last run and will be retried automatically.</p>`;

  $("#view").innerHTML = `${summary}${note}${groups}`;
}

/* ------------------------------------------------------------
   Method / about
   ------------------------------------------------------------ */

function renderAbout() {
  const config = state.status?.config || {};
  const runAt = config.runAt || "06:00";
  const timezone = config.timezone || TZ;
  const freshness = config.freshnessHours || 9;
  const feeds = config.feeds || 30;
  const dataPath = config.dataPath || "data/";
  const scheduler = config.schedulerEnabled ? "Automatic" : "Paused";
  const next = state.status?.nextRun;

  let nextLabel = "—";
  if (next?.at) {
    nextLabel = `${fmtShort(next.date)}, ${fmtTime(next.at)} IST`;
  }

  setHeader({
    kicker: "How it works",
    title: "Method & limitations",
    sub: "A transparent, deterministic reading desk — no language model, no invented facts.",
    actions: "",
    docTitle: "Method · UPSC Daily Digest",
  });

  $("#view").innerHTML = `<div class="prose">
    <h2>What this is</h2>
    <p>A local research desk for civil-services preparation. On every run it reads a fixed watchlist of ${feeds} trusted feeds, keeps what matters for the syllabus, groups duplicate coverage, flags how well each story is corroborated, and writes a daily briefing with source links, revision notes and a Prelims question.</p>
    <p>Everything is stored on this computer. There is no account, no cloud sync and no third-party analytics. The dashboard is served only on <code>127.0.0.1</code>.</p>

    <h2>How a briefing is built</h2>
    <div class="steps">
      <div class="step"><span class="step-num">01</span><div><strong>Scan</strong><p>Fetch every feed in the watchlist over RSS or Atom, parse headlines, summaries, dates and links.</p></div></div>
      <div class="step"><span class="step-num">02</span><div><strong>Filter</strong><p>Score each item against GS syllabus themes. Drop crime, celebrity, market-noise and local court listings that rarely translate into exam material.</p></div></div>
      <div class="step"><span class="step-num">03</span><div><strong>Cluster</strong><p>Merge reports of the same event across outlets. Count distinct outlets to estimate corroboration; flag official government and institutional releases.</p></div></div>
      <div class="step"><span class="step-num">04</span><div><strong>Explain</strong><p>Extract the article where available, then assemble key facts, a “why it matters” line tied to the Mains angle, and a syllabus-classification MCQ for Prelims practice.</p></div></div>
      <div class="step"><span class="step-num">05</span><div><strong>Rank &amp; store</strong><p>Order by exam relevance, apply per-theme and per-topic caps, and save the edition as dated JSON plus an index and run metadata.</p></div></div>
    </div>

    <h2>Verification, honestly</h2>
    <div class="legend-grid">
      <div class="legend-card">
        ${verificationBadge({ status: "official", outletCount: 1 })}
        <p>At least one official government or institutional release anchors the story — for example PIB, RBI or WHO. The record is authoritative; the interpretation is still the desk’s.</p>
      </div>
      <div class="legend-card">
        ${verificationBadge({ status: "corroborated", outletCount: 2 })}
        <p>The same event was carried by two or more distinct outlets in the watchlist. That makes a single-outlet error less likely, but it does not prove every figure.</p>
      </div>
      <div class="legend-card">
        ${verificationBadge({ status: "single" })}
        <p>Only one outlet carried it. Useful as a lead, but verify names, numbers and quotations against the linked original before using them in an answer.</p>
      </div>
    </div>
    <div class="callout">
      <strong>There is no claim-level fact-checking.</strong> This desk verifies provenance and corroboration, not the truth of every sentence. It does not use a language model to judge claims. Always open the linked source before quoting a figure in an answer or interview.
    </div>

    <h2>Schedule &amp; storage</h2>
    <table class="config-table">
      <tr><th>Setting</th><th>Current value</th></tr>
      <tr><td>Daily run</td><td>${esc(runAt)} (${esc(timezone)}), plus an automatic run when the app opens and today’s edition is missing or older than ${esc(
    String(freshness)
  )} hours</td></tr>
      <tr><td>Next run</td><td>${esc(nextLabel)} · ${esc(scheduler)}</td></tr>
      <tr><td>Storage</td><td><code>${esc(dataPath)}</code> — one JSON file per day, an index, run metadata and a seven-day article cache</td></tr>
      <tr><td>History</td><td>Up to 400 daily editions; bookmarks live in this browser’s local storage</td></tr>
    </table>

    <h2>Using the desk</h2>
    <ul>
      <li><strong>Filter</strong> by GS paper or verification level, or search across headlines, facts and source names.</li>
      <li><strong>Star</strong> a story to keep it in Bookmarks for revision; it survives refreshes.</li>
      <li><strong>Practice</strong> the MCQ on each card, then reveal the explanation.</li>
      <li><strong>Export</strong> an edition as JSON, or use <strong>Print</strong> for a clean paper copy.</li>
      <li>Press <span class="kbd">/</span> to jump to search; <span class="kbd">Esc</span> clears it.</li>
    </ul>

    <h2>Customising</h2>
    <p>Edit <code>config.json</code> in the app folder and restart the server:</p>
    <table class="config-table">
      <tr><th>Key</th><th>What it changes</th></tr>
      <tr><td>port</td><td>Local port for the dashboard (default 4178)</td></tr>
      <tr><td>runAt</td><td>Daily run time in 24-hour IST, e.g. “06:00”</td></tr>
      <tr><td>maxItemsPerDay</td><td>Maximum stories in one edition</td></tr>
      <tr><td>maxPerTopic</td><td>Cap on near-duplicate stories about one topic</td></tr>
      <tr><td>minRelevance</td><td>Minimum syllabus score for an item to be considered</td></tr>
      <tr><td>freshnessHours</td><td>How old an edition may be before opening the app triggers a run</td></tr>
      <tr><td>disabledFeeds</td><td>Array of feed ids to skip — see <code>src/sources.js</code></td></tr>
      <tr><td>scheduler.enabled</td><td>Turn the in-process daily scheduler on or off</td></tr>
    </table>
    <p>To add a feed, append an entry to the <code>SOURCES</code> array in <code>src/sources.js</code> with an <code>id</code>, <code>name</code>, <code>outlet</code>, <code>url</code>, <code>kind</code> and <code>region</code>. Run <code>npm run selftest</code> afterwards.</p>

    <h2>Limitations</h2>
    <ul>
      <li>Coverage follows the watchlist. A story no listed feed covers will not appear, however important it is.</li>
      <li>Paywalls and bot protection can reduce some outlets to headlines or short summaries.</li>
      <li>Theme tagging and MCQ generation are rule-based. They are consistent and explainable, but not infallible; the syllabus mapping is a study aid, not an official classification.</li>
      <li>Cross-source corroboration is not independent verification of facts, and syndicated copy can look like multiple confirmations.</li>
      <li>This is an independent study tool. It is not affiliated with UPSC, and it is not a substitute for the original newspapers, PIB releases or standard textbooks.</li>
    </ul>
  </div>`;
}

/* ------------------------------------------------------------
   States
   ------------------------------------------------------------ */

function showLoading() {
  $("#view").innerHTML = `<div class="loading-view" aria-live="polite">
    <div class="skeleton skeleton--title"></div>
    <div class="skeleton skeleton--line"></div>
    <div class="skeleton skeleton--line skeleton--short"></div>
    <div class="skeleton-row">
      <div class="skeleton skeleton--card"></div>
      <div class="skeleton skeleton--card"></div>
    </div>
  </div>`;
}

function renderNoDigest() {
  setHeader({
    kicker: "Preparing the first edition",
    title: "Today’s Briefing",
    sub: "The desk is reading the day’s feeds. This page will update automatically.",
    actions: refreshButton(),
    docTitle: "Today's Briefing · UPSC Daily Digest",
  });
  $("#view").innerHTML = `<div class="empty">
    <div class="empty-glyph">◷</div>
    <h2>The first briefing is on its way</h2>
    <p>${
      state.status?.running
        ? "A research run is in progress. Stories will appear here as soon as it finishes — usually within a minute."
        : "No edition is stored yet. Start a research run now, or wait for the automatic schedule."
    }</p>
    <button class="btn btn--primary" type="button" data-action="refresh">${icon("refresh")}<span class="btn-label">Run research now</span></button>
  </div>`;
}

function renderError(err, context = "digest") {
  setHeader({
    kicker: "Something went wrong",
    title: context === "archive" ? "Archive unavailable" : context === "sources" ? "Sources unavailable" : "Could not load the briefing",
    sub: "The local research desk did not return the data this page needs.",
    actions: `<button class="btn btn--primary" type="button" data-action="retry">${icon("refresh")}<span>Try again</span></button>`,
    docTitle: "Error · UPSC Daily Digest",
  });

  const message = err?.message || "Unknown error";
  const offline = !state.status;
  $("#view").innerHTML = `<div class="error-box">
    <h2>${offline ? "The local server is not responding" : "That did not work"}</h2>
    <p>${esc(message)}</p>
    <p>${
      offline
        ? "Close this tab, then start the digest again with <strong>“Start UPSC Digest.cmd”</strong>. If the window closed, the server may have stopped."
        : "The server is reachable but could not complete this request. Try again, or start a fresh research run."
    }</p>
    <button class="btn btn--primary" type="button" data-action="retry">${icon("refresh")}<span>Try again</span></button>
  </div>`;
}

/* ------------------------------------------------------------
   Misc UI
   ------------------------------------------------------------ */

function toast(message, type = "info") {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast${type === "error" ? " toast--error" : ""}`;
  el.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 4200);
}

function onScroll() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
    const bar = $("#scroll-progress");
    if (bar) bar.style.width = `${pct}%`;
  });
}
