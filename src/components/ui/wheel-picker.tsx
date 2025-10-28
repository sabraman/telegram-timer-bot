import "@ncdai/react-wheel-picker/style.css";

import * as WheelPickerPrimitive from "@ncdai/react-wheel-picker";

import { cn } from "~/lib/utils";
import { GlowingProgressBar } from "./glowing-progress-bar";

type WheelPickerOption = WheelPickerPrimitive.WheelPickerOption;
type WheelPickerClassNames = WheelPickerPrimitive.WheelPickerClassNames;

function WheelPickerWrapper({
  className,
  glow = false,
  progress = 0,
  ...props
}: React.ComponentProps<typeof WheelPickerPrimitive.WheelPickerWrapper> & {
  glow?: boolean;
  progress?: number;
}) {
  return (
    <div className="relative">
      <WheelPickerPrimitive.WheelPickerWrapper
        className={cn(
          "w-56 rounded-2xl border border-zinc-200 bg-white px-2 shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900",
          "*:data-rwp:first:*:data-rwp-highlight-wrapper:rounded-l-2xl",
          "*:data-rwp:last:*:data-rwp-highlight-wrapper:rounded-r-2xl",
          className,
        )}
        {...props}
      />
      <GlowingProgressBar
        progress={progress}
        glow={glow}
        className="rounded-2xl"
        animationDuration={0.3}
      />
    </div>
  );
}

function WheelPicker({
  classNames,
  ...props
}: React.ComponentProps<typeof WheelPickerPrimitive.WheelPicker>) {
  return (
    <WheelPickerPrimitive.WheelPicker
      classNames={{
        optionItem: "text-zinc-400 dark:text-zinc-500 font-semibold text-lg",
        highlightWrapper:
          "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-xl border-0 rounded-xl font-bold text-xl",
        highlightItem: "text-white",
        ...classNames,
      }}
      {...props}
    />
  );
}

export { WheelPicker, WheelPickerWrapper };
export type { WheelPickerClassNames, WheelPickerOption };
