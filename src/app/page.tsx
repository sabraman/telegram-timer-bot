import { ClientTimerGenerator } from "~/components/timer/ClientTimerGenerator";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <ClientTimerGenerator />
      </div>
    </main>
  );
}
