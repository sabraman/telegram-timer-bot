// Web Worker for timer video generation
self.onmessage = async function(e) {
  const { timerSeconds, workerId, action, fontLoaded, fontBuffer, generatedFonts, debugMode = false } = e.data;

  // Debug logging function for worker
  const debugLog = (...args) => {
    if (debugMode) {
      console.log('🐛 [WORKER DEBUG]', ...args);
    }
  };

  try {
    if (action !== 'generate') {
      return; // Only handle generation, cache management is in main thread
    }

    // Debug: WebKit detection in worker
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Worker Context';
    const isWebKit = userAgent.includes('AppleWebKit') && !userAgent.includes('Chrome');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isIOS = userAgent.includes('iPhone') || userAgent.includes('iPad');

    console.log("👷 Worker Environment Detection:", {
      userAgent: userAgent.substring(0, 50) + '...',
      isWebKit,
      isSafari,
      isIOS,
      inWorker: typeof self !== 'undefined',
      hasFontFace: typeof FontFace !== 'undefined',
      hasWorkerFonts: typeof self !== 'undefined' && typeof self.fonts !== 'undefined',
      hasOffscreenCanvas: typeof OffscreenCanvas !== 'undefined'
    });

    console.log(`🔤 Worker received font status: ${fontLoaded ? 'LOADED' : 'NOT LOADED'}`);
    console.log(`🔤 Worker received font buffer: ${fontBuffer ? `${(fontBuffer.byteLength / 1024).toFixed(1)} KB` : 'NONE'}`);

    // Log generated fonts for iOS
    if (generatedFonts) {
      console.log("🍎 iOS: Worker received generated fonts:", {
        condensed: generatedFonts.condensed ? `${(generatedFonts.condensed.byteLength / 1024).toFixed(1)} KB` : 'NONE',
        normal: generatedFonts.normal ? `${(generatedFonts.normal.byteLength / 1024).toFixed(1)} KB` : 'NONE',
        extended: generatedFonts.extended ? `${(generatedFonts.extended.byteLength / 1024).toFixed(1)} KB` : 'NONE',
        isIOS: true
      });
    } else {
      console.log("🔤 Worker received no generated fonts (non-iOS or fallback)");
    }

    // Test WebKit-specific features
    if (isWebKit) {
      console.log("🍎 WebKit Worker Detected - Testing FontFace API Support...");

      // Test FontFace constructor
      try {
        const testFontFace = new FontFace('TestFont', new ArrayBuffer(100));
        console.log("✅ FontFace constructor works in WebKit worker");
      } catch (error) {
        console.error("❌ FontFace constructor failed in WebKit worker:", error);
      }

      // Test self.fonts API
      if (typeof self !== 'undefined' && self.fonts) {
        console.log("✅ self.fonts API available in WebKit worker");
      } else {
        console.error("❌ self.fonts API NOT available in WebKit worker");
      }

      console.log("🍎 WebKit Worker Font Support Summary:", {
        fontFaceConstructor: typeof FontFace !== 'undefined',
        fontsAPI: typeof self !== 'undefined' && typeof self.fonts !== 'undefined',
        expectsLimitedSupport: true,
        fallbackRequired: "Likely"
      });
    }

    // Register font faces directly in worker if buffer is available and not iOS
    let fontsRegistered = false;

    // iOS: Register generated static fonts in worker
    if (isIOS && generatedFonts && typeof FontFace !== 'undefined') {
      console.log("🍎 iOS Detected: Registering generated static fonts in Web Worker...");

      try {
        // Create font faces from generated static fonts
        const fontFaces = [
          new FontFace('HeadingNowCondensed', generatedFonts.condensed, {
            weight: '1000',
            style: 'normal',
            display: 'swap'
          }),
          new FontFace('HeadingNowNormal', generatedFonts.normal, {
            weight: '1000',
            variationSettings: "wdth 1000",
            style: 'normal',
            display: 'swap'
          }),
          new FontFace('HeadingNowExtended', generatedFonts.extended, {
            weight: '1000',
            style: 'normal',
            display: 'swap'
          })
        ];

        // Load and register all generated font faces
        for (let i = 0; i < fontFaces.length; i++) {
          const fontFace = fontFaces[i];
          console.log(`🍎 iOS: Loading generated font ${i + 1}/${fontFaces.length}: ${fontFace.family}`);

          await fontFace.load();
          console.log(`✅ iOS: Generated font loaded: ${fontFace.family}`);

          if (typeof self !== 'undefined' && self.fonts) {
            self.fonts.add(fontFace);
            console.log(`✅ iOS: Generated font registered in worker: ${fontFace.family}`);
          } else {
            console.error(`❌ iOS: self.fonts not available - cannot register: ${fontFace.family}`);
            throw new Error('self.fonts API not available');
          }
        }

        fontsRegistered = true;
        console.log("✅ iOS: All generated static fonts registered successfully in Web Worker!");
      } catch (fontError) {
        console.error("❌ iOS: Generated font registration failed:", {
          error: fontError.message,
          stack: fontError.stack,
          generatedFontsAvailable: !!generatedFonts,
          isIOS
        });
        fontsRegistered = false;
      }
    }
    // iOS fallback: Try to use fonts pre-registered in main thread
    else if (isIOS) {
      console.log("🍎 iOS Fallback: Using fonts pre-registered in main thread");
      fontsRegistered = true; // Assume fonts are available from main thread registration
      console.log("✅ iOS: Skipping worker font registration, using main thread fonts");
    }
    // Non-iOS: Register fonts in worker as usual
    else if (fontBuffer && typeof FontFace !== 'undefined') {
      try {
        console.log("🔤 Registering font faces in Web Worker...");

        // Create separate font faces for each variation
        const fontFaces = [
          // State 1: Ultra-condensed (width 1000) for 0-9 seconds
          new FontFace('HeadingNowCondensed', fontBuffer, {
            weight: '1000',
            stretch: 'ultra-condensed',
            style: 'normal',
            display: 'swap',
            variationSettings: "'wght' 1000, 'wdth' 1000"
          }),

          // State 2: Condensed (width 410) for 10-60 seconds (two digits)
          new FontFace('HeadingNowNormal', fontBuffer, {
            weight: '1000',
            stretch: 'condensed',
            style: 'normal',
            display: 'swap',
            variationSettings: "'wght' 1000, 'wdth' 410"
          }),

          // State 3: Extended (width 170) for MM:SS format
          new FontFace('HeadingNowExtended', fontBuffer, {
            weight: '1000',
            stretch: 'ultra-expanded',
            style: 'normal',
            display: 'swap',
            variationSettings: "'wght' 1000, 'wdth' 170"
          })
        ];

        // Load and register all font faces with detailed logging
        for (let i = 0; i < fontFaces.length; i++) {
          const fontFace = fontFaces[i];
          console.log(`🔤 Loading font face ${i + 1}/${fontFaces.length}: ${fontFace.family}`);

          try {
            // Test font face creation
            console.log(`🔤 FontFace object created:`, {
              family: fontFace.family,
              weight: fontFace.weight,
              stretch: fontFace.stretch,
              hasBuffer: !!fontBuffer
            });

            // Load the font face
            console.log(`🔤 Loading font face: ${fontFace.family}...`);
            await fontFace.load();
            console.log(`✅ Font face loaded successfully: ${fontFace.family}`);

            // Test self.fonts availability
            if (typeof self !== 'undefined' && self.fonts) {
              console.log(`🔤 Adding font to worker fonts: ${fontFace.family}`);
              self.fonts.add(fontFace);
              console.log(`✅ Font face registered in worker: ${fontFace.family}`);
            } else {
              console.error(`❌ self.fonts not available in worker - cannot register: ${fontFace.family}`);
              throw new Error('self.fonts API not available');
            }
          } catch (error) {
            console.error(`❌ Failed to register font face ${fontFace.family}:`, {
              error: error.message,
              stack: error.stack,
              fontFace: fontFace.family,
              step: i + 1
            });

            // WebKit-specific error logging
            if (isWebKit) {
              console.error("🍎 WebKit Font Registration Failed:", {
                fontFamily: fontFace.family,
                webKitLimitation: "FontFace API in Web Workers has limited support",
                fallbackRequired: true,
                errorDetails: error.message
              });
            }

            // If any font fails, mark all as failed
            fontsRegistered = false;
            break;
          }
        }

        if (fontsRegistered !== false) {
          fontsRegistered = true;
          console.log("✅ All font faces registered successfully in Web Worker!");
        }
      } catch (fontError) {
        console.error("❌ Font registration process failed:", {
          error: fontError.message,
          stack: fontError.stack,
          fontBufferAvailable: !!fontBuffer,
          fontBufferSize: fontBuffer ? `${(fontBuffer.byteLength / 1024).toFixed(1)} KB` : 'none',
          isWebKit
        });

        fontsRegistered = false;
      }
    } else {
      if (!isIOS) {
        console.log("⚠️ No font buffer available or FontFace API not supported in worker");
        console.log("🔤 Font Registration Prerequisites Check:", {
          fontBufferAvailable: !!fontBuffer,
          fontFaceConstructorAvailable: typeof FontFace !== 'undefined',
          bufferSize: fontBuffer ? `${(fontBuffer.byteLength / 1024).toFixed(1)} KB` : 'none',
          isWebKit
        });
      }
      // For iOS, fontsRegistered is already set to true above
    }

    // Create canvas in worker
    const canvas = new OffscreenCanvas(512, 512);
    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false
    });

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    const fps = 1;
    const duration = timerSeconds + 1;
    const totalFrames = fps * duration;
    const centerX = 256;
    const centerY = 256;

    // Pre-set shadow properties
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Format time function - dynamic formatting based on remaining seconds
    function formatTime(seconds) {
      if (seconds < 60) {
        return seconds.toString(); // Keep current behavior for < 60s
      } else {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
    }

    // Dynamic font settings function using separate font faces
    function getFontSettings(remainingSeconds) {
      // Use maximum font size for all states
      const baseSize = 512; // Maximum size for all formats (full canvas height)

      let fontName;

      if (remainingSeconds <= 9) {
        fontName = 'HeadingNowCondensed'; // State 1: 0-9s - ultra condensed
      } else if (remainingSeconds < 60) {
        fontName = 'HeadingNowNormal';    // State 2: 10-59s - condensed
      } else {
        fontName = 'HeadingNowExtended';  // State 3: >=60s (MM:SS format) - extended
      }

      // Use appropriate font face if registered in worker, otherwise fallback to system font
      if (fontsRegistered) {
        console.log(`✅ Using worker-registered font face: ${fontName}`);
        return {
          font: `${baseSize}px ${fontName}`,
          variations: null, // No variations needed - using separate font faces
          name: fontName,
          baseSize
        };
      } else {
        // Fallback: Use Arial Black for bold single digits, Arial for others
        const fallbackFont = remainingSeconds <= 9 ? 'Arial Black' : 'Arial';
        console.log(`⚠️ Using fallback font: ${fallbackFont} (fonts not registered in worker)`);
        return {
          font: `${baseSize}px ${fallbackFont}`,
          variations: null,
          name: fallbackFont,
          baseSize
        };
      }
    }

    // Generate all frames and store as ImageData
    const frames = [];
    const startTime = performance.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      const currentSecond = Math.floor(frame / fps);
      const remainingSeconds = Math.max(0, timerSeconds - currentSecond);

      // Clear canvas
      ctx.clearRect(0, 0, 512, 512);

      // Get dynamic font settings based on remaining time
      const fontSettings = getFontSettings(remainingSeconds);

      // Apply font settings with verification
      try {
        console.log(`🔤 Applying font settings: ${fontSettings.font}`);
        ctx.font = fontSettings.font;

        // Test if font is actually applied by measuring text
        const testText = 'Test';
        const testMetrics = ctx.measureText(testText);
        const expectedWidth = fontSettings.baseSize * 0.6; // Rough estimate for normal width

        console.log(`🔤 Font Application Test:`, {
          fontApplied: fontSettings.font,
          testText: testText,
          measuredWidth: testMetrics.width.toFixed(1) + 'px',
          expectedWidth: expectedWidth.toFixed(1) + 'px',
          widthRatio: (testMetrics.width / expectedWidth).toFixed(2),
          fontBoundingBox: testMetrics.fontBoundingBox ? {
            width: testMetrics.fontBoundingBox.width,
            height: testMetrics.fontBoundingBox.height
          } : 'not available'
        });

        // If measured width is much smaller than expected, font probably didn't load
        if (testMetrics.width < expectedWidth * 0.3) {
          console.warn(`⚠️ Font may not be applied properly - applying fallback`, {
            measuredWidth: testMetrics.width.toFixed(1) + 'px',
            expectedWidth: expectedWidth.toFixed(1) + 'px',
            ratio: (testMetrics.width / expectedWidth).toFixed(2),
            attemptedFont: fontSettings.font,
            fallbackFont: `${fontSettings.baseSize}px Arial`
          });

          // Try fallback
          ctx.font = `${fontSettings.baseSize}px Arial`;
          console.log(`🔧 Applied fallback font: Arial`);

          // Test fallback
          const fallbackMetrics = ctx.measureText(testText);
          console.log(`✅ Fallback font applied:`, {
            fallbackFont: `${fontSettings.baseSize}px Arial`,
            fallbackWidth: fallbackMetrics.width.toFixed(1) + 'px',
            improved: fallbackMetrics.width > testMetrics.width
          });
        } else {
          console.log(`✅ Font applied successfully:`, {
            font: fontSettings.font,
            measuredWidth: testMetrics.width.toFixed(1) + 'px',
            expectedWidth: expectedWidth.toFixed(1) + 'px',
            ratio: (testMetrics.width / expectedWidth).toFixed(2),
            fontName: fontSettings.name
          });
        }

        // WebKit-specific font application logging
        if (isWebKit) {
          console.log("🍎 WebKit Font Application Summary:", {
            attemptedFont: fontSettings.font,
            actualFont: ctx.font,
            fontRegistered: fontsRegistered,
            fallbackUsed: testMetrics.width < expectedWidth * 0.3,
            webKitIssue: fontsRegistered ? "Font registered but not applied correctly" : "Font registration failed"
          });
        }
      } catch (e) {
        console.error(`❌ Font application failed:`, {
          error: e.message,
          attemptedFont: fontSettings.font,
          fontSettings: fontSettings,
          isWebKit,
          fontsRegistered
        });

        // Fallback to basic system font
        ctx.font = `${fontSettings.baseSize}px Arial`;
        console.log(`🔧 Applied emergency fallback font: Arial`);
      }

      // Format time based on remaining seconds
      const timeText = formatTime(remainingSeconds);

      // Debug: Log font usage for key frames to show variations
      if (frame === 0 || remainingSeconds === 60 || remainingSeconds === 10 || remainingSeconds === 9) {
        const finalMetrics = ctx.measureText(timeText);
        console.log(`🔤 Font settings for frame ${frame} (${remainingSeconds}s):`, {
          font: ctx.font,
          fontName: fontSettings.name,
          timeText: timeText,
          textWidth: finalMetrics.width.toFixed(1) + 'px',
          fontsRegistered: fontsRegistered,
          fontBufferAvailable: !!fontBuffer
        });
      }

      // Draw timer text
      ctx.fillText(timeText, centerX, centerY);

      // Capture frame as ImageData
      const imageData = ctx.getImageData(0, 0, 512, 512);
      frames.push(imageData);

      // Send progress update for every 25% to give meaningful feedback
      const progressPercent = Math.round(((frame + 1) / totalFrames) * 100);
      if (progressPercent % 25 === 0 || frame === totalFrames - 1) {
        self.postMessage({
          type: 'progress',
          workerId,
          progress: progressPercent,
          frame: frame + 1,
          totalFrames
        });
      }
      }

    console.log(`🔨 WORKER: Generated ${frames.length} frames for ${timerSeconds}s timer`);

    // Send completed frames back to main thread
    self.postMessage({
      type: 'complete',
      workerId,
      frames,
      timerSeconds,
      totalFrames,
      fromCache: false
    });

  } catch (error) {
    self.postMessage({
      type: 'error',
      workerId,
      error: error.message
    });
  }
};