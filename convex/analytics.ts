import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Analytics queries for production monitoring
export const getTimerGenerations = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("timerGenerations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(args.limit || 100);
    }

    let query = ctx.db.query("timerGenerations").order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }

    return await query.collect();
  },
});

export const getBotActivity = query({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("botActivity").order("desc");

    if (args.limit) {
      const results = await query.take(args.limit);
      if (args.action) {
        return results.filter(activity => activity.action === args.action);
      }
      return results;
    }

    const results = await query.collect();

    if (args.action) {
      return results.filter(activity => activity.action === args.action);
    }

    return results;
  },
});

export const getErrors = query({
  args: {
    limit: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("errors").order("desc");

    if (args.limit) {
      const results = await query.take(args.limit);
      if (args.userId) {
        return results.filter(error => error.userId === args.userId);
      }
      return results;
    }

    const results = await query.collect();

    if (args.userId) {
      return results.filter(error => error.userId === args.userId);
    }

    return results;
  },
});

// Mutations for tracking production events
export const trackTimerGeneration = mutation({
  args: {
    userId: v.string(),
    duration: v.number(),
    userAgent: v.optional(v.string()),
    environment: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("timerGenerations", {
      userId: args.userId,
      duration: args.duration,
      timestamp: Date.now(),
      userAgent: args.userAgent,
      environment: args.environment,
    });
  },
});

export const trackBotActivity = mutation({
  args: {
    action: v.string(),
    userId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("botActivity", {
      action: args.action,
      userId: args.userId,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

export const trackError = mutation({
  args: {
    error: v.string(),
    stack: v.optional(v.string()),
    userId: v.optional(v.string()),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("errors", {
      error: args.error,
      stack: args.stack,
      userId: args.userId,
      timestamp: Date.now(),
      context: args.context,
    });
  },
});