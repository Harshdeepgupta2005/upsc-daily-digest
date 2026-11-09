# UPSC Daily Digest

A local research desk that builds a syllabus-mapped UPSC current-affairs digest every day.

It pulls trusted news feeds, groups reports about the same story, checks how many independent outlets are carrying it, and saves a revision-ready briefing with source links and a Prelims MCQ. Everything runs on your computer. There is no account, no cloud service and no API key.

---

## Install the desktop app

Download the latest release from:

<https://github.com/Harshdeepgupta2005/upsc-daily-digest/releases>

- **Windows** — `UPSC-Daily-Digest-<version>-win-x64.exe`. The installer is per-user, so it does not need an administrator account, and you can choose the install folder.
- **macOS** — `UPSC-Daily-Digest-<version>-mac-universal.dmg` (or the matching `.zip`). The same build runs on Apple silicon and Intel Macs.

These first builds are **not code-signed**. Windows SmartScreen may show “Windows protected your PC” — choose **More info → Run anyway**. On macOS, right-click the app and choose **Open** the first time, or run:

```bash
xattr -dr com.apple.quarantine "/Applications/UPSC Daily Digest.app"
```

On first launch the app creates its settings and data folder in your OS application-data directory. Daily research catches up automatically when the app opens, and the in-process scheduler runs while the app is open.

### Updates

Use **Check for Updates…** in the app menu (macOS) or **Help** menu (Windows). It compares your version with the latest public GitHub Release and opens the correct installer download when a newer version exists.

Install a newer version over the old one. Your digests, configuration and logs are kept across updates.

---

## Run from source

1. Install **Node.js 20 or newer** from <https://nodejs.org>.
2. Open this folder once and run:

   ```bash
   npm install
   ```

3. Start the dashboard:

   ```bash
   npm start
   ```

The dashboard opens at <http://127.0.0.1:4178>. On the first launch it may take a few seconds to fetch and research the day's news.

You can also run the packaged-style desktop shell in development:

```bash
npm run app
```

The `.cmd` launchers in this folder are for Windows. On macOS or Linux, run `npm start`,
`npm run research` and `npm run selftest` from a terminal (the server and dashboard are
cross-platform).

If the digest is missing or older than the freshness window, the server starts a research run automatically when it opens.

---

## Daily automation

### Packaged desktop app

The installed app checks for a missing or stale digest when it launches, then keeps an in-process scheduler running while it is open. If the app is closed at the configured research time, the next launch catches up.

The Windows Task Scheduler setup below is for the **source checkout** and is not needed after installing the desktop app.

### Set up the 06:00 run (source checkout)

Double-click **`Setup Daily Schedule.cmd`**.

This creates a Windows Task Scheduler task named **UPSC Digest Daily Research**. It runs the headless research job at the time in `config.json` (`06:00` by default) and catches up on a missed run the next time you log in.

No server needs to stay open for the daily research. When you later open the dashboard, the finished digest is already there.

### Run it manually

Double-click **`run-daily.cmd`**, or run:

```bat
npm run research
```

A manual run replaces today's digest. Output is appended to `data/logs/`.

### Remove the schedule

Double-click **`Remove Daily Schedule.cmd`**.

---

## What is in the dashboard

- **Today** — lead story, two-column briefing grid, search, GS-paper filters and verification filters.
- **Archive** — every saved digest, grouped by month, with story counts by paper.
- **Bookmarks** — stories you star, saved in your browser's local storage.
- **Sources** — all configured feeds, their type, region and latest fetch health.
- **Method** — a plain-language explanation of how stories are selected and verified.

Each story card contains:

- UPSC relevance score and **GS paper / syllabus theme**
- A short summary and 2–3 **key facts**
- **Why it matters** for Mains, plus a Prelims focus note
- **Source links** with a verification label
- One **Prelims MCQ** with a revealable answer and explanation

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `Esc` | Clear search / close the open card |

Dark mode, bookmarks and print/export are available from the header. `Ctrl+P` produces a clean print layout.

---

## How the research works

