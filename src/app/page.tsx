import { ClientTimerGenerator } from "~/components/timer/ClientTimerGenerator";
import { ProgressBarDemo } from "~/components/ui/progress-bar-demo";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-12">
        <ProgressBarDemo />
        <ClientTimerGenerator />
      </div>
    </main>
  );
}
