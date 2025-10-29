// Web Worker for timer video generation
self.onmessage = async function(e) {
  const { timerSeconds, workerId, action, fontLoaded, fontBuffer } = e.data;

  try {
    if (action !== 'generate') {
      return; // Only handle generation, cache management is in main thread
    }

    console.log(`🔤 Worker received font status: ${fontLoaded ? 'LOADED' : 'NOT LOADED'}`);
    console.log(`🔤 Worker received font buffer: ${fontBuffer ? `${(fontBuffer.byteLength / 1024).toFixed(1)} KB` : 'NONE'}`);

    // Register font faces directly in worker if buffer is available
    let fontsRegistered = false;
    if (fontBuffer && typeof FontFace !== 'undefined') {
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

        // Load and register all font faces
        for (const fontFace of fontFaces) {
          await fontFace.load();
          self.fonts.add(fontFace);
          console.log(`✅ Registered font face: ${fontFace.family}`);
        }

        fontsRegistered = true;
        console.log("✅ All font faces registered successfully in Web Worker!");
      } catch (fontError) {
        console.warn("⚠️ Failed to register font faces in worker:", fontError);
        fontsRegistered = false;
      }
    } else {
      console.log("⚠️ No font buffer available or FontFace API not supported in worker");
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
        ctx.font = fontSettings.font;

        // Test if font is actually applied by measuring text
        const testMetrics = ctx.measureText('Test');
        const expectedWidth = fontSettings.baseSize * 0.6; // Rough estimate for normal width

        // If measured width is much smaller than expected, font probably didn't load
        if (testMetrics.width < expectedWidth * 0.3) {
          console.warn(`⚠️ Font may not be applied properly (width: ${testMetrics.width.toFixed(1)}px < expected: ${expectedWidth.toFixed(1)}px)`);
          // Try fallback
          ctx.font = `${fontSettings.baseSize}px Arial`;
          console.log(`🔧 Applied fallback font: Arial`);
        } else {
          console.log(`✅ Applied font: ${fontSettings.font} (measured width: ${testMetrics.width.toFixed(1)}px)`);
        }
      } catch (e) {
        console.log(`❌ Failed to apply font: ${e.message}`);
        // Fallback to basic system font
        ctx.font = `${fontSettings.baseSize}px Arial`;
        console.log(`🔧 Applied fallback font: Arial`);
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