1. **Fetch** — reads 30 RSS feeds from PIB, RBI, The Hindu, Indian Express, Hindustan Times, Mint, BusinessLine, Times of India, Mongabay, Carbon Brief, Nature, Supreme Court Observer, BBC, The Guardian, Al Jazeera, DW, The Diplomat and WHO.
2. **Extract** — cleans each item, pulls the article summary and attempts a full-text fetch where possible.
3. **Classify** — scores the text against a hand-built GS syllabus taxonomy (GS-1 to GS-4 and essay-relevant themes), with negative signals for partisan, market and celebrity coverage.
4. **Filter** — drops routine circulars, live blogs, market wraps, gadget pricing, foreign family-law colour, research-paper titles and other non-syllabus noise.
5. **Cluster** — merges reports on the same development using title, description, entity and topic similarity, so one event becomes one story.
6. **Verify** — counts distinct outlets and flags official sources (PIB, RBI). Labels are `Official + N sources`, `Official source`, `Verified · N sources`, `Corroborated · 2 sources` or `Single source`.
7. **Rank and cap** — ranks by source tier, recency, theme strength, corroboration and article depth. Per-theme and per-topic caps prevent one story from filling the digest.
8. **Save** — writes `data/digests/YYYY-MM-DD.json` and updates the archive index.

The result is deterministic: the same feeds and the same day produce a repeatable digest.

### Verification, honestly

This app verifies **coverage**, not every claim. "Verified · 3 sources" means three independent outlets carried the story, not that every figure in it was independently fact-checked. There is no LLM in the loop and no claim-level fact-checking service.

Before quoting a number in an answer, open the linked source — ideally the official release. The **Method** page in the dashboard says the same thing.

---

## Configuration

Edit `config.json` — in this folder when running from source, or beside the `data` folder for the installed desktop app:

| Key | Default | Meaning |
| --- | --- | --- |
| `port` | `4178` | Local dashboard port |
| `runAt` | `"06:00"` | Daily research time |
| `timezone` | `"Asia/Kolkata"` | Timezone for date keys and the next-run label |
| `freshnessHours` | `9` | Re-research when the digest is older than this |
| `maxItemsPerDay` | `45` | Maximum stories in a digest |
| `maxItemAgeHours` | `40` | Ignore feeds older than this |
| `enrichTopStories` | `32` | How many candidates get full-text enrichment |
| `enrichConcurrency` | `5` | Parallel article fetches |
| `feedConcurrency` | `8` | Parallel feed fetches |
| `minRelevance` | `20` | Minimum relevance score |
| `maxPerTheme` | `12` | Cap per GS theme |
| `maxPerTopic` | `2` | Cap per topic family |
| `disabledFeeds` | `[]` | Feed IDs to skip |
| `scheduler.enabled` | `true` | In-process freshness checker |
| `scheduler.checkEveryMinutes` | `20` | How often it checks |

Restart the app (or server) after changing `config.json`. If the configured port is busy, the desktop app falls back to a free port; the source server reports the conflict instead.

### Add or remove a feed

Feeds live in `src/sources.js`. Add an entry with a unique `id`, `name`, `outlet`, `kind`, `region`, `tier` and RSS `url`:

```js
{
  id: "example",
  name: "Example — National",
  outlet: "Example",
  kind: "national",      // official | national | business | specialist | international
  region: "india",       // india | world
  tier: 2,               // 1–3; higher is more trusted
  url: "https://example.com/feed.xml",
}
```

To switch a feed off without deleting it, add its `id` to `disabledFeeds` in `config.json`.

---

## Data and privacy

All content stays in a local application-data folder:

| Where you run it | Data folder |
| --- | --- |
| Windows desktop app | `%APPDATA%\UPSC Daily Digest\data` |
| macOS desktop app | `~/Library/Application Support/UPSC Daily Digest/data` |
| Source checkout | `data/` |

The desktop app also keeps an editable `config.json` beside that folder
(`%APPDATA%\UPSC Daily Digest\config.json` or
`~/Library/Application Support/UPSC Daily Digest/config.json`).

```
data/
  digests/YYYY-MM-DD.json   one briefing per day
  index.json                archive index
  meta.json                 last run, errors, stats
  cache/articles.json       extracted article cache
  logs/                     run logs (desktop.log for the Electron shell)
  run.lock                  prevents overlapping runs
```

Nothing is sent anywhere except ordinary HTTPS requests to the news feeds and article pages, plus an update check when you explicitly choose **Check for Updates…**. There is no telemetry and no third-party script in the dashboard.

To reset, delete the `digests` folder and `index.json` inside the data folder. The next run rebuilds the archive. Uninstalling the desktop app leaves this data in place.

---

## Troubleshooting

**Windows says “Windows protected your PC”** — the first builds are unsigned. Choose **More info → Run anyway**. The app is installed per-user.

