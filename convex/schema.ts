import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  posts: defineTable({
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // Production-ready timer analytics
  timerGenerations: defineTable({
    userId: v.string(),
    duration: v.number(),
    timestamp: v.number(),
    userAgent: v.optional(v.string()),
    environment: v.string(), // 'development' | 'production'
  }).index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),

  // Bot health monitoring
  botActivity: defineTable({
    action: v.string(), // 'webhook_received' | 'sticker_sent' | 'error'
    userId: v.optional(v.string()),
    timestamp: v.number(),
    metadata: v.optional(v.any()),
  }).index("by_timestamp", ["timestamp"]),

  // Error tracking for production
  errors: defineTable({
    error: v.string(),
    stack: v.optional(v.string()),
    userId: v.optional(v.string()),
    timestamp: v.number(),
    context: v.optional(v.any()),
  }).index("by_timestamp", ["timestamp"]),
}); 