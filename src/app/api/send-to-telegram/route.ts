import { InputFile } from "grammy";
import { type NextRequest, NextResponse } from "next/server";
import { bot } from "~/lib/bot/bot";
import { getAuth } from "~/lib/security";

export async function POST(request: NextRequest) {
  try {
    const { video, filename, caption } = await request.json();

    // Debug: Log what we received
    console.log("🔍 API received data:", {
      videoLength: video?.length || 0,
      filename,
      videoPrefix: `${video?.substring(0, 50)}...` || "missing",
      receivedDataSize: JSON.stringify({ video, filename, caption }).length,
    });

    if (!video || !filename) {
      return NextResponse.json(
        { error: "Video data and filename are required" },
        { status: 400 },
      );
    }

    // Get user authentication data to obtain chat ID
    const { userData, isAuthorized } = await getAuth();

    if (!isAuthorized || !userData?.id) {
      return NextResponse.json(
        {
          error:
            "User authentication required. Please open this app from Telegram.",
        },
        { status: 401 },
      );
    }

    // Extract base64 data (handle both WebM and MP4)
    let base64Data = video;
    if (video.startsWith("data:video/")) {
      // Efficient string-based approach to avoid regex catastrophic backtracking on large strings
      const base64Start = video.indexOf('base64,');
      if (base64Start !== -1) {
        base64Data = video.substring(base64Start + 7);
      } else {
        // Fallback for unexpected format
        base64Data = video.replace(/^data:video\/[^;]+;base64,/, '');
      }
    }

    // Debug: Log base64 processing
    console.log("🔍 Base64 processing:", {
      originalLength: video.length,
      afterStripping: base64Data.length,
      prefixRemoved: video.length - base64Data.length,
    });

    const buffer = Buffer.from(base64Data, "base64");

    // Debug: Log buffer creation
    console.log("🔍 Buffer created:", {
      bufferSize: buffer.length,
      originalBase64Size: base64Data.length,
      expectedSize: Math.floor(base64Data.length * 0.75), // Rough estimate
    });

    try {
      // Check file size before attempting upload
      const fileSizeMB = buffer.length / 1024 / 1024;
      const maxSizeMB = 50; // Telegram's limit

      if (fileSizeMB > maxSizeMB) {
        return NextResponse.json(
          {
            error: `File too large for Telegram. Your sticker is ${fileSizeMB.toFixed(1)} MB, but Telegram's limit is ${maxSizeMB} MB.`,
            size: buffer.length,
            maxSize: maxSizeMB * 1024 * 1024,
            suggestion:
              "Try generating a shorter sticker or use a lower quality setting.",
          },
          { status: 413 },
        );
      }

      // Send sticker using InputFile (like your Shrek example)
      await bot.api.sendSticker(userData.id, new InputFile(buffer, filename));

      console.log(`Sticker sent to Telegram user ${userData.id}: ${filename}`);
      console.log(
        `File size: ${buffer.length} bytes (${fileSizeMB.toFixed(2)} MB)`,
      );

      return NextResponse.json({
        success: true,
        message: "Timer sticker sent to Telegram successfully!",
        filename,
        size: buffer.length,
        sentTo: userData.id,
        format: "WebM Sticker",
      });
    } catch (botError) {
      console.error("Error sending to Telegram bot:", botError);

      // Handle specific Telegram errors
      if (botError.error_code === 413) {
        return NextResponse.json(
          {
            error:
              "File too large for Telegram. Try generating a shorter sticker.",
            details: "Request Entity Too Large (413)",
          },
          { status: 413 },
        );
      }

      if (botError.error_code === 502) {
        return NextResponse.json(
          {
            error: "Telegram server error. Please try again in a moment.",
            details: "Bad Gateway (502)",
          },
          { status: 502 },
        );
      }

      // InputFile should handle all cases properly (like your Shrek example)
      // If it fails, it's likely a real issue with the file or Telegram API
      console.error("InputFile upload failed:", botError);

      return NextResponse.json(
        {
          error: "Failed to send sticker to Telegram.",
          details: botError.message,
          suggestion: "The sticker file might be corrupted or still too large.",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error processing video upload:", error);
    return NextResponse.json(
      { error: "Failed to process video upload" },
      { status: 500 },
    );
  }
}
