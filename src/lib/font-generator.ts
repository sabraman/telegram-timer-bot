export interface GeneratedFont {
  buffer: ArrayBuffer;
  name: string;
  weight: number;
  width?: number;
}

export function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function createFontFaceBuffer(fontBuffer: ArrayBuffer, familyName: string): FontFace {
  // Create a basic FontFace without variation settings for iOS compatibility
  return new FontFace(familyName, fontBuffer, {
    weight: '1000',
    style: 'normal',
    display: 'swap'
  });
}

// Simple iOS fallback: Use the original font buffer with different font families
// This won't have variable width support but will at least render the correct font
export function createSimpleIOSFonts(fontBuffer: ArrayBuffer): {
  condensed: GeneratedFont;
  normal: GeneratedFont;
  extended: GeneratedFont;
} {
  console.log('🔧 Creating simple iOS font variants (no variable width support)...');

  // For iOS, we'll use the same font buffer but register it with different family names
  // This doesn't provide variable width support but ensures the font loads properly
  const fonts = {
    condensed: {
      buffer: fontBuffer.slice(0), // Create a copy
      name: 'HeadingNowCondensed',
      weight: 1000,
      width: 1000
    },
    normal: {
      buffer: fontBuffer.slice(0), // Create a copy
      name: 'HeadingNowNormal',
      weight: 1000,
      width: 410
    },
    extended: {
      buffer: fontBuffer.slice(0), // Create a copy
      name: 'HeadingNowExtended',
      weight: 1000,
      width: 170
    }
  };

  console.log('✅ Simple iOS font variants created:', {
    condensed: `${(fonts.condensed.buffer.byteLength / 1024).toFixed(1)} KB`,
    normal: `${(fonts.normal.buffer.byteLength / 1024).toFixed(1)} KB`,
    extended: `${(fonts.extended.buffer.byteLength / 1024).toFixed(1)} KB`
  });

  return fonts;
}