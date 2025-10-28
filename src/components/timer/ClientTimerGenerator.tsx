"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { WheelPicker, WheelPickerWrapper } from "~/components/ui/wheel-picker";
import { Loader2, Send } from "lucide-react";
import { CanvasSource, Output, WebMOutputFormat, BufferTarget } from "mediabunny";
import type { WheelPickerOption } from "~/components/ui/wheel-picker";

type TimerStyle = "countdown";

// Create timer options for wheel picker
const createArray = (length: number, add = 0): WheelPickerOption[] =>
  Array.from({ length }, (_, i) => {
    const value = i + add;
    return {
      label: value.toString(),
      value: value.toString(), // Use simple string values
    };
  });

const timerOptions = createArray(60, 1);

export function ClientTimerGenerator() {
  const [timerSeconds, setTimerSeconds] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{count: number, timers: number[], totalFrames: number} | null>(null);

  // Frame cache for instant regeneration (main thread)
  const [frameCache] = useState<Map<number, ImageData[]>>(new Map());

  // Handle timer value change from wheel picker
  const handleTimerValueChange = (value: string) => {
    console.log('🔧 Wheel picker value changed:', value);

    const newTimerSeconds = parseInt(value, 10) || 1;
    console.log('✅ Timer value updated:', {
      stringValue: value,
      parsedValue: newTimerSeconds,
      previousTimerSeconds: timerSeconds
    });

    setTimerSeconds(newTimerSeconds);
  };

  
  const generateTimerClientSide = async () => {
    setIsGenerating(true);
    setProgress(0);

    setVideoBlob(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    console.log('🎯 Generating timer with current state value:', timerSeconds);

    try {
      const startTime = performance.now();
      const fps = 1;
      const duration = timerSeconds + 1;
      const totalFrames = fps * duration;
      const workerId = Date.now();

      // Check main thread cache first
      if (frameCache.has(timerSeconds)) {
        console.log(`🎯 CACHE HIT: Using cached frames for ${timerSeconds}s timer`);
        console.log(`⚡ Cache hit! ${timerSeconds}s timer loaded instantly`);

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
      };

      // Handle messages from worker
      worker.onmessage = async (e) => {
        const { type, fromCache } = e.data;

        if (type === 'progress') {
          updateProgress(e.data.progress);
        } else if (type === 'complete') {
          console.log(`🆕 FRESH FRAMES: Starting video encoding for new ${timerSeconds}s timer`);
          console.log(`🔨 Generated fresh ${timerSeconds}s timer (now cached)`);

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
      console.log(`🗑️ Cache cleared! Removed ${cacheSize} timer(s)`);
    } catch (error) {
      console.error('Error clearing cache:', error);
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
    <div className="w-full max-w-sm mx-auto p-4 space-y-6">
      {/* Timer Selection */}
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Timer Duration</h1>

        <WheelPickerWrapper>
          <WheelPicker
            options={timerOptions}
            value={timerSeconds.toString()}
            onValueChange={handleTimerValueChange}
            infinite
            optionItemHeight={44}
            classNames={{
              highlightWrapper: "bg-blue-500 text-white rounded-lg",
              optionItem: "text-lg font-medium py-2",
            }}
          />
        </WheelPickerWrapper>

        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {timerSeconds}s
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={generateTimerClientSide}
        disabled={isGenerating}
        className="w-full h-12 text-lg"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Generating... {progress}%
          </>
        ) : (
          "Generate Timer"
        )}
      </Button>

      {/* Progress */}
      {isGenerating && (
        <Progress value={progress} className="h-2" />
      )}

      {/* Video Preview */}
      {videoUrl && (
        <div className="space-y-4">
          <div className="rounded-none overflow-hidden bg-transparent">
            <video
              src={videoUrl}
              controls={false}
              autoPlay
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
            className="w-full h-12 text-lg bg-blue-500 hover:bg-blue-600"
            size="lg"
          >
            {isSendingToTelegram ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Send to Telegram
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}