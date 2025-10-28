"use client";

import { useState, useEffect } from "react";
import { GlowingProgressBar } from "./glowing-progress-bar";

export function ProgressBarDemo() {
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 0;
        }
        return prev + 0.5;
      });
    }, 25); // Update every 25ms with smaller increments for smoother animation

    return () => clearInterval(interval);
  }, [isAnimating]);

  return (
    <div className="w-full max-w-md space-y-8 p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Glowing Progress Bar Demo</h2>
        <p className="text-white/70 text-sm">Watch the progress bar fill from 0% to 100%</p>
        <div className="text-3xl font-mono font-bold text-white">
          {progress.toFixed(1)}%
        </div>
      </div>

      {/* Main demo */}
      <div className="relative w-64 h-64 mx-auto">
        <div className="absolute inset-0 bg-white/10 rounded-2xl flex items-center justify-center">
          <span className="text-white/50 text-lg">Progress Container</span>
        </div>
        <GlowingProgressBar
          progress={progress}
          glow={true}
          className="rounded-2xl"
        />
      </div>

      {/* Different variants */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-2">
            <div className="absolute inset-0 bg-white/10 rounded-xl"></div>
            <GlowingProgressBar
              progress={progress}
              variant="default"
              className="rounded-xl"
            />
          </div>
          <span className="text-xs text-white/70">Pink</span>
        </div>

        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-2">
            <div className="absolute inset-0 bg-white/10 rounded-xl"></div>
            <GlowingProgressBar
              progress={progress}
              variant="white"
              className="rounded-xl"
            />
          </div>
          <span className="text-xs text-white/70">White</span>
        </div>

        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-2">
            <div className="absolute inset-0 bg-white/10 rounded-xl"></div>
            <GlowingProgressBar
              progress={progress}
              variant="default"
              blur={2}
              className="rounded-xl"
            />
          </div>
          <span className="text-xs text-white/70">Blur</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setIsAnimating(!isAnimating)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        >
          {isAnimating ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => setProgress(0)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}