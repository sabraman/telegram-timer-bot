import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate
} from "remotion";

type TimerStyle = "countdown" | "circular" | "progress";

interface TimerVideoProps {
  style?: TimerStyle;
}

export const TimerVideo: React.FC<TimerVideoProps> = ({ style = "countdown" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentSecond = Math.floor(frame / fps);
  const remainingSeconds = Math.max(0, 60 - currentSecond);
  const progress = currentSecond / 60;

  const renderCountdown = () => (
    <div className="flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 w-full h-full">
      <div className="text-center">
        <div className="text-white font-bold" style={{ fontSize: "180px" }}>
          {remainingSeconds}
        </div>
        <div className="text-white text-4xl mt-4">
          {remainingSeconds === 1 ? "second" : "seconds"} left
        </div>
      </div>
    </div>
  );

  const renderCircular = () => {
    const radius = 180;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <div className="flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-600 w-full h-full">
        <svg width="400" height="400" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="200"
            cy="200"
            r={radius}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="20"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="200"
            cy="200"
            r={radius}
            stroke="white"
            strokeWidth="20"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute text-white font-bold" style={{ fontSize: "120px" }}>
          {remainingSeconds}
        </div>
      </div>
    );
  };

  const renderProgressBar = () => {
    const barWidth = interpolate(progress, [0, 1], [400, 0]);

    return (
      <div className="flex flex-col items-center justify-center bg-gradient-to-br from-orange-500 to-red-600 w-full h-full">
        <div className="text-white font-bold mb-8" style={{ fontSize: "120px" }}>
          {remainingSeconds}
        </div>
        <div className="w-96 h-12 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-100"
            style={{ width: `${barWidth}px` }}
          />
        </div>
        <div className="text-white text-4xl mt-8">
          {remainingSeconds === 1 ? "second" : "seconds"} remaining
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (style) {
      case "circular":
        return renderCircular();
      case "progress":
        return renderProgressBar();
      default:
        return renderCountdown();
    }
  };

  return (
    <AbsoluteFill>
      {renderContent()}
    </AbsoluteFill>
  );
};