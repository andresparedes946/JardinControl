import {
  CalendarCheck,
  Clock,
  FileText,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

const TARJETAS: { etiqueta: string; icono: LucideIcon }[] = [
  { etiqueta: "Presentes hoy", icono: UserCheck },
  { etiqueta: "Ausentes", icono: UserX },
  { etiqueta: "Llegadas tarde", icono: Clock },
  { etiqueta: "Licencias activas", icono: FileText },
  { etiqueta: "Horas del mes", icono: CalendarCheck },
];

export default async function DashboardPage() {
  const sesion = await requerirAdmin();
  const nombre = sesion.user.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{nombre && `, ${nombre}`}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Resumen del jardín. Los indicadores se conectan en la Fase 7.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {TARJETAS.map(({ etiqueta, icono: Icono }) => (
          <Card key={etiqueta}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {etiqueta}
              </CardTitle>
              <Icono className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-2xl font-semibold">—</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
