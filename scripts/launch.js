import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { ROOT } from "../src/store.js";

const config = await loadConfig();
const port = config.port;
const url = `http://127.0.0.1:${port}`;

function probe(port, timeout = 900) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function isOurApp() {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true && data?.app === "upsc-daily-digest";
  } catch {
    return false;
  }
}

function openBrowser(target) {
  if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", target], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } else if (process.platform === "darwin") {
    spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
  }
}

const alreadyUp = await probe(port);
if (alreadyUp) {
  if (await isOurApp()) {
    console.log(`Digest already running at ${url}`);
    openBrowser(url);
    process.exit(0);
  }
  console.error(`Port ${port} is taken by another program. Change "port" in config.json and try again.`);
  process.exit(1);
}

console.log("Starting the digest server…");
const child = spawn(process.execPath, [path.join(ROOT, "server.js")], {
  cwd: ROOT,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();

let ready = false;
const deadline = Date.now() + 20000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 400));
  if (await probe(port)) {
    ready = true;
    break;
  }
}

if (!ready) {
  console.error("The server did not start within 20 seconds. Run 'node server.js' to see the error.");
  process.exit(1);
}

console.log(`Dashboard ready: ${url}`);
openBrowser(url);
process.exit(0);
