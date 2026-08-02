import { LogIn, LogOut } from "lucide-react";
import type { Metadata } from "next";

import { PanelFichaje } from "@/components/fichar/panel-fichaje";
import { Card, CardContent } from "@/components/ui/card";
import { estadoDelDia } from "@/lib/asistencia";
import { obtenerConfiguracion } from "@/lib/empleados";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/session";
import { ETIQUETA_TURNO } from "@/lib/validaciones";

export const metadata: Metadata = { title: "Fichar" };

// El estado de hoy cambia con cada fichaje: servir una versión cacheada
// mostraría "registrá tu entrada" a alguien que ya entró.
export const dynamic = "force-dynamic";

export default async function FicharPage() {
  const { user } = await requerirSesion();
  const nombre = user.name?.split(" ")[0] ?? "";

  if (!user.empleadoId) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Tu usuario no tiene una empleada asociada, así que no puede fichar.
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = await obtenerConfiguracion();

  const [estado, empleado] = await Promise.all([
    estadoDelDia(user.empleadoId, config.zonaHoraria),
    prisma.empleado.findUnique({
      where: { id: user.empleadoId },
      select: {
        turno: true,
        _count: { select: { descriptores: { where: { activo: true } } } },
      },
    }),
  ]);

  const horario = empleado
    ? await prisma.horario.findUnique({ where: { turno: empleado.turno } })
    : null;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{nombre && `, ${nombre}`}
        </h1>
        {horario && empleado && (
          <p className="text-muted-foreground mt-1 text-sm">
            Turno {ETIQUETA_TURNO[empleado.turno].toLowerCase()}, de{" "}
            {horario.horaInicio} a {horario.horaFin}
          </p>
        )}
      </div>

      <PanelFichaje
        proximo={estado.proximo}
        sinEnrolar={(empleado?._count.descriptores ?? 0) === 0}
      />

      {(estado.horaIngreso || estado.horaSalida) && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-5 text-center">
            <div>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
                <LogIn className="size-3.5" />
                Entrada
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {estado.horaIngreso ?? "—"}
              </p>
              {estado.minutosTarde > 0 && (
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
                  {estado.minutosTarde} min tarde
                </p>
              )}
            </div>

            <div>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
                <LogOut className="size-3.5" />
                Salida
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {estado.horaSalida ?? "—"}
              </p>
              {estado.trabajadas && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {estado.trabajadas} trabajadas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
