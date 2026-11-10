import { app, BrowserWindow, dialog, shell } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMenu } from "./menu.js";
import { migrateConfig } from "./config-migrate.js";
import { checkForUpdates, RELEASES_URL } from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_NAME = "UPSC Daily Digest";
const APP_ID = "com.harshdeepgupta.upscdigest";

// Keep the same application-data folder in development and in the packaged
// app, so digests and settings survive reinstalls and updates.
app.setName(PRODUCT_NAME);
app.setPath("userData", path.join(app.getPath("appData"), PRODUCT_NAME));
if (process.platform === "win32") app.setAppUserModelId(APP_ID);

let mainWindow = null;
let serverApp = null;
let serverUrl = null;
let logger = console;

function logToFile(level, args) {
  const text = args
    .map((value) => {
      if (value instanceof Error) return value.stack || value.message;
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(" ");
  const line = `[${new Date().toISOString()}] [${level}] ${text}\n`;
  console[level === "error" ? "error" : "log"](text);
  try {
    const logDir = path.join(app.getPath("userData"), "data", "logs");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "desktop.log"), line, "utf8");
  } catch {
    // Logging must never crash the app.
  }
}

function makeLogger() {
  return {
    log: (...args) => logToFile("info", args),
    warn: (...args) => logToFile("warn", args),
    error: (...args) => logToFile("error", args),
  };
}

// Settings written by older versions keep working, but retired tuning keys must
// be dropped and superseded defaults refreshed, otherwise an upgraded install
// silently keeps the old behaviour (for example the v1.0.0 relevance floor).
async function ensureUserConfig() {
  const userConfig = path.join(app.getPath("userData"), "config.json");
  const bundled = path.join(app.getAppPath(), "config.json");
  const template = JSON.parse(await fsp.readFile(bundled, "utf8"));

  let current = null;
  try {
    current = JSON.parse(await fsp.readFile(userConfig, "utf8"));
  } catch {
    current = null;
  }

  if (!current) {
    await fsp.mkdir(path.dirname(userConfig), { recursive: true });
    await fsp.copyFile(bundled, userConfig);
    return userConfig;
  }

  const { config, changed } = migrateConfig(current, template);
  if (changed) {
    await fsp.mkdir(path.dirname(userConfig), { recursive: true });
    await fsp.writeFile(userConfig, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
  return userConfig;
}

function iconPath() {
  const candidate = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "build", "icon.png");
  return fs.existsSync(candidate) ? candidate : undefined;
}

function openDataFolder() {
  const target = serverApp?.dataDir || path.join(app.getPath("userData"), "data");
  shell.openPath(target).then((error) => {
    if (error) logger.warn("[app] Could not open data folder:", error);
  });
}

function showAbout() {
  if (process.platform === "darwin") {
    app.showAboutPanel();
    return;
  }
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: `About ${PRODUCT_NAME}`,
    message: `${PRODUCT_NAME} ${app.getVersion()}`,
    detail:
      "A local-first UPSC current-affairs research desk.\n\n" +
      "Digests, settings and logs stay on this computer. No account and no telemetry.",
    buttons: ["OK"],
  });
}

function refreshResearch() {
  if (!serverApp) return;
  const started = serverApp.startRun("Manual refresh from app menu");
  if (!started) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Research already running",
      message: "A research run is already in progress. The dashboard will update when it finishes.",
      buttons: ["OK"],
    });
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
}

function installMenu() {
  buildMenu({
    onRefresh: refreshResearch,
    onOpenDashboard: () => serverUrl && shell.openExternal(serverUrl),
    onOpenDataFolder: openDataFolder,
    onOpenReleases: () => shell.openExternal(RELEASES_URL),
    onCheckUpdates: () => checkForUpdates({ interactive: true, parent: mainWindow }),
    onExport: () => serverUrl && shell.openExternal(`${serverUrl}/api/export`),
    onAbout: showAbout,
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 920,
    minHeight: 620,
    show: false,
    backgroundColor: "#171a17",
    title: PRODUCT_NAME,
    icon: iconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (serverUrl && url.startsWith(serverUrl)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    logger.error(`[app] Dashboard failed to load (${code}): ${description}`);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(serverUrl).catch((err) => {
    logger.error("[app] loadURL failed:", err);
    dialog.showErrorBox(
      "Dashboard could not open",
      `The local dashboard did not load.\n\n${err.message}\n\nSee the desktop.log file in the app data folder.`
    );
  });
}

async function start() {
  logger = makeLogger();

  const userConfig = await ensureUserConfig();
  process.env.UPSC_CONFIG = userConfig;
  process.env.UPSC_DATA_DIR = path.join(app.getPath("userData"), "data");
  process.env.UPSC_APP_VERSION = app.getVersion();

  // Import after the environment variables above so store/config resolve to
  // the OS application-data folder instead of the read-only app bundle.
  const [{ loadConfig }, { createAppServer }] = await Promise.all([
    import("../src/config.js"),
    import("../src/app-server.js"),
  ]);

  const config = await loadConfig();
  serverApp = createAppServer({
    config,
    appVersion: app.getVersion(),
    logger,
  });

  let port;
  try {
    port = await serverApp.start({ port: config.port, fallbackToRandom: true });
  } catch (err) {
    logger.error("[app] Server failed to start:", err);
    dialog.showErrorBox(
      "UPSC Daily Digest could not start",
      `The local research server failed to start.\n\n${err.message}\n\n` +
        `Check the desktop.log file in:\n${app.getPath("userData")}`
    );
    app.quit();
    return;
  }

  serverUrl = `http://127.0.0.1:${port}`;
  logger.log(`[app] ${PRODUCT_NAME} ${app.getVersion()} serving ${serverUrl}`);
  logger.log(`[app] Data folder: ${serverApp.dataDir}`);

  app.setAboutPanelOptions({
    applicationName: PRODUCT_NAME,
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: "Local-first UPSC current-affairs research desk",
    credits: "All digests and settings stay on this computer.",
  });

  installMenu();
  createWindow();
  serverApp.scheduleStartupResearch();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverUrl) createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    serverApp?.close().catch(() => {});
  });

  app.whenReady()
    .then(async () => {
      await start();
    })
    .catch((err) => {
      logger.error("[app] Startup failed:", err);
      dialog.showErrorBox(
        "UPSC Daily Digest could not start",
        `${err.message}\n\nCheck the desktop.log file in:\n${app.getPath("userData")}`
      );
      app.quit();
    });
}
