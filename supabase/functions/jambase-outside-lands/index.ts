const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300, s-maxage=900",
};

const JAMBASE_URL = "https://api.data.jambase.com/v3/events";
const DEFAULT_NAME = "Outside Lands";
const DEFAULT_DATE_FROM = "2026-08-07";
const DEFAULT_DATE_TO = "2026-08-09";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uniqueArtists(events: any[]) {
  const artists = new Map<
    string,
    {
      artist: string;
      identifier?: string;
      artistUrl?: string;
      performanceDate?: string;
      performanceRank?: number;
      headliner?: boolean;
      genres: string[];
    }
  >();

  function visit(value: any) {
    if (!value) return;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const name = item.name || item.artistName || item.title;
      if (typeof name === "string" && name.trim()) {
        const artist = name.trim();
        const key = artist.toLowerCase();
        const current = artists.get(key);
        artists.set(key, {
          artist,
          identifier:
            typeof item.identifier === "string" ? item.identifier : current?.identifier,
          artistUrl:
            typeof item.url === "string" ? item.url : current?.artistUrl,
          performanceDate:
            typeof item["x-performanceDate"] === "string"
              ? item["x-performanceDate"]
              : current?.performanceDate,
          performanceRank:
            Number.isFinite(Number(item["x-performanceRank"]))
              ? Number(item["x-performanceRank"])
              : current?.performanceRank,
          headliner:
            typeof item["x-isHeadliner"] === "boolean"
              ? item["x-isHeadliner"]
              : current?.headliner,
          genres: Array.isArray(item.genre)
            ? [...new Set(item.genre.filter((genre: unknown) => typeof genre === "string"))]
            : current?.genres || [],
        });
      }
      visit(item.performer);
      visit(item.performers);
      visit(item.artist);
      visit(item.artists);
      visit(item.subEvent);
      visit(item.subEvents);
    }
  }

  for (const event of events) visit(event?.performer || event?.artists || event);
  return [...artists.values()].sort((a, b) => {
    const date = (a.performanceDate || "").localeCompare(b.performanceDate || "");
    if (date) return date;
    return (a.performanceRank || 9999) - (b.performanceRank || 9999);
  });
}

function extractEvents(payload: any) {
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "GET only" }, 405);

  const apiKey = Deno.env.get("jambase") || Deno.env.get("JAMBASE_API_KEY");
  if (!apiKey) return json({ error: "JamBase secret is not configured" }, 503);

  const requestUrl = new URL(request.url);
  const name = requestUrl.searchParams.get("name") || DEFAULT_NAME;
  const eventDateFrom =
    requestUrl.searchParams.get("eventDateFrom") || DEFAULT_DATE_FROM;
  const eventDateTo =
    requestUrl.searchParams.get("eventDateTo") || DEFAULT_DATE_TO;
  const perPage = Math.min(
    100,
    Math.max(1, Number(requestUrl.searchParams.get("perPage") || 100)),
  );

  const params = new URLSearchParams({
    name,
    eventDateFrom,
    eventDateTo,
    page: "1",
    perPage: String(perPage),
  });

  const upstream = await fetch(`${JAMBASE_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "Go-DJ-JamBase-Sync/1.0",
    },
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return json(
      {
        error: "JamBase request failed",
        status: upstream.status,
        detail: payload?.detail || payload?.message || null,
      },
      502,
    );
  }

  const events = extractEvents(payload);
  return json({
    source: "JamBase Data API v3",
    sourceUrl: "https://www.jambase.com/festival/outside-lands-2026",
    queriedAt: new Date().toISOString(),
    query: { name, eventDateFrom, eventDateTo, perPage },
    pagination: payload?.pagination || null,
    artistCount: uniqueArtists(events).length,
    artists: uniqueArtists(events),
    events,
  });
});
