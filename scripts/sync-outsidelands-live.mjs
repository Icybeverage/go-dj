import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;

const FESTIVAL = "outside-lands-2026";
const FESTIVAL_SOURCE_URL =
  "https://www.jambase.com/festival/outside-lands-2026";
const EDGE_URL =
  process.env.JAMBASE_EDGE_URL ||
  "https://zcahokqhmmsjpcfrxfly.supabase.co/functions/v1/jambase-outside-lands";

function readConvexUrl() {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL;
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  return text.match(/^CONVEX_URL=(.*)$/m)?.[1]?.trim();
}

function labelDay(date) {
  if (!date) return "Outside Lands 2026";
  const value = new Date(`${date}T12:00:00Z`);
  return `${new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(value)} · ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value)}`;
}

const convexUrl = readConvexUrl();
if (!convexUrl) throw new Error("CONVEX_URL is not configured");

const response = await fetch(
  `${EDGE_URL}?name=Outside%20Lands&eventDateFrom=2026-08-07&eventDateTo=2026-08-09&perPage=100`,
);
if (!response.ok) throw new Error(`JamBase Edge Function returned ${response.status}`);
const payload = await response.json();
if (!Array.isArray(payload.artists) || payload.artists.length === 0) {
  throw new Error("JamBase Edge Function returned no artists");
}

const artists = payload.artists.map((item, index) => ({
  artist: item.artist,
  day: labelDay(item.performanceDate),
  sortOrder:
    (item.performanceDate ? Number(item.performanceDate.slice(-2)) : 0) * 1000 +
    (item.performanceRank || index),
  jamBaseId: item.identifier,
  artistUrl: item.artistUrl,
  genres: item.genres || [],
  headliner: item.headliner,
}));

const client = new ConvexHttpClient(convexUrl);
const result = await client.mutation(api.festivals.upsertCatalog, {
  festival: FESTIVAL,
  source: payload.source || "JamBase Data API v3",
  sourceUrl: FESTIVAL_SOURCE_URL,
  artists,
});

console.log(
  JSON.stringify(
    {
      source: payload.source,
      festival: FESTIVAL,
      artistCount: result.count,
      syncedAt: new Date(result.syncedAt).toISOString(),
    },
    null,
    2,
  ),
);
