import { getPlatformAdapter } from "~/adapters/platform-adapter";
import { TIMER_FPS } from "~/constants/timer";
import { VideoEncoder, type EncodingOptions } from "./VideoEncoder";
import { MemoryMonitor } from "~/lib/memory-monitor";
import { TimerTrimmerService, type TrimResult } from "./TimerTrimmerService";

export interface TimerGenerationOptions {
  totalSeconds: number;
  onProgress: (progress: number) => void;
  fontBufferData?: ArrayBuffer | null;
  generatedFonts?: {
    condensed: ArrayBuffer | null;
    normal: ArrayBuffer | null;
    extended: ArrayBuffer | null;
  };
  preRenderedTexts?: ImageData[];
  debugMode?: boolean;
}

export interface GenerationResult {
  videoBlob: Blob;
  videoUrl: string;
  totalTime: number;
  fromCache: boolean;
  cacheType?: string;
  sourceCache?: number;
  extractedFrames?: number;
}

export interface WorkerMessage {
  action: 'generate';
  timerSeconds: number;
  fontBufferData?: ArrayBuffer;
  generatedFonts?: {
    condensed: ArrayBuffer;
    normal: ArrayBuffer;
    extended: ArrayBuffer;
  };
  preRenderedTexts?: ImageData[];
  workerId: number;
  fontBuffer?: ArrayBuffer;
  isIOS?: boolean;
  debugMode?: boolean;
  platformInfo?: Record<string, unknown>;
}

export interface WorkerResponse {
  type: 'progress' | 'complete' | 'error' | 'font-loaded';
  progress?: number;
  frames?: ImageData[];
  error?: string;
  generatedFonts?: {
    condensed: ArrayBuffer;
    normal: ArrayBuffer;
    extended: ArrayBuffer;
  };
  performanceMetrics?: Record<string, unknown>;
}

/**
 * TimerGenerationService handles the core timer generation logic
 * including worker management, frame generation orchestration, and progress tracking.
 */
