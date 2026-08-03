import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const artistInput = v.object({
  artist: v.string(),
  day: v.string(),
  sortOrder: v.number(),
  jamBaseId: v.optional(v.string()),
  artistUrl: v.optional(v.string()),
  genres: v.optional(v.array(v.string())),
  headliner: v.optional(v.boolean()),
});

export const saveSnapshot = mutation({
  args: { festival: v.string(), source: v.string(), payloadJson: v.string() },
  handler: async (ctx, args) => await ctx.db.insert("festivalSnapshots", { ...args, createdAt: Date.now() }),
});

export const latest = query({
  args: { festival: v.string() },
  handler: async (ctx, args) => await ctx.db.query("festivalSnapshots").withIndex("by_festival", (q) => q.eq("festival", args.festival)).order("desc").first(),
});

export const upsertCatalog = mutation({
  args: {
    festival: v.string(),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    payloadJson: v.optional(v.string()),
    artists: v.array(artistInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incomingArtists = new Set(args.artists.map((artist) => artist.artist));
    const existingCatalog = await ctx.db
      .query("festivalArtists")
      .withIndex("by_festival", (q) => q.eq("festival", args.festival))
      .take(200);
    let removed = 0;

    for (const existing of existingCatalog) {
      if (!incomingArtists.has(existing.artist)) {
        await ctx.db.delete(existing._id);
        removed += 1;
      }
    }

    for (const artist of args.artists) {
      const existing = await ctx.db
        .query("festivalArtists")
        .withIndex("by_festival_artist", (q) =>
          q.eq("festival", args.festival).eq("artist", artist.artist),
        )
        .first();

      const values = {
        festival: args.festival,
        artist: artist.artist,
        day: artist.day,
        sortOrder: artist.sortOrder,
        source: args.source,
        sourceUrl: args.sourceUrl,
        jamBaseId: artist.jamBaseId,
        artistUrl: artist.artistUrl,
        genres: artist.genres ?? [],
        headliner: artist.headliner,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existing) await ctx.db.patch(existing._id, values);
      else await ctx.db.insert("festivalArtists", values);
    }

    await ctx.db.insert("festivalSnapshots", {
      festival: args.festival,
      source: args.source,
      payloadJson: args.payloadJson ?? JSON.stringify({
        sourceUrl: args.sourceUrl,
        artistCount: args.artists.length,
        artists: args.artists,
      }),
      createdAt: now,
    });

    return { count: args.artists.length, removed, syncedAt: now };
  },
});

export const listArtists = query({
  args: {
    festival: v.string(),
    day: v.optional(v.string()),
    text: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requestedLimit = args.limit ?? 150;
    const limit = Math.max(1, Math.min(200, Math.floor(requestedLimit)));
    const text = args.text?.trim().toLowerCase();
    const artists = await ctx.db
      .query("festivalArtists")
      .withIndex("by_festival", (q) => q.eq("festival", args.festival))
      .order("asc")
      .take(200);

    return artists
      .filter((item) => {
        const matchesDay = !args.day || item.day === args.day;
        const matchesText =
          !text || item.artist.toLowerCase().includes(text);
        return matchesDay && matchesText;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, limit);
  },
});
