import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const enqueue = mutation({
  args: {
    command: v.string(),
    argsJson: v.optional(v.string()),
    protocol: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("mixxxCommands", {
      command: args.command,
      argsJson: args.argsJson ?? "{}",
      protocol: args.protocol,
      status: "pending",
      createdAt: Date.now(),
    }),
});

export const pending = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("mixxxCommands")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50),
});

export const claim = mutation({
  args: { id: v.id("mixxxCommands") },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.id);
    if (!command || command.status !== "pending") return false;
    await ctx.db.patch(args.id, { status: "sent" });
    return true;
  },
});

export const release = mutation({
  args: { id: v.id("mixxxCommands") },
  handler: async (ctx, args) => {
    const command = await ctx.db.get(args.id);
    if (!command || command.status !== "sent") return false;
    await ctx.db.patch(args.id, { status: "pending" });
    return true;
  },
});

export const acknowledge = mutation({
  args: {
    id: v.id("mixxxCommands"),
    status: v.union(v.literal("sent"), v.literal("done")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});
