import { PencilLine } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { EditarAsistencia } from "@/components/asistencias/editar-asistencia";
import { FiltrosAsistencias } from "@/components/asistencias/filtros-asistencias";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listarAsistencias,
  periodosConDatos,
  type FilaAsistencia,
} from "@/lib/asistencia";
import {
  listarEmpleadosParaSelector,
  listarSalas,
  obtenerConfiguracion,
} from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";
import { periodoDe } from "@/lib/time";
import {
  ESTADOS_ASISTENCIA,
  ETIQUETA_ESTADO_ASISTENCIA,
  filtrosAsistenciasSchema,
} from "@/lib/validaciones";

export const metadata: Metadata = { title: "Asistencias" };

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function AsistenciasPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  await requerirAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asistencias</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Registros diarios, horas trabajadas y correcciones manuales.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** "2026-08-02" → "sáb 02/08". */
function etiquetaDeDia(fecha: Date): string {
  const dia = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(fecha);

  const numero = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(fecha);

  return `${dia} ${numero}`;
}

function colorDeEstado(estado: string) {
  if (estado === "PRESENTE") return "secondary" as const;
  if (estado === "AUSENTE") return "destructive" as const;
  return "outline" as const;
}

async function Contenido({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const config = await obtenerConfiguracion();

  const parseado = filtrosAsistenciasSchema.safeParse(params);
  const crudos = parseado.success ? parseado.data : {};
  // Sin período elegido se muestra el mes en curso, que es lo que la
  // dirección quiere ver el 99% de las veces que entra acá.
  const periodo = crudos.periodo ?? periodoDe(new Date(), config.zonaHoraria);

  const [{ filas, resumen }, periodos, empleadas, salas] = await Promise.all([
    listarAsistencias({ ...crudos, periodo }, config.zonaHoraria),
    periodosConDatos(config.zonaHoraria),
    listarEmpleadosParaSelector(),
    listarSalas(),
  ]);

  return (
    <div className="space-y-4">
      <FiltrosAsistencias
        periodos={periodos}
        periodoActual={periodo}
        empleadas={empleadas}
        salas={salas.map((s) => ({ id: s.id, nombre: s.nombre }))}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Resumen etiqueta="Jornadas" valor={String(resumen.dias)} />
        <Resumen etiqueta="Horas trabajadas" valor={resumen.horas} />
        <Resumen etiqueta="Llegadas tarde" valor={String(resumen.tardanzas)} />
        <Resumen
          etiqueta="Minutos de tardanza"
          valor={String(resumen.minutosTarde)}
        />
      </div>

      {filas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No hay jornadas registradas con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead>Empleada</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Tarde</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <Fila key={f.id} fila={f} />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
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

function Fila({ fila: f }: { fila: FilaAsistencia }) {
  const dia = etiquetaDeDia(f.fecha);

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        {dia}
        {f.ajustadaManual && (
          <span
            className="text-muted-foreground ml-1.5 inline-flex align-middle"
            title="Corregida a mano"
          >
            <PencilLine className="size-3" />
          </span>
        )}
      </TableCell>
      <TableCell>{f.empleado.nombre}</TableCell>
      <TableCell>
        {f.empleado.sala ? (
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: f.empleado.colorSala ?? undefined }}
              aria-hidden
            />
            {f.empleado.sala}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">{f.horaIngreso ?? "—"}</TableCell>
      <TableCell className="tabular-nums">{f.horaSalida ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">
        {f.trabajadas ?? "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {f.minutosTarde > 0 ? `${f.minutosTarde}′` : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={colorDeEstado(f.estado)}>
          {ETIQUETA_ESTADO_ASISTENCIA[
            f.estado as (typeof ESTADOS_ASISTENCIA)[number]
          ] ?? f.estado}
        </Badge>
      </TableCell>
      <TableCell>
        <EditarAsistencia
          id={f.id}
          quien={f.empleado.nombre}
          dia={dia}
          valores={{
            horaIngreso: f.horaIngreso ?? "",
            horaSalida: f.horaSalida ?? "",
            estado: f.estado as (typeof ESTADOS_ASISTENCIA)[number],
            observaciones: f.observaciones ?? "",
          }}
        />
      </TableCell>
    </TableRow>
  );
}
