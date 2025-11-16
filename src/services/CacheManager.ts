import { getPlatformAdapter } from "~/adapters/platform-adapter";
import { TIMER_FPS } from "~/constants/timer";

export interface CacheAnalysis {
  cacheHitRate: number;
  cachedCount: number;
  totalRequired: number;
  needGeneration: number;
  legacyCacheHit?: {
    duration: number;
    frames: ImageData[];
  };
}

export interface LegacyCacheHit {
  duration: number;
  frames: ImageData[];
}

/**
 * CacheManager handles all cache operations including:
 * - Individual frame cache for incremental generation
 * - Legacy complete timer cache for backward compatibility
 * - Bidirectional cache optimization
 * - Cache analysis and smart assembly
 */
export class CacheManager {
  private individualFrameCache: Map<number, ImageData>;
  private frameCache: Map<number, ImageData[]>;
  private debugMode: boolean;
  private platformAdapter = getPlatformAdapter();

  constructor(
    individualFrameCache: Map<number, ImageData>,
    frameCache: Map<number, ImageData[]>,
    debugMode = false
  ) {
    this.individualFrameCache = individualFrameCache;
    this.frameCache = frameCache;
    this.debugMode = debugMode;
  }

  /**
   * Analyze frame cache to determine optimization opportunities
   */
  analyzeFrameCache(targetDuration: number): CacheAnalysis {
    const totalRequired = targetDuration + 1; // Include 0 second
    let cachedCount = 0;

    // Check which individual frames we have
    for (let second = 0; second <= targetDuration; second++) {
      if (this.individualFrameCache.has(second)) {
        cachedCount++;
      }
    }

    const cacheHitRate = cachedCount / totalRequired;
    const needGeneration = totalRequired - cachedCount;

    this.debugLog("🔍 Cache analysis:", {
      targetDuration,
      totalRequired,
      cachedCount,
      cacheHitRate: `${(cacheHitRate * 100).toFixed(1)}%`,
      needGeneration,
      individualCacheSize: this.individualFrameCache.size
    });

    // Check for bidirectional legacy cache (longer cached timer that contains our frames)
    const legacyCacheHit = this.findBidirectionalCacheHit(targetDuration);

    return {
      cacheHitRate,
      cachedCount,
      totalRequired,
      needGeneration,
      legacyCacheHit
    };
  }

  /**
   * Find a longer cached timer that can provide frames for our target duration
   */
  private findBidirectionalCacheHit(targetDuration: number): LegacyCacheHit | undefined {
    const cachedDurations = Array.from(this.frameCache.keys())
      .filter(duration => duration > targetDuration)
      .sort((a, b) => a - b); // Find the smallest larger duration

    if (cachedDurations.length > 0) {
      const sourceDuration = cachedDurations[0];
      const sourceFrames = this.frameCache.get(sourceDuration)!;

      this.debugLog("🎯 Found bidirectional cache hit:", {
        targetDuration,
        sourceDuration,
        sourceFramesCount: sourceFrames.length
      });

      return {
        duration: sourceDuration,
        frames: sourceFrames
      };
    }

    return undefined;
  }

  /**
   * Assemble complete timer from individual frame cache
   */
  assembleCompleteTimer(targetDuration: number): ImageData[] {
    const frames: ImageData[] = [];
    const missingFrames: number[] = [];

    this.debugLog("🔧 Assembling complete timer from individual frames:", { targetDuration });

    // Collect frames from individual cache
    for (let second = 0; second <= targetDuration; second++) {
      const frame = this.individualFrameCache.get(second);
      if (frame) {
        frames.push(frame);
      } else {
        missingFrames.push(second);
        this.debugLog(`❌ Missing frame for second: ${second}`);
      }
    }

    if (missingFrames.length > 0) {
      throw new Error(`Missing frames for seconds: ${missingFrames.join(', ')}`);
    }

    this.debugLog("✅ Complete timer assembled:", {
      targetDuration,
      framesCount: frames.length,
      expectedFrames: targetDuration + 1
    });

    return frames;
  }

