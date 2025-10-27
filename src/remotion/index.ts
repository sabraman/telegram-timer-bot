import { Composition } from "remotion";
import { TimerVideo } from "./TimerVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TimerVideo"
        component={TimerVideo}
        durationInFrames={60 * 30} // 60 seconds at 30fps
        fps={30}
        width={512}
        height={512}
      />
    </>
  );
};

export { RemotionRoot };