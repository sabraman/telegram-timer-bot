"use client";

import { Check, Loader2, RotateCcw } from "lucide-react";
import {
  BufferTarget,
  CanvasSource,
  Output,
  WebMOutputFormat,
} from "mediabunny";
import { loadFont } from "@remotion/fonts";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPlatformAdapter } from "~/adapters/platform-adapter";
import LottieSuccessToast from "~/components/ui/lottie-success-toast";
import { TextShimmer } from "~/components/motion-primitives/text-shimmer";
import {
  SlideToUnlock,
  SlideToUnlockHandle,
  SlideToUnlockText,
  SlideToUnlockTrack,
} from "~/components/slide-to-unlock";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import type { WheelPickerOption } from "~/components/ui/wheel-picker";
import { WheelPicker, WheelPickerWrapper } from "~/components/ui/wheel-picker";
import { useHapticFeedback } from "~/hooks/use-haptic-feedback";
import {
  CANVAS_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BITRATE,
  VIDEO_MIME_TYPE,
  VIDEO_CONTAINER_TYPE,
  VP9_CODEC,
  LEGACY_VP9_CODEC,
  DEFAULT_TIMER_FILENAME,
  TIMER_FPS,
  RECORDING_FPS,
} from "~/constants/timer";

// Create timer options for wheel picker
const createArray = (length: number, add = 0): WheelPickerOption[] =>
  Array.from({ length }, (_, i) => {
    const value = i + add;
    return {
      label: value.toString().padStart(2, "0"),
      value: value.toString(),
    };
  });

// Create options for minutes (0-59) and seconds (0-59)
const minuteOptions = createArray(60, 0); // 0-59 minutes
const secondOptions = createArray(60, 0); // 0-59 seconds

