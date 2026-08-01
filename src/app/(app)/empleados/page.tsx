import { Plus, ScanFace } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccionesFila } from "@/components/empleados/acciones-fila";
import { FiltrosEmpleados } from "@/components/empleados/filtros-empleados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  EMPLEADOS_POR_PAGINA,
  listarEmpleados,
  listarSalas,
} from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";
import { ETIQUETA_TURNO, filtrosEmpleadosSchema } from "@/lib/validaciones";

export const metadata: Metadata = { title: "Empleados" };

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  await requerirAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Alta, edición y baja del personal del jardín.
          </p>
        </div>
        {/* nativeButton={false}: al renderizar un <a> en vez de un <button>,
            Base UI necesita saberlo para no aplicar semántica de botón nativo. */}
        <Button nativeButton={false} render={<Link href="/empleados/nuevo" />}>
          <Plus className="size-4" />
          Nueva empleada
        </Button>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;

  // Un filtro inválido se descarta y se cae al valor por defecto: una URL
  // manipulada a mano no debería romper la pantalla.
  const parseado = filtrosEmpleadosSchema.safeParse(params);
  const filtros = parseado.success ? parseado.data : { pagina: 1 };

  // `pagina` viene acotada por listarEmpleados: puede no coincidir con la
  // que pidió la URL si estaba fuera de rango.
  const [{ empleados, total, paginas, pagina }, salas] = await Promise.all([
    listarEmpleados(filtros),
    listarSalas(),
  ]);

  const desde = total === 0 ? 0 : (pagina - 1) * EMPLEADOS_POR_PAGINA + 1;
  const hasta = Math.min(pagina * EMPLEADOS_POR_PAGINA, total);

  function urlPagina(pagina: number) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" && k !== "pagina") p.set(k, v);
    }
    if (pagina > 1) p.set("pagina", String(pagina));
    const qs = p.toString();
    return qs ? `/empleados?${qs}` : "/empleados";
  }

  const sinFiltros = Object.keys(params).length === 0;

  return (
    <div className="space-y-4">
      <FiltrosEmpleados
        salas={salas.map((s) => ({ id: s.id, nombre: s.nombre }))}
      />

      {empleados.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            {sinFiltros
              ? "Todavía no hay empleadas cargadas."
              : "Ninguna empleada coincide con los filtros."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleada</TableHead>
                  <TableHead>Legajo</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead className="text-right">Valor hora</TableHead>
                  <TableHead>Rostro</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleados.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link
                        href={`/empleados/${e.id}`}
                        className="font-medium hover:underline"
                      >
                        {e.usuario.apellido}, {e.usuario.nombre}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {e.usuario.email}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.legajo}
                    </TableCell>
                    <TableCell>
                      {e.sala ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: e.sala.color }}
                            aria-hidden
                          />
                          {e.sala.nombre}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{ETIQUETA_TURNO[e.turno]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pesos.format(Number(e.valorHora))}
                    </TableCell>
                    <TableCell>
                      {e._count.descriptores > 0 ? (
                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <ScanFace className="size-3.5" />
                          Registrado
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Sin registrar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.estado === "ACTIVO" ? "secondary" : "outline"
                        }
                      >
                        {e.estado === "ACTIVO" ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AccionesFila
                        id={e.id}
                        nombre={`${e.usuario.nombre} ${e.usuario.apellido}`}
                        estado={e.estado}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {total === 0
            ? "Sin resultados"
            : `Mostrando ${desde}–${hasta} de ${total}`}
        </p>

        {paginas > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1}
              nativeButton={false}
              render={<Link href={urlPagina(pagina - 1)} />}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground text-sm">
              {pagina} de {paginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= paginas}
              nativeButton={false}
              render={<Link href={urlPagina(pagina + 1)} />}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
