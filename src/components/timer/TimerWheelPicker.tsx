import type { WheelPickerOption } from "~/components/ui/wheel-picker";
import { WheelPicker, WheelPickerWrapper } from "~/components/ui/wheel-picker";

const createArray = (length: number, add = 0): WheelPickerOption[] =>
  Array.from({ length }, (_, i) => {
    const value = i + add;
    return {
      label: value.toString().padStart(2, "0"),
      value: value.toString(),
    };
  });

const minuteOptions = createArray(61, 0); // 0-60 minutes
const secondOptions = createArray(60, 0); // 0-59 seconds

interface TimerWheelPickerProps {
  minutes: number;
  seconds: number;
  onMinutesChange: (minutes: number) => void;
  onSecondsChange: (seconds: number) => void;
}

export function TimerWheelPicker({ minutes, seconds, onMinutesChange, onSecondsChange }: TimerWheelPickerProps) {
  const handleMinutesChange = (value: string) => {
    onMinutesChange(parseInt(value, 10) || 0);
  };

  const handleSecondsChange = (value: string) => {
    onSecondsChange(parseInt(value, 10) || 0);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Timer Duration</h1>

        <WheelPickerWrapper>
          <WheelPicker
            options={minuteOptions}
            value={minutes.toString()}
            onValueChange={handleMinutesChange}
            infinite
            classNames={{
              highlightWrapper: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-xl border-0 rounded-xl font-bold text-xl",
              optionItem: "text-zinc-400 dark:text-zinc-500 font-semibold text-lg",
            }}
          />
          <WheelPicker
            options={secondOptions}
            value={seconds.toString()}
            onValueChange={handleSecondsChange}
            infinite
            classNames={{
              highlightWrapper: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-xl border-0 rounded-xl font-bold text-xl",
              optionItem: "text-zinc-400 dark:text-zinc-500 font-semibold text-lg",
            }}
          />
        </WheelPickerWrapper>

        <div className="text-center">
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
          </div>
        </div>
      </div>
    </div>
  );
}