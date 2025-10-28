"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Loader2, Send } from "lucide-react";
import { CanvasSource, Output, WebMOutputFormat, BufferTarget } from "mediabunny";

type TimerStyle = "countdown";

export function ClientTimerGenerator() {
  const [timerSeconds, setTimerSeconds] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string>('');
  const [cacheInfo, setCacheInfo] = useState<{count: number, timers: number[], totalFrames: number} | null>(null);

  // Frame cache for instant regeneration (main thread)
  const [frameCache] = useState<Map<number, ImageData[]>>(new Map());

  const generateTimerClientSide = async () => {
    setIsGenerating(true);
    setProgress(0);
    setCacheStatus('');

    setVideoBlob(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      const startTime = performance.now();
      const fps = 1;
      const duration = timerSeconds + 1;
      const totalFrames = fps * duration;
      const workerId = Date.now();

      // Check main thread cache first
      if (frameCache.has(timerSeconds)) {
        console.log(`🎯 CACHE HIT: Using cached frames for ${timerSeconds}s timer`);
        setCacheStatus(`⚡ Cache hit! ${timerSeconds}s timer loaded instantly`);

        const cachedFrames = frameCache.get(timerSeconds)!;

        // Create canvas for video recording
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d', {
          alpha: true,
          desynchronized: true,
          willReadFrequently: false
        });

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Set up MediaRecorder with optimized settings
        const stream = canvas.captureStream(30); // Higher fps for fast generation
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 500000
        });

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const endTime = performance.now();
          const totalTime = endTime - startTime;
          const blob = new Blob(chunks, { type: 'video/webm' });
          setVideoBlob(blob);
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);

          console.log(`✅ WebM sticker generated from cache!`, {
            duration: `${duration}s`,
            totalTime: `${totalTime.toFixed(2)}ms`,
            fps: (totalFrames / (totalTime / 1000)).toFixed(1),
            size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
            efficiency: `${((blob.size / 1024 / totalTime) * 1000).toFixed(2)} KB/s`,
            type: blob.type,
            fromCache: true
          });

          const fileSizeMB = blob.size / 1024 / 1024;
          if (fileSizeMB > 50) {
            alert(`⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`);
          }

          setIsGenerating(false);
          setProgress(0);
          setTimeout(() => setCacheStatus(''), 3000);
        };

        // INSTANT generation with Mediabunny - like Premiere Pro!
        try {
          console.log('🚀 Using Mediabunny with Telegram VP9 settings from cache...');
          const videoBlob = await encodeFramesToVideoInstantly(cachedFrames, fps, setProgress);

          const endTime = performance.now();
          const totalTime = endTime - startTime;
          const url = URL.createObjectURL(videoBlob);
          setVideoBlob(videoBlob);
          setVideoUrl(url);

          console.log(`✅ WebM sticker generated instantly from cache!`, {
            duration: `${duration}s`,
            totalTime: `${totalTime.toFixed(2)}ms`,
            size: `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`,
            type: videoBlob.type,
            fromCache: true
          });

          const fileSizeMB = videoBlob.size / 1024 / 1024;
          if (fileSizeMB > 50) {
            alert(`⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`);
          }

          setIsGenerating(false);
          setProgress(0);
          setTimeout(() => setCacheStatus(''), 3000);
          return;
        } catch (error) {
          console.error('Mediabunny encoding failed, falling back to real-time MediaRecorder:', error);

          // Fallback to real-time MediaRecorder (will take longer but works)
          if (mediaRecorder.state !== 'recording') {
            mediaRecorder.start();
          }

          let frameIndex = 0;
          const playFrame = () => {
            if (frameIndex >= cachedFrames.length) {
              setTimeout(() => mediaRecorder.stop(), 200);
              return;
            }

            ctx.putImageData(cachedFrames[frameIndex], 0, 0);
            frameIndex++;

            const progressPercent = Math.round((frameIndex / cachedFrames.length) * 100);
            setProgress(progressPercent);

            if (frameIndex < cachedFrames.length) {
              setTimeout(playFrame, 1000);
            }
          };

          playFrame();
          return;
        }
      }

      console.log(`🚀 Starting ${timerSeconds}s timer generation with Web Worker + MediaRecorder API...`);

      // Simple progress update function
      const updateProgress = (newProgress: number) => {
        setProgress(newProgress);
      };

      // Create Web Worker for frame generation
      const worker = new Worker('/timer-worker.js');

      // Create canvas for video recording
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
        willReadFrequently: false
      });

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set up MediaRecorder with optimized settings
      const stream = canvas.captureStream(30); // Higher fps for fast generation
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 500000
      });

      const chunks: Blob[] = [];
      let currentFrameIndex = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const blob = new Blob(chunks, { type: 'video/webm' });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);

        console.log(`✅ WebM sticker generated successfully!`, {
          duration: `${duration}s`,
          totalTime: `${totalTime.toFixed(2)}ms`,
          fps: (totalFrames / (totalTime / 1000)).toFixed(1),
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
          efficiency: `${((blob.size / 1024 / totalTime) * 1000).toFixed(2)} KB/s`,
          type: blob.type
        });

        // Check file size
        const fileSizeMB = blob.size / 1024 / 1024;
        if (fileSizeMB > 50) {
          alert(`⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`);
        }

        worker.terminate();
        setIsGenerating(false);
        setProgress(0);
        // Keep cache status for a bit, then clear it
        setTimeout(() => setCacheStatus(''), 3000);
      };

      // Handle messages from worker
      worker.onmessage = async (e) => {
        const { type, fromCache } = e.data;

        if (type === 'progress') {
          updateProgress(e.data.progress);
        } else if (type === 'complete') {
          console.log(`🆕 FRESH FRAMES: Starting video encoding for new ${timerSeconds}s timer`);
          setCacheStatus(`🔨 Generated fresh ${timerSeconds}s timer (now cached)`);

          // Cache the frames in main thread
          frameCache.set(timerSeconds, e.data.frames);
          console.log(`💾 Cached frames for ${timerSeconds}s timer in main thread (${e.data.frames.length} frames)`);

          // Update cache info
          updateCacheInfo();

          // INSTANT generation with Mediabunny - like Premiere Pro!
          try {
            console.log('🚀 Using Mediabunny for instant encoding...');
            const videoBlob = await encodeFramesToVideoInstantly(e.data.frames, fps, updateProgress);

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const url = URL.createObjectURL(videoBlob);
            setVideoBlob(videoBlob);
            setVideoUrl(url);

            console.log(`✅ WebM sticker generated instantly!`, {
              duration: `${duration}s`,
              totalTime: `${totalTime.toFixed(2)}ms`,
              size: `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`,
              type: videoBlob.type,
              fromCache: false
            });

            const fileSizeMB = videoBlob.size / 1024 / 1024;
            if (fileSizeMB > 50) {
              alert(`⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`);
            }

            worker.terminate();
            setIsGenerating(false);
            setProgress(0);
            setTimeout(() => setCacheStatus(''), 3000);
            return;
          } catch (error) {
            console.error('Mediabunny failed, falling back to MediaRecorder:', error);

            // Fallback to MediaRecorder (will take longer but works)
            if (mediaRecorder.state !== 'recording') {
              mediaRecorder.start();
            }

            let frameIndex = 0;
            const playFrame = () => {
              if (frameIndex >= e.data.frames.length) {
                setTimeout(() => mediaRecorder.stop(), 200);
                return;
              }

              ctx.putImageData(e.data.frames[frameIndex], 0, 0);
              frameIndex++;

              const progressPercent = Math.round((frameIndex / e.data.frames.length) * 100);
              updateProgress(progressPercent);

              if (frameIndex < e.data.frames.length) {
                setTimeout(playFrame, 1000);
              }
            };

            playFrame();
          }
        } else if (type === 'error') {
          throw new Error(e.data.error);
        }
      };

      // Start recording before frame generation
      mediaRecorder.start();

      // Send timer generation request to worker
      worker.postMessage({
        action: 'generate',
        timerSeconds,
        workerId
      });

    } catch (error) {
      console.error("Error generating timer sticker:", error);
      alert(`Failed to generate timer sticker: ${error instanceof Error ? error.message : String(error)}`);
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const encodeFramesToVideoWithWebCodecs = async (frames: ImageData[], fps: number, onProgress: (progress: number) => void): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        // Check WebCodecs support
        if (typeof VideoEncoder === 'undefined') {
          throw new Error('WebCodecs API not supported in this browser');
        }

        const chunks: Uint8Array[] = [];
        const frameDuration = 1000000 / fps; // microseconds per frame (1 second = 1,000,000 microseconds)
        let frameIndex = 0;

        const encoder = new VideoEncoder({
          output: (chunk, metadata) => {
            chunks.push(chunk);
            onProgress(Math.round(((frameIndex + 1) / frames.length) * 100));

            if (frameIndex === frames.length - 1) {
              // All frames encoded, create blob
              const blob = new Blob(chunks, { type: 'video/webm;codecs=vp9' });
              resolve(blob);
            }
          },
          error: (error) => {
            reject(error);
          }
        });

        // Configure encoder for VP9 with transparency support (sticker format)
        encoder.configure({
          codec: 'vp09.00.10.08', // VP9 with alpha support
          width: 512,
          height: 512,
          bitrate: 500000, // 500kbps
          framerate: fps,
          latencyMode: 'realtime',
          // Alpha channel settings for stickers
          alphaMode: 'keep', // Preserve transparency
          hardwareAcceleration: 'prefer-hardware' // Allow hardware acceleration
        });

        // Encode all frames with correct timestamps
        for (let i = 0; i < frames.length; i++) {
          // Convert ImageData to VideoFrame with alpha channel support
          const canvas = new OffscreenCanvas(512, 512);
          const ctx = canvas.getContext('2d');

          // Clear canvas to ensure transparency
          ctx.clearRect(0, 0, 512, 512);

          // Put image data with alpha channel
          ctx.putImageData(frames[i], 0, 0);

          const frame = new VideoFrame(canvas, {
            timestamp: i * frameDuration, // microseconds
            duration: frameDuration,
            alpha: 'keep' // Preserve alpha channel
          });

          encoder.encode(frame);
          frame.close();

          // Update progress
          frameIndex = i;
          onProgress(Math.round(((i + 1) / frames.length) * 50)); // 50% during encoding
        }

        encoder.flush();

      } catch (error) {
        reject(error);
      }
    });
  };

  const updateCacheInfo = () => {
    const cacheKeys = Array.from(frameCache.keys()).sort((a, b) => a - b);
    const totalFrames = Array.from(frameCache.values()).reduce((sum, frames) => sum + frames.length, 0);
    const info = {
      count: frameCache.size,
      timers: cacheKeys,
      totalFrames
    };
    setCacheInfo(info);
    console.log('📊 Main thread cache info:', info);
  };

  const clearCache = async () => {
    try {
      const cacheSize = frameCache.size;
      frameCache.clear();
      setCacheInfo(null);
      console.log(`🗑️ Main thread cache cleared! Removed ${cacheSize} timer(s)`);
      setCacheStatus(`🗑️ Cache cleared! Removed ${cacheSize} timer(s)`);
      setTimeout(() => setCacheStatus(''), 3000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      setCacheStatus('❌ Failed to clear cache');
      setTimeout(() => setCacheStatus(''), 3000);
    }
  };

  const getCacheInfo = async () => {
    try {
      updateCacheInfo();
    } catch (error) {
      console.error('Error getting cache info:', error);
    }
  };

  const encodeFramesToVideoInstantly = async (frames: ImageData[], fps: number, onProgress: (progress: number) => void): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('🚀 Using Mediabunny with Telegram-compatible VP9 settings...');

        // Create canvas with transparency support
        const canvas = new OffscreenCanvas(512, 512);

        // Create CanvasSource with Telegram-compatible VP9 + alpha settings
        // Using specific codec string and alpha preservation for sticker compatibility
        const canvasSource = new CanvasSource(canvas, {
          codec: 'vp9',
          bitrate: 500000, // Same bitrate as working MediaRecorder
          alpha: 'keep', // Preserve alpha channel for Telegram stickers (like -pix_fmt yuva420p)
          fullCodecString: 'vp09.00.31.08' // VP9 codec with alpha support (similar to libvpx-vp9 settings)
        });

        // Create Output with WebM format for Telegram compatibility
        const output = new Output({
          format: new WebMOutputFormat(),
          target: new BufferTarget()
        });

        // Connect CanvasSource to Output (correct pattern)
        output.addVideoTrack(canvasSource);

        // Start the output pipeline
        await output.start();

        // Add all frames instantly with precise 1fps timing (like Premiere Pro)
        for (let i = 0; i < frames.length; i++) {
          const timestamp = i * 1.0; // 0, 1, 2, 3... seconds for 1fps content
          const duration = 1.0; // Each frame lasts exactly 1 second

          // Draw frame to canvas with alpha channel
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }

          // Clear canvas to ensure transparency
          ctx.clearRect(0, 0, 512, 512);

          // Draw frame with alpha channel preserved
          ctx.putImageData(frames[i], 0, 0);

          // Add frame with precise timing for 1fps playback
          // This should create the equivalent of FFmpeg's -auto-alt-ref 0 setting
          await canvasSource.add(timestamp, duration);

          // Update progress
          const progressPercent = Math.round(((i + 1) / frames.length) * 100);
          onProgress(progressPercent);
        }

        // Close source to improve performance
        canvasSource.close();

        // Finalize the output to get the encoded video
        await output.finalize();

        // Get the buffer and create blob with correct MIME type
        const buffer = output.target.buffer;
        const blob = new Blob([buffer], { type: 'video/webm;codecs=vp9' });

        console.log(`✅ Video encoded instantly with Mediabunny!`, {
          duration: `${frames.length}s`, // 1fps = frames.length seconds
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
          type: blob.type,
          fps: 1,
          frameCount: frames.length,
          telegramCompatible: true,
          codec: 'VP9 with alpha (vp09.00.31.08)',
          transparencyEnabled: true
        });

        resolve(blob);

      } catch (error) {
        console.error('Mediabunny encoding failed:', error);
        reject(error);
      }
    });
  };

  const sendToTelegram = async () => {
    if (!videoBlob) return;

    setIsSendingToTelegram(true);
    try {
      // Debug: Log blob details before conversion
      console.log('🔍 Blob details before conversion:', {
        size: videoBlob.size,
        type: videoBlob.type,
        isClosed: (videoBlob as any).closed || false
      });

      // Convert blob to base64 for API upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // Debug: Log base64 conversion results
        console.log('🔍 Base64 conversion results:', {
          originalBlobSize: videoBlob.size,
          base64DataLength: base64data.length,
          base64Prefix: base64data.substring(0, 50) + '...',
          mimeType: base64data.split(';')[0]?.split(':')[1] || 'unknown'
        });

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

      reader.onerror = (error) => {
        console.error('🔍 FileReader error:', error);
        alert('❌ Failed to read video file for upload');
        setIsSendingToTelegram(false);
      };

      reader.readAsDataURL(videoBlob);
    } catch (error) {
      console.error("Error sending to Telegram:", error);
      alert("Failed to send video to Telegram.");
    } finally {
      setIsSendingToTelegram(false);
    }
  };

  // Load cache info on component mount
  useEffect(() => {
    getCacheInfo();
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Generate Timer Sticker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cache Management */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Cache Management</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={getCacheInfo}
                disabled={isGenerating}
              >
                📊 Info
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearCache}
                disabled={isGenerating}
              >
                🗑️ Clear
              </Button>
            </div>
          </div>

          {cacheInfo && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                📊 Cache: {cacheInfo.count} timer(s) cached
              </p>
              {cacheInfo.timers.length > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Durations: {cacheInfo.timers.join('s, ')}s ({cacheInfo.totalFrames} frames)
                </p>
              )}
            </div>
          )}
        </div>

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
              Generating... {progress}%
            </>
          ) : (
            "Generate Timer Sticker"
          )}
        </Button>

        {/* Loading Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            {cacheStatus && (
              <p className="text-xs text-muted-foreground text-center">
                {cacheStatus}
              </p>
            )}
          </div>
        )}

        {/* Video Preview */}
        {videoUrl && (
          <div className="space-y-3">
            {cacheStatus && !isGenerating && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
                <p className="text-xs text-green-700 dark:text-green-300 text-center">
                  {cacheStatus}
                </p>
              </div>
            )}
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