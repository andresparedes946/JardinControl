import { PencilLine } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SelectorPeriodo } from "@/components/asistencias/selector-periodo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { historialDeEmpleado, periodosConDatos } from "@/lib/asistencia";
import { obtenerConfiguracion } from "@/lib/empleados";
import { requerirSesion } from "@/lib/session";
import { periodoDe } from "@/lib/time";
import {
  ESTADOS_ASISTENCIA,
  ETIQUETA_ESTADO_ASISTENCIA,
} from "@/lib/validaciones";

export const metadata: Metadata = { title: "Mi historial" };

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function MiHistorialPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const { user } = await requerirSesion();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi historial</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tus ingresos, egresos y horas trabajadas mes a mes.
        </p>
      </div>

      {user.empleadoId ? (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Contenido empleadoId={user.empleadoId} searchParams={searchParams} />
        </Suspense>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Tu usuario no tiene una empleada asociada, así que no tiene
            historial de asistencia.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function etiquetaDeDia(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(fecha);
}

async function Contenido({
  empleadoId,
  searchParams,
}: {
  empleadoId: string;
  searchParams: Params;
}) {
  const params = await searchParams;
  const config = await obtenerConfiguracion();

  const pedido = typeof params.periodo === "string" ? params.periodo : null;
  const periodo =
    pedido && /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido)
      ? pedido
      : periodoDe(new Date(), config.zonaHoraria);

  const [{ filas, resumen }, periodos] = await Promise.all([
    historialDeEmpleado(empleadoId, periodo, config.zonaHoraria),
    periodosConDatos(config.zonaHoraria, empleadoId),
  ]);

  return (
    <div className="space-y-4">
      <SelectorPeriodo periodos={periodos} actual={periodo} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumen etiqueta="Días trabajados" valor={String(resumen.dias)} />
        <Resumen etiqueta="Horas del mes" valor={resumen.horas} />
        <Resumen etiqueta="Llegadas tarde" valor={String(resumen.tardanzas)} />
      </div>

      {filas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No hay jornadas registradas en este mes.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filas.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  {/* `capitalize` pondría mayúscula en cada palabra y daría
                      "Domingo, 02 De Agosto". Solo va la primera letra. */}
                  <p className="font-medium first-letter:uppercase">
                    {etiquetaDeDia(f.fecha)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
                    {f.horaIngreso ?? "—"} a {f.horaSalida ?? "—"}
                    {f.minutosTarde > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-500">
                        {f.minutosTarde} min tarde
                      </span>
                    )}
                  </p>
                  {f.observaciones && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {f.observaciones}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {f.ajustadaManual && (
                    <span
                      className="text-muted-foreground"
                      title="Corregida por la dirección"
                    >
                      <PencilLine className="size-3.5" />
                    </span>
                  )}
                  <Badge variant="outline">
                    {ETIQUETA_ESTADO_ASISTENCIA[
                      f.estado as (typeof ESTADOS_ASISTENCIA)[number]
                    ] ?? f.estado}
                  </Badge>
                  <p className="w-14 text-right text-lg font-semibold tabular-nums">
                    {f.trabajadas ?? "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{etiqueta}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
}
