export interface UploadOptions {
  videoBlob: Blob;
  onProgress?: (progress: number) => void;
  debugMode?: boolean;
}

export interface UploadResult {
  success: boolean;
  fileSize: number;
  fileType: string;
  duration?: number;
}

/**
 * TelegramUploader handles video uploads to Telegram
 */
export class TelegramUploader {
  private debugMode: boolean;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  /**
   * Upload video blob to Telegram
   */
  async uploadToTelegram(options: UploadOptions): Promise<UploadResult> {
    const { videoBlob, onProgress } = options;

    this.debugLog("📤 Starting Telegram upload:", {
      size: `${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`,
      type: videoBlob.type
    });

    const startTime = performance.now();

    try {
      // Validate file size
      const fileSizeMB = videoBlob.size / 1024 / 1024;
      if (fileSizeMB > 50) {
        throw new Error(`File too large for Telegram (${fileSizeMB.toFixed(1)} MB > 50 MB limit)`);
      }

      // Convert blob to base64
      onProgress?.(25);
      const base64Data = await this.blobToBase64(videoBlob);
      this.debugLog("✅ Converted to base64");

      onProgress?.(50);

      // Send to Telegram API
      const requestBody = {
        video: base64Data,
        filename: `timer-${Date.now()}.webm`
      };

      this.debugLog("🔍 Sending to API:", {
        requestBodySize: JSON.stringify(requestBody).length,
        videoDataLength: base64Data.length,
        filename: requestBody.filename,
        videoDataPrefix: base64Data.substring(0, 50) + "..."
      });

      const response = await fetch('/api/send-to-telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      onProgress?.(75);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      onProgress?.(100);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      this.debugLog("✅ Telegram upload completed:", {
        totalTime: `${totalTime.toFixed(2)}ms`,
        fileSize: `${fileSizeMB.toFixed(2)} MB`,
        fileType: videoBlob.type,
        result
      });

      return {
        success: true,
        fileSize: videoBlob.size,
        fileType: videoBlob.type,
        duration: totalTime
      };

    } catch (error) {
      this.debugLog("❌ Telegram upload failed:", error);
      throw error;
    }
  }

  /**
   * Convert blob to base64 string
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      this.debugLog("🔍 Converting blob to base64:", {
        blobSize: blob.size,
        blobType: blob.type,
        isBlobValid: blob instanceof Blob
      });

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;

        this.debugLog("🔍 FileReader result:", {
          resultLength: result.length,
          resultPrefix: result.substring(0, 50) + "...",
          resultSuffix: "..." + result.substring(result.length - 50)
        });

        // Handle different codec prefixes with efficient string-based approach
        let base64Data = result;

        // Remove any data URL prefix for codec handling
        const base64Prefix = "base64,";
        const prefixIndex = result.indexOf(base64Prefix);
        if (prefixIndex !== -1) {
          base64Data = result.substring(prefixIndex + base64Prefix.length);
        }

        this.debugLog("🔍 Final base64 data:", {
          base64Length: base64Data.length,
          base64Prefix: base64Data.substring(0, 50) + "..."
        });

        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error("Failed to convert blob to base64"));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Validate video blob for Telegram requirements
   */
  validateVideoBlob(videoBlob: Blob): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size (50MB Telegram limit)
    const fileSizeMB = videoBlob.size / 1024 / 1024;
    if (fileSizeMB > 50) {
      errors.push(`File too large: ${fileSizeMB.toFixed(1)} MB (limit: 50 MB)`);
    }

    // Check file type
    const validTypes = [
      'video/webm',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9.0'
    ];

    const isValidType = validTypes.some(type => {
      // Exact match
      if (videoBlob.type === type) return true;
      // Check if blob type starts with valid type (for codec variations)
      if (videoBlob.type.startsWith(type)) return true;
      // Check if valid type is contained in blob type (for specific codecs)
      if (videoBlob.type.includes(type)) return true;
      return false;
    });

    if (!isValidType) {
      errors.push(`Invalid file type: ${videoBlob.type} (expected: video/webm with VP8/VP9 codec)`);
    }

    // Check minimum file size
    if (videoBlob.size === 0) {
      errors.push("File is empty");
    } else if (videoBlob.size < 1024) {
      errors.push(`File too small: ${videoBlob.size} bytes (minimum: 1 KB)`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get estimated upload time based on file size and connection
   */
  getEstimatedUploadTime(videoBlob: Blob): number {
    // Estimate based on typical connection speeds
    const fileSizeMB = videoBlob.size / 1024 / 1024;
    const assumedSpeedMbps = 5; // Conservative assumption
    const speedMBps = assumedSpeedMbps / 8; // Convert to MB/s

    return Math.max(1, fileSizeMB / speedMBps); // Minimum 1 second
  }

  /**
   * Debug logging function
   */
  private debugLog(...args: unknown[]) {
    if (this.debugMode) {
      console.log('🔧 [TelegramUploader]', ...args);
    }
  }
}