  /**
   * Extract subset from longer cached timer for bidirectional optimization
   */
  extractLegacyCacheSubset(cacheHit: LegacyCacheHit, targetDuration: number): ImageData[] {
    const { duration: sourceDuration, frames: sourceFrames } = cacheHit;
    const frameSkip = Math.floor(sourceFrames.length / sourceDuration);
    const extractedFrames: ImageData[] = [];

    this.debugLog("🔧 Extracting subset from legacy cache:", {
      sourceDuration,
      targetDuration,
      sourceFramesCount: sourceFrames.length,
      frameSkip
    });

    // Extract the relevant frames from the end of the longer timer
    for (let second = 0; second <= targetDuration; second++) {
      const sourceFrameIndex = sourceFrames.length - (targetDuration + 1 - second) * frameSkip;

      if (sourceFrameIndex >= 0 && sourceFrameIndex < sourceFrames.length) {
        extractedFrames.push(sourceFrames[sourceFrameIndex]);
      } else {
        this.debugLog(`❌ Cannot extract frame for second: ${second}, index: ${sourceFrameIndex}`);
      }
    }

    if (extractedFrames.length !== targetDuration + 1) {
      throw new Error(
        `Extracted frames count (${extractedFrames.length}) doesn't match expected (${targetDuration + 1})`
      );
    }

    this.debugLog("✅ Subset extracted successfully:", {
      targetDuration,
      extractedFramesCount: extractedFrames.length
    });

    return extractedFrames;
  }

  /**
   * Check if legacy cache has frames for the specified duration
   */
  hasLegacyCache(duration: number): boolean {
    return this.frameCache.has(duration);
  }

  /**
   * Get frames from legacy cache
   */
  getLegacyCache(duration: number): ImageData[] | undefined {
    return this.frameCache.get(duration);
  }

  /**
   * Store frames in legacy cache
   */
  setLegacyCache(duration: number, frames: ImageData[]): void {
    this.frameCache.set(duration, frames);
    this.debugLog("💾 Stored frames in legacy cache:", { duration, framesCount: frames.length });
  }

  /**
   * Store individual frame in cache
   */
  setIndividualFrame(second: number, frame: ImageData): void {
    this.individualFrameCache.set(second, frame);
    this.debugLog("💾 Stored individual frame:", { second });
  }

  /**
   * Get individual frame from cache
   */
  getIndividualFrame(second: number): ImageData | undefined {
    return this.individualFrameCache.get(second);
  }

  /**
   * Get cache information for debugging
   */
  getCacheInfo(): {
    count: number;
    timers: number[];
    totalFrames: number;
  } {
    const timers = Array.from(this.frameCache.keys()).sort((a, b) => a - b);
    const totalFrames = Array.from(this.frameCache.values())
      .reduce((sum, frames) => sum + frames.length, 0);

    return {
      count: this.frameCache.size,
      timers,
      totalFrames
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.individualFrameCache.clear();
    this.frameCache.clear();
    this.debugLog("🧹 All caches cleared");
  }

  /**
   * Clear legacy cache (complete timers)
   */
  clearLegacyCache(): void {
    this.frameCache.clear();
    this.debugLog("🧹 Legacy cache cleared");
  }

  /**
   * Clear individual frame cache
   */
  clearIndividualFrameCache(): void {
    this.individualFrameCache.clear();
    this.debugLog("🧹 Individual frame cache cleared");
  }

  /**
   * Get cache size information
   */
  getCacheSize(): {
    individualCacheSize: number;
    legacyCacheSize: number;
    totalCachedTimers: number;
    totalIndividualFrames: number;
  } {
    const totalCachedTimers = this.frameCache.size;
    const totalIndividualFrames = this.individualFrameCache.size;
    const legacyCacheSize = Array.from(this.frameCache.values())
      .reduce((total, frames) => total + frames.length, 0);

    return {
      individualCacheSize: totalIndividualFrames,
      legacyCacheSize,
      totalCachedTimers,
      totalIndividualFrames
    };
  }

  /**
   * Debug logging function
   */
  private debugLog(...args: unknown[]) {
    if (this.debugMode) {
      console.log('🔧 [CacheManager]', ...args);
    }
  }
}