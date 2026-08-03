import type { Metadata } from "next";
import { Suspense } from "react";

import {
  colorDeEstadoLicencia,
  etiquetaDeEstadoLicencia,
  etiquetaDeTipoLicencia,
} from "@/components/licencias/etiquetas";
import { FiltrosLicencias } from "@/components/licencias/filtros-licencias";
import { ListaComprobantes } from "@/components/licencias/lista-comprobantes";
import { RevisarLicencia } from "@/components/licencias/revisar-licencia";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listarEmpleadosParaSelector } from "@/lib/empleados";
import {
  isoDesdeDia,
  listarLicencias,
  rangoLegible,
  type FilaLicencia,
} from "@/lib/licencias";
import { requerirAdmin } from "@/lib/session";
import { filtrosLicenciasSchema, TIPOS_LICENCIA } from "@/lib/validaciones";

export const metadata: Metadata = { title: "Licencias" };

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function LicenciasPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  await requerirAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Licencias</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Solicitudes de licencia y revisión de los comprobantes cargados.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** "03/08/2026 14:20", en hora de quien mira. */
function fechaCorta(instante: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instante);
}

async function Contenido({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;

  const parseado = filtrosLicenciasSchema.safeParse(params);
  const filtros = parseado.success ? parseado.data : {};

  const [{ filas, resumen }, empleadas] = await Promise.all([
    listarLicencias(filtros),
    listarEmpleadosParaSelector(),
  ]);

  return (
    <div className="space-y-4">
      <FiltrosLicencias empleadas={empleadas} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumen etiqueta="Pendientes" valor={resumen.pendientes} />
        <Resumen etiqueta="Aprobadas" valor={resumen.aprobadas} />
        <Resumen etiqueta="Rechazadas" valor={resumen.rechazadas} />
      </div>

      {filas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No hay licencias con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filas.map((l) => (
            <Tarjeta key={l.id} licencia={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{etiqueta}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
}

function Tarjeta({ licencia: l }: { licencia: FilaLicencia }) {
  // Mientras está pendiente, el tipo y el rango que tiene guardados son el
  // marcador provisorio con el que nació: mostrarlos como si fueran datos
  // sería mentir. Lo único cierto todavía es cuándo llegó el certificado.
  const pendiente = l.estado === "PENDIENTE";

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">{l.empleado.nombre}</p>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {pendiente ? (
                <span>Certificado recibido el {fechaCorta(l.creadaEn)}</span>
              ) : (
                <>
                  <span className="tabular-nums">
                    {rangoLegible(l.fechaInicio, l.fechaFin)}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {l.dias} {l.dias === 1 ? "día" : "días"}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{etiquetaDeTipoLicencia(l.tipo)}</span>
                </>
              )}
              {l.empleado.sala && (
                <>
                  <span aria-hidden>·</span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: l.empleado.colorSala ?? undefined }}
                      aria-hidden
                    />
                    {l.empleado.sala}
                  </span>
                </>
              )}
            </p>
          </div>

          <Badge variant={colorDeEstadoLicencia(l.estado)}>
            {etiquetaDeEstadoLicencia(l.estado)}
          </Badge>
        </div>

        {l.motivo && <p className="text-sm">{l.motivo}</p>}

        <ListaComprobantes comprobantes={l.comprobantes} />

        {l.observaciones && (
          <p className="text-muted-foreground border-border border-l-2 pl-3 text-sm">
            {l.observaciones}
            {l.revisadaPor && (
              <span className="block text-xs">— {l.revisadaPor}</span>
            )}
          </p>
        )}

        <div className="flex justify-end">
          <RevisarLicencia
            id={l.id}
            quien={l.empleado.nombre}
            estado={l.estado}
            valores={{
              tipo: l.tipo as (typeof TIPOS_LICENCIA)[number],
              fechaInicio: isoDesdeDia(l.fechaInicio),
              fechaFin: isoDesdeDia(l.fechaFin),
            }}
            sinComprobantes={l.comprobantes.length === 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}
