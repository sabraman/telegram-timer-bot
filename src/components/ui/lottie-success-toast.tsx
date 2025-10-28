"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";
import doneAnimation from "../../../done-animation.json";

interface LottieSuccessToastProps {
  isVisible: boolean;
  onComplete?: () => void;
}

const LottieSuccessToast = ({
  isVisible,
  onComplete,
}: LottieSuccessToastProps) => {
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (isVisible) {
      // Force re-render of animation when it becomes visible
      setAnimationKey((prev) => prev + 1);

      // Auto-hide after animation completes (approximately 2 seconds)
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
      <div
        className={`
          flex items-center justify-center p-0 rounded-2xl shadow-xl
          bg-background
          animate-in fade-in-0 zoom-in-95 duration-300
        `}
      >
        <div className="w-36 h-36">
          <Lottie
            key={animationKey}
            animationData={doneAnimation}
            loop={false}
            autoplay={true}
            className="w-full h-full"
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))',
              mixBlendMode: 'normal',
              opacity: 1
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default LottieSuccessToast;