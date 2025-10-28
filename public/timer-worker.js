// Web Worker for timer video generation
self.onmessage = function(e) {
  const { timerSeconds, workerId, action } = e.data;

  try {
    if (action !== 'generate') {
      return; // Only handle generation, cache management is in main thread
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

    // Pre-set font and shadow properties
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 480px system-ui';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Generate all frames and store as ImageData
    const frames = [];
    const startTime = performance.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      const currentSecond = Math.floor(frame / fps);
      const remainingSeconds = Math.max(0, timerSeconds - currentSecond);

      // Clear canvas
      ctx.clearRect(0, 0, 512, 512);

      // Draw timer number
      ctx.fillText(remainingSeconds.toString(), centerX, centerY);

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