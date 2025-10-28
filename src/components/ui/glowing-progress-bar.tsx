"use client";

import { memo, useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

interface GlowingProgressBarProps {
  progress: number; // 0-100
  blur?: number;
  variant?: "default" | "white";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  animationDuration?: number;
  borderWidth?: number;
}

const GlowingProgressBar = memo(
  ({
    progress = 0,
    blur = 0,
    variant = "default",
    glow = false,
    className,
    animationDuration = 0.5,
    borderWidth = 3,
    disabled = false,
  }: GlowingProgressBarProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (disabled || !containerRef.current) return;

      const element = containerRef.current;

      // Ensure progress is within bounds
      const clampedProgress = Math.max(0, Math.min(100, progress));

      // Always set active to 1 for progress bar (we want it to always be visible)
      element.style.setProperty("--active", "1");

      // Set progress directly for the filling effect
      element.style.setProperty("--progress", String(clampedProgress));

            }, [progress, disabled]);

    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity",
            glow && "opacity-100",
            variant === "white" && "border-white",
            disabled && "!block"
          )}
        />
        <div
          ref={containerRef}
          style={
            {
              "--blur": `${blur}px`,
              "--active": disabled ? "0" : "1",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--repeating-conic-gradient-times": "5",
              "--animation-duration": `${animationDuration}s`,
              "--gradient":
                variant === "white"
                  ? `repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  var(--black),
                  var(--black) calc(25% / var(--repeating-conic-gradient-times))
                )`
                  : `radial-gradient(circle, #ff69b4 10%, #ff69b400 20%),
                radial-gradient(circle at 40% 40%, #ff69b4 5%, #ff69b400 15%),
                radial-gradient(circle at 60% 60%, #ffc0cb 10%, #ffc0cb00 20%),
                radial-gradient(circle at 40% 60%, #ffb6c1 10%, #ffb6c100 20%),
                repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  #ff69b4 0%,
                  #ff69b4 calc(25% / var(--repeating-conic-gradient-times)),
                  #ffc0cb calc(50% / var(--repeating-conic-gradient-times)),
                  #ffb6c1 calc(75% / var(--repeating-conic-gradient-times)),
                  #ff69b4 calc(100% / var(--repeating-conic-gradient-times))
                )`,
            } as React.CSSProperties
          }
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity",
            glow && "opacity-100 shadow-[0_0_8px_var(--glow-color),0_0_16px_var(--glow-color),0_0_24px_var(--glow-color)]",
            blur > 0 && "blur-[var(--blur)]",
            className,
            disabled && "!hidden"
          )}
          style={
            {
              "--blur": `${blur}px`,
              "--active": disabled ? "0" : "1",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--repeating-conic-gradient-times": "5",
              "--animation-duration": `${animationDuration}s`,
              "--glow-color": variant === "white" ? "#ffffff" : "#ff69b4",
              "--gradient":
                variant === "white"
                  ? `repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  var(--black),
                  var(--black) calc(25% / var(--repeating-conic-gradient-times))
                )`
                  : `radial-gradient(circle, #ff69b4 10%, #ff69b400 20%),
                radial-gradient(circle at 40% 40%, #ff69b4 5%, #ff69b400 15%),
                radial-gradient(circle at 60% 60%, #ffc0cb 10%, #ffc0cb00 20%),
                radial-gradient(circle at 40% 60%, #ffb6c1 10%, #ffb6c100 20%),
                repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  #ff69b4 0%,
                  #ff69b4 calc(25% / var(--repeating-conic-gradient-times)),
                  #ffc0cb calc(50% / var(--repeating-conic-gradient-times)),
                  #ffb6c1 calc(75% / var(--repeating-conic-gradient-times)),
                  #ff69b4 calc(100% / var(--repeating-conic-gradient-times))
                )`,
            } as React.CSSProperties
          }
        >
          <div
            className={cn(
              "glow",
              "rounded-[inherit]",
              'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
              "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
              "after:[background:var(--gradient)] after:[background-attachment:fixed]",
              "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
              "after:[transition:progress_var(--animation-duration,ease-in-out)]",
              "after:[mask-clip:padding-box,border-box]",
              "after:[mask-composite:intersect]",
              "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_45deg,#fff_0deg,#fff_calc(var(--progress)*3.6deg),#00000000_calc(var(--progress)*3.6deg))]"
            )}
          />
        </div>
      </>
    );
  }
);

GlowingProgressBar.displayName = "GlowingProgressBar";

export { GlowingProgressBar };