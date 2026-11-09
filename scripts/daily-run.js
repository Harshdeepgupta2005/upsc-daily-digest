import { loadConfig } from "../src/config.js";
import { runAndLog } from "../src/pipeline.js";
import { appendLog } from "../src/store.js";

const config = await loadConfig();
console.log(`[${new Date().toISOString()}] Starting headless research run…`);
try {
  const digest = await runAndLog(config);
  if (digest?.skipped) {
    console.log(`Skipped: ${digest.reason}`);
    process.exit(0);
  }
  console.log(
    `Done: ${digest.items.length} stories · ${digest.stats.sourcesUsed} sources · ` +
      `${digest.stats.feedsFailed} feed errors · ${(digest.stats.durationMs / 1000).toFixed(1)}s`
  );
  process.exit(0);
} catch (err) {
  console.error(`Research failed: ${err.message}`);
  await appendLog(`Scheduler run failed: ${err.stack || err.message}`).catch(() => {});
  process.exit(1);
}
