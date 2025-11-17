/**
 * MemoryMonitor - Utility for tracking and managing memory usage
 * Provides browser-compatible memory monitoring with graceful fallbacks
 */

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usedMB: number;
  totalMB: number;
  limitMB: number;
  usagePercentage: number;
}

export interface MemoryThreshold {
  warning: number; // MB
  critical: number; // MB
  emergency: number; // MB
}

export class MemoryMonitor {
  private static readonly DEFAULT_THRESHOLDS: MemoryThreshold = {
    warning: 100,   // 100MB
    critical: 200,  // 200MB
    emergency: 300  // 300MB
  };

  private static isMemoryAPIAvailable(): boolean {
    return 'memory' in performance && (performance as any).memory;
  }

  /**
   * Get current memory usage information
   * Falls back to estimates if memory API is not available
   */
  static getCurrentMemoryUsage(): MemoryInfo | null {
    if (!this.isMemoryAPIAvailable()) {
      console.warn('Memory API not available in this browser');
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usedMB: Math.round(memory.usedJSHeapSize / (1024 * 1024) * 100) / 100,
      totalMB: Math.round(memory.totalJSHeapSize / (1024 * 1024) * 100) / 100,
      limitMB: Math.round(memory.jsHeapSizeLimit / (1024 * 1024) * 100) / 100,
      usagePercentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 10000) / 100
    };
  }

  /**
   * Check if memory usage exceeds threshold
   */
  static checkMemoryThresholds(
    thresholds: Partial<MemoryThreshold> = {}
  ): {
    level: 'normal' | 'warning' | 'critical' | 'emergency';
    currentUsage: MemoryInfo | null;
    message?: string;
  } {
    const finalThresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };
    const currentUsage = this.getCurrentMemoryUsage();

    if (!currentUsage) {
      return { level: 'normal', currentUsage };
    }

    const { usedMB } = currentUsage;

    if (usedMB >= finalThresholds.emergency) {
      return {
        level: 'emergency',
        currentUsage,
        message: `EMERGENCY: Memory usage extremely high (${usedMB}MB)`
      };
    }

    if (usedMB >= finalThresholds.critical) {
      return {
        level: 'critical',
        currentUsage,
        message: `CRITICAL: Memory usage very high (${usedMB}MB)`
      };
    }

    if (usedMB >= finalThresholds.warning) {
      return {
        level: 'warning',
        currentUsage,
        message: `WARNING: Memory usage elevated (${usedMB}MB)`
      };
    }

    return { level: 'normal', currentUsage };
  }

  /**
   * Log memory usage with optional warnings
   */
  static logMemoryUsage(
    context: string,
    thresholds: Partial<MemoryThreshold> = {},
    forceLog = false
  ): void {
    const result = this.checkMemoryThresholds(thresholds);
    const { currentUsage } = result;

    if (!currentUsage) return;

    const logData = {
      context,
      ...currentUsage,
      timestamp: new Date().toISOString()
    };

    // Always log if forceLog is true or if there's a warning
    if (forceLog || result.level !== 'normal') {
      console.log(`🧠 [MemoryMonitor] ${result.level.toUpperCase()}:`, logData);

      if (result.message) {
        console.warn(`🧠 [MemoryMonitor] ${result.message}`);
      }
    }
  }

  /**
   * Create a memory monitoring hook for React components
   */
  static createMemoryMonitor(intervalMs = 30000) {
    let intervalId: NodeJS.Timeout | null = null;
    let isMonitoring = false;

    const startMonitoring = (context: string, thresholds?: Partial<MemoryThreshold>) => {
      if (isMonitoring) return;

      isMonitoring = true;
      intervalId = setInterval(() => {
        this.logMemoryUsage(context, thresholds);
      }, intervalMs);

      // Log immediately when starting
      this.logMemoryUsage(`${context} (monitoring started)`, thresholds, true);
    };

    const stopMonitoring = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      isMonitoring = false;
    };

    const checkNow = (context: string, thresholds?: Partial<MemoryThreshold>) => {
      return this.checkMemoryThresholds(thresholds);
    };

    return {
      startMonitoring,
      stopMonitoring,
      checkNow,
      isMonitoring: () => isMonitoring
    };
  }

  /**
   * Get memory pressure recommendations
   */
  static getRecommendations(memoryInfo: MemoryInfo | null): string[] {
    if (!memoryInfo) return ['Memory monitoring not available'];

    const { usagePercentage, usedMB } = memoryInfo;
    const recommendations: string[] = [];

    if (usagePercentage > 80) {
      recommendations.push('Consider clearing caches and unused objects');
      recommendations.push('Close unused browser tabs');
    }

    if (usedMB > 200) {
      recommendations.push('High memory usage detected - consider refreshing the page');
    }

    if (usagePercentage > 50) {
      recommendations.push('Monitor memory usage trends');
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory usage is within normal limits');
    }

    return recommendations;
  }

  /**
   * Force garbage collection if available (development only)
   */
  static forceGarbageCollection(): boolean {
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc();
        console.log('🗑️ [MemoryMonitor] Forced garbage collection');
        return true;
      } catch (error) {
        console.warn('🗑️ [MemoryMonitor] Failed to force garbage collection:', error);
      }
    }
    return false;
  }
}