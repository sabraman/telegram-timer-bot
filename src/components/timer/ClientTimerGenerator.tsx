"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { WheelPicker, WheelPickerWrapper } from "~/components/ui/wheel-picker";
import { Loader2, Send, RotateCcw, Check } from "lucide-react";
import { CanvasSource, Output, WebMOutputFormat, BufferTarget } from "mediabunny";
import type { WheelPickerOption } from "~/components/ui/wheel-picker";
import {
  SlideToUnlock,
  SlideToUnlockHandle,
  SlideToUnlockText,
  SlideToUnlockTrack,
} from "~/components/slide-to-unlock";
import { TextShimmer } from "~/components/motion-primitives/text-shimmer";
import { useHapticFeedback } from "~/hooks/use-haptic-feedback";
import { toast } from "sonner";

type TimerStyle = "countdown";

// Create timer options for wheel picker
const createArray = (length: number, add = 0): WheelPickerOption[] =>
  Array.from({ length }, (_, i) => {
    const value = i + add;
    return {
      label: value.toString().padStart(2, "0"),
      value: value.toString(),
    };
  });

// Create options for minutes (0-60) and seconds (0-59)
const minuteOptions = createArray(61, 0); // 0-60 minutes
const secondOptions = createArray(60, 0); // 0-59 seconds

