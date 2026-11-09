import { Menu, app } from "electron";

export function buildMenu({
  onRefresh,
  onOpenDashboard,
  onOpenDataFolder,
  onOpenReleases,
  onCheckUpdates,
  onExport,
  onAbout,
} = {}) {
  const isMac = process.platform === "darwin";

  const helpSubmenu = [
    { label: "Check for Updates…", click: () => onCheckUpdates?.() },
    { label: "Release Notes", click: () => onOpenReleases?.() },
    { type: "separator" },
    { label: "Open Data Folder", click: () => onOpenDataFolder?.() },
  ];
  if (!isMac) {
    helpSubmenu.push({ type: "separator" });
    helpSubmenu.push({ label: "About UPSC Daily Digest", click: () => onAbout?.() });
  }

  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { label: "About UPSC Daily Digest", click: () => onAbout?.() },
            { label: "Check for Updates…", click: () => onCheckUpdates?.() },
            { type: "separator" },
            { label: "Open Data Folder", click: () => onOpenDataFolder?.() },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }]
      : []),
    {
      label: "File",
      submenu: [
        { label: "Refresh Research", accelerator: "CmdOrCtrl+Alt+R", click: () => onRefresh?.() },
        { label: "Export Today's Digest…", click: () => onExport?.() },
        { type: "separator" },
        { label: "Open Dashboard in Browser", click: () => onOpenDashboard?.() },
        { label: "Open Data Folder", click: () => onOpenDataFolder?.() },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { label: "Help", role: "help", submenu: helpSubmenu },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
