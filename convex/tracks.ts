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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const registerUpload = mutation({
  args: {
    sessionKey: v.string(),
    storageId: v.id("_storage"),
    title: v.string(),
    artist: v.string(),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    bpm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tracks", {
      title: args.title,
      artist: args.artist,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      sessionKey: args.sessionKey,
      source: "user-upload",
      bpm: args.bpm,
      genres: [],
      moods: [],
      createdAt: Date.now(),
    });
  },
});

export const removeUpload = mutation({
  args: {
    trackId: v.id("tracks"),
    sessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId);
    if (!track || track.sessionKey !== args.sessionKey || !track.storageId) {
      throw new Error("Upload not found for this session");
    }
    await ctx.storage.delete(track.storageId);
    await ctx.db.delete(args.trackId);
    return true;
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
    sessionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const text = args.text?.trim().toLowerCase();
    const requestedLimit = args.limit ?? 100;
    const limit = Math.max(1, Math.min(200, Math.floor(requestedLimit)));
    const tracks = await ctx.db.query("tracks").order("desc").take(200);
    const visibleTracks = tracks.filter((track) => {
      const matchesSession = !track.sessionKey || track.sessionKey === args.sessionKey;
      const matchesText = !text || `${track.title} ${track.artist}`.toLowerCase().includes(text);
      const matchesGenre = !args.genre || track.genres.some((item) => item.toLowerCase() === args.genre?.toLowerCase());
      const matchesMood = !args.mood || track.moods.some((item) => item.toLowerCase() === args.mood?.toLowerCase());
      const matchesMinBpm = args.minBpm === undefined || (track.bpm ?? -Infinity) >= args.minBpm;
      const matchesMaxBpm = args.maxBpm === undefined || (track.bpm ?? Infinity) <= args.maxBpm;
      const matchesEnergy = args.minEnergy === undefined || (track.energy ?? -Infinity) >= args.minEnergy;
      const matchesVocals = args.vocals === undefined || track.vocals === args.vocals;
      return matchesSession && matchesText && matchesGenre && matchesMood && matchesMinBpm && matchesMaxBpm && matchesEnergy && matchesVocals;
    }).slice(0, limit);
    return await Promise.all(
      visibleTracks.map(async (track) => ({
        ...track,
        storageUrl: track.storageId ? await ctx.storage.getUrl(track.storageId) : null,
      })),
    );
  },
});
