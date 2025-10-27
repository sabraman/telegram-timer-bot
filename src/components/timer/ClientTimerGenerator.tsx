"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Loader2, Send } from "lucide-react";

type TimerStyle = "countdown";

export function ClientTimerGenerator() {
  const [timerSeconds, setTimerSeconds] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);

  const generateTimerClientSide = async () => {
    setIsGenerating(true);
    setProgress(0);

    setVideoBlob(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      console.log("Generating timer stickers with MediaRecorder API...");

      // Create canvas for animation
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const fps = 1; // Only need 1fps since numbers change once per second
      const duration = timerSeconds + 1; // +1 to include the "0" at the end
      const frameDuration = 1000 / fps; // milliseconds per frame

      // Create MediaRecorder to capture canvas as WebM
      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2000000 // 2Mbps for good quality
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);

        console.log("WebM sticker generated successfully!", {
          duration: `${duration}s`,
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
          type: blob.type
        });

        // Check file size
        const fileSizeMB = blob.size / 1024 / 1024;
        if (fileSizeMB > 50) {
          alert(`⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`);
        }
      };

      // Start recording
      mediaRecorder.start();

      // Animate the timer
      let frame = 0;
      const totalFrames = fps * duration;

      const animateFrame = () => {
        if (frame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const currentSecond = Math.floor(frame / fps);
        const remainingSeconds = Math.max(0, timerSeconds - currentSecond);

        // Clear canvas with transparency
        ctx.clearRect(0, 0, 512, 512);

        // Draw timer text with good contrast
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add text shadow for better visibility on transparent background
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Draw main timer number
        ctx.fillStyle = 'white';
        ctx.font = 'bold 512px Arial';
        ctx.fillText(remainingSeconds.toString(), 256, 256);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        frame++;

        // Update progress
        const progressPercent = Math.round((frame / totalFrames) * 100);
        setProgress(progressPercent);

        // Schedule next frame
        setTimeout(animateFrame, frameDuration);
      };

      // Start animation
      animateFrame();

    } catch (error) {
      console.error("Error generating timer sticker:", error);
      alert(`Failed to generate timer sticker: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const sendToTelegram = async () => {
    if (!videoBlob) return;

    setIsSendingToTelegram(true);
    try {
      // Convert blob to base64 for API upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        const response = await fetch("/api/send-to-telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video: base64data,
            filename: "timer-countdown.webm",
            caption: `🕐 ${timerSeconds}→0 countdown timer sticker - ${timerSeconds + 1} seconds`,
          }),
        });

        if (response.ok) {
          alert("✅ Timer video sent to Telegram successfully!");
        } else {
          const error = await response.json();
          alert(`❌ Failed to send to Telegram: ${error.message}`);
        }
      };
      reader.readAsDataURL(videoBlob);
    } catch (error) {
      console.error("Error sending to Telegram:", error);
      alert("Failed to send video to Telegram.");
    } finally {
      setIsSendingToTelegram(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Generate Timer Sticker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Duration Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Timer Duration (seconds)</label>
          <Input
            type="number"
            min="1"
            max="60"
            value={timerSeconds}
            onChange={(e) => setTimerSeconds(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
            placeholder="Enter seconds (1-60)"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Timer will count down from {timerSeconds} to 0 ({timerSeconds + 1} seconds total)
          </p>
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateTimerClientSide}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Timer Sticker...
            </>
          ) : (
            "Generate Timer Sticker"
          )}
        </Button>

        {/* Loading Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Generating timer...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Video Preview */}
        {videoUrl && (
          <div className="space-y-3">
            <div className="border rounded-lg overflow-hidden">
              <video
                src={videoUrl}
                controls
                className="w-full h-auto"
                muted
                loop
                playsInline
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <Button
              onClick={sendToTelegram}
              disabled={isSendingToTelegram}
              className="w-full"
            >
              {isSendingToTelegram ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending to Telegram...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send to Telegram
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}