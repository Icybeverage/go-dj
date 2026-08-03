import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    title: v.string(),
    artist: v.string(),
    filePath: v.optional(v.string()),
    source: v.string(),
    bpm: v.optional(v.number()),
    musicalKey: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    moods: v.optional(v.array(v.string())),
    energy: v.optional(v.number()),
    vocals: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_artist", (q) => q.eq("artist", args.artist))
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();
    const values = {
      title: args.title,
      artist: args.artist,
      filePath: args.filePath,
      source: args.source,
      bpm: args.bpm,
      musicalKey: args.musicalKey,
      genres: args.genres ?? [],
      moods: args.moods ?? [],
      energy: args.energy,
      vocals: args.vocals,
      createdAt: existing?.createdAt ?? now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert("tracks", values);
  },
});

export const search = query({
  args: {
    text: v.optional(v.string()),
    genre: v.optional(v.string()),
    mood: v.optional(v.string()),
    minBpm: v.optional(v.number()),
    maxBpm: v.optional(v.number()),
    minEnergy: v.optional(v.number()),
    vocals: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const text = args.text?.trim().toLowerCase();
    const requestedLimit = args.limit ?? 100;
    const limit = Math.max(1, Math.min(200, Math.floor(requestedLimit)));
    const tracks = await ctx.db.query("tracks").order("desc").take(200);
    return tracks.filter((track) => {
      const matchesText = !text || `${track.title} ${track.artist}`.toLowerCase().includes(text);
      const matchesGenre = !args.genre || track.genres.some((item) => item.toLowerCase() === args.genre?.toLowerCase());
      const matchesMood = !args.mood || track.moods.some((item) => item.toLowerCase() === args.mood?.toLowerCase());
      const matchesMinBpm = args.minBpm === undefined || (track.bpm ?? -Infinity) >= args.minBpm;
      const matchesMaxBpm = args.maxBpm === undefined || (track.bpm ?? Infinity) <= args.maxBpm;
      const matchesEnergy = args.minEnergy === undefined || (track.energy ?? -Infinity) >= args.minEnergy;
      const matchesVocals = args.vocals === undefined || track.vocals === args.vocals;
      return matchesText && matchesGenre && matchesMood && matchesMinBpm && matchesMaxBpm && matchesEnergy && matchesVocals;
    }).slice(0, limit);
  },
});