export function ClientTimerGenerator() {
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{count: number, timers: number[], totalFrames: number} | null>(null);

  // Frame cache for instant regeneration (main thread)
  const [frameCache] = useState<Map<number, ImageData[]>>(new Map());

  // Haptic feedback
  const { impactOccurred, notificationOccurred } = useHapticFeedback();

  // Play unlock sound
  const playUnlockSound = () => {
    try {
      const audio = new Audio('/audio/unlock.wav');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Silently fail if audio play is blocked by browser
      });
    } catch (error) {
      // Silently fail if audio is not supported
    }
  };

  // Calculate total seconds from minutes and seconds
  const getTotalSeconds = () => {
    return minutes * 60 + seconds;
  };

  // Handle minutes value change
  const handleMinutesChange = (value: string) => {
    const newMinutes = parseInt(value, 10) || 0;
    console.log('🔧 Minutes changed:', { newMinutes, oldMinutes: minutes });
    setMinutes(newMinutes);
  };

  // Handle seconds value change
  const handleSecondsChange = (value: string) => {
    const newSeconds = parseInt(value, 10) || 0;
    console.log('🔧 Seconds changed:', { newSeconds, oldSeconds: seconds });
    setSeconds(newSeconds);
  };

  
  const generateTimerClientSide = async () => {
    setIsGenerating(true);
    setProgress(0);

    setVideoBlob(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    const currentTimerSeconds = getTotalSeconds();
    console.log('🎯 Generating timer:', { minutes, seconds, totalSeconds: currentTimerSeconds });

    try {
      const startTime = performance.now();
      const fps = 1;
      const duration = currentTimerSeconds + 1;
      const totalFrames = fps * duration;
      const workerId = Date.now();

      // Check main thread cache first
      if (frameCache.has(currentTimerSeconds)) {
        console.log(`🎯 CACHE HIT: Using cached frames for ${currentTimerSeconds}s timer`);
        console.log(`⚡ Cache hit! ${currentTimerSeconds}s timer loaded instantly`);

        const cachedFrames = frameCache.get(currentTimerSeconds)!;

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

      console.log(`🚀 Starting ${currentTimerSeconds}s timer generation with Web Worker + MediaRecorder API...`);

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
          toast.warning(`Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`);
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
          console.log(`🆕 FRESH FRAMES: Starting video encoding for new ${currentTimerSeconds}s timer`);
          console.log(`🔨 Generated fresh ${currentTimerSeconds}s timer (now cached)`);

          // Cache the frames in main thread
          frameCache.set(currentTimerSeconds, e.data.frames);
          console.log(`💾 Cached frames for ${currentTimerSeconds}s timer in main thread (${e.data.frames.length} frames)`);

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
        timerSeconds: currentTimerSeconds,
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

    // Play unlock sound and haptic feedback
    playUnlockSound();
    impactOccurred('medium');

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
            caption: `🕐 ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s countdown timer sticker - ${getTotalSeconds() + 1} seconds`,
          }),
        });

        if (response.ok) {
          notificationOccurred('success');
          toast.success("Timer sticker sent");
        } else {
          const error = await response.json();
          toast.error(`Failed to send to Telegram: ${error.message}`);
        }
      };

      reader.onerror = (error) => {
        console.error('🔍 FileReader error:', error);
        toast.error('Failed to read video file for upload');
        setIsSendingToTelegram(false);
      };

      reader.readAsDataURL(videoBlob);
    } catch (error) {
      console.error("Error sending to Telegram:", error);
      toast.error("Failed to send video to Telegram");
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
      <div className="w-full">
        <div className="text-center space-y-4">
          <WheelPickerWrapper>
            <WheelPicker
              options={minuteOptions}
              value={minutes.toString()}
              onValueChange={handleMinutesChange}
              infinite
              classNames={{
                highlightWrapper: "bg-[#ff197c] text-white shadow-xl border-0 rounded-l-xl rounded-r-none font-bold text-xl",
                optionItem: "text-zinc-400 dark:text-zinc-500 font-semibold text-lg",
              }}
            />
            <WheelPicker
              options={secondOptions}
              value={seconds.toString()}
              onValueChange={handleSecondsChange}
              infinite
              classNames={{
                highlightWrapper: "bg-[#ff197c] text-white shadow-xl border-0 rounded-l-none rounded-r-xl font-bold text-xl",
                optionItem: "text-zinc-400 dark:text-zinc-500 font-semibold text-lg",
              }}
            />
          </WheelPickerWrapper>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => {
            setMinutes(0);
            setSeconds(5);
          }}
          disabled={isGenerating}
          className="flex-1 h-12 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          size="lg"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
        <Button
          onClick={generateTimerClientSide}
          disabled={isGenerating}
          className="flex-1 h-12 rounded-full bg-[#ff197c] hover:bg-[#e0166a] text-white"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {progress}%
            </>
          ) : (
            <Check className="h-5 w-5" />
          )}
        </Button>
      </div>

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

          <div className="flex justify-center">
            <SlideToUnlock
              className="w-full rounded-2xl bg-white dark:bg-zinc-900 ring-2 ring-[#ff197c]/20"
              onUnlock={sendToTelegram}
            >
              <SlideToUnlockTrack>
                <SlideToUnlockText>
                  <TextShimmer
                    className="text-lg font-semibold"
                    duration={2.5}
                    spread={3}
                  >
                    slide to send
                  </TextShimmer>
                </SlideToUnlockText>
                <SlideToUnlockHandle
                  className="bg-[#ff197c] text-white rounded-xl"
                  disabled={isSendingToTelegram}
                >
                  {isSendingToTelegram ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="size-5" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.14753 11.8099C7.3949 9.52374 10.894 8.01654 12.6447 7.28833C17.6435 5.20916 18.6822 4.84799 19.3592 4.83606C19.5081 4.83344 19.8411 4.87034 20.0567 5.04534C20.2388 5.1931 20.2889 5.39271 20.3129 5.5328C20.3369 5.6729 20.3667 5.99204 20.343 6.2414C20.0721 9.08763 18.9 15.9947 18.3037 19.1825C18.0514 20.5314 17.5546 20.9836 17.0736 21.0279C16.0283 21.1241 15.2345 20.3371 14.2221 19.6735C12.6379 18.635 11.7429 17.9885 10.2051 16.9751C8.42795 15.804 9.58001 15.1603 10.5928 14.1084C10.8579 13.8331 15.4635 9.64397 15.5526 9.26395C15.5637 9.21642 15.5741 9.03926 15.4688 8.94571C15.3636 8.85216 15.2083 8.88415 15.0962 8.9096C14.9373 8.94566 12.4064 10.6184 7.50365 13.928C6.78528 14.4212 6.13461 14.6616 5.55163 14.649C4.90893 14.6351 3.67265 14.2856 2.7536 13.9869C1.62635 13.6204 0.730432 13.4267 0.808447 12.8044C0.849081 12.4803 1.29544 12.1488 2.14753 11.8099Z"></path>
                    </svg>
                  )}
                </SlideToUnlockHandle>
              </SlideToUnlockTrack>
            </SlideToUnlock>
          </div>
        </div>
      )}
    </div>
  );
}