"use client";

import { useState, useRef } from "react";
import { Button } from "~/components/ui/button";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Loader2, Download, Send } from "lucide-react";
import { Player } from "@remotion/player";
import { TimerVideo } from "~/remotion/TimerVideo";

type TimerStyle = "countdown" | "circular" | "progress";

export function ClientTimerGenerator() {
  const [selectedStyle, setSelectedStyle] = useState<TimerStyle>("countdown");
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);

  const generateTimerClientSide = async () => {
    setIsGenerating(true);
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

      const fps = 10;
      const duration = 5;
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
        const remainingSeconds = Math.max(0, 5 - currentSecond);

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
        ctx.font = 'bold 220px Arial';
        ctx.fillText(remainingSeconds.toString(), 256, 240);

        // Draw smaller text below
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`${remainingSeconds === 1 ? 'second' : 'seconds'} left`, 256, 320);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        frame++;

        // Show progress
        if (frame % 5 === 0) {
          console.log(`Generated frame ${frame}/${totalFrames} (${Math.round((frame / totalFrames) * 100)}%)`);
        }

        // Schedule next frame
        setTimeout(animateFrame, frameDuration);
      };

      // Start animation
      animateFrame();

    } catch (error) {
      console.error("Error generating timer sticker:", error);
      alert(`Failed to generate timer sticker: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  
  const downloadVideo = () => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timer-${selectedStyle}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
            filename: `timer-${selectedStyle}.webm`,
            caption: `🕐 ${selectedStyle} style timer sticker - 5 seconds`,
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
        <CardTitle>Generate Timer Sticker (Telegram)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Style Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Choose Timer Style</Label>
          <RadioGroup
            value={selectedStyle}
            onValueChange={(value) => setSelectedStyle(value as TimerStyle)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="countdown" id="countdown" />
              <Label htmlFor="countdown" className="text-sm">
                Simple Countdown (60, 59, 58...)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="circular" id="circular" />
              <Label htmlFor="circular" className="text-sm">
                Circular Progress
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="progress" id="progress" />
              <Label htmlFor="progress" className="text-sm">
                Progress Bar
              </Label>
            </div>
          </RadioGroup>
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
            "Generate 5-Second Timer Sticker"
          )}
        </Button>

        {/* Real-time Preview */}
        <div className="space-y-3">
          <div className="border rounded-lg overflow-hidden">
            <Player
              component={TimerVideo}
              compositionWidth={512}
              compositionHeight={512}
              fps={30}
              durationInFrames={60 * 30}
              loop
              autoPlay
              style={{ width: '100%', height: 'auto' }}
              inputProps={{ style: selectedStyle }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Live preview - {selectedStyle} style timer
          </p>
        </div>

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

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={downloadVideo} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download WebM
              </Button>
              <Button
                onClick={sendToTelegram}
                disabled={isSendingToTelegram}
              >
                {isSendingToTelegram ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send to Telegram
              </Button>
            </div>

            {videoBlob && (
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  File size: {(videoBlob.size / 1024 / 1024).toFixed(2)} MB
                  {videoBlob.size > 50 * 1024 * 1024 && (
                    <span className="text-red-500 font-medium">⚠️ Too large</span>
                  )}
                  {videoBlob.size <= 50 * 1024 * 1024 && videoBlob.size > 20 * 1024 * 1024 && (
                    <span className="text-yellow-500 font-medium">⚠️ Large</span>
                  )}
                  {videoBlob.size <= 20 * 1024 * 1024 && (
                    <span className="text-green-500 font-medium">✅ Ready</span>
                  )}
                </div>
                <div>Format: WebM Sticker (VP9) • 512x512 • 5 seconds • 10fps • Transparent</div>
                <div className="text-gray-500">Telegram limit: 50MB • Auto-compression if oversized</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}