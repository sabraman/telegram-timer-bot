import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimerTrimmerService } from '../TimerTrimmerService';

describe('TimerTrimmerService', () => {
  let service: TimerTrimmerService;

  beforeEach(() => {
    service = new TimerTrimmerService(false); // Disable debug mode for cleaner test output
    vi.clearAllMocks();
  });

  describe('canHandleDuration', () => {
    it('should return true for durations within the test limit', () => {
      expect(service.canHandleDuration(1)).toBe(true);
      expect(service.canHandleDuration(30)).toBe(true);
      expect(service.canHandleDuration(59)).toBe(true); // 00:59
      expect(service.canHandleDuration(3599)).toBe(true); // 59:59 (max duration)
    });

    it('should return false for durations exceeding the test limit', () => {
      expect(service.canHandleDuration(3600)).toBe(false); // 60:00 (exceeds 59:59)
      expect(service.canHandleDuration(7200)).toBe(false); // 120:00
    });

    it('should return false for zero or negative durations', () => {
      expect(service.canHandleDuration(0)).toBe(false);
      expect(service.canHandleDuration(-1)).toBe(false);
    });
  });

  describe('getMaxSupportedDuration', () => {
    it('should return 3599 seconds (59:59 max duration)', () => {
      expect(service.getMaxSupportedDuration()).toBe(3599);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds as MM:SS correctly', () => {
      expect(service.formatDuration(0)).toBe('00:00');
      expect(service.formatDuration(1)).toBe('00:01');
      expect(service.formatDuration(59)).toBe('00:59');
      expect(service.formatDuration(60)).toBe('01:00');
      expect(service.formatDuration(3599)).toBe('59:59');
    });
  });

  describe('getEstimatedSize', () => {
    it('should return reasonable size estimates', () => {
      const sizeFor1Sec = service.getEstimatedSize(1);
      const sizeFor60Sec = service.getEstimatedSize(60);
      const sizeFor3600Sec = service.getEstimatedSize(3600);

      expect(sizeFor1Sec).toBeGreaterThan(0);
      expect(sizeFor60Sec).toBeGreaterThan(sizeFor1Sec);
      expect(sizeFor3600Sec).toBeGreaterThan(sizeFor60Sec);
    });
  });

  describe('getStatus', () => {
    it('should return correct status information', () => {
      const status = service.getStatus();

      expect(status).toHaveProperty('isAvailable', true);
      expect(status).toHaveProperty('maxDuration', 3599); // 59:59 max duration
      expect(status).toHaveProperty('masterVideoCached', false);
      expect(status).toHaveProperty('estimatedFileSize');
      expect(typeof status.estimatedFileSize).toBe('function');
    });
  });

  describe('clearCache', () => {
    it('should clear the master video cache', () => {
      // This is mainly a smoke test since we can't easily test the cache state
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  describe('validateTrimParameters', () => {
    // We can't directly test this private method, but we can test its effects
    it('should reject invalid durations through trimTimer', async () => {
      const invalidDurations = [0, -1, 3600];

      for (const duration of invalidDurations) {
        const result = await service.trimTimer({ duration });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('integration with TimerGenerationService', () => {
    it('should work correctly for durations that can be trimmed', () => {
      // Test durations that should use trimming (test file limit)
      const trimmableDurations = [10, 30, 45, 59];

      trimmableDurations.forEach(duration => {
        expect(service.canHandleDuration(duration)).toBe(true);
        const estimatedSize = service.getEstimatedSize(duration);
        expect(estimatedSize).toBeGreaterThan(0);
      });
    });

    it('should reject durations that need frame generation', () => {
      // Test durations that should fall back to frame generation (exceed 59:59 limit)
      const nonTrimmableDurations = [3600, 7200, 10800]; // 60:00, 120:00, 180:00

      nonTrimmableDurations.forEach(duration => {
        expect(service.canHandleDuration(duration)).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing master video gracefully', async () => {
      // This test verifies that the service handles missing master video
      // without crashing, returning appropriate error information
      const result = await service.trimTimer({ duration: 30 }); // Use valid duration for test file

      expect(result.success).toBe(false);
      expect(result.error).toContain('Master timer video not available');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.size).toBe(0);
    });
  });
});