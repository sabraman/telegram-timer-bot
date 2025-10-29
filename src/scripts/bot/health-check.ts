import { bot } from "~/lib/bot/bot";
import { env } from "~/lib/bot/env";

/**
 * Health check script for Telegram bot
 *
 * Usage:
 * - Run `pnpm bot:health-check` to verify bot is working
 * - Can be used in deployment pipelines as a health check
 */

async function main() {
  try {
    console.log("🔍 Checking bot health...");

    // Test bot API connection
    const botInfo = await bot.api.getMe();
    console.log("✅ Bot info:", {
      id: botInfo.id,
      username: botInfo.username,
      first_name: botInfo.first_name,
      is_bot: botInfo.is_bot,
    });

    // Check webhook status
    const webhookInfo = await bot.api.getWebhookInfo();
    console.log("🔗 Webhook status:", {
      url: webhookInfo.url,
      has_custom_certificate: webhookInfo.has_custom_certificate,
      pending_update_count: webhookInfo.pending_update_count,
      last_error_date: webhookInfo.last_error_date,
      last_error_message: webhookInfo.last_error_message,
    });

    // Test environment variables
    console.log("🔧 Environment check:");
    console.log("- TG_API_TOKEN:", env.TG_API_TOKEN ? "✅ Set" : "❌ Missing");
    console.log("- NEXT_PUBLIC_SITE_URL:", env.NEXT_PUBLIC_SITE_URL || "Not set (development)");
    console.log("- CONVEX_DEPLOYMENT:", env.CONVEX_DEPLOYMENT || "Not set");
    console.log("- NODE_ENV:", env.NODE_ENV);

    if (webhookInfo.url) {
      console.log("✅ Bot is ready for production!");
    } else {
      console.log("ℹ️  Bot is in polling mode (good for development)");
    }

    console.log("🎉 Health check completed successfully!");

  } catch (error) {
    console.error("❌ Health check failed:", error);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));