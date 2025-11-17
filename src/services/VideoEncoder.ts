import * as Mediabunny from "mediabunny";
import {
  CANVAS_SIZE,
  BITRATE,
  VIDEO_MIME_TYPE,
  MEDIABUNNY_CODEC,
  MEDIABUNNY_BITRATE,
  MEDIABUNNY_ALPHA,
} from "~/constants/timer";

export interface EncodingStrategy {
  encode(frames: ImageData[], fps: number, onProgress: (progress: number) => void): Promise<Blob>;
  getName(): string;
  isSupported(): boolean;
}

export interface EncodingOptions {
  frames: ImageData[];
  fps: number;
  onProgress: (progress: number) => void;
  strategy?: 'mediabunny' | 'mediarecorder' | 'webcodecs';
  debugMode?: boolean;
}

/**
 * VideoEncoder service handles video encoding with multiple strategies
 */
export class VideoEncoder {
  private debugMode: boolean;
  private strategies: Map<string, EncodingStrategy>;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
    this.strategies = new Map();
    this.initializeStrategies();
  }

  /**
   * Initialize all encoding strategies
   */
  private initializeStrategies(): void {
    this.strategies.set('mediabunny', new MediabunnyStrategy(this.debugMode));
    this.strategies.set('mediarecorder', new MediaRecorderStrategy(this.debugMode));
    this.strategies.set('webcodecs', new WebCodecsStrategy(this.debugMode));
  }

  /**
   * Encode frames to video using specified or best available strategy
   */
  async encodeFramesToVideo(options: EncodingOptions): Promise<Blob> {
    const { frames, fps, onProgress, strategy = 'mediabunny' } = options;

    this.debugLog("🎬 Starting video encoding:", {
      framesCount: frames.length,
      fps,
      strategy,
      frameSize: `${CANVAS_SIZE}x${CANVAS_SIZE}`
    });

    const startTime = performance.now();

    try {
      // Try specified strategy first
      if (this.strategies.has(strategy)) {
        const encodingStrategy = this.strategies.get(strategy);
        if (encodingStrategy && encodingStrategy.isSupported()) {
          this.debugLog(`✅ Using ${encodingStrategy.getName()} strategy`);
          const result = await encodingStrategy.encode(frames, fps, onProgress);

          const endTime = performance.now();
          const totalTime = endTime - startTime;

          this.debugLog("✅ Video encoding completed:", {
            strategy: encodingStrategy.getName(),
            totalTime: `${totalTime.toFixed(2)}ms`,
            size: `${(result.size / 1024 / 1024).toFixed(2)} MB`,
            type: result.type
          });

          return result;
        }
      }

      // Fallback to other strategies
      this.debugLog(`⚠️ ${strategy} strategy not supported, trying alternatives`);

      for (const [name, encodingStrategy] of this.strategies) {
        if (name !== strategy && encodingStrategy.isSupported()) {
          this.debugLog(`✅ Falling back to ${encodingStrategy.getName()} strategy`);
          const result = await encodingStrategy.encode(frames, fps, onProgress);

          const endTime = performance.now();
          const totalTime = endTime - startTime;

          this.debugLog("✅ Video encoding completed with fallback:", {
            strategy: encodingStrategy.getName(),
            totalTime: `${totalTime.toFixed(2)}ms`,
            size: `${(result.size / 1024 / 1024).toFixed(2)} MB`,
            type: result.type
          });

          return result;
        }
      }

      throw new Error("No supported encoding strategies available");

    } catch (error) {
      this.debugLog("❌ Video encoding failed:", error);
      throw error;
    }
  }

  /**
   * Get available encoding strategies
   */
  getAvailableStrategies(): string[] {
    const available: string[] = [];
    for (const [name, strategy] of this.strategies) {
      if (strategy.isSupported()) {
        available.push(name);
      }
    }
    return available;
  }

  /**
   * Debug logging function
   */
  private debugLog(...args: unknown[]) {
    if (this.debugMode) {
      console.log('🔧 [VideoEncoder]', ...args);
    }
  }
}

/**
 * Mediabunny encoding strategy - fast and efficient
 */
