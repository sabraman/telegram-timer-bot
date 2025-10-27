import { Cherry } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { TimerGenerator } from "~/components/timer/TimerGenerator";
import { ClientTimerGenerator } from "~/components/timer/ClientTimerGenerator";
import { getAuth } from "~/lib/security";

export default async function HomePage() {
  const { userData } = await getAuth();
  // const name: string = userData?.firstName ?? userData?.username ?? "world";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-8">
      <h1 className="text-3xl font-bold">
        Hello {userData?.firstName}!
        <br />
        <span className="text-sm text-muted-foreground">
          {userData?.username}
        </span>
      </h1>

      <p className="text-muted-foreground w-full text-center">
        Create custom 60-second timer videos and share them on Telegram!
      </p>

      <div className="w-full max-w-lg space-y-6">
        <ClientTimerGenerator />

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Or use the server-side version (requires additional setup):
          </p>
          <TimerGenerator />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/demo">
          <Button className="gap-2" variant="outline">
            <Cherry className="size-4" /> Demo
          </Button>
        </Link>
      </div>
    </main>
  );
}
