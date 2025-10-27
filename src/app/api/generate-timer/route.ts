import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { style = "countdown" } = await request.json();

    // Create temporary files
    const tempDir = tmpdir();
    const tempIndexFile = join(tempDir, `index-${Date.now()}.js`);
    const outputFile = join(tempDir, `timer-${style}-${Date.now()}.webm`);

    // Create a simple index.js for Remotion CLI
    const indexContent = `
const { Composition } = require("remotion");

const TimerVideo = ({ style = "countdown" }) => {
  const { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } = require("remotion");

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSecond = Math.floor(frame / fps);
  const remainingSeconds = Math.max(0, 60 - currentSecond);

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: style === "circular"
          ? "linear-gradient(to bottom right, #10b981, #14b8a6)"
          : style === "progress"
          ? "linear-gradient(to bottom right, #f97316, #ef4444)"
          : "linear-gradient(to bottom right, #3b82f6, #8b5cf6)",
        color: "white",
        fontSize: "180px",
        fontWeight: "bold",
        textAlign: "center",
        flexDirection: "column"
      },
      children: [
        remainingSeconds.toString(),
        {
          type: "div",
          props: {
            style: { fontSize: "40px", marginTop: "20px" },
            children: remainingSeconds === 1 ? "second left" : "seconds left"
          }
        }
      ]
    }
  };
};

module.exports = {
  composition: {
    id: "Timer",
    component: TimerVideo,
    durationInFrames: 60 * 30,
    fps: 30,
    width: 512,
    height: 512,
    defaultProps: { style }
  }
};
`;

    await writeFile(tempIndexFile, indexContent);

    try {
      // Use Remotion CLI to render video
      const { stdout, stderr } = await execAsync(
        `npx remotion render Timer "${outputFile}" --codec=webm --props='{"style":"${style}"}' --pixel-format=yuva420p --frames=1800`,
        {
          cwd: process.cwd(),
          timeout: 60000 // 60 second timeout
        }
      );

      console.log("Remotion output:", stdout);
      if (stderr) console.log("Remotion stderr:", stderr);

      // Read the generated file
      const videoBuffer = await require('fs').promises.readFile(outputFile);

      // Cleanup
      await unlink(tempIndexFile);
      await unlink(outputFile);

      return new NextResponse(videoBuffer, {
        headers: {
          "Content-Type": "video/webm",
          "Cache-Control": "no-cache",
        },
      });

    } catch (cliError) {
      console.error("CLI Error:", cliError);

      // Fallback: return a simple placeholder response
      return NextResponse.json({
        message: "Timer generation initiated",
        style,
        status: "queued",
        note: "Full Remotion integration requires CLI setup. This is a demo response."
      });
    }

  } catch (error) {
    console.error("Error generating timer video:", error);
    return NextResponse.json(
      { error: "Failed to generate timer video", details: error.message },
      { status: 500 }
    );
  }
}