class MediabunnyStrategy implements EncodingStrategy {
  private debugMode: boolean;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  getName(): string {
    return "Mediabunny";
  }

  isSupported(): boolean {
    // Check if Mediabunny library is available and has CanvasSource
    return typeof Mediabunny !== 'undefined' &&
           typeof Mediabunny.CanvasSource !== 'undefined';
  }

  async encode(frames: ImageData[], fps: number, onProgress: (progress: number) => void): Promise<Blob> {
    this.debugLog("🚀 Using Mediabunny for instant video encoding");

    try {
      // Create OffscreenCanvas for Mediabunny compatibility
      const canvas = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error("Failed to get 2D context from OffscreenCanvas");
      }

      // Create CanvasSource with Telegram-compatible settings
      const canvasSource = new Mediabunny.CanvasSource(canvas, {
        codec: MEDIABUNNY_CODEC,
        bitrate: MEDIABUNNY_BITRATE,
        alpha: MEDIABUNNY_ALPHA
      });

      // Create Output with BufferTarget
      const output = new Mediabunny.Output({
        target: new Mediabunny.BufferTarget(),
        format: new Mediabunny.WebMOutputFormat({
          codec: MEDIABUNNY_CODEC,
          bitrate: MEDIABUNNY_BITRATE
        })
      });

      // Connect CanvasSource to Output (correct pattern)
      output.addVideoTrack(canvasSource);

      // Start the output pipeline
      await output.start();

      // Progress tracking
      const totalFrames = frames.length;
      let currentFrame = 0;

      this.debugLog("🎬 Starting frame rendering:", {
        totalFrames,
        canvasSize: `${CANVAS_SIZE}x${CANVAS_SIZE}`,
        firstFrameData: frames[0] ? {
          width: frames[0].width,
          height: frames[0].height,
          dataLength: frames[0].data.length
        } : 'No frames'
      });

      // Add all frames with proper timing (like original working code)
      for (let i = 0; i < frames.length; i++) {
        const timestamp = i * 1.0; // 0, 1, 2, 3... seconds for 1fps content
        const duration = 1.0; // Each frame lasts exactly 1 second

        // Clear canvas to ensure transparency (like original)
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Draw frame to canvas with alpha channel
        ctx.putImageData(frames[i], 0, 0);

        // Add frame to output with correct timing
        await canvasSource.add(timestamp, duration);

        currentFrame++;
        const progress = Math.round((currentFrame / totalFrames) * 100);
        onProgress(progress);

        this.debugLog(`📊 Mediabunny Progress: ${progress}% (${currentFrame}/${totalFrames}), timestamp: ${timestamp}s, frameAdded: true`);
      }

      // Close source to improve performance
      canvasSource.close();

      this.debugLog("🔄 Finalizing video encoding...");

      // Finalize encoding
      await output.finalize();

      // Get buffer from output target
      const finalBuffer = output.target.buffer;

      if (!finalBuffer || finalBuffer.byteLength === 0) {
        throw new Error("Mediabunny produced empty buffer");
      }

      // Create blob from buffer with proper MIME type
      const blob = new Blob([finalBuffer], { type: VIDEO_MIME_TYPE });

      this.debugLog("✅ Mediabunny encoding completed:", {
        framesCount: totalFrames,
        bufferSize: `${(finalBuffer.byteLength / 1024).toFixed(1)} KB`,
        blobSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
        type: blob.type,
        mimeType: VIDEO_MIME_TYPE
      });

      // Validate blob has content
      if (blob.size === 0) {
        throw new Error("Encoded blob is empty - encoding failed");
      }

      return blob;

    } catch (error) {
      this.debugLog("❌ Mediabunny encoding failed:", error);
      throw new Error(`Mediabunny encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private debugLog(...args: unknown[]) {
    if (this.debugMode) {
      console.log('🔧 [MediabunnyStrategy]', ...args);
    }
  }
}

/**
 * MediaRecorder encoding strategy - browser native
 */
class MediaRecorderStrategy implements EncodingStrategy {
  private debugMode: boolean;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  getName(): string {
    return "MediaRecorder";
  }

  isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' &&
           MediaRecorder.isTypeSupported(VIDEO_MIME_TYPE);
  }

  async encode(frames: ImageData[], fps: number, onProgress: (progress: number) => void): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.debugLog("🎥 Using MediaRecorder for video encoding");

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Failed to get 2D context from canvas"));
        return;
      }

      // Create stream from canvas
      const stream = canvas.captureStream(30); // Use 30fps for recording

      // Create MediaRecorder with VP9 settings
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: VIDEO_MIME_TYPE,
        videoBitsPerSecond: BITRATE
      });

      const chunks: Blob[] = [];
      const totalFrames = frames.length;
      let currentFrame = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: VIDEO_MIME_TYPE });

        this.debugLog("✅ MediaRecorder encoding completed:", {
          framesCount: totalFrames,
          size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
          type: blob.type
        });

        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        this.debugLog("❌ MediaRecorder error:", event);
        reject(new Error("MediaRecorder encoding failed"));
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second

      // Render frames with proper timing
      const renderFrame = () => {
        if (currentFrame < frames.length) {
          ctx.putImageData(frames[currentFrame], 0, 0);

          currentFrame++;
          const progress = Math.round((currentFrame / totalFrames) * 100);
          onProgress(progress);

          this.debugLog(`📊 MediaRecorder Progress: ${progress}% (${currentFrame}/${totalFrames})`);

          // Schedule next frame (1 second per frame for timer)
          setTimeout(renderFrame, 1000);
        } else {
          // Stop recording when all frames are rendered
          mediaRecorder.stop();
        }
      };

      renderFrame();
    });
  }

  private debugLog(...args: unknown[]) {
    if (this.debugMode) {
      console.log('🔧 [MediaRecorderStrategy]', ...args);
    }
  }
}

/**
 * WebCodecs encoding strategy - advanced browser API
 */
class WebCodecsStrategy implements EncodingStrategy {
  private debugMode: boolean;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  getName(): string {
    return "WebCodecs";
  }

  isSupported(): boolean {
    return typeof VideoEncoder !== 'undefined' &&
           typeof VideoFrame !== 'undefined';
  }

  async encode(frames: ImageData[], fps: number, onProgress: (progress: number) => void): Promise<Blob> {
    this.debugLog("🎬 Using WebCodecs for video encoding");

    return new Promise((resolve, reject) => {
      try {
        const chunks: Uint8Array[] = [];
        const frameDuration = 1000000 / fps; // microseconds per frame
        const totalFrames = frames.length;
        let currentFrame = 0;

        // Initialize encoder
        const encoder = new VideoEncoder({
          output: (chunk) => {
            chunks.push(chunk);

            currentFrame++;
            const progress = Math.round((currentFrame / totalFrames) * 100);
            onProgress(progress);

            this.debugLog(`📊 WebCodecs Progress: ${progress}% (${currentFrame}/${totalFrames})`);

            if (currentFrame === totalFrames) {
              // Encoding complete, create blob
              const webmBlob = new Blob(chunks, { type: VIDEO_MIME_TYPE });

              this.debugLog("✅ WebCodecs encoding completed:", {
                framesCount: totalFrames,
                size: `${(webmBlob.size / 1024 / 1024).toFixed(2)} MB`,
                type: webmBlob.type
              });

              resolve(webmBlob);
            }
          },
          error: (error) => {
            this.debugLog("❌ WebCodecs error:", error);
            reject(error);
          }
        });

        encoder.configure({
          codec: MEDIABUNNY_CODEC,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          bitrate: BITRATE,
          framerate: fps,
        });

        // Encode each frame
        for (let i = 0; i < frames.length; i++) {
          const frameData = frames[i];

          // Create VideoFrame from ImageData
          const videoFrame = new VideoFrame(frameData, {
            timestamp: i * frameDuration,
            duration: frameDuration
          });

          encoder.encode(videoFrame);
          videoFrame.close();
        }

        // Signal end of encoding
        encoder.flush();

      } catch (error) {
        this.debugLog("❌ WebCodecs initialization failed:", error);
        reject(error);
      }
    });
  }

  private debugLog(...args: unknown[]) {
    if (this.debugMode) {
      console.log('🔧 [WebCodecsStrategy]', ...args);
    }
  }
}