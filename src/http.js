const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 UPSCDigest/1.0";

export async function fetchText(url, { timeout = 15000, retries = 1, headers = {} } = {}) {
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "en-IN,en;q=0.9",
          ...headers,
        },
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if (res.status === 429 || res.status >= 500) {
          await sleep(600 + attempt * 900);
          continue;
        }
        return { ok: false, status: res.status, text: "", error: lastError };
      }
      const text = await res.text();
      return { ok: true, status: res.status, text, error: "" };
    } catch (err) {
      lastError = err.name === "AbortError" ? `Timed out after ${timeout}ms` : err.message;
      if (attempt < retries) await sleep(500 + attempt * 700);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, text: "", error: lastError };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mapLimit(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let index = 0;
  let completed = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      try {
        results[current] = await worker(items[current], current);
      } catch (err) {
        results[current] = { error: err.message };
      }
      completed++;
      onProgress?.(completed, items.length, items[current]);
    }
  });
  await Promise.all(runners);
  return results;
}
