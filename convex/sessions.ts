import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_DECK = {
  playing: false,
  cue: false,
  syncEnabled: false,
  pitch: 50,
  filter: 18000,
  filterMode: "lowpass" as const,
  effectMix: 0,
  channelVolume: 80,
};

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: unknown, min: number, max: number) {
  return Math.max(min, Math.min(max, finiteNumber(value, min)));
}

function parseArgs(argsJson: string | undefined) {
  if (!argsJson) return {} as Record<string, any>;
  try {
    const value = JSON.parse(argsJson);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {} as Record<string, any>;
  }
}

function commandArgs(argsJson: string | undefined) {
  const envelope = parseArgs(argsJson);
  return envelope.args && typeof envelope.args === "object" && !Array.isArray(envelope.args)
    ? envelope.args
    : envelope;
}

function assertHandDeck(payload: Record<string, any>, deck: number) {
  if (payload.handSide !== "left" && payload.handSide !== "right") return;
  const expectedDeck = payload.handSide === "left" ? 1 : 2;
  if (deck !== expectedDeck)
    throw new Error(
      `${payload.handSide} hand cannot control Deck ${deck}; expected Deck ${expectedDeck}`,
    );
}

async function findSession(ctx: any, sessionKey: string) {
  return await ctx.db
    .query("djSessions")
    .withIndex("by_key", (q: any) => q.eq("sessionKey", sessionKey))
    .first();
}

async function ensureSession(ctx: any, sessionKey: string, displayName?: string) {
  const existing = await findSession(ctx, sessionKey);
  if (existing) return existing;

  const now = Date.now();
  const sessionId = await ctx.db.insert("djSessions", {
    sessionKey,
    displayName: displayName?.trim() || "Go DJ session",
    status: "ready",
    crossfader: 50,
    master: 80,
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([1, 2].map((deck) =>
    ctx.db.insert("djDecks", {
      sessionId,
      deck,
      ...DEFAULT_DECK,
      updatedAt: now,
    }),
  ));

  return await ctx.db.get(sessionId);
}

async function findDeck(ctx: any, sessionId: any, deck: number) {
  return await ctx.db
    .query("djDecks")
    .withIndex("by_session_deck", (q: any) =>
      q.eq("sessionId", sessionId).eq("deck", deck),
    )
    .first();
}

export const ensure = mutation({
  args: {
    sessionKey: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ensureSession(ctx, args.sessionKey, args.displayName);
    return { session, created: session?.createdAt === session?.updatedAt };
  },
});

export const state = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    const session = await findSession(ctx, args.sessionKey);
    if (!session) return null;
    const decks = await ctx.db
      .query("djDecks")
      .withIndex("by_session", (q: any) => q.eq("sessionId", session._id))
      .take(2);
    return {
      session,
      decks: decks.sort((a: any, b: any) => a.deck - b.deck),
    };
  },
});

export const dispatch = mutation({
  args: {
    sessionKey: v.string(),
    command: v.string(),
    argsJson: v.optional(v.string()),
    protocol: v.optional(v.string()),
    source: v.optional(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ensureSession(ctx, args.sessionKey);
    if (!session) throw new Error("Unable to create DJ session");

    const payload = commandArgs(args.argsJson);
    const deckNumber = Math.round(finiteNumber(payload.deck, 0));
    assertHandDeck(payload, deckNumber);
    const now = Date.now();

    if (args.requestId) {
      const prior = await ctx.db
        .query("mixxxCommands")
        .withIndex("by_status", (q: any) => q.eq("status", "pending"))
        .filter((q: any) => q.eq(q.field("requestId"), args.requestId))
        .first();
      if (prior) return prior._id;
    }

    if (args.command === "setCrossfader") {
      await ctx.db.patch(session._id, {
        crossfader: clamp(payload.value, 0, 100),
        updatedAt: now,
        lastCommandAt: now,
      });
    } else if (args.command === "setMasterVolume") {
      await ctx.db.patch(session._id, {
        master: clamp(payload.value, 0, 100),
        updatedAt: now,
        lastCommandAt: now,
      });
    } else if (deckNumber === 1 || deckNumber === 2) {
      const deck = await findDeck(ctx, session._id, deckNumber);
      if (deck) {
        const patch: Record<string, unknown> = { updatedAt: now };
        if (args.command === "play") patch.playing = Boolean(payload.playing);
        if (args.command === "cue") patch.cue = true;
        if (args.command === "setChannelVolume")
          patch.channelVolume = clamp(payload.value, 0, 100);
        if (args.command === "setFilter") {
          patch.filter = clamp(payload.frequency, 40, 18000);
          patch.filterMode = payload.type === "highpass" ? "highpass" : "lowpass";
        }
        if (args.command === "setPitch") patch.pitch = clamp(payload.percent, 0, 100);
        if (args.command === "setEffectMix")
          patch.effectMix = clamp(payload.value, 0, 1);
        if (args.command === "setSync") {
          patch.syncEnabled = Boolean(payload.enabled);
          patch.targetBpm = payload.targetBpm == null ? undefined : finiteNumber(payload.targetBpm, 0);
        }
        if (args.command === "loadTrack") {
          patch.title = typeof payload.title === "string" ? payload.title : undefined;
          patch.artist = typeof payload.artist === "string" ? payload.artist : undefined;
          patch.filePath = typeof payload.path === "string" ? payload.path : undefined;
          patch.bpm = payload.bpm == null ? undefined : finiteNumber(payload.bpm, 0);
          patch.playing = false;
          patch.cue = false;
        }
        await ctx.db.patch(deck._id, patch);
      }
    }

    return await ctx.db.insert("mixxxCommands", {
      command: args.command,
      argsJson: args.argsJson ?? "{}",
      protocol: args.protocol ?? "mixxx-command-v1",
      sessionKey: args.sessionKey,
      source: args.source ?? "web",
      requestId: args.requestId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    });
  },
});

export const recordGesture = mutation({
  args: {
    sessionKey: v.string(),
    hand: v.union(v.literal("left"), v.literal("right"), v.literal("both"), v.literal("head")),
    gesture: v.string(),
    value: v.optional(v.number()),
    confidence: v.optional(v.number()),
    payloadJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ensureSession(ctx, args.sessionKey);
    if (!session) throw new Error("Unable to create DJ session");
    return await ctx.db.insert("gestureEvents", {
      sessionId: session._id,
      hand: args.hand,
      gesture: args.gesture,
      value: args.value,
      confidence: args.confidence,
      payloadJson: args.payloadJson,
      createdAt: Date.now(),
    });
  },
});

export const recentGestures = query({
  args: { sessionKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const session = await findSession(ctx, args.sessionKey);
    if (!session) return [];
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 20)));
    return await ctx.db
      .query("gestureEvents")
      .withIndex("by_session", (q: any) => q.eq("sessionId", session._id))
      .order("desc")
      .take(limit);
  },
});
