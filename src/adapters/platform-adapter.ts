/**
 * Platform Adapter Interface
 *
 * Provides a unified interface for platform-specific behavior,
 * eliminating scattered platform detection code throughout the codebase.
 */

export interface PlatformInfo {
  readonly isIOS: boolean;
  readonly isWebKit: boolean;
  readonly isSafari: boolean;
  readonly isChrome: boolean;
  readonly isFirefox: boolean;
  readonly userAgent: string;
  readonly platform: string;
}

export interface PlatformCapabilities {
  readonly supportsVariableFonts: boolean;
  readonly supportsFontFaceAPI: boolean;
  readonly supportsOffscreenCanvas: boolean;
  readonly supportsWorkerFonts: boolean;
  readonly supportsWebCodecs: boolean;
  readonly hasMemoryLimitations: boolean;
  readonly requiresPreRenderedText: boolean;
}

export interface PlatformAdapter {
  /**
   * Get comprehensive platform information
   */
  getPlatformInfo(): PlatformInfo;

  /**
   * Get platform-specific capabilities
   */
  getCapabilities(): PlatformCapabilities;

  /**
   * Check if platform requires iOS-specific workarounds
   */
  requiresIOSWorkarounds(): boolean;

  /**
   * Check if platform requires WebKit-specific workarounds
   */
  requiresWebKitWorkarounds(): boolean;

  /**
   * Get recommended rendering strategy for this platform
   */
  getRenderingStrategy(): 'variable-fonts' | 'static-fonts' | 'pre-rendered-text';

  /**
   * Check if platform supports specific font features
   */
  supportsFontFeature(feature: 'variation' | 'weight' | 'width' | 'stretch'): boolean;
}

/**
 * Default Platform Adapter Implementation
 * Analyzes the current browser environment and provides platform-specific information
 */
export class DefaultPlatformAdapter implements PlatformAdapter {
  private platformInfo: PlatformInfo;
  private capabilities: PlatformCapabilities;

  constructor(userAgent?: string) {
    this.platformInfo = this.analyzePlatform(userAgent);
    this.capabilities = this.determineCapabilities(this.platformInfo);
  }

  getPlatformInfo(): PlatformInfo {
    return this.platformInfo;
  }

  getCapabilities(): PlatformCapabilities {
    return this.capabilities;
  }

  requiresIOSWorkarounds(): boolean {
    return this.platformInfo.isIOS;
  }

  requiresWebKitWorkarounds(): boolean {
    return this.platformInfo.isWebKit && !this.platformInfo.isChrome;
  }

  getRenderingStrategy(): 'variable-fonts' | 'static-fonts' | 'pre-rendered-text' {
    if (this.platformInfo.isIOS) {
      return 'pre-rendered-text';
    }

    if (this.capabilities.supportsVariableFonts) {
      return 'variable-fonts';
    }

    return 'static-fonts';
  }

  supportsFontFeature(feature: 'variation' | 'weight' | 'width' | 'stretch'): boolean {
    switch (feature) {
      case 'variation':
        return this.capabilities.supportsVariableFonts && !this.platformInfo.isIOS;
      case 'weight':
        return true; // Basic font weight support is universal
      case 'width':
        return this.capabilities.supportsVariableFonts && !this.platformInfo.isIOS;
      case 'stretch':
        return this.capabilities.supportsVariableFonts && !this.platformInfo.isIOS;
      default:
        return false;
    }
  }

  private analyzePlatform(userAgent?: string): PlatformInfo {
    const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');

    // iOS detection
    const isIOS = /iPhone|iPad|iPod/.test(ua);

    // WebKit detection (excluding Chrome which uses Blink but has WebKit in UA)
    const isWebKit = /AppleWebKit/.test(ua) && !/Chrome/.test(ua);

    // Safari detection
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);

    // Chrome detection
    const isChrome = /Chrome/.test(ua);

    // Firefox detection
    const isFirefox = /Firefox/.test(ua);

    return {
      isIOS,
      isWebKit,
      isSafari,
      isChrome,
      isFirefox,
      userAgent: ua,
      platform: this.detectPlatform(ua)
    };
  }

  private determineCapabilities(info: PlatformInfo): PlatformCapabilities {
    return {
      supportsVariableFonts: this.checkVariableFontSupport(info),
      supportsFontFaceAPI: this.checkFontFaceAPISupport(),
      supportsOffscreenCanvas: this.checkOffscreenCanvasSupport(),
      supportsWorkerFonts: this.checkWorkerFontSupport(info),
      supportsWebCodecs: this.checkWebCodecsSupport(),
      hasMemoryLimitations: info.isIOS,
      requiresPreRenderedText: info.isIOS
    };
  }

  private detectPlatform(_ua: string): string {
    if (isIOS) return 'iOS';
    if (isMac) return 'macOS';
    if (isWindows) return 'Windows';
    if (isAndroid) return 'Android';
    if (isLinux) return 'Linux';
    return 'Unknown';
  }

  private checkVariableFontSupport(info: PlatformInfo): boolean {
    // Most modern browsers support variable fonts except older Safari/iOS
    if (info.isIOS) return false;
    if (info.isSafari) {
      // Safari 10+ supports variable fonts
      const safariVersionMatch = info.userAgent.match(/Version\/(\d+)/);
      return safariVersionMatch ? parseInt(safariVersionMatch[1], 10) >= 10 : false;
    }
    // Chrome, Firefox, Edge all support variable fonts
    return info.isChrome || info.isFirefox;
  }

  private checkFontFaceAPISupport(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof FontFace !== 'undefined';
  }

  private checkOffscreenCanvasSupport(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof OffscreenCanvas !== 'undefined';
  }

  private checkWorkerFontSupport(info: PlatformInfo): boolean {
    // Workers have limited font support in iOS
    if (info.isIOS) return false;
    return this.checkFontFaceAPISupport();
  }

  private checkWebCodecsSupport(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof VideoEncoder !== 'undefined' &&
           typeof AudioEncoder !== 'undefined';
  }
}

// Helper variables for platform detection
const isIOS = /iPhone|iPad|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
const isMac = /Mac/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
const isWindows = /Win/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
const isAndroid = /Android/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
const isLinux = /Linux/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

/**
 * Singleton instance for platform detection
 */
let platformAdapterInstance: PlatformAdapter | null = null;

/**
 * Get the platform adapter instance
 * Creates a singleton instance on first call
 */
export function getPlatformAdapter(userAgent?: string): PlatformAdapter {
  if (!platformAdapterInstance) {
    platformAdapterInstance = new DefaultPlatformAdapter(userAgent);
  }
  return platformAdapterInstance;
}

/**
 * Utility functions for backward compatibility
 * These provide the same interface as the old scattered detection code
 */
export function isIOSPlatform(): boolean {
  return getPlatformAdapter().getPlatformInfo().isIOS;
}

export function isWebKitPlatform(): boolean {
  return getPlatformAdapter().getPlatformInfo().isWebKit;
}

export function requiresIOSWorkarounds(): boolean {
  return getPlatformAdapter().requiresIOSWorkarounds();
}

export function requiresWebKitWorkarounds(): boolean {
  return getPlatformAdapter().requiresWebKitWorkarounds();
}