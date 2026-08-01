import { MapPin, ScanFace } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";
import { requerirSesion } from "@/lib/session";

export const metadata: Metadata = { title: "Fichar" };

export default async function FicharPage() {
  const { user } = await requerirSesion();
  const nombre = user.name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bienvenida{nombre && `, ${nombre}`}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Desde acá vas a registrar tu ingreso y tu egreso.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="bg-muted rounded-full p-4">
            <ScanFace className="text-muted-foreground size-8" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">El fichaje se habilita en la Fase 3</p>
            <p className="text-muted-foreground text-sm">
              Va a pedirte permiso de cámara y de ubicación.
            </p>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <MapPin className="size-3.5" />
            Solo se puede fichar dentro del radio del jardín.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
