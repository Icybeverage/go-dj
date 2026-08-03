import { ConvexHttpClient } from "convex/browser";
import { api } from "../src/convexApi.js";

const POLL_INTERVAL_MS = 250;
const once = process.argv.includes("--once");
const convexUrl = process.env.GODJ_CONVEX_URL;
const adapterUrl = process.env.GODJ_ADAPTER_URL;
const sessionKey = process.env.GODJ_SESSION_KEY;

if (!convexUrl || !adapterUrl) {
  throw new Error(
    "Set GODJ_CONVEX_URL and GODJ_ADAPTER_URL before starting the Mixxx bridge.",
  );
}

const client = new ConvexHttpClient(convexUrl);

async function forwardPending() {
  const pending = await client.query(
    api.mixxx.pending,
    sessionKey ? { sessionKey } : {},
  );
  for (const command of pending) {
    const claimed = await client.mutation(api.mixxx.claim, { id: command._id });
    if (!claimed) continue;

    try {
      const payload = JSON.parse(command.argsJson);
      const mixxx = payload.args?.mixxx || {};
      if (mixxx.action === "loadTrackByPath" || mixxx.control === "loadTrack") {
        console.warn(`Skipping web-only track load ${command._id}`);
        await client.mutation(api.mixxx.acknowledge, {
          id: command._id,
          status: "done",
        });
        continue;
      }
      const response = await fetch(adapterUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Adapter returned ${response.status}`);
      await client.mutation(api.mixxx.acknowledge, {
        id: command._id,
        status: "done",
      });
    } catch (error) {
      console.error(`Mixxx command ${command._id} failed:`, error.message);
      await client.mutation(api.mixxx.release, {
        id: command._id,
      });
    }
  }
}

async function main() {
  do {
    await forwardPending();
    if (!once)
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  } while (!once);
  await client.close();
}

await main();
