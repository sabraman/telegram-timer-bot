import { ClientTimerGenerator } from "~/components/timer/ClientTimerGenerator";
import { DebugToggle } from "~/components/ui/debug-toggle";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <ClientTimerGenerator />
      </div>
      <DebugToggle />
    </main>
  );
}
