import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-muted rounded-full p-4">
        <WifiOff className="text-muted-foreground size-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Sin conexión</h1>
        <p className="text-muted-foreground max-w-xs text-sm">
          El fichaje necesita internet para validar tu ubicación. Conectate y
          volvé a intentar.
        </p>
      </div>
    </main>
  );
}
