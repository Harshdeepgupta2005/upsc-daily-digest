// Regenerate the macOS .icns, Windows .ico and shared PNG icon from the
// dashboard favicon. Run with `npm run icons` on macOS (uses sips + iconutil).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "public", "favicon.svg");
const buildDir = path.join(root, "build");
const iconsetDir = path.join(buildDir, "icon.iconset");
const masterPng = path.join(buildDir, "icon.png");

const ICONSET = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

function resize(input, output, size) {
  execFileSync("sips", [
    "-s", "format", "png",
    "--resampleHeightWidth", String(size), String(size),
    input,
    "--out", output,
  ], { stdio: "ignore" });
}

function buildIco(pngFiles) {
  const entries = pngFiles.map(({ file, size }) => ({
    size,
    data: fs.readFileSync(file),
  }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(entries.length * 16);
  let offset = header.length + directory.length;
  entries.forEach((entry, index) => {
    const base = index * 16;
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, base);
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, base + 1);
    directory.writeUInt8(0, base + 2);
    directory.writeUInt8(0, base + 3);
    directory.writeUInt16LE(1, base + 4);
    directory.writeUInt16LE(32, base + 6);
    directory.writeUInt32LE(entry.data.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += entry.data.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.data)]);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("Icon generation uses macOS sips/iconutil. Run it on macOS, or commit the generated files in build/.");
  }
  await fsp.mkdir(buildDir, { recursive: true });
  await fsp.rm(iconsetDir, { recursive: true, force: true });
  await fsp.mkdir(iconsetDir, { recursive: true });

  // Rasterise the SVG once at high resolution, then downscale from that.
  resize(source, masterPng, 1024);

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoFiles = [];
  for (const [name, size] of ICONSET) {
    const target = path.join(iconsetDir, name);
    resize(masterPng, target, size);
  }
  for (const size of icoSizes) {
    const target = path.join(buildDir, `icon-${size}.png`);
    resize(masterPng, target, size);
    icoFiles.push({ file: target, size });
  }

  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", path.join(buildDir, "icon.icns")], {
    stdio: "inherit",
  });

  await fsp.writeFile(path.join(buildDir, "icon.ico"), buildIco(icoFiles));
  await fsp.rm(iconsetDir, { recursive: true, force: true });
  await Promise.all(icoFiles.map(({ file }) => fsp.rm(file, { force: true })));

  console.log("Wrote build/icon.png, build/icon.icns and build/icon.ico");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