export function ClientTimerGenerator() {
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);
  const [showLottieSuccess, setShowLottieSuccess] = useState(false);
  const videoPreviewRef = useRef<HTMLDivElement>(null);
  const [_cacheInfo, setCacheInfo] = useState<{
    count: number;
    timers: number[];
    totalFrames: number;
  } | null>(null);

  // Debug mode for verbose logging (set to true for debugging iPhone issues)
  const DEBUG_MODE = typeof window !== 'undefined' && window.location.search.includes('debug=true');

  // Debug logging function
  const debugLog = (...args) => {
    if (DEBUG_MODE) {
      console.log('🐛 [DEBUG]', ...args);
    }
  };

  // Individual frame cache for incremental generation (main thread)
  // Key: remainingSeconds, Value: ImageData for that specific second
  const [individualFrameCache] = useState<Map<number, ImageData>>(new Map());

  // Legacy complete timer cache for backward compatibility
  const [frameCache] = useState<Map<number, ImageData[]>>(new Map());
  const [fontLoaded, setFontLoaded] = useState(false);
  const [fontBufferData, setFontBufferData] = useState<ArrayBuffer | null>(null);
  const [generatedFonts, setGeneratedFonts] = useState<{
    condensed: ArrayBuffer | null;
    normal: ArrayBuffer | null;
    extended: ArrayBuffer | null;
  }>({ condensed: null, normal: null, extended: null });

  // Haptic feedback
  const { impactOccurred, notificationOccurred } = useHapticFeedback();

  // Time formatting function (matches worker logic)
  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 60) {
      return seconds.toString(); // Keep current behavior for < 60s
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }, []);

  // Main thread text rendering for iOS (WebKit Web Worker font workaround)
  const renderTimerTextInMainThread = useCallback(async (text: string, fontSize: number, fontFamily: string): Promise<ImageData> => {
    console.log(`🍎 iOS: Rendering text "${text}" in main thread with font: ${fontFamily}`);

    // Ensure font is loaded in main thread
    await document.fonts.load(`${fontSize}px ${fontFamily}`);

    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D context for text rendering');
    }

    // Configure text rendering
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Clear canvas (transparent background)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw text
    ctx.fillText(text, 256, 256);

    console.log(`✅ iOS: Main thread text rendering completed for "${text}"`);
    return ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, []);

  // Load HeadingNow font as buffer for Web Worker transfer
  useEffect(() => {
    const loadHeadingNowFontBuffer = async () => {
      // Use platform adapter for unified platform detection
      const platformAdapter = getPlatformAdapter();
      const platformInfo = platformAdapter.getPlatformInfo();
      const capabilities = platformAdapter.getCapabilities();

      const deviceInfo = {
        userAgent: platformInfo.userAgent,
        isiPhone: platformInfo.isIOS && platformInfo.userAgent.includes('iPhone'),
        isiPad: platformInfo.isIOS && platformInfo.userAgent.includes('iPad'),
        isWebKit: platformInfo.isWebKit,
        isSafari: platformInfo.isSafari,
        platform: navigator.platform,
        vendor: navigator.vendor,
        isIOS: platformInfo.isIOS,
        capabilities,
        renderingStrategy: platformAdapter.getRenderingStrategy(),
        requiresWorkarounds: {
          iOS: platformAdapter.requiresIOSWorkarounds(),
          WebKit: platformAdapter.requiresWebKitWorkarounds()
        },
        debugMode: DEBUG_MODE
      };

      console.log("📱 Platform Adapter Detection:", deviceInfo);
      debugLog("📱 Extended Device Info:", {
        userAgentFull: platformInfo.userAgent,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink
        } : 'not available'
      });

      try {
        console.log("🔤 Loading HeadingNow font buffer for Web Worker transfer...");

        // Method 1: Load with Remotion for main thread usage
        console.log("🔤 Step 1: Loading font with Remotion for main thread...");
        await loadFont({
          family: "HeadingNowVariable",
          url: "/fonts/HeadingNowVariable-Regular.ttf",
          format: "truetype",
          weight: "100 1000",
          stretch: "ultra-condensed",
        });
        console.log("✅ Step 1: Remotion font loading completed");

        // Method 2: Load font as ArrayBuffer for Web Worker transfer
        console.log("🔤 Step 2: Fetching font as ArrayBuffer...");
        const fontResponse = await fetch("/fonts/HeadingNowVariable-Regular.ttf");
        if (!fontResponse.ok) {
          throw new Error(`Failed to fetch font: ${fontResponse.status}`);
        }

        const fontBufferData = await fontResponse.arrayBuffer();
        console.log(`✅ Step 2: Font buffer loaded: ${(fontBufferData.byteLength / 1024).toFixed(1)} KB`);

        // Debug: Test if FontFace API works in main thread
        console.log("🔤 Step 3: Testing FontFace API in main thread...");
        try {
          const testFontFace = new FontFace(
            "HeadingNowTest",
            fontBufferData
          );
          console.log("✅ FontFace constructor works in main thread");

          // Test if document.fonts.add works
          document.fonts.add(testFontFace);
          console.log("✅ document.fonts.add works in main thread");

          // Test font loading
          await testFontFace.load();
          console.log("✅ FontFace.load works in main thread");
        } catch (fontError) {
          console.warn("⚠️ FontFace API test failed in main thread:", fontError);
        }

        // Store original font buffer data for multiple transfers
        setFontBufferData(fontBufferData);
        setFontLoaded(true);
        console.log("✅ HeadingNow font buffer data ready for Web Worker transfer!");

        // iOS: Use pre-generated static fonts for proper width control
        if (platformInfo.isIOS) {
          console.log("🍎 iOS Device Detected - Using pre-generated static fonts for Web Worker compatibility...");

          try {
            // Load pre-generated static fonts
            const fontPromises = [
              fetch('/fonts/generated/HeadingNowCondensed.ttf'),
              fetch('/fonts/generated/HeadingNowNormal.ttf'),
              fetch('/fonts/generated/HeadingNowExtended.ttf')
            ];

            const fontResponses = await Promise.all(fontPromises);

            // Convert to ArrayBuffers
            const [condensedResponse, normalResponse, extendedResponse] = fontResponses;

            if (!condensedResponse.ok || !normalResponse.ok || !extendedResponse.ok) {
              throw new Error('Failed to fetch pre-generated fonts');
            }

            const [
              condensedBuffer,
              normalBuffer,
              extendedBuffer
            ] = await Promise.all([
              condensedResponse.arrayBuffer(),
              normalResponse.arrayBuffer(),
              extendedResponse.arrayBuffer()
            ]);

            console.log("🍎 iOS: Loaded pre-generated fonts:", {
              condensed: `${(condensedBuffer.byteLength / 1024).toFixed(1)} KB`,
              normal: `${(normalBuffer.byteLength / 1024).toFixed(1)} KB`,
              extended: `${(extendedBuffer.byteLength / 1024).toFixed(1)} KB`
            });

            // Store generated fonts for Web Worker transfer
            setGeneratedFonts({
              condensed: condensedBuffer,
              normal: normalBuffer,
              extended: extendedBuffer
            });

            console.log("✅ iOS: Pre-generated static fonts loaded for Web Worker access");
          } catch (fontError) {
            console.warn("⚠️ iOS: Pre-generated font loading failed:", fontError);
            console.log("🔄 iOS: Falling back to original font buffer for Web Worker...");
          }

          console.log("🍎 iOS Device Detected - Font Loading Summary:", {
            fontLoaded: true,
            bufferSize: `${(fontBufferData.byteLength / 1024).toFixed(1)} KB`,
            isWebKit: platformInfo.isWebKit,
            isSafari: platformInfo.isSafari,
            readyForWebWorker: true,
            fontsRegisteredInMainThread: true,
            webWorkerShouldUseMainThreadFonts: true
          });
        }

        // Original iOS code (commented out for testing):
        // iOS: Use pre-generated static fonts for proper width control
        /* Commented out for Google Fonts test
        if (platformInfo.isIOS) {
          console.log("🍎 iOS Device Detected - Using pre-generated static fonts for Web Worker compatibility...");

          try {
            // Load pre-generated static fonts
            const fontPromises = [
              fetch('/fonts/generated/HeadingNowCondensed.ttf'),
              fetch('/fonts/generated/HeadingNowNormal.ttf'),
              fetch('/fonts/generated/HeadingNowExtended.ttf')
            ];

            const fontResponses = await Promise.all(fontPromises);

            // Convert to ArrayBuffers
            const [condensedResponse, normalResponse, extendedResponse] = fontResponses;

            if (!condensedResponse.ok || !normalResponse.ok || !extendedResponse.ok) {
              throw new Error('Failed to fetch pre-generated fonts');
            }

            const [
              condensedBuffer,
              normalBuffer,
              extendedBuffer
            ] = await Promise.all([
              condensedResponse.arrayBuffer(),
              normalResponse.arrayBuffer(),
              extendedResponse.arrayBuffer()
            ]);

            console.log("🍎 iOS: Loaded pre-generated fonts:", {
              condensed: `${(condensedBuffer.byteLength / 1024).toFixed(1)} KB`,
              normal: `${(normalBuffer.byteLength / 1024).toFixed(1)} KB`,
              extended: `${(extendedBuffer.byteLength / 1024).toFixed(1)} KB`
            });

            // Store font buffers for Web Worker transfer
            setGeneratedFonts({
              condensed: condensedBuffer,
              normal: normalBuffer,
              extended: extendedBuffer
            });

            console.log("✅ iOS: Pre-generated static fonts loaded for Web Worker access");
          } catch (fontError) {
            console.warn("⚠️ iOS: Pre-generated font loading failed:", fontError);
            console.log("🔄 iOS: Falling back to original font buffer for Web Worker...");
          }

          console.log("🍎 iOS Device Detected - Font Loading Summary:", {
            fontLoaded: true,
            bufferSize: `${(fontBufferData.byteLength / 1024).toFixed(1)} KB`,
            isWebKit: platformInfo.isWebKit,
            isSafari: platformInfo.isSafari,
            readyForWebWorker: true,
            fontsRegisteredInMainThread: true,
            webWorkerShouldUseMainThreadFonts: true
          });
        } */
      } catch (error) {
        console.error("❌ Failed to load HeadingNow font buffer:", error);
        setFontLoaded(false);
        setFontBufferData(null);

        // iOS-specific error logging
        const platformAdapter = getPlatformAdapter();
        const platformInfo = platformAdapter.getPlatformInfo();
        if (platformInfo.isIOS) {
          console.error("🍎 iOS Font Loading Failed - Debug Info:", {
            error: error instanceof Error ? error.message : String(error),
            isWebKit: platformInfo.isWebKit,
            isSafari: platformInfo.isSafari,
            fallbackNeeded: true
          });
        }
      }
    };

    loadHeadingNowFontBuffer();
  }, []);

  // Play unlock sound
  const playUnlockSound = () => {
    try {
      const audio = new Audio("/audio/unlock.wav");
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Silently fail if audio play is blocked by browser
      });
    } catch (_error) {
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
    console.log("🔧 Minutes changed:", { newMinutes, oldMinutes: minutes });
    setMinutes(newMinutes);
  };

  // Handle seconds value change
  const handleSecondsChange = (value: string) => {
    const newSeconds = parseInt(value, 10) || 0;
    console.log("🔧 Seconds changed:", { newSeconds, oldSeconds: seconds });
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
    console.log("🎯 Generating timer:", {
      minutes,
      seconds,
      totalSeconds: currentTimerSeconds,
    });

    try {
      const startTime = performance.now();
      const fps = 1;
      const duration = currentTimerSeconds + 1;
      const totalFrames = fps * duration;
      const workerId = Date.now();

      // Check incremental cache first for smart generation
      const cacheAnalysis = analyzeFrameCache(currentTimerSeconds);

      // Check if we can assemble complete timer from incremental cache
      if (cacheAnalysis.cacheHitRate === 1.0) {
        console.log(
          `🎯 INCREMENTAL CACHE HIT: Assembling complete ${currentTimerSeconds}s timer from individual frames`,
        );

        try {
          const cachedFrames = assembleCompleteTimer(currentTimerSeconds);

          console.log(`✅ Complete timer assembled from incremental cache in ${((performance.now() - startTime).toFixed(2))}ms`);

          const videoBlob = await encodeFramesToVideoInstantly(
            cachedFrames,
            fps,
            setProgress,
          );

          const endTime = performance.now();
          const totalTime = endTime - startTime;
          const url = URL.createObjectURL(videoBlob);
          setVideoBlob(videoBlob);
          setVideoUrl(url);

          console.log(`✅ WebM sticker generated from incremental cache!`, {
            duration: `${duration}s`,
            totalTime: `${totalTime.toFixed(2)}ms`,
            size: `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`,
            type: videoBlob.type,
            fromCache: true,
            cacheType: "incremental"
          });

          const fileSizeMB = videoBlob.size / 1024 / 1024;
          if (fileSizeMB > 50) {
            alert(
              `⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`,
            );
          }

          setIsGenerating(false);
          setProgress(0);
          return;
        } catch (error) {
          console.error("Failed to assemble timer from incremental cache:", error);
          // Fall through to worker generation
        }
      } else if (cacheAnalysis.cacheHitRate > 0) {
        console.log(
          `🔄 PARTIAL CACHE HIT: ${cacheAnalysis.cachedCount}/${cacheAnalysis.totalRequired} frames available (${(cacheAnalysis.cacheHitRate * 100).toFixed(1)}% cache hit rate)`,
        );
        console.log(
          `⚡ Will only generate ${cacheAnalysis.needGeneration} missing frames instead of ${cacheAnalysis.totalRequired}`,
        );
      }

      // Check for bidirectional legacy cache (longer cached timer that contains our frames)
      if (cacheAnalysis.legacyCacheHit) {
        console.log(
          `🎯 BIDIRECTIONAL CACHE HIT: Using subset from ${cacheAnalysis.legacyCacheHit.duration}s cache for ${currentTimerSeconds}s timer`,
        );

        try {
          const cachedFrames = extractLegacyCacheSubset(cacheAnalysis.legacyCacheHit, currentTimerSeconds);

          console.log(`✅ Timer extracted from bidirectional cache in ${((performance.now() - startTime).toFixed(2))}ms`);

          const videoBlob = await encodeFramesToVideoInstantly(
            cachedFrames,
            fps,
            setProgress,
          );

          const endTime = performance.now();
          const totalTime = endTime - startTime;
          const url = URL.createObjectURL(videoBlob);
          setVideoBlob(videoBlob);
          setVideoUrl(url);

          console.log(`✅ WebM sticker generated from bidirectional cache!`, {
            duration: `${duration}s`,
            totalTime: `${totalTime.toFixed(2)}ms`,
            size: `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`,
            type: videoBlob.type,
            fromCache: true,
            cacheType: "bidirectional-legacy",
            sourceCache: `${cacheAnalysis.legacyCacheHit.duration}s`,
            extractedFrames: cachedFrames.length
          });

          const fileSizeMB = videoBlob.size / 1024 / 1024;
          if (fileSizeMB > 50) {
            alert(
              `⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`,
            );
          }

          setIsGenerating(false);
          setProgress(0);
          return;
        } catch (error) {
          console.error("Failed to extract timer from bidirectional cache:", error);
          // Fall through to worker generation
        }
      }

      // Fall back to legacy cache check for backward compatibility
      if (frameCache.has(currentTimerSeconds)) {
        console.log(
          `🎯 LEGACY CACHE HIT: Using cached frames for ${currentTimerSeconds}s timer`,
        );

        const cachedFrames = frameCache.get(currentTimerSeconds)!;

        const videoBlob = await encodeFramesToVideoInstantly(
          cachedFrames,
          fps,
          setProgress,
        );

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const url = URL.createObjectURL(videoBlob);
        setVideoBlob(videoBlob);
        setVideoUrl(url);

        console.log(`✅ WebM sticker generated from legacy cache!`, {
          duration: `${duration}s`,
          totalTime: `${totalTime.toFixed(2)}ms`,
          size: `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`,
          type: videoBlob.type,
          fromCache: true,
          cacheType: "legacy"
        });

        const fileSizeMB = videoBlob.size / 1024 / 1024;
        if (fileSizeMB > 50) {
          alert(
            `⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`,
          );
        }

        setIsGenerating(false);
        setProgress(0);
        return;
      }

      console.log(
        `🚀 Starting ${currentTimerSeconds}s timer generation with Web Worker + MediaRecorder API...`,
      );

      // Simple progress update function
      const updateProgress = (newProgress: number) => {
        setProgress(newProgress);
      };

      // Create Web Worker for frame generation
      console.log("👷 Creating Web Worker for frame generation...");

      // Simple worker creation - Turbopack warnings are cosmetic, functionality works
      const worker = new window.Worker("/timer-worker.js");
      console.log("✅ Web Worker created successfully", { workerMethod: "Direct Worker instantiation" });

      // Debug: Add iOS-specific Web Worker logging
      const _platformAdapter = getPlatformAdapter();
      const platformInfo = _platformAdapter.getPlatformInfo();
      if (platformInfo.isIOS) {
        console.log("🍎 iOS Web Worker Debug Info:", {
          workerCreated: true,
          workerMethod: "Next.js worker import",
          supportExpected: "Limited FontFace API in Web Worker",
          fallbackWillBeUsed: "Likely"
        });
      }

      // Create canvas for video recording
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d", {
        alpha: true,
        desynchronized: true,
        willReadFrequently: false,
      });

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Set up MediaRecorder with optimized settings
      const stream = canvas.captureStream(RECORDING_FPS); // Higher fps for fast generation
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: VIDEO_MIME_TYPE,
        videoBitsPerSecond: BITRATE,
      });

      const chunks: Blob[] = [];
      const _currentFrameIndex = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const blob = new Blob(chunks, { type: VIDEO_CONTAINER_TYPE });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);

        console.log(`✅ WebM sticker generated successfully!`, {
          duration: `${duration}s`,
          totalTime: `${totalTime.toFixed(2)}ms`,
          fps: (totalFrames / (totalTime / 1000)).toFixed(1),
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
          efficiency: `${((blob.size / 1024 / totalTime) * 1000).toFixed(2)} KB/s`,
          type: blob.type,
        });

        // Check file size
        const fileSizeMB = blob.size / 1024 / 1024;
        if (fileSizeMB > 50) {
          toast.warning(
            `Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`,
          );
        }

        worker.terminate();
        setIsGenerating(false);
        setProgress(0);
      };

      // Handle messages from worker
      worker.onmessage = async (e) => {
        const { type } = e.data;
        console.log("📨 Worker message received:", { type, data: e.data });

        if (type === "progress") {
          updateProgress(e.data.progress);
        } else if (type === "complete") {
          const { isPartialGeneration, generatedFrameNumbers } = e.data;

          if (isPartialGeneration) {
            console.log(
              `🧩 PARTIAL GENERATION: Generated ${e.data.frames.length} frames for ${currentTimerSeconds}s timer (frames: ${generatedFrameNumbers.join(', ')})`,
            );

            // Store the newly generated individual frames
            e.data.frames.forEach((frame: ImageData, index: number) => {
              const frameNumber = generatedFrameNumbers[index];
              const remainingSeconds = Math.max(0, currentTimerSeconds - frameNumber);
              individualFrameCache.set(remainingSeconds, frame);
            });

            console.log(`💾 Stored ${e.data.frames.length} new individual frames in incremental cache`);

            // Assemble complete timer from cached + new frames
            const completeFrames = assembleCompleteTimer(currentTimerSeconds);

            // Cache complete timer in legacy cache for backward compatibility
            frameCache.set(currentTimerSeconds, completeFrames);
            console.log(`💾 Cached complete ${currentTimerSeconds}s timer in legacy cache (${completeFrames.length} frames)`);

            // Update cache info
            updateCacheInfo();

            console.log(`🔧 Assembled complete ${currentTimerSeconds}s timer from ${cacheAnalysis.cachedCount} cached + ${e.data.frames.length} new frames`);

            // Encode the complete timer
            try {
              console.log("🚀 Using Mediabunny for instant encoding of assembled timer...");
              const videoBlob = await encodeFramesToVideoInstantly(
                completeFrames,
                fps,
                updateProgress,
              );

              const endTime = performance.now();
              const totalTime = endTime - startTime;
              const url = URL.createObjectURL(videoBlob);
              setVideoBlob(videoBlob);
              setVideoUrl(url);

              console.log(`✅ WebM sticker generated from partial cache!`, {
                duration: `${duration}s`,
                totalTime: `${totalTime.toFixed(2)}ms`,
                size: `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`,
                type: videoBlob.type,
                fromCache: false,
                cacheType: "partial-incremental",
                cachedFrames: cacheAnalysis.cachedCount,
                newFrames: e.data.frames.length
              });

              const fileSizeMB = videoBlob.size / 1024 / 1024;
              if (fileSizeMB > 50) {
                alert(
                  `⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`,
                );
              }

              worker.terminate();
              setIsGenerating(false);
              setProgress(0);
              return;
            } catch (error) {
              console.error(
                "Mediabunny failed for assembled timer, falling back to MediaRecorder:",
                error,
              );

              // Fall back to MediaRecorder with complete frames
              if (mediaRecorder.state !== "recording") {
                mediaRecorder.start();
              }

              let frameIndex = 0;
              const playFrame = () => {
                if (frameIndex >= completeFrames.length) {
                  setTimeout(() => mediaRecorder.stop(), 200);
                  return;
                }

                ctx.putImageData(completeFrames[frameIndex], 0, 0);
                frameIndex++;

                const progressPercent = Math.round(
                  (frameIndex / completeFrames.length) * 100,
                );
                setProgress(progressPercent);

                if (frameIndex < completeFrames.length) {
                  setTimeout(playFrame, 1000);
                }
              };

              playFrame();
              return;
            }
          } else {
            // Full generation (existing logic)
            console.log(
              `🆕 FRESH FRAMES: Starting video encoding for new ${currentTimerSeconds}s timer`,
            );
            console.log(
              `🔨 Generated fresh ${currentTimerSeconds}s timer (now cached)`,
            );

            // Cache the frames in main thread (legacy)
            frameCache.set(currentTimerSeconds, e.data.frames);
            console.log(
              `💾 Cached frames for ${currentTimerSeconds}s timer in main thread (${e.data.frames.length} frames)`,
            );

            // Store individual frames for incremental cache
            storeIndividualFrames(e.data.frames, currentTimerSeconds);

            // Update cache info
            updateCacheInfo();

            // INSTANT generation with Mediabunny - like Premiere Pro!
            try {
              console.log("🚀 Using Mediabunny for instant encoding...");
              const videoBlob = await encodeFramesToVideoInstantly(
                e.data.frames,
                fps,
                updateProgress,
              );

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
                fromCache: false,
              });

              const fileSizeMB = videoBlob.size / 1024 / 1024;
              if (fileSizeMB > 50) {
                alert(
                  `⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`,
                );
              }

              worker.terminate();
              setIsGenerating(false);
              setProgress(0);
              return;
            } catch (error) {
              console.error(
                "Mediabunny failed, falling back to MediaRecorder:",
                error,
              );

              // Fallback to MediaRecorder (will take longer but works)
              if (mediaRecorder.state !== "recording") {
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

                const progressPercent = Math.round(
                  (frameIndex / e.data.frames.length) * 100,
                );
                setProgress(progressPercent);

                if (frameIndex < e.data.frames.length) {
                  setTimeout(playFrame, 1000);
                }
              };

              playFrame();
            }
          }
          try {
            console.log("🚀 Using Mediabunny for instant encoding...");
            const videoBlob = await encodeFramesToVideoInstantly(
              e.data.frames,
              fps,
              updateProgress,
            );

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
              fromCache: false,
            });

            const fileSizeMB = videoBlob.size / 1024 / 1024;
            if (fileSizeMB > 50) {
              alert(
                `⚠️ Sticker is too large for Telegram (${fileSizeMB.toFixed(1)} MB). Try generating a shorter version.`,
              );
            }

            worker.terminate();
            setIsGenerating(false);
            setProgress(0);
            return;
          } catch (error) {
            console.error(
              "Mediabunny failed, falling back to MediaRecorder:",
              error,
            );

            // Fallback to MediaRecorder (will take longer but works)
            if (mediaRecorder.state !== "recording") {
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

              const progressPercent = Math.round(
                (frameIndex / e.data.frames.length) * 100,
              );
              updateProgress(progressPercent);

              if (frameIndex < e.data.frames.length) {
                setTimeout(playFrame, 1000);
              }
            };

            playFrame();
          }
        } else if (type === "error") {
          throw new Error(e.data.error);
        }
      };

      // Start recording before frame generation
      mediaRecorder.start();

      // Check if we need to use iOS main thread rendering
      const platformAdapter = getPlatformAdapter();
      const isIOS = platformAdapter.getPlatformInfo().isIOS;
      let preRenderedTexts: ImageData[] = null;

      if (isIOS) {
        console.log("🍎 iOS Detected: Using main thread text rendering approach");

        // Pre-render all text frames in main thread for iOS
        preRenderedTexts = [];
        for (let frame = 0; frame < currentTimerSeconds + 1; frame++) {
          const remainingSeconds = Math.max(0, currentTimerSeconds - frame);
          const timeText = formatTime(remainingSeconds);

          // Determine font family based on time
          let fontFamily;
          if (remainingSeconds <= 9) {
            fontFamily = 'HeadingNowCondensed';
          } else if (remainingSeconds < 60) {
            fontFamily = 'HeadingNowNormal';
          } else {
            fontFamily = 'HeadingNowExtended';
          }

          const textImageData = await renderTimerTextInMainThread(timeText, CANVAS_SIZE, fontFamily);
          preRenderedTexts.push(textImageData);
        }

        console.log(`✅ iOS: Pre-rendered ${preRenderedTexts.length} text frames in main thread`);
      }

      // Send timer generation request to worker with font buffers
      let fontBufferForTransfer = null;
      let generatedFontBuffers = null;

      // For non-iOS, use generated static fonts
      if (!isIOS && generatedFonts.condensed && generatedFonts.normal && generatedFonts.extended) {
        generatedFontBuffers = {
          condensed: generatedFonts.condensed.slice(0),
          normal: generatedFonts.normal.slice(0),
          extended: generatedFonts.extended.slice(0)
        };
        console.log(`🔤 Non-iOS: Created fresh generated font buffers for transfer:`, {
          condensed: `${(generatedFontBuffers.condensed.byteLength / 1024).toFixed(1)} KB`,
          normal: `${(generatedFontBuffers.normal.byteLength / 1024).toFixed(1)} KB`,
          extended: `${(generatedFontBuffers.extended.byteLength / 1024).toFixed(1)} KB`
        });
      }
      // For non-iOS, use original font buffer
      else if (!isIOS && fontBufferData) {
        fontBufferForTransfer = fontBufferData.slice(0); // Create a copy
        console.log(`🔤 Non-iOS: Created fresh font buffer for transfer: ${(fontBufferForTransfer.byteLength / 1024).toFixed(1)} KB`);
      }
      // iOS: Don't send any font buffers - use pre-rendered text only
      else if (isIOS) {
        console.log(`🍎 iOS: Skipping font buffer transfer - using pre-rendered text approach`);
      }

      const message = {
        action: "generate",
        timerSeconds: currentTimerSeconds,
        workerId,
        fontLoaded: fontLoaded,
        fontBuffer: fontBufferForTransfer,
        generatedFonts: generatedFontBuffers,
        preRenderedTexts: preRenderedTexts,
        isIOS: isIOS,
        debugMode: DEBUG_MODE,
        framesToGenerate: cacheAnalysis.needGeneration > 0 ? cacheAnalysis.framesToGenerate : undefined,
      };

      console.log("📤 Sending message to worker:", {
        action: message.action,
        timerSeconds: message.timerSeconds,
        fontLoaded: message.fontLoaded,
        hasFontBuffer: !!message.fontBuffer,
        hasGeneratedFonts: !!message.generatedFonts,
        hasPreRenderedTexts: !!message.preRenderedTexts,
        preRenderedTextsCount: message.preRenderedTexts ? message.preRenderedTexts.length : 0,
        isIOS: message.isIOS,
        bufferSize: message.fontBuffer ? `${(message.fontBuffer.byteLength / 1024).toFixed(1)} KB` : 'none',
        generatedFontsSize: message.generatedFonts ? {
          condensed: `${(message.generatedFonts.condensed.byteLength / 1024).toFixed(1)} KB`,
          normal: `${(message.generatedFonts.normal.byteLength / 1024).toFixed(1)} KB`,
          extended: `${(message.generatedFonts.extended.byteLength / 1024).toFixed(1)} KB`
        } : 'none',
        isiPhone: platformAdapter.getPlatformInfo().isIOS && platformAdapter.getPlatformInfo().userAgent.includes('iPhone'),
        isWebKit: platformAdapter.getPlatformInfo().isWebKit
      });

      // iOS: Send pre-rendered texts directly (no font buffers needed)
      if (isIOS && preRenderedTexts) {
        console.log("🍎 iOS: Sending message with pre-rendered texts (no font buffers)");
        worker.postMessage(message);
        console.log(`✅ iOS: Pre-rendered texts sent to worker (${preRenderedTexts.length} frames)`);
      } else if (generatedFontBuffers) {
        console.log("🔤 Non-iOS: Embedding generated font buffers directly in message...");
        worker.postMessage(message);
        console.log(`✅ Non-iOS: Generated font buffers sent directly in message`);
      } else if (fontBufferForTransfer) {
        console.log("🚚 Adding font buffer to transfer list");
        worker.postMessage(message, [fontBufferForTransfer]);
        console.log(`✅ Font buffer transferred to worker`);
      } else {
        console.log("📤 Sending message to worker without font data");
        worker.postMessage(message);
      }
    } catch (error) {
      console.error("Error generating timer sticker:", error);
      alert(
        `Failed to generate timer sticker: ${error instanceof Error ? error.message : String(error)}`,
      );
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const _encodeFramesToVideoWithWebCodecs = async (
    frames: ImageData[],
    fps: number,
    onProgress: (progress: number) => void,
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        // Check WebCodecs support
        if (typeof VideoEncoder === "undefined") {
          throw new Error("WebCodecs API not supported in this browser");
        }

        const chunks: Uint8Array[] = [];
        const frameDuration = 1000000 / fps; // microseconds per frame (1 second = 1,000,000 microseconds)
        let frameIndex = 0;

        const encoder = new VideoEncoder({
          output: (chunk, _metadata) => {
            chunks.push(chunk);
            onProgress(Math.round(((frameIndex + 1) / frames.length) * 100));

            if (frameIndex === frames.length - 1) {
              // All frames encoded, create blob
              const blob = new Blob(chunks, { type: VIDEO_MIME_TYPE });
              resolve(blob);
            }
          },
          error: (error) => {
            reject(error);
          },
        });

        // Configure encoder for VP9 with transparency support (sticker format)
        encoder.configure({
          codec: LEGACY_VP9_CODEC, // VP9 with alpha support
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          bitrate: BITRATE, // 500kbps
          framerate: fps,
          latencyMode: "realtime",
          // Alpha channel settings for stickers
          alphaMode: "keep", // Preserve transparency
          hardwareAcceleration: "prefer-hardware", // Allow hardware acceleration
        });

        // Encode all frames with correct timestamps
        for (let i = 0; i < frames.length; i++) {
          // Convert ImageData to VideoFrame with alpha channel support
          const canvas = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
          const ctx = canvas.getContext("2d");

          // Clear canvas to ensure transparency
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          // Put image data with alpha channel
          ctx.putImageData(frames[i], 0, 0);

          const frame = new VideoFrame(canvas, {
            timestamp: i * frameDuration, // microseconds
            duration: frameDuration,
            alpha: "keep", // Preserve alpha channel
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

  const _clearCache = async () => {
    try {
      const cacheSize = frameCache.size;
      frameCache.clear();
      setCacheInfo(null);
      console.log(`🗑️ Main thread cache cleared! Removed ${cacheSize} timer(s)`);
      console.log(`🗑️ Cache cleared! Removed ${cacheSize} timer(s)`);
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  };

  const updateCacheInfo = useCallback(() => {
    const cacheKeys = Array.from(frameCache.keys()).sort((a, b) => a - b);
    const totalFrames = Array.from(frameCache.values()).reduce(
      (sum, frames) => sum + frames.length,
      0,
    );
    const info = {
      count: frameCache.size,
      timers: cacheKeys,
      totalFrames,
    };
    setCacheInfo(info);
    console.log("📊 Main thread cache info:", info);
  }, [frameCache]);

  const getCacheInfo = useCallback(async () => {
    try {
      updateCacheInfo();
    } catch (error) {
      console.error("Error getting cache info:", error);
    }
  }, [updateCacheInfo]);

  // Incremental cache helper functions
  const analyzeFrameCache = useCallback((targetDuration: number) => {
    const frames = [];
    const framesToGenerate = [];

    // Check individual frame cache first (bidirectional)
    for (let remainingSeconds = 0; remainingSeconds <= targetDuration; remainingSeconds++) {
      if (individualFrameCache.has(remainingSeconds)) {
        frames.push({
          remainingSeconds,
          frameData: individualFrameCache.get(remainingSeconds)!,
          cached: true
        });
      } else {
        framesToGenerate.push(remainingSeconds);
      }
    }

    const cachedCount = frames.length;
    const totalRequired = targetDuration + 1;
    const needGeneration = framesToGenerate.length;

    // Check for bidirectional legacy cache opportunities
    const legacyCacheHit = checkLegacyCacheSubset(targetDuration);

    console.log(`🔍 Bidirectional Cache Analysis for ${targetDuration}s timer:`, {
      totalRequired,
      cached: cachedCount,
      needGeneration,
      cacheHitRate: `${((cachedCount / totalRequired) * 100).toFixed(1)}%`,
      timeSaved: `${((cachedCount / totalRequired) * 100).toFixed(1)}%`,
      individualFrameCache: `${cachedCount} frames`,
      legacyCacheHit: legacyCacheHit ? `Yes (${legacyCacheHit.duration}s cache)` : 'No'
    });

    return {
      frames,
      framesToGenerate,
      cachedCount,
      needGeneration,
      totalRequired,
      cacheHitRate: cachedCount / totalRequired,
      legacyCacheHit
    };
  }, [individualFrameCache]);

  const checkLegacyCacheSubset = useCallback((targetDuration: number) => {
    // Find any cached timer that contains the frames we need
    const availableCachedTimers = Array.from(frameCache.keys())
      .filter(duration => duration >= targetDuration);

    if (availableCachedTimers.length === 0) {
      return null;
    }

    // Use the shortest cached timer that still contains our target
    const suitableCache = Math.min(...availableCachedTimers);
    console.log(`🎯 Found suitable legacy cache: ${suitableCache}s timer for ${targetDuration}s target`);

    return {
      duration: suitableCache,
      sourceFrames: frameCache.get(suitableCache)!,
      subsetStart: suitableCache - targetDuration,
      subsetEnd: suitableCache
    };
  }, [frameCache]);

  const extractLegacyCacheSubset = useCallback((cacheHit: any, targetDuration: number) => {
    const { sourceFrames, subsetStart, subsetEnd } = cacheHit;

    // Extract the relevant frames from the longer cached timer
    const subset = sourceFrames.slice(subsetStart, subsetEnd + 1);

    console.log(`✂️ Extracting ${subset.length} frames from ${cacheHit.duration}s cache for ${targetDuration}s timer`);
    console.log(`📊 Subset range: frames ${subsetStart}-${subsetEnd} (total: ${subset.length})`);

    return subset;
  }, []);

  const storeIndividualFrames = useCallback((frames: ImageData[], startSeconds: number) => {
    let storedCount = 0;
    frames.forEach((frame, index) => {
      const remainingSeconds = startSeconds - index;
      if (remainingSeconds >= 0) {
        individualFrameCache.set(remainingSeconds, frame);
        storedCount++;
      }
    });
    console.log(`💾 Stored ${storedCount} individual frames in incremental cache`);
  }, [individualFrameCache]);

  const assembleCompleteTimer = useCallback((targetDuration: number) => {
    const completeFrames: ImageData[] = [];

    // Build complete timer from highest duration down to 0
    for (let remainingSeconds = targetDuration; remainingSeconds >= 0; remainingSeconds--) {
      const frame = individualFrameCache.get(remainingSeconds);
      if (frame) {
        completeFrames.push(frame);
      } else {
        console.error(`❌ Missing frame for ${remainingSeconds}s in incremental cache assembly`);
        throw new Error(`Missing frame for ${remainingSeconds}s in cache`);
      }
    }

    console.log(`🔧 Assembled complete ${targetDuration}s timer from incremental cache (${completeFrames.length} frames)`);
    return completeFrames;
  }, [individualFrameCache]);

  const encodeFramesToVideoInstantly = async (
    frames: ImageData[],
    _fps: number,
    onProgress: (progress: number) => void,
  ): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(
          "🚀 Using Mediabunny with Telegram-compatible VP9 settings...",
        );

        // Create canvas with transparency support
        const canvas = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);

        // Create CanvasSource with Telegram-compatible VP9 + alpha settings
        // Using specific codec string and alpha preservation for sticker compatibility
        const canvasSource = new CanvasSource(canvas, {
          codec: "vp9",
          bitrate: BITRATE, // Same bitrate as working MediaRecorder
          alpha: "keep", // Preserve alpha channel for Telegram stickers (like -pix_fmt yuva420p)
          fullCodecString: VP9_CODEC, // VP9 codec with alpha support (similar to libvpx-vp9 settings)
        });

        // Create Output with WebM format for Telegram compatibility
        const output = new Output({
          format: new WebMOutputFormat(),
          target: new BufferTarget(),
        });

        // Connect CanvasSource to Output (correct pattern)
        output.addVideoTrack(canvasSource);

        // Start the output pipeline
        await output.start();

        // Add all frames instantly with precise TIMER_FPS timing (like Premiere Pro)
        for (let i = 0; i < frames.length; i++) {
          const timestamp = i * 1.0; // 0, 1, 2, 3... seconds for TIMER_FPS content
          const duration = 1.0; // Each frame lasts exactly 1 second

          // Draw frame to canvas with alpha channel
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Could not get canvas context");
          }

          // Clear canvas to ensure transparency
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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
        const blob = new Blob([buffer], { type: VIDEO_MIME_TYPE });

        console.log(`✅ Video encoded instantly with Mediabunny!`, {
          duration: `${frames.length}s`, // 1fps = frames.length seconds
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
          type: blob.type,
          fps: TIMER_FPS,
          frameCount: frames.length,
          telegramCompatible: true,
          codec: "VP9 with alpha (vp09.00.31.08)",
          transparencyEnabled: true,
        });

        resolve(blob);
      } catch (error) {
        console.error("Mediabunny encoding failed:", error);
        reject(error);
      }
    });
  };

  const sendToTelegram = async () => {
    if (!videoBlob) return;

    // Play unlock sound and haptic feedback
    playUnlockSound();
    impactOccurred("medium");

    setIsSendingToTelegram(true);
    try {
      // Debug: Log blob details before conversion
      console.log("🔍 Blob details before conversion:", {
        size: videoBlob.size,
        type: videoBlob.type,
        isClosed: (videoBlob as { closed?: boolean }).closed || false,
      });

      // Convert blob to base64 for API upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // Debug: Log base64 conversion results
        console.log("🔍 Base64 conversion results:", {
          originalBlobSize: videoBlob.size,
          base64DataLength: base64data.length,
          base64Prefix: `${base64data.substring(0, 50)}...`,
          mimeType: base64data.split(";")[0]?.split(":")[1] || "unknown",
        });

        const response = await fetch("/api/send-to-telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video: base64data,
            filename: DEFAULT_TIMER_FILENAME,
            caption: `🕐 ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s countdown timer sticker - ${getTotalSeconds() + 1} seconds`,
          }),
        });

        if (response.ok) {
          notificationOccurred("success");
          setShowLottieSuccess(true);
        } else {
          const error = await response.json();
          toast.error(`Failed to send to Telegram: ${error.message}`);
        }
      };

      reader.onerror = (error) => {
        console.error("🔍 FileReader error:", error);
        toast.error("Failed to read video file for upload");
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
  }, [getCacheInfo]);

  // Smooth autoscroll to video preview when video is generated
  useEffect(() => {
    if (videoUrl && videoPreviewRef.current) {
      const scrollToVideo = () => {
        videoPreviewRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      };

      // Small delay to ensure the video preview is rendered
      setTimeout(scrollToVideo, 100);
    }
  }, [videoUrl]);

  return (
    <div className="w-full max-w-sm mx-auto p-4 space-y-6">
      {/* Timer Selection */}
      <div className="w-full">
        <div className="text-center space-y-4">
          <WheelPickerWrapper glow={isGenerating} progress={progress}>
            <WheelPicker
              options={minuteOptions}
              value={minutes.toString()}
              onValueChange={handleMinutesChange}
              classNames={{
                highlightWrapper:
                  "bg-[#ff197c] text-white shadow-xl border-0 rounded-l-xl rounded-r-none font-bold text-xl",
                optionItem:
                  "text-zinc-400 dark:text-zinc-500 font-semibold text-lg",
              }}
            />
            <WheelPicker
              options={secondOptions}
              value={seconds.toString()}
              onValueChange={handleSecondsChange}
              classNames={{
                highlightWrapper:
                  "bg-[#ff197c] text-white shadow-xl border-0 rounded-l-none rounded-r-xl font-bold text-xl",
                optionItem:
                  "text-zinc-400 dark:text-zinc-500 font-semibold text-lg",
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
      {isGenerating && <Progress value={progress} className="h-2" />}

      {/* Video Preview */}
      {videoUrl && (
        <div ref={videoPreviewRef} className="space-y-4">
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
                    <svg
                      stroke="currentColor"
                      fill="currentColor"
                      strokeWidth="0"
                      viewBox="0 0 24 24"
                      className="size-5"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M2.14753 11.8099C7.3949 9.52374 10.894 8.01654 12.6447 7.28833C17.6435 5.20916 18.6822 4.84799 19.3592 4.83606C19.5081 4.83344 19.8411 4.87034 20.0567 5.04534C20.2388 5.1931 20.2889 5.39271 20.3129 5.5328C20.3369 5.6729 20.3667 5.99204 20.343 6.2414C20.0721 9.08763 18.9 15.9947 18.3037 19.1825C18.0514 20.5314 17.5546 20.9836 17.0736 21.0279C16.0283 21.1241 15.2345 20.3371 14.2221 19.6735C12.6379 18.635 11.7429 17.9885 10.2051 16.9751C8.42795 15.804 9.58001 15.1603 10.5928 14.1084C10.8579 13.8331 15.4635 9.64397 15.5526 9.26395C15.5637 9.21642 15.5741 9.03926 15.4688 8.94571C15.3636 8.85216 15.2083 8.88415 15.0962 8.9096C14.9373 8.94566 12.4064 10.6184 7.50365 13.928C6.78528 14.4212 6.13461 14.6616 5.55163 14.649C4.90893 14.6351 3.67265 14.2856 2.7536 13.9869C1.62635 13.6204 0.730432 13.4267 0.808447 12.8044C0.849081 12.4803 1.29544 12.1488 2.14753 11.8099Z"></path>
                    </svg>
                  )}
                </SlideToUnlockHandle>
              </SlideToUnlockTrack>
            </SlideToUnlock>
          </div>
        </div>
      )}

      <LottieSuccessToast
        isVisible={showLottieSuccess}
        onComplete={() => setShowLottieSuccess(false)}
      />
    </div>
  );
}
