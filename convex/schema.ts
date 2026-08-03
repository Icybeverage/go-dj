import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tracks: defineTable({
    title: v.string(),
    artist: v.string(),
    filePath: v.optional(v.string()),
    source: v.string(),
    bpm: v.optional(v.number()),
    musicalKey: v.optional(v.string()),
    genres: v.array(v.string()),
    moods: v.array(v.string()),
    energy: v.optional(v.number()),
    vocals: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_artist", ["artist"]),

  mediaAnalyses: defineTable({
    trackId: v.id("tracks"),
    model: v.string(),
    labelsJson: v.string(),
    analyzedAt: v.number(),
  }).index("by_track", ["trackId"]),

  mixxxCommands: defineTable({
    command: v.string(),
    argsJson: v.string(),
    protocol: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("done")),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  festivalSnapshots: defineTable({
    festival: v.string(),
    source: v.string(),
    payloadJson: v.string(),
    createdAt: v.number(),
  }).index("by_festival", ["festival"]),

  festivalArtists: defineTable({
    festival: v.string(),
    artist: v.string(),
    day: v.string(),
    sortOrder: v.number(),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    jamBaseId: v.optional(v.string()),
    artistUrl: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    headliner: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_festival", ["festival"])
    .index("by_festival_artist", ["festival", "artist"]),
});
