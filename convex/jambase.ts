import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";

const FESTIVAL = "outside-lands-2026";
const FESTIVAL_SOURCE_URL =
  "https://www.jambase.com/festival/outside-lands-2026";
const DEFAULT_EDGE_URL =
  "https://zcahokqhmmsjpcfrxfly.supabase.co/functions/v1/jambase-outside-lands";

function dayLabel(date: string | undefined) {
  if (!date) return "Outside Lands 2026";
  const value = new Date(`${date}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(value);
  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
  return `${weekday} · ${monthDay}`;
}

export const refreshOutsideLands = internalAction({
  args: {},
  handler: async (ctx) => {
    const edgeUrl = process.env.JAMBASE_EDGE_URL || DEFAULT_EDGE_URL;
    const response = await fetch(
      `${edgeUrl}?name=Outside%20Lands&eventDateFrom=2026-08-07&eventDateTo=2026-08-09&perPage=100`,
    );
    if (!response.ok) {
      throw new Error(`JamBase Edge Function returned ${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.artists) || payload.artists.length === 0) {
      throw new Error("JamBase returned no Outside Lands artists");
    }

    const artists = payload.artists.map((item: any, index: number) => ({
      artist: item.artist,
      day: dayLabel(item.performanceDate),
      sortOrder:
        (item.performanceDate ? Number(item.performanceDate.slice(-2)) : 0) *
          1000 +
        (item.performanceRank || index),
      jamBaseId: item.identifier,
      artistUrl: item.artistUrl,
      genres: item.genres || [],
      headliner: item.headliner,
    }));

    return await ctx.runMutation(api.festivals.upsertCatalog, {
      festival: FESTIVAL,
      source: payload.source || "JamBase Data API v3",
      sourceUrl: FESTIVAL_SOURCE_URL,
      payloadJson: JSON.stringify(payload),
      artists,
    });
  },
});
