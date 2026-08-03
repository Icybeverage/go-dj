import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveAnalysis = mutation({
  args: { trackId: v.id("tracks"), model: v.string(), labelsJson: v.string() },
  handler: async (ctx, args) => await ctx.db.insert("mediaAnalyses", { ...args, analyzedAt: Date.now() }),
});

export const getAnalysis = query({
  args: { trackId: v.id("tracks") },
  handler: async (ctx, args) => await ctx.db.query("mediaAnalyses").withIndex("by_track", (q) => q.eq("trackId", args.trackId)).order("desc").first(),
});
