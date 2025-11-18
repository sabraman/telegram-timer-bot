import * as Mediabunny from 'mediabunny';

export interface TrimmingOptions {
  duration: number; // Duration in seconds (≤ 3599 for 59:59)
  onProgress?: (progress: number) => void;
  debugMode?: boolean;
}

export interface TrimResult {
  blob: Blob;
  duration: number;
  size: number;
  success: boolean;
  error?: string;
}

/**
 * Configuration for master timer video
 */
const MASTER_TIMER_CONFIG = {
  URL: '/timer-master-59-59.webm', // Master timer video file
  MAX_DURATION: 3599, // 59:59 in seconds (maximum supported duration)
  CANVAS_WIDTH: 512,
  CANVAS_HEIGHT: 512,
  BITRATE: 500000, // 500kbps for Telegram compatibility
  CODEC: 'vp9',
  ALPHA: 'keep', // Preserve transparency for stickers
} as const;

/**
 * TimerTrimmerService handles trimming of master timer video to specific durations
 * This solves memory issues with long timers by using pre-generated master video
 */
export class TimerTrimmerService {
  private debugMode: boolean;
  private masterVideoCache: Blob | null = null;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.log(`[TimerTrimmerService] ${message}`, ...args);
    }
  }

  /**
   * Log error messages
   */
  private logError(message: string, error?: any): void {
    console.error(`[TimerTrimmerService] ${message}`, error);
  }

  /**
   * Check if trimming service can handle the requested duration
   */
  canHandleDuration(durationSeconds: number): boolean {
    return durationSeconds > 0 && durationSeconds <= MASTER_TIMER_CONFIG.MAX_DURATION;
  }

  /**
   * Get maximum supported duration
   */
  getMaxSupportedDuration(): number {
    return MASTER_TIMER_CONFIG.MAX_DURATION;
  }

  /**
   * Get full URL for master timer video
   */
  private getMasterVideoUrl(): string {
    // Always use relative URL - works in both browser and Node.js with proper server
    return MASTER_TIMER_CONFIG.URL;
  }

  /**
   * Load or return cached master timer video
   */
  private async loadMasterVideo(): Promise<Blob> {
    if (this.masterVideoCache) {
      this.log('Using cached master video');
      return this.masterVideoCache;
    }

    const url = this.getMasterVideoUrl();
    this.log('Loading master timer video from:', url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch master timer: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // Validate blob size and type
      if (blob.size === 0) {
        throw new Error('Master timer video is empty');
      }

      this.log(`Master video loaded: ${blob.type}, size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

      // Cache for future use
      this.masterVideoCache = blob;
      return blob;

    } catch (error) {
      this.logError('Failed to load master timer video', error);
      throw new Error(`Master timer video not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate trim duration parameters
   */
  private validateTrimParameters(durationSeconds: number): void {
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      throw new Error('Duration must be a positive integer');
    }

    if (durationSeconds > MASTER_TIMER_CONFIG.MAX_DURATION) {
      throw new Error(`Duration cannot exceed ${MASTER_TIMER_CONFIG.MAX_DURATION} seconds (${Math.floor(MASTER_TIMER_CONFIG.MAX_DURATION / 60)}:${(MASTER_TIMER_CONFIG.MAX_DURATION % 60).toString().padStart(2, '0')})`);
    }
  }

  /**
   * Create MediaBunny input from master video blob
   */
  private async createMediaBunnyInput(videoBlob: Blob): Promise<Mediabunny.Input> {
    // Convert blob to Uint8Array for MediaBunny
    const arrayBuffer = await videoBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    return new Mediabunny.Input({
      source: new Mediabunny.BufferSource(uint8Array, {
        size: videoBlob.size,
      }),
      formats: Mediabunny.ALL_FORMATS,
    });
  }

  /**
   * Create MediaBunny output for trimmed video
   */
  private createMediaBunnyOutput(): Mediabunny.Output {
    return new Mediabunny.Output({
      format: new Mediabunny.WebMOutputFormat({
        codec: MASTER_TIMER_CONFIG.CODEC,
        bitrate: MASTER_TIMER_CONFIG.BITRATE,
        alpha: MASTER_TIMER_CONFIG.ALPHA,
      }),
      target: new Mediabunny.BufferTarget({
        chunked: true,
        chunkSize: 1024 * 1024, // 1MB chunks
      }),
    });
  }

  /**
   * Trim master timer video to specified duration
   */
  async trimTimer(options: TrimmingOptions): Promise<TrimResult> {
    const { duration, onProgress, debugMode = this.debugMode } = options;

    this.log(`Starting timer trim: ${duration}s`, { options });

    try {
      // Validate parameters
      this.validateTrimParameters(duration);

      // Progress callback wrapper
      const progressCallback = (progress: number) => {
        this.log(`Trimming progress: ${Math.round(progress * 100)}%`);
        if (onProgress) {
          onProgress(progress);
        }
      };

      // Load master video
      progressCallback(0.1); // 10% - Loading master video
      const masterBlob = await this.loadMasterVideo();

      // Create MediaBunny input and output
      progressCallback(0.2); // 20% - Setting up MediaBunny
      const input = await this.createMediaBunnyInput(masterBlob);
      const output = this.createMediaBunnyOutput();

      // Initialize conversion with trim settings
      progressCallback(0.3); // 30% - Initializing conversion
      const conversion = await Mediabunny.Conversion.init({
        input,
        output,
        trim: {
          start: 0,
          end: duration,
        },
        video: {
          frameRate: 1, // Timer videos are 1fps
          width: MASTER_TIMER_CONFIG.CANVAS_WIDTH,
          height: MASTER_TIMER_CONFIG.CANVAS_HEIGHT,
          fit: 'fill', // Required by MediaBunny when width and height are both specified
        },
      });

      // Execute conversion
      progressCallback(0.4); // 40% - Starting conversion
      this.log(`Executing MediaBunny conversion for ${duration}s timer...`);

      await conversion.execute();

      // Get result
      const bufferTarget = output.target as Mediabunny.BufferTarget;
      const resultBuffer = await bufferTarget.getBuffer();
      const resultBlob = new Blob([resultBuffer], { type: 'video/webm' });

      progressCallback(1.0); // 100% - Complete

      this.log(`Timer trim completed successfully:`, {
        duration: `${duration}s`,
        size: `${(resultBlob.size / 1024 / 1024).toFixed(2)} MB`,
        type: resultBlob.type,
      });

      return {
        blob: resultBlob,
        duration,
        size: resultBlob.size,
        success: true,
      };

    } catch (error) {
      this.logError('Timer trimming failed', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        blob: new Blob(),
        duration: 0,
        size: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Format duration as MM:SS
   */
  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get estimated output size for a given duration
   */
  getEstimatedSize(durationSeconds: number): number {
    // Rough estimate based on bitrate: (bitrate * duration) / 8
    const bitSize = MASTER_TIMER_CONFIG.BITRATE * durationSeconds;
    return Math.ceil(bitSize / 8); // Convert to bytes
  }

  /**
   * Clear cached master video (useful for memory management)
   */
  clearCache(): void {
    this.masterVideoCache = null;
    this.log('Master video cache cleared');
  }

  /**
   * Get service status and capabilities
   */
  getStatus(): {
    isAvailable: boolean;
    maxDuration: number;
    masterVideoCached: boolean;
    estimatedFileSize: (duration: number) => number;
  } {
    return {
      isAvailable: true, // TODO: Could check for MediaBunny support
      maxDuration: MASTER_TIMER_CONFIG.MAX_DURATION,
      masterVideoCached: this.masterVideoCache !== null,
      estimatedFileSize: (duration: number) => this.getEstimatedSize(duration),
    };
  }
}

// Export singleton instance for easy usage
export const timerTrimmerService = new TimerTrimmerService();

// Export types for external usage
export type { TrimmingOptions, TrimResult };