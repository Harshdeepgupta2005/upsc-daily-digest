import { app, dialog, net, shell } from "electron";

// Change these two values if the repository is renamed or moved.
const REPO_OWNER = "Harshdeepgupta2005";
const REPO_NAME = "upsc-daily-digest";
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const LATEST_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

function versionParts(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

function pickAsset(assets = []) {
  const platform = process.platform;
  const arch = process.arch;
  const matchesArch = (name) => name.toLowerCase().includes(arch);
  const sortByPreference = (list) => {
    const preferred = list.find((a) => a.name.toLowerCase().includes("universal")) ||
      list.find((a) => matchesArch(a.name));
    return preferred || list[0] || null;
  };

  if (platform === "darwin") {
    const dmg = assets.filter((a) => /\.dmg$/i.test(a.name));
    const zip = assets.filter((a) => /\.zip$/i.test(a.name));
    return sortByPreference(dmg) || sortByPreference(zip);
  }
  if (platform === "win32") {
    const exe = assets.filter((a) => /\.exe$/i.test(a.name));
    return sortByPreference(exe);
  }
  const appImage = assets.filter((a) => /\.appimage$/i.test(a.name));
  return sortByPreference(appImage);
}

async function fetchLatestRelease() {
  const res = await net.fetch(LATEST_API, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": `UPSC-Daily-Digest/${app.getVersion()}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub replied with ${res.status}`);
  return res.json();
}

/**
 * Check GitHub Releases for a newer version. When `interactive` is true the
 * user sees a dialog (up to date, unavailable, or update found). When false
 * the check is silent and returns the release info if an update exists.
 */
export async function checkForUpdates({ interactive = true, parent = null } = {}) {
  const current = app.getVersion();
  let release;
  try {
    release = await fetchLatestRelease();
  } catch (err) {
    if (interactive) {
      await dialog.showMessageBox(parent, {
        type: "error",
        title: "Update check failed",
        message: "Could not reach GitHub to check for updates.",
        detail: `${err.message}\n\nYou can check manually at ${RELEASES_URL}`,
        buttons: ["OK"],
      });
    }
    return null;
  }

  if (!release) {
    if (interactive) {
      await dialog.showMessageBox(parent, {
        type: "info",
        title: "No releases yet",
        message: "There are no published releases for this app yet.",
        detail: `Check ${RELEASES_URL} later.`,
        buttons: ["OK"],
      });
    }
    return null;
  }

  const latest = String(release.tag_name || release.name || "").replace(/^v/i, "");
  if (!latest || compareVersions(latest, current) <= 0) {
    if (interactive) {
      await dialog.showMessageBox(parent, {
        type: "info",
        title: "You're up to date",
        message: `UPSC Daily Digest ${current} is the latest version.`,
        buttons: ["OK"],
      });
    }
    return null;
  }

  if (!interactive) return { version: latest, release };

  const asset = pickAsset(release.assets);
  const downloadUrl = asset?.browser_download_url || release.html_url;
  const assetNote = asset
    ? `The installer for this computer (${asset.name}) will download in your browser. Close the app before installing the update.`
    : "Open the release page to download the installer for this computer.";

  const choice = await dialog.showMessageBox(parent, {
    type: "info",
    title: "Update available",
    message: `UPSC Daily Digest ${latest} is available.`,
    detail: `You are running ${current}.\n\n${assetNote}\n\nYour saved digests are kept across updates.`,
    buttons: ["Download update", "Later"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });

  if (choice.response === 0) {
    await shell.openExternal(downloadUrl);
  }
  return { version: latest, release, downloadUrl };
}

export { RELEASES_URL };
