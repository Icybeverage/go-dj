import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const itemInput = v.object({
  kind: v.string(),
  title: v.optional(v.string()),
  artist: v.optional(v.string()),
  subtitle: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  metadataJson: v.optional(v.string()),
  sortOrder: v.number(),
});

export const upsert = mutation({
  args: {
    key: v.string(),
    title: v.string(),
    kind: v.string(),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    items: v.array(itemInput),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingCatalog = await ctx.db
      .query("catalogs")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    const catalog = {
      key: args.key,
      title: args.title,
      kind: args.kind,
      source: args.source,
      sourceUrl: args.sourceUrl,
      createdAt: existingCatalog?.createdAt ?? now,
      updatedAt: now,
    };
    if (existingCatalog) await ctx.db.patch(existingCatalog._id, catalog);
    else await ctx.db.insert("catalogs", catalog);

    const previous = await ctx.db
      .query("catalogItems")
      .withIndex("by_catalog", (q) => q.eq("catalogKey", args.key))
      .take(500);
    for (const item of previous) await ctx.db.delete(item._id);
    for (const item of args.items) {
      await ctx.db.insert("catalogItems", {
        catalogKey: args.key,
        ...item,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { key: args.key, count: args.items.length, syncedAt: now };
  },
});

export const list = query({
  args: {
    key: v.string(),
    text: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const catalog = await ctx.db
      .query("catalogs")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    const text = args.text?.trim().toLowerCase();
    const limit = Math.max(1, Math.min(500, Math.floor(args.limit ?? 200)));
    const items = await ctx.db
      .query("catalogItems")
      .withIndex("by_catalog_order", (q) => q.eq("catalogKey", args.key))
      .order("asc")
      .take(500);
    return {
      catalog,
      items: items
        .filter((item) => {
          if (!text) return true;
          return `${item.title ?? ""} ${item.artist ?? ""} ${item.subtitle ?? ""}`
            .toLowerCase()
            .includes(text);
        })
        .slice(0, limit),
    };
  },
});

export const listCatalogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 20)));
    return await ctx.db.query("catalogs").order("desc").take(limit);
  },
});