**macOS says the app is damaged or cannot be opened** — right-click the app and choose **Open**, or clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine "/Applications/UPSC Daily Digest.app"
```

**The desktop app opens but the dashboard is blank** — check `desktop.log` in the app's data folder (paths above). The local server usually failed to start or the configured port was taken; the app automatically falls back to a free port.

**`npm` is blocked in PowerShell** — use `cmd /c "npm install"` or run the `.cmd` launchers.

**Port 4178 is already in use** — the digest is probably already running. Open <http://127.0.0.1:4178>. Otherwise change `port` in `config.json`.

**The server starts but the dashboard is empty** — wait for the first research run, or click **Refresh**. Check `data/logs/` and `data/meta.json` for feed errors.

**A run looks stuck** — a lock expires after 25 minutes. You can delete `data/run.lock` if no run is active, then refresh.

**The scheduled task did not run** — open Task Scheduler, find `UPSC Digest Daily Research`, and check **Last Run Result**. The task only runs when you are logged in; missed runs are caught up at the next login.

**Fewer than 45 stories appear** — that is intentional. The digest only keeps items above the relevance floor and within the per-theme and per-topic caps.

---

## Project layout

```
server.js                 CLI entry point for the local HTTP server
config.json               default runtime settings
electron/
  main.js                 desktop shell: window, data paths, lifecycle
  menu.js                 native application menu
  updater.js              GitHub Releases update check
src/
  app-server.js           reusable HTTP server and JSON API
  sources.js              trusted feed registry
  rss.js                  RSS/Atom parser
  analyzer.js             filtering, classification, clustering, verification, MCQ
  themes.js               GS syllabus taxonomy and signals
  enrich.js               article-page extraction
  pipeline.js             fetch → analyse → cluster → enrich → select → save
  scheduler.js            daily and stale-on-open logic
  store.js                local JSON persistence, locking and env-configurable paths
public/
  index.html              dashboard shell
  app.js                  routing, rendering, search, bookmarks, MCQ
  styles.css              editorial theme, dark mode, print, responsive layout
  theme.js                pre-paint theme selection
build/
  icon.png                shared app icon
  icon.icns               macOS icon
  icon.ico                Windows icon
scripts/
  daily-run.js            headless research run
  launch.js               start server and open browser
  make-icons.js           regenerate icons from public/favicon.svg (macOS)
  setup-schedule.ps1      register the Windows scheduled task
  selftest.js             parser and classifier self-tests
.github/workflows/
  release.yml             build and publish installers on version tags
```

---

## Building installers

```bash
npm install
npm run selftest
npm run dist:mac     # universal DMG + ZIP (run this on macOS)
npm run dist:win     # per-user x64 NSIS installer
```

Installers are written to `release/`. The build is intentionally unsigned for now. On macOS, `npm run icons` regenerates `build/icon.icns`, `build/icon.ico` and `build/icon.png` from `public/favicon.svg` (requires macOS `sips`/`iconutil`); the generated icons are already committed.

The GitHub Actions workflow at `.github/workflows/release.yml` builds both platforms and publishes the installers to a GitHub Release. Push a version tag to trigger it:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag version is copied into `package.json` before building, so the app version and release version match.

The update checker and the release publisher point at `Harshdeepgupta2005/upsc-daily-digest`. If the repository has a different owner or name, change `REPO_OWNER`/`REPO_NAME` in `electron/updater.js` and `build.publish` in `package.json`.

For a later signed release, add the Windows code-signing certificate and Apple Developer ID credentials as CI secrets and enable signing/notarization. The app already stores user data in the OS application-data folder and marks NSIS `deleteAppDataOnUninstall: false`, so data survives updates.

---

## Self-test

```bat
npm run selftest
```

The suite covers URL canonicalisation, HTML entity decoding, text cleaning, sentence splitting, hook extraction, tokenisation, theme detection and RSS/Atom parsing.

---

## Scope and limitations

- Designed for **one reader on one computer**, not multi-user hosting. The server binds only to `127.0.0.1`.
- Research quality depends on the configured feeds. If a feed changes its URL or starts blocking requests, that source will show an error in **Sources**.
- Paywalled article pages may yield only the RSS summary; the card still links to the source.
- The MCQ is a **syllabus-classification question** generated from the item's theme. It is a recall prompt, not a substitute for the actual exam's factual MCQs.
- Coverage labels reflect independent outlets in the current cluster, not an exhaustive audit of every claim.
