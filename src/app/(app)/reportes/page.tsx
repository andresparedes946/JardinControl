import type { Metadata } from "next";
import { Suspense } from "react";

import { ControlesReporte } from "@/components/reportes/controles-reporte";
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
import { periodosConDatos } from "@/lib/asistencia";
import {
  listarEmpleadosParaSelector,
  listarSalas,
  obtenerConfiguracion,
} from "@/lib/empleados";
import { generarReporte, type Reporte } from "@/lib/reportes";
import { requerirAdmin } from "@/lib/session";
import { nombreDePeriodo, periodoDe } from "@/lib/time";
import { filtrosReporteSchema } from "@/lib/validaciones";

export const metadata: Metadata = { title: "Reportes" };

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  await requerirAdmin();

  return (
    <div className="space-y-6">
      <div className="no-imprimir">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Lo que ves acá es exactamente lo que se imprime y lo que se descarga.
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
  const actual = periodoDe(new Date(), config.zonaHoraria);

  const parseado = filtrosReporteSchema.safeParse({ periodo: actual, ...params });
  const filtros = parseado.success
    ? parseado.data
    : { tipo: "asistencias" as const, periodo: actual };

  const [reporte, periodos, empleadas, salas] = await Promise.all([
    generarReporte(filtros, config.zonaHoraria),
    periodosConDatos(config.zonaHoraria),
    listarEmpleadosParaSelector(),
    listarSalas(),
  ]);

  return (
    <div className="space-y-4">
      <ControlesReporte
        tipo={filtros.tipo}
        periodo={filtros.periodo}
        periodos={periodos}
        empleadas={empleadas}
        salas={salas.map((s) => ({ id: s.id, nombre: s.nombre }))}
      />

      {/* El encabezado del papel. En pantalla lo tapa el título de arriba, así
          que solo aparece al imprimir: sin esto la hoja saldría sin decir de
          qué jardín es ni de qué mes. */}
      <div className="hidden print:mb-4 print:block">
        <h2 className="text-lg font-semibold">
          {config.nombreJardin} · {reporte.titulo}
        </h2>
        <p className="text-sm">
          {nombreDePeriodo(filtros.periodo)} · {reporte.subtitulo}
        </p>
      </div>

      {reporte.filas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No hay datos para ese recorte.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground no-imprimir text-sm">
            {nombreDePeriodo(filtros.periodo)} · {reporte.subtitulo}
          </p>

          <Card className="overflow-hidden py-0 print:border-0 print:shadow-none">
            <div className="overflow-x-auto">
              <TablaReporte reporte={reporte} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function TablaReporte({ reporte }: { reporte: Reporte }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {reporte.columnas.map((c) => (
            <TableHead key={c.clave} className={c.derecha ? "text-right" : undefined}>
              {c.etiqueta}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {reporte.filas.map((f, i) => (
          <TableRow key={i}>
            {reporte.columnas.map((c) => (
              <TableCell
                key={c.clave}
                className={c.derecha ? "text-right tabular-nums" : undefined}
              >
                {f[c.clave] || <span className="text-muted-foreground">—</span>}
              </TableCell>
            ))}
          </TableRow>
        ))}

        {reporte.totales && (
          <TableRow className="font-medium">
            {reporte.columnas.map((c) => (
              <TableCell
                key={c.clave}
                className={c.derecha ? "text-right tabular-nums" : undefined}
              >
                {reporte.totales?.[c.clave] ?? ""}
              </TableCell>
            ))}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
