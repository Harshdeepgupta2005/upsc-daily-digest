import { loadConfig } from "./src/config.js";
import { createAppServer } from "./src/app-server.js";

const config = await loadConfig();
const app = createAppServer({ config });

let port;
try {
  port = await app.start({ port: config.port, fallbackToRandom: false });
} catch (err) {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${config.port} is already in use — the digest is probably already running.`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
}

console.log("");
console.log("  UPSC DAILY DIGEST");
console.log(`  Dashboard : http://127.0.0.1:${port}`);
console.log(`  Data      : ${app.dataDir}`);
console.log(`  Schedule  : daily at ${config.runAt} (${config.timezone})`);
console.log("");

app.scheduleStartupResearch();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nShutting down (${signal})…`);
  await app.close().catch(() => {});
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}
