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
    sessionKey: v.optional(v.string()),
    source: v.optional(v.string()),
    requestId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("done")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    claimedAt: v.optional(v.number()),
    attempts: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_session_status", ["sessionKey", "status"]),

  djSessions: defineTable({
    sessionKey: v.string(),
    displayName: v.string(),
    status: v.union(v.literal("ready"), v.literal("live")),
    crossfader: v.number(),
    master: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastCommandAt: v.optional(v.number()),
  }).index("by_key", ["sessionKey"]),

  djDecks: defineTable({
    sessionId: v.id("djSessions"),
    deck: v.number(),
    trackId: v.optional(v.id("tracks")),
    title: v.optional(v.string()),
    artist: v.optional(v.string()),
    filePath: v.optional(v.string()),
    bpm: v.optional(v.number()),
    targetBpm: v.optional(v.number()),
    playing: v.boolean(),
    cue: v.boolean(),
    syncEnabled: v.boolean(),
    pitch: v.number(),
    filter: v.number(),
    filterMode: v.union(v.literal("lowpass"), v.literal("highpass")),
    effectMix: v.number(),
    channelVolume: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_deck", ["sessionId", "deck"]),

  gestureEvents: defineTable({
    sessionId: v.id("djSessions"),
    hand: v.union(v.literal("left"), v.literal("right"), v.literal("both"), v.literal("head")),
    gesture: v.string(),
    value: v.optional(v.number()),
    confidence: v.optional(v.number()),
    payloadJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  catalogs: defineTable({
    key: v.string(),
    title: v.string(),
    kind: v.string(),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  catalogItems: defineTable({
    catalogKey: v.string(),
    kind: v.string(),
    title: v.optional(v.string()),
    artist: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_catalog", ["catalogKey"])
    .index("by_catalog_order", ["catalogKey", "sortOrder"]),

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
