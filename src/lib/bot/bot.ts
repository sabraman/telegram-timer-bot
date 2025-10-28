import { Bot } from "grammy";
import { env } from "./env";

// Make sure the token is available
if (!env.TG_API_TOKEN) {
  throw new Error("TG_API_TOKEN environment variable not found.");
}

// Create a bot instance
export const bot = new Bot(env.TG_API_TOKEN);

// Define your bot's logic here
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to Timer Bot! 🕐\n\n" +
      "Create custom 60-second timer videos and share them!\n\n" +
      "Open the mini app to get started:",
  );
});

bot.command("timer", async (ctx) => {
  await ctx.reply(
    "🎬 Create your timer video!\n\n" +
      "1. Open the mini app\n" +
      "2. Choose your timer style\n" +
      "3. Generate and download\n" +
      "4. Send the video in chat\n\n" +
      "Available styles:\n" +
      "• Simple Countdown\n" +
      "• Circular Progress\n" +
      "• Progress Bar",
  );
});

bot.on("message:text", async (ctx) => {
  await ctx.reply(
    `You said: ${ctx.message.text}\n\nTry /timer to create timer videos!`,
  );
});

// Handle video uploads (when users send generated timer videos)
bot.on("message:video", async (ctx) => {
  const video = ctx.message.video;
  await ctx.reply(
    `Nice video! 📹\n` +
      `Duration: ${video.duration}s\n` +
      `File name: ${video.file_name || "Unknown"}\n\n` +
      `Is this a timer video? Great! 🎉`,
  );
});

// Add more command handlers and logic as needed
