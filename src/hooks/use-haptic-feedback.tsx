import { hapticFeedback } from "@telegram-apps/sdk-react";

/**
 * Triggers haptic feedback for different interaction types.
 * Returns functions to trigger different haptic feedback types.
 */
export function useHapticFeedback() {
  const triggerImpact = (
    style: "light" | "medium" | "heavy" | "rigid" | "soft" = "medium",
  ) => {
    if (hapticFeedback.impactOccurred.isSupported()) {
      hapticFeedback.impactOccurred(style);
    }
  };

  const triggerNotification = (type: "error" | "success" | "warning") => {
    if (hapticFeedback.notificationOccurred.isSupported()) {
      hapticFeedback.notificationOccurred(type);
    }
  };

  const triggerSelectionChange = () => {
    if (hapticFeedback.selectionChanged.isSupported()) {
      hapticFeedback.selectionChanged();
    }
  };

  return {
    impactOccurred: triggerImpact,
    notificationOccurred: triggerNotification,
    selectionChanged: triggerSelectionChange,
  };
}
