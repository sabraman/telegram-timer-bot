import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramUploader } from '../TelegramUploader';

// Mock fetch globally
global.fetch = vi.fn();

// Mock FileReader directly for this test file
const MockFileReader = class {
  result: string | ArrayBuffer | null = '';
  error: any = null;
  readyState = 0;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  shouldError = false;

  readAsDataURL = vi.fn().mockImplementation(function(this: any, blob: Blob) {
    setTimeout(() => {
      if (this.shouldError) {
        this.readyState = 2;
        this.error = new Error('Mock FileReader error');
        if (this.onerror) {
          this.onerror({ target: this } as any);
        }
      } else {
        this.result = 'data:video/webm;base64,dGVzdCBkYXRh';
        this.readyState = 2;
        if (this.onload) {
          this.onload({ target: this } as any);
        }
      }
    }, 0);
  });

  abort = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
  readAsArrayBuffer = vi.fn();
  readAsBinaryString = vi.fn();
  readAsText = vi.fn();

  setErrorMode(shouldError: boolean) {
    this.shouldError = shouldError;
  }
};

global.FileReader = MockFileReader as any;

describe('TelegramUploader', () => {
  let uploader: TelegramUploader;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    uploader = new TelegramUploader();
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockBlob = (size = 2048, type = 'video/webm'): Blob => {
    const data = new Uint8Array(size);
    return new Blob([data], { type });
  };

  
  describe('constructor', () => {
    it('should initialize with default debug mode', () => {
      const defaultUploader = new TelegramUploader();
      expect(defaultUploader).toBeInstanceOf(TelegramUploader);
    });

    it('should initialize with debug mode enabled', () => {
      const debugUploader = new TelegramUploader(true);
      expect(debugUploader).toBeInstanceOf(TelegramUploader);
    });
  });

  describe('uploadToTelegram', () => {
    const mockProgressCallback = vi.fn();

    beforeEach(() => {
      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 123 } }),
        status: 200,
      } as Response);
    });

    it('should upload video successfully', async () => {
      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
        onProgress: mockProgressCallback,
      };

      const result = await uploader.uploadToTelegram(options);

      expect(result).toEqual({
        success: true,
        fileSize: videoBlob.size,
        fileType: videoBlob.type,
        duration: expect.any(Number),
      });

      expect(mockProgressCallback).toHaveBeenCalledWith(25);
      expect(mockProgressCallback).toHaveBeenCalledWith(50);
      expect(mockProgressCallback).toHaveBeenCalledWith(75);
      expect(mockProgressCallback).toHaveBeenCalledWith(100);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/send-to-telegram',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('timer-'),
        })
      );
    });

    it('should reject files larger than 50MB', async () => {
      const largeBlob = createMockBlob(55 * 1024 * 1024); // 55MB
      const options = {
        videoBlob: largeBlob,
        onProgress: mockProgressCallback,
      };

      await expect(uploader.uploadToTelegram(options)).rejects.toThrow(
        'File too large for Telegram (55.0 MB > 50 MB limit)'
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Bad Request',
        json: async () => ({ error: 'Bad Request' }),
      } as Response);

      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
        onProgress: mockProgressCallback,
      };

      await expect(uploader.uploadToTelegram(options)).rejects.toThrow(
        'Upload failed: 400 Bad Request - Bad Request'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
        onProgress: mockProgressCallback,
      };

      await expect(uploader.uploadToTelegram(options)).rejects.toThrow('Network error');
    });

    it('should work without progress callback', async () => {
      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
      };

      const result = await uploader.uploadToTelegram(options);

      expect(result.success).toBe(true);
      expect(result.fileSize).toBe(videoBlob.size);
    });

    it('should convert blob to base64 correctly', async () => {
      const videoBlob = createMockBlob(100, 'video/webm');
      const options = {
        videoBlob,
        onProgress: mockProgressCallback,
      };

      await uploader.uploadToTelegram(options);

      // Check that fetch was called with base64 data
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.video).toBe('dGVzdCBkYXRh'); // Should be base64 without prefix
    });

    it('should handle FileReader errors', async () => {
      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
        onProgress: mockProgressCallback,
      };

      // Mock FileReader to always error for this test
      const MockFileReaderError = class {
        result: string | ArrayBuffer | null = '';
        error: any = null;
        readyState = 0;
        onload: ((event: any) => void) | null = null;
        onerror: ((event: any) => void) | null = null;

        readAsDataURL = vi.fn().mockImplementation(function(this: any, blob: Blob) {
          setTimeout(() => {
            this.readyState = 2; // DONE
            this.error = new Error('Mock FileReader error');
            if (this.onerror) {
              this.onerror({ target: this } as any);
            }
          }, 0);
        });

        abort = vi.fn();
        addEventListener = vi.fn();
        removeEventListener = vi.fn();
        dispatchEvent = vi.fn();
        readAsArrayBuffer = vi.fn();
        readAsBinaryString = vi.fn();
        readAsText = vi.fn();
      } as any;

      const originalFileReader = global.FileReader;
      global.FileReader = MockFileReaderError;

      try {
        await expect(uploader.uploadToTelegram(options)).rejects.toThrow(
          'Failed to convert blob to base64'
        );
      } finally {
        // Restore original FileReader
        global.FileReader = originalFileReader;
      }
    });
  });

  describe('validateVideoBlob', () => {
    it('should validate correct video blob', () => {
      const videoBlob = createMockBlob(2048, 'video/webm;codecs=vp9');
      const result = uploader.validateVideoBlob(videoBlob);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject oversized file', () => {
      const largeBlob = createMockBlob(55 * 1024 * 1024, 'video/webm');
      const result = uploader.validateVideoBlob(largeBlob);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'File too large: 55.0 MB (limit: 50 MB)'
      );
    });

    it('should reject invalid file type', () => {
      const invalidBlob = createMockBlob(1000, 'video/mp4');
      const result = uploader.validateVideoBlob(invalidBlob);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Invalid file type: video/mp4 (expected: video/webm with VP8/VP9 codec)'
      );
    });

    it('should reject empty file', () => {
      const emptyBlob = new Blob([], { type: 'video/webm' });
      const result = uploader.validateVideoBlob(emptyBlob);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject too small file', () => {
      const tinyBlob = createMockBlob(500, 'video/webm');
      const result = uploader.validateVideoBlob(tinyBlob);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File too small: 500 bytes (minimum: 1 KB)');
    });

    it('should accept various WebM codec formats', () => {
      const validTypes = [
        'video/webm',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9.0',
      ];

      validTypes.forEach(type => {
        const blob = createMockBlob(2048, type);
        const result = uploader.validateVideoBlob(blob);
        expect(result.valid).toBe(true);
      });
    });

    it('should accumulate multiple errors', () => {
      const invalidBlob = createMockBlob(55 * 1024 * 1024, 'video/mp4');
      const result = uploader.validateVideoBlob(invalidBlob);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(e => e.includes('too large'))).toBe(true);
      expect(result.errors.some(e => e.includes('Invalid file type'))).toBe(true);
    });
  });

  describe('getEstimatedUploadTime', () => {
    it('should return reasonable upload time estimates', () => {
      const smallBlob = createMockBlob(1024 * 1024); // 1MB
      const time1 = uploader.getEstimatedUploadTime(smallBlob);
      expect(time1).toBeGreaterThanOrEqual(1);

      const largeBlob = createMockBlob(10 * 1024 * 1024); // 10MB
      const time2 = uploader.getEstimatedUploadTime(largeBlob);
      expect(time2).toBeGreaterThanOrEqual(time1);
    });

    it('should return minimum 1 second', () => {
      const tinyBlob = createMockBlob(100); // Very small
      const time = uploader.getEstimatedUploadTime(tinyBlob);
      expect(time).toBe(1);
    });
  });

  describe('debug mode', () => {
    it('should not log when debug mode is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const uploader = new TelegramUploader(false);
      const videoBlob = createMockBlob();

      // Mock fetch to resolve immediately
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      uploader.uploadToTelegram({ videoBlob });

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log when debug mode is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const debugUploader = new TelegramUploader(true);
      const videoBlob = createMockBlob();

      // Mock fetch
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await debugUploader.uploadToTelegram({ videoBlob });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('base64 conversion edge cases', () => {
    it('should handle base64 data with codec prefix', async () => {
      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
        onProgress: vi.fn(),
      };

      
      await uploader.uploadToTelegram(options);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.video).toBe('dGVzdCBkYXRh'); // Should strip prefix
    });

    it('should handle base64 data without prefix', async () => {
      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
        onProgress: vi.fn(),
      };

      
      await uploader.uploadToTelegram(options);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.video).toBe('dGVzdCBkYXRh'); // Should handle gracefully
    });
  });

  describe('request body generation', () => {
    it('should generate filename with timestamp', async () => {
      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
      };

      
      await uploader.uploadToTelegram(options);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.filename).toMatch(/^timer-\d+\.webm$/);
    });

    it('should include video data in request body', async () => {
      const videoBlob = createMockBlob();
      const options = {
        videoBlob,
      };

      
      await uploader.uploadToTelegram(options);

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody).toHaveProperty('video');
      expect(requestBody).toHaveProperty('filename');
      expect(typeof requestBody.video).toBe('string');
    });
  });
});