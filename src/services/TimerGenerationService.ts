import { getPlatformAdapter } from "~/adapters/platform-adapter";
import {
  CANVAS_SIZE,
  TIMER_FPS,
  RECORDING_FPS,
} from "~/constants/timer";

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
  type: 'generate';
  totalSeconds: number;
  fontBufferData?: ArrayBuffer;
  generatedFonts?: {
    condensed: ArrayBuffer;
    normal: ArrayBuffer;
    extended: ArrayBuffer;
  };
  preRenderedTexts?: ImageData[];
  workerId: number;
  platformInfo?: any;
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
  performanceMetrics?: any;
}

/**
 * TimerGenerationService handles the core timer generation logic
 * including worker management, frame generation orchestration, and progress tracking.
 */
export class TimerGenerationService {
  private debugMode: boolean;
  private platformAdapter = getPlatformAdapter();

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  /**
   * Generate a timer video with the specified options
   */
  async generateTimer(options: TimerGenerationOptions): Promise<GenerationResult> {
    const { totalSeconds, onProgress } = options;

    this.debugLog("🎯 Starting timer generation:", { totalSeconds });

    const startTime = performance.now();
    const fps = TIMER_FPS;
    const duration = totalSeconds + 1;
    const totalFrames = fps * duration;
    const workerId = Date.now();

    this.debugLog("👷 Creating Web Worker for frame generation...");

    // Create Web Worker for frame generation
    const worker = new window.Worker("/timer-worker.js");
    this.debugLog("✅ Web Worker created successfully", { workerMethod: "Direct Worker instantiation" });

    try {
      // Debug: Add iOS-specific Web Worker logging
      const platformInfo = this.platformAdapter.getPlatformInfo();
      this.debugLog("📱 Platform Info for Worker:", {
        platform: platformInfo.platform,
        isIOS: platformInfo.isIOS,
        isWebKit: platformInfo.isWebKit,
        userAgent: platformInfo.userAgent,
        isSafari: platformInfo.isSafari,
        workerSupport: platformInfo.features?.supportsWebWorkers,
        fontTransferMethod: this.platformAdapter.getFontTransferMethod()
      });

      // Prepare font data based on platform
      const {
        fontBufferForTransfer,
        generatedFontBuffers,
        isIOS,
        preRenderedTexts
      } = this.prepareFontData(options);

      // Create worker message
      const message: WorkerMessage = {
        type: "generate",
        totalSeconds,
        workerId,
        platformInfo: {
          isIOS: platformInfo.isIOS,
          isWebKit: platformInfo.isWebKit,
          isSafari: platformInfo.isSafari,
          fontTransferMethod: this.platformAdapter.getFontTransferMethod(),
          platform: platformInfo.platform
        }
      };

      // Add font data to message based on platform
      if (isIOS && preRenderedTexts) {
        message.preRenderedTexts = preRenderedTexts;
      } else if (generatedFontBuffers) {
        message.generatedFonts = generatedFontBuffers;
      } else if (fontBufferForTransfer) {
        message.fontBufferData = fontBufferForTransfer;
      }

      this.debugLog("📤 Sending generation message to worker:", {
        type: message.type,
        totalSeconds: message.totalSeconds,
        workerId: message.workerId,
        hasFontBufferData: !!message.fontBufferData,
        hasGeneratedFonts: !!message.generatedFonts,
        hasPreRenderedTexts: !!message.preRenderedTexts,
        preRenderedTextsLength: message.preRenderedTexts?.length || 0,
        platformInfo: message.platformInfo,
        generatedFontsSize: message.generatedFonts ? {
          condensed: `${(message.generatedFonts.condensed.byteLength / 1024).toFixed(1)} KB`,
          normal: `${(message.generatedFonts.normal.byteLength / 1024).toFixed(1)} KB`,
          extended: `${(message.generatedFonts.extended.byteLength / 1024).toFixed(1)} KB`
        } : 'none',
        isiPhone: platformInfo.isIOS && platformInfo.userAgent.includes('iPhone'),
        isWebKit: platformInfo.isWebKit
      });

      // Send message to worker with appropriate transfer strategy
      await this.sendMessageToWorker(worker, message, fontBufferForTransfer, isIOS, preRenderedTexts);

      // Wait for worker completion and handle result
      const result = await this.handleWorkerResponse(worker, startTime, onProgress);

      this.debugLog("✅ Timer generation completed successfully");
      return result;

    } catch (error) {
      this.debugLog("❌ Timer generation failed:", error);
      throw error;
    } finally {
      // Always clean up worker
      worker.terminate();
      this.debugLog("🧹 Worker terminated");
    }
  }

  /**
   * Prepare font data based on platform requirements
   */
  private prepareFontData(options: TimerGenerationOptions) {
    const { fontBufferData, generatedFonts, preRenderedTexts } = options;
    const isIOS = this.platformAdapter.getPlatformInfo().isIOS;

    let fontBufferForTransfer: ArrayBuffer | null = null;
    let generatedFontBuffers: any = null;

    // iOS: Use generated fonts if available
    if (isIOS && generatedFonts?.condensed && generatedFonts?.normal && generatedFonts?.extended) {
      generatedFontBuffers = {
        condensed: generatedFonts.condensed,
        normal: generatedFonts.normal,
        extended: generatedFonts.extended
      };
    }
    // Non-iOS: Use font buffer for transfer
    else if (fontBufferData) {
      fontBufferForTransfer = fontBufferData.slice(0); // Create fresh copy for transfer
    }

    return {
      fontBufferForTransfer,
      generatedFontBuffers,
      isIOS,
      preRenderedTexts
    };
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
      let receivedFrames = 0;
      let totalFrames = 0;
      let generationComplete = false;

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
              generationComplete = true;

              const endTime = performance.now();
              const totalTime = endTime - startTime;

              this.debugLog("✅ All frames received from worker:", {
                totalFrames: frames.length,
                totalTime: `${totalTime.toFixed(2)}ms`,
                averageTimePerFrame: `${(totalTime / frames.length).toFixed(2)}ms`
              });

              // Convert frames to video using external encoder
              this.encodeFramesToVideo(frames)
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
   * Encode frames to video (placeholder - will be extracted to VideoEncoder service)
   */
  private async encodeFramesToVideo(frames: ImageData[]): Promise<Blob> {
    // This will be replaced with VideoEncoder service
    throw new Error("Video encoding not implemented in TimerGenerationService");
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