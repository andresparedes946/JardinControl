import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Marcador para las secciones que se implementan en fases posteriores.
 * Existe para que la navegación esté completa desde la Fase 0 y no haya
 * enlaces rotos mientras el sistema se construye por partes.
 */
export function PantallaPendiente({
  titulo,
  descripcion,
  fase,
}: {
  titulo: string;
  descripcion: string;
  fase: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{descripcion}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="bg-muted rounded-full p-3">
            <Construction className="text-muted-foreground size-6" />
          </div>
          <div>
            <p className="font-medium">Se implementa en la {fase}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              La sección ya está enlazada y protegida por rol.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
