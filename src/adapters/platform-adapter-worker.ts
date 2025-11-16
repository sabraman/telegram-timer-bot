/**
 * Platform Adapter for Web Workers
 *
 * Worker-compatible version of platform detection that doesn't rely on DOM APIs.
 * This file can be bundled with the worker or imported via importScripts.
 */

// Platform detection utilities for worker context
export interface PlatformInfo {
  readonly isIOS: boolean;
  readonly isWebKit: boolean;
  readonly isSafari: boolean;
  readonly isChrome: boolean;
  readonly userAgent: string;
  readonly platform: string;
}

export interface PlatformCapabilities {
  readonly supportsVariableFonts: boolean;
  readonly supportsFontFaceAPI: boolean;
  readonly supportsWorkerFonts: boolean;
  readonly hasMemoryLimitations: boolean;
  readonly requiresPreRenderedText: boolean;
}

/**
 * Platform adapter for worker context
 */
export class WorkerPlatformAdapter {
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

    return {
      isIOS,
      isWebKit,
      isSafari,
      isChrome,
      userAgent: ua,
      platform: this.detectPlatform(ua)
    };
  }

  private determineCapabilities(info: PlatformInfo): PlatformCapabilities {
    return {
      supportsVariableFonts: this.checkVariableFontSupport(info),
      supportsFontFaceAPI: this.checkFontFaceAPISupport(),
      supportsWorkerFonts: this.checkWorkerFontSupport(info),
      hasMemoryLimitations: info.isIOS,
      requiresPreRenderedText: info.isIOS
    };
  }

  private detectPlatform(ua: string): string {
    if (info.isIOS) return 'iOS';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Win/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) return 'Android';
    if (/Linux/.test(ua)) return 'Linux';
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
    return info.isChrome;
  }

  private checkFontFaceAPISupport(): boolean {
    return typeof FontFace !== 'undefined';
  }

  private checkWorkerFontSupport(info: PlatformInfo): boolean {
    // Workers have limited font support in iOS
    if (info.isIOS) return false;
    return this.checkFontFaceAPISupport();
  }
}

/**
 * Global platform adapter instance for worker context
 */
let workerPlatformAdapter: WorkerPlatformAdapter | null = null;

/**
 * Get the platform adapter instance in worker context
 */
export function getWorkerPlatformAdapter(userAgent?: string): WorkerPlatformAdapter {
  if (!workerPlatformAdapter) {
    workerPlatformAdapter = new WorkerPlatformAdapter(userAgent);
  }
  return workerPlatformAdapter;
}

/**
 * Utility functions for backward compatibility in worker context
 */
export function isIOSPlatformWorker(): boolean {
  return getWorkerPlatformAdapter().getPlatformInfo().isIOS;
}

export function isWebKitPlatformWorker(): boolean {
  return getWorkerPlatformAdapter().getPlatformInfo().isWebKit;
}

export function requiresIOSWorkaroundsWorker(): boolean {
  return getWorkerPlatformAdapter().requiresIOSWorkarounds();
}

export function requiresWebKitWorkaroundsWorker(): boolean {
  return getWorkerPlatformAdapter().requiresWebKitWorkarounds();
}