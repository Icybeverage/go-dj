import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const enqueue = mutation({
  args: {
    command: v.string(),
    argsJson: v.optional(v.string()),
    protocol: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    source: v.optional(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mixxxCommands", {
      command: args.command,
      argsJson: args.argsJson ?? "{}",
      protocol: args.protocol,
      sessionKey: args.sessionKey,
      source: args.source ?? "legacy",
      requestId: args.requestId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    });
  },
});

export const pending = query({
  args: { sessionKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.sessionKey) {
      return await ctx.db
        .query("mixxxCommands")
        .withIndex("by_session_status", (q) =>
          q.eq("sessionKey", args.sessionKey).eq("status", "pending"),
        )
        .order("asc")
        .take(50);
    }
    return await ctx.db
      .query("mixxxCommands")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50);
  },
});

export const claim = mutation({
  args: { id: v.id("mixxxCommands") },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.id);
    if (!command || command.status !== "pending") return false;
    await ctx.db.patch(args.id, {
      status: "sent",
      claimedAt: Date.now(),
      updatedAt: Date.now(),
      attempts: (command.attempts ?? 0) + 1,
    });
    return true;
  },
});

export const release = mutation({
  args: { id: v.id("mixxxCommands") },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.id);
    if (!command || command.status !== "sent") return false;
    await ctx.db.patch(args.id, { status: "pending", updatedAt: Date.now() });
    return true;
  },
});

export const acknowledge = mutation({
  args: {
    id: v.id("mixxxCommands"),
    status: v.union(v.literal("sent"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
  },
});
