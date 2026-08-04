import { AlertTriangle, Lock } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SelectorPeriodo } from "@/components/asistencias/selector-periodo";
import { GenerarLiquidacion } from "@/components/sueldos/generar-liquidacion";
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
import { obtenerConfiguracion } from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";
import {
  calcularPeriodo,
  periodosLiquidables,
  pesos,
  type FilaSueldo,
} from "@/lib/sueldos";
import { nombreDePeriodo, periodoDe } from "@/lib/time";
import { ETIQUETA_TURNO, TURNOS } from "@/lib/validaciones";

export const metadata: Metadata = { title: "Sueldos" };

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function SueldosPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  await requerirAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sueldos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Liquidación mensual por horas trabajadas y valor hora.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const config = await obtenerConfiguracion();

  const pedido = typeof params.periodo === "string" ? params.periodo : null;
  const periodo =
    pedido && /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido)
      ? pedido
      : periodoDe(new Date(), config.zonaHoraria);

  const [{ filas, resumen }, periodos] = await Promise.all([
    calcularPeriodo(periodo),
    periodosLiquidables(periodoDe(new Date(), config.zonaHoraria)),
  ]);

  const conHoras = filas.filter((f) => f.minutosTotales > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SelectorPeriodo periodos={periodos} actual={periodo} />

        <GenerarLiquidacion
          periodo={periodo}
          nombrePeriodo={nombreDePeriodo(periodo)}
          empleadas={conHoras.length}
          total={pesos(resumen.total)}
          yaGenerada={resumen.liquidadas > 0}
          desactualizadas={resumen.desactualizadas}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumen etiqueta="Empleadas a liquidar" valor={String(resumen.empleadas)} />
        <Resumen etiqueta="Horas del mes" valor={resumen.horas} />
        <Resumen etiqueta="Total a pagar" valor={pesos(resumen.total)} />
      </div>

      {resumen.jornadasIncompletas > 0 && (
        <Aviso>
          Hay {resumen.jornadasIncompletas}{" "}
          {resumen.jornadasIncompletas === 1
            ? "jornada con entrada y sin salida, y no suma horas"
            : "jornadas con entrada y sin salida, y no suman horas"}
          . Corregilas en Asistencias antes de liquidar.
        </Aviso>
      )}

      {resumen.desactualizadas > 0 && (
        <Aviso>
          {resumen.desactualizadas === 1
            ? "Una liquidación quedó desfasada"
            : `${resumen.desactualizadas} liquidaciones quedaron desfasadas`}{" "}
          respecto del cálculo actual: se tocaron asistencias o el valor hora
          después de generarla. Regenerá el mes si querés que coincidan.
        </Aviso>
      )}

      {filas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No hay empleadas activas para liquidar.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleada</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead className="text-right">Trabajadas</TableHead>
                  <TableHead className="text-right">Licencia</TableHead>
                  <TableHead className="text-right">Total horas</TableHead>
                  <TableHead className="text-right">Valor hora</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <Fila key={f.empleadoId} fila={f} />
                ))}
                <TableRow className="font-medium">
                  <TableCell colSpan={5}>Total del mes</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {resumen.horas}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {pesos(resumen.total)}
                  </TableCell>
                </TableRow>
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

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
      <p>{children}</p>
    </div>
  );
}

function Fila({ fila: f }: { fila: FilaSueldo }) {
  return (
    <TableRow className={f.minutosTotales === 0 ? "text-muted-foreground" : undefined}>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {f.nombre}
          {f.liquidacion && (
            <span
              className={
                f.liquidacion.desactualizada
                  ? "text-amber-600 dark:text-amber-500"
                  : "text-muted-foreground"
              }
              title={
                f.liquidacion.desactualizada
                  ? `Liquidada por ${pesos(f.liquidacion.total)}: no coincide con el cálculo de ahora`
                  : `Liquidada por ${pesos(f.liquidacion.total)}`
              }
            >
              <Lock className="size-3" />
            </span>
          )}
        </span>
        <span className="text-muted-foreground block text-xs">{f.legajo}</span>
      </TableCell>

      <TableCell>
        {f.sala ? (
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: f.colorSala ?? undefined }}
              aria-hidden
            />
            {f.sala}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>
        {ETIQUETA_TURNO[f.turno as (typeof TURNOS)[number]] ?? f.turno}
      </TableCell>

      <TableCell className="text-right tabular-nums">{f.horasTrabajadas}</TableCell>

      <TableCell className="text-right tabular-nums">
        {f.minutosLicencia > 0 ? (
          <span title={`${f.diasLicencia} ${f.diasLicencia === 1 ? "día" : "días"} de licencia`}>
            {f.horasLicencia}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-right font-medium tabular-nums">
        {f.horasTotales}
      </TableCell>

      <TableCell className="text-right tabular-nums">{pesos(f.valorHora)}</TableCell>

      <TableCell className="text-right font-medium tabular-nums">
        {pesos(f.total)}
      </TableCell>
    </TableRow>
  );
}