export class TimerGenerationService {
  private debugMode: boolean;
  private platformAdapter = getPlatformAdapter();
  private videoEncoder: VideoEncoder;
  private timerTrimmer: TimerTrimmerService;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
    this.videoEncoder = new VideoEncoder(debugMode);
    this.timerTrimmer = new TimerTrimmerService(debugMode);
  }

  /**
   * Generate a timer video with the specified options
   */
  async generateTimer(options: TimerGenerationOptions): Promise<GenerationResult> {
    const { totalSeconds, onProgress } = options;

    // Validate input
    if (totalSeconds <= 0) {
      throw new Error("Timer duration must be greater than 0 seconds");
    }

    this.debugLog("🎯 Starting timer generation:", { totalSeconds });

    // TEMPORARILY: Disable trimming to focus on memory issue fix
    // TODO: Re-enable once we have a proper master video format
    // if (this.timerTrimmer.canHandleDuration(totalSeconds)) {
    //   this.debugLog(`✂️ Using timer trimming for ${totalSeconds}s (≤ 59:59)`);
    //   return this.generateTimerWithTrimming(totalSeconds, onProgress);
    // }

    this.debugLog(`🏭 Using optimized frame generation for ${totalSeconds}s`);

    // Use optimized frame generation approach
    return this.generateTimerWithFrames(totalSeconds, onProgress);
  }

  /**
   * Send message to worker with appropriate transfer strategy
   */
  private async sendMessageToWorker(
    worker: Worker,
    message: WorkerMessage,
    fontBufferForTransfer: ArrayBuffer | null,
    isIOS: boolean,
    preRenderedTexts?: ImageData[]
  ) {
    // iOS: Send pre-rendered texts directly (no font buffers needed)
    if (isIOS && preRenderedTexts) {
      this.debugLog("🍎 iOS: Sending message with pre-rendered texts (no font buffers)");
      worker.postMessage(message);
      this.debugLog(`✅ iOS: Pre-rendered texts sent to worker (${preRenderedTexts.length} frames)`);
    } else if (message.generatedFonts) {
      this.debugLog("🔤 Non-iOS: Embedding generated font buffers directly in message...");
      worker.postMessage(message);
      this.debugLog(`✅ Non-iOS: Generated font buffers sent directly in message`);
    } else if (fontBufferForTransfer) {
      this.debugLog("🚚 Adding font buffer to transfer list");
      worker.postMessage(message, [fontBufferForTransfer]);
      this.debugLog(`✅ Font buffer transferred to worker`);
    } else {
      this.debugLog("📤 Sending message to worker without font data");
      worker.postMessage(message);
    }
  }

  /**
   * Handle worker response and convert to video
   */
  private async handleWorkerResponse(
    worker: Worker,
    startTime: number,
    onProgress: (progress: number) => void
  ): Promise<GenerationResult> {
    return new Promise((resolve, reject) => {
      let frames: ImageData[] = [];

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;

        switch (message.type) {
          case "progress":
            if (message.progress !== undefined) {
              onProgress(message.progress);
              this.debugLog(`📊 Progress: ${message.progress}%`);
            }
            break;

          case "font-loaded":
            this.debugLog("🔤 Worker fonts loaded successfully");
            break;

          case "complete":
            if (message.frames) {
              frames = message.frames;

              const endTime = performance.now();
              const totalTime = endTime - startTime;

              this.debugLog("✅ All frames received from worker:", {
                totalFrames: frames.length,
                totalTime: `${totalTime.toFixed(2)}ms`,
                averageTimePerFrame: `${(totalTime / frames.length).toFixed(2)}ms`
              });

              // Use VideoEncoder service to convert frames to video
              const encodingOptions: EncodingOptions = {
                frames,
                fps: TIMER_FPS,
                onProgress: (progress) => {
                  // Scale progress from 50-100% for encoding phase
                  const scaledProgress = 50 + (progress / 2);
                  onProgress(scaledProgress);
                },
                debugMode: this.debugMode
              };

              this.videoEncoder.encodeFramesToVideo(encodingOptions)
                .then((videoBlob) => {
                  const url = URL.createObjectURL(videoBlob);

                  resolve({
                    videoBlob,
                    videoUrl: url,
                    totalTime,
                    fromCache: false
                  });
                })
                .catch(reject);
            }
            break;

          case "error":
            this.debugLog("❌ Worker error:", message.error);
            reject(new Error(message.error || "Unknown worker error"));
            break;
        }
      };

      worker.addEventListener("message", handleMessage);
    });
  }

  /**
   * Generate timer using trimming approach (for durations ≤ 59:59)
   */
  private async generateTimerWithTrimming(
    totalSeconds: number,
    onProgress: (progress: number) => void
  ): Promise<GenerationResult> {
    const startTime = performance.now();

    try {
      this.debugLog(`✂️ Starting timer trimming: ${totalSeconds}s`);

      // Use TimerTrimmerService to create trimmed video
      const trimResult: TrimResult = await this.timerTrimmer.trimTimer({
        duration: totalSeconds,
        onProgress: (progress) => {
          // Scale progress from 0-100% for trimming phase
          onProgress(progress);
        },
        debugMode: this.debugMode,
      });

      if (!trimResult.success) {
        throw new Error(trimResult.error || 'Timer trimming failed');
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const videoUrl = URL.createObjectURL(trimResult.blob);

      this.debugLog(`✅ Timer trimming completed:`, {
        duration: `${totalSeconds}s`,
        size: `${(trimResult.size / 1024 / 1024).toFixed(2)} MB`,
        totalTime: `${totalTime.toFixed(2)}ms`,
        method: 'trimming',
      });

      return {
        videoBlob: trimResult.blob,
        videoUrl,
        totalTime,
        fromCache: false,
        cacheType: 'trimming',
      };

    } catch (error) {
      this.debugLog(`❌ Timer trimming failed, falling back to frame generation:`, error);

      // Fallback to frame generation if trimming fails
      this.debugLog(`🏭 Falling back to frame generation for ${totalSeconds}s`);
      return this.generateTimerWithFrames(totalSeconds, onProgress);
    }
  }

  /**
   * Generate timer using frame generation approach (for durations > 59:59 or trimming fallback)
   */
  private async generateTimerWithFrames(
    totalSeconds: number,
    onProgress: (progress: number) => void
  ): Promise<GenerationResult> {
    this.debugLog(`🏭 Starting frame generation: ${totalSeconds}s`);

    // Check memory usage before starting generation
    const memoryCheck = MemoryMonitor.checkMemoryThresholds({ warning: 50, critical: 100 });
    if (memoryCheck.level === 'critical' || memoryCheck.level === 'emergency') {
      console.warn('🧠 [TimerGenerationService] High memory usage detected:', memoryCheck.message);
    }

    const startTime = performance.now();
    const fps = TIMER_FPS;
    const duration = totalSeconds + 1;
    const totalFrames = fps * duration;
    const workerId = Date.now();

    this.debugLog(`📊 Total frames needed: ${totalFrames}`);

    // Use chunked generation for large timers to avoid memory issues
    const CHUNK_SIZE_THRESHOLD = 600; // 10 minutes at 1fps
    const shouldUseChunkedGeneration = totalFrames > CHUNK_SIZE_THRESHOLD;

    if (shouldUseChunkedGeneration) {
      this.debugLog(`🧠 Using chunked generation for ${totalFrames} frames (>${CHUNK_SIZE_THRESHOLD})`);
      return this.generateTimerWithChunkedFrames(totalSeconds, onProgress, startTime, totalFrames);
    }

    this.debugLog("👷 Creating Web Worker for frame generation...");

    // Create Web Worker for frame generation
    const worker = new Worker("/timer-worker.js");

    try {
      // Send message to worker
      const message: WorkerMessage = {
        action: 'generate',
        timerSeconds: totalSeconds,
        workerId,
        debugMode: this.debugMode,
        platformInfo: this.platformAdapter.getPlatformInfo() as unknown as Record<string, unknown>,
      };

      // Send message without font data for now (we'll need to pass options in real implementation)
      await this.sendMessageToWorker(worker, message, null, false);

      // Handle worker response
      const result = await this.handleWorkerResponse(worker, startTime, onProgress);

      // Update result to indicate it's from frame generation
      return {
        ...result,
        cacheType: result.cacheType ? result.cacheType : 'frame-generation',
      };

    } finally {
      // Clean up worker
      worker.terminate();
      this.debugLog("🧹 Worker terminated");
    }
  }

  /**
   * Generate timer using chunked frame generation with WebWorker logic (exact copy)
   */
  private async generateTimerWithChunkedFrames(
    totalSeconds: number,
    onProgress: (progress: number) => void,
    startTime: number,
    totalFrames: number
  ): Promise<GenerationResult> {
    this.debugLog(`🧩 Starting chunked frame generation: ${totalSeconds}s (${totalFrames} frames)`);

    // Constants matching WebWorker
    const CANVAS_SIZE = 512;
    const SINGLE_DIGIT_MAX = 9; // 0-9 seconds
    const MM_SS_THRESHOLD = 60; // 60+ seconds
    const CHUNK_SIZE = 100; // Process 100 frames per chunk to avoid memory issues
    const chunks = Math.ceil(totalFrames / CHUNK_SIZE);

    this.debugLog(`📦 Will process ${chunks} chunks of ${CHUNK_SIZE} frames each`);

    // Extracted WebWorker functions
    const formatTime = (seconds: number): string => {
      if (seconds < 60) {
        return seconds.toString(); // Keep current behavior for < 60s
      } else {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
    };

    const getFontSettings = (remainingSeconds: number) => {
      // Use maximum font size for all states
      const baseSize = CANVAS_SIZE; // Maximum size for all formats (full canvas height)

      let fontName: string;

      if (remainingSeconds <= SINGLE_DIGIT_MAX) {
        fontName = 'Arial Black'; // State 1: 0-9s - bold condensed
      } else if (remainingSeconds < MM_SS_THRESHOLD) {
        fontName = 'Arial'; // State 2: 10-59s - normal
      } else {
        fontName = 'Arial'; // State 3: >=60s (MM:SS format) - extended
      }

      return {
        font: `bold ${baseSize}px ${fontName}`,
        name: fontName,
        baseSize
      };
    };

    try {
      // Create canvas exactly like WebWorker
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true, willReadFrequently: false });

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const fps = 1;
      const centerX = CANVAS_SIZE / 2;
      const centerY = CANVAS_SIZE / 2;

      // Pre-set shadow properties exactly like WebWorker
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const allFrames: ImageData[] = [];
      let framesProcessed = 0;

      // Process frames in chunks exactly like WebWorker but with memory management
      for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
        const startFrame = chunkIndex * CHUNK_SIZE;
        const endFrame = Math.min(startFrame + CHUNK_SIZE, totalFrames);

        this.debugLog(`🔄 Processing chunk ${chunkIndex + 1}/${chunks}: frames ${startFrame}-${endFrame - 1}`);

        // Generate frames for this chunk using exact WebWorker logic
        for (let frame = startFrame; frame < endFrame; frame++) {
          const currentSecond = Math.floor(frame / fps);
          const remainingSeconds = Math.max(0, totalSeconds - currentSecond);

          // Clear canvas
          ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

          // Get dynamic font settings based on remaining time
          const fontSettings = getFontSettings(remainingSeconds);
          ctx.font = fontSettings.font;

          // Format time based on remaining seconds
          const timeText = formatTime(remainingSeconds);

          // Draw timer text
          ctx.fillText(timeText, centerX, centerY);

          // Capture frame as ImageData
          const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
          allFrames.push(imageData);

          framesProcessed++;
        }

        // Update progress after each chunk
        const progress = (framesProcessed / totalFrames) * 100;
        onProgress(progress);

        // Force garbage collection if available between chunks
        if (global.gc) {
          global.gc();
        }

        // Small delay to allow memory cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.debugLog(`✅ All ${allFrames.length} frames generated successfully`);

      // Use VideoEncoder to create video from frames (same as WebWorker approach)
      const encodingOptions: EncodingOptions = {
        frames: allFrames,
        fps: TIMER_FPS,
        onProgress: (progress) => {
          onProgress(progress);
        },
        debugMode: this.debugMode
      };

      const videoBlob = await this.videoEncoder.encodeFramesToVideo(encodingOptions);
      const url = URL.createObjectURL(videoBlob);
      const totalTime = performance.now() - startTime;

      return {
        videoBlob,
        videoUrl: url,
        totalTime,
        fromCache: false,
        cacheType: 'chunked-generation',
        extractedFrames: totalFrames,
      };

    } catch (error) {
      this.debugLog(`❌ Chunked generation failed:`, error);
      throw new Error(`Chunked timer generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Debug logging function
   */
  private debugLog(...args: unknown[]) {
    if (this.debugMode) {
      console.log('🔧 [TimerGenerationService]', ...args);
    }
  }
}