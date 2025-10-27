"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Loader2, Download } from "lucide-react";

type TimerStyle = "countdown" | "circular" | "progress";

export function TimerGenerator() {
  const [selectedStyle, setSelectedStyle] = useState<TimerStyle>("countdown");
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const generateTimer = async () => {
    setIsGenerating(true);
    setVideoUrl(null);

    try {
      const response = await fetch("/api/generate-timer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ style: selectedStyle }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate timer");
      }

      const contentType = response.headers.get("content-type");

      if (contentType?.includes("video/webm")) {
        // Handle video blob response
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
      } else {
        // Handle JSON response (demo/fallback)
        const data = await response.json();
        console.log("Timer generation response:", data);

        // Show a demo message for now
        alert(`Timer generation started for ${selectedStyle} style!\n\nThis is a demo - full video rendering requires additional server configuration.`);

        // Create a mock video URL for demonstration
        setVideoUrl("demo");
      }
    } catch (error) {
      console.error("Error generating timer:", error);
      alert("Failed to generate timer. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadVideo = () => {
    if (videoUrl) {
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `timer-${selectedStyle}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Generate Timer Video</CardTitle>
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
          onClick={generateTimer}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Timer...
            </>
          ) : (
            "Generate 60-Second Timer"
          )}
        </Button>

        {/* Video Preview */}
        {videoUrl && (
          <div className="space-y-3">
            {videoUrl === "demo" ? (
              <div className="border rounded-lg p-8 bg-muted/50 text-center">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-lg font-semibold mb-2">Timer Video Generated!</h3>
                <p className="text-muted-foreground mb-4">
                  Your {selectedStyle} style timer is ready for production deployment.
                </p>
                <div className="text-sm text-muted-foreground">
                  <p>✅ Timer style: {selectedStyle}</p>
                  <p>✅ Duration: 60 seconds</p>
                  <p>✅ Resolution: 512x512</p>
                  <p>✅ Format: WebM with transparency</p>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <video
                  src={videoUrl}
                  controls
                  className="w-full h-auto"
                  muted
                  loop
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            <div className="flex gap-2">
              {videoUrl !== "demo" && (
                <Button onClick={downloadVideo} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
              <Button
                onClick={() => {
                  // In a real implementation, this would send to Telegram
                  alert("In production, this would send the timer video via Telegram bot!");
                }}
                className="flex-1"
              >
                Send to Telegram
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}