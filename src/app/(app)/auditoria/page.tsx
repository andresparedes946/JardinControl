import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FiltrosAuditoria } from "@/components/auditoria/filtros-auditoria";
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
  AUDITORIA_POR_PAGINA,
  listarAuditoria,
  periodosConAuditoria,
  usuariosConAuditoria,
  type FilaAuditoria,
} from "@/lib/auditoria";
import { obtenerConfiguracion } from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";
import { periodoDe } from "@/lib/time";
import {
  ETIQUETA_ACCION_AUDITORIA,
  ETIQUETA_ENTIDAD_AUDITORIA,
  etiquetaDeAuditoria,
  filtrosAuditoriaSchema,
} from "@/lib/validaciones";

export const metadata: Metadata = { title: "Auditoría" };

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  await requerirAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Qué se hizo en el sistema, quién lo hizo y desde dónde. El registro es
          solo de lectura: no se edita ni se borra desde la aplicación.
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

  // Una URL manipulada a mano no debería romper la pantalla: si no parsea, se
  // cae a los valores por defecto.
  const parseado = filtrosAuditoriaSchema.safeParse(params);
  const crudos = parseado.success ? parseado.data : { pagina: 1 };
  const periodo = crudos.periodo ?? periodoDe(new Date(), config.zonaHoraria);

  // `pagina` vuelve acotada por listarAuditoria: puede no ser la de la URL.
  const [{ filas, total, paginas, pagina }, periodos, usuarios] =
    await Promise.all([
      listarAuditoria({ ...crudos, periodo }, config.zonaHoraria),
      periodosConAuditoria(config.zonaHoraria),
      usuariosConAuditoria(),
    ]);

  const desde = total === 0 ? 0 : (pagina - 1) * AUDITORIA_POR_PAGINA + 1;
  const hasta = Math.min(pagina * AUDITORIA_POR_PAGINA, total);

  function urlPagina(pagina: number) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" && k !== "pagina") p.set(k, v);
    }
    p.set("periodo", periodo);
    if (pagina > 1) p.set("pagina", String(pagina));
    return `/auditoria?${p.toString()}`;
  }

  return (
    <div className="space-y-4">
      <FiltrosAuditoria
        periodos={periodos}
        periodoActual={periodo}
        usuarios={usuarios}
      />

      {filas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No hay actividad registrada con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* En un celular la tabla no entra por más que se le recorten
              columnas: cinco en 375 px obligan a arrastrar de costado para
              leer cada fila, y un registro se lee de arriba abajo. Debajo de
              `lg` va la misma información apilada; de ahí para arriba, la
              tabla, que es lo que sirve para barrer veinticinco filas.

              El corte va en `lg` y no en `md` porque entre 768 y 1024 px la
              tabla entra pero le come el ancho al detalle hasta dejarlo en
              tres renglones: cabe, y aun así se lee peor que las tarjetas. */}
          <div className="space-y-3 lg:hidden">
            {filas.map((f) => (
              <Tarjeta key={f.id} fila={f} />
            ))}
          </div>

          <Card className="hidden overflow-hidden py-0 lg:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuándo</TableHead>
                    <TableHead>Quién</TableHead>
                    <TableHead>Qué hizo</TableHead>
                    <TableHead>Sobre</TableHead>
                    <TableHead>Desde</TableHead>
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
        </>
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

/**
 * Origen del acceso en una línea: "Chrome · Windows · Escritorio". Los
 * registros viejos pueden no traer todo, así que se arma con lo que haya.
 */
function origenDe(f: FilaAuditoria): string {
  return [f.navegador, f.sistemaOperativo, f.dispositivo]
    .filter(Boolean)
    .join(" · ");
}

function Fila({ fila: f }: { fila: FilaAuditoria }) {
  const origen = origenDe(f);

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap tabular-nums">
        {f.dia}
        <span className="text-muted-foreground ml-2 text-xs">{f.hora}</span>
      </TableCell>

      <TableCell className="whitespace-nowrap">
        {f.usuario ?? (
          <span className="text-muted-foreground" title="Cuenta eliminada">
            —
          </span>
        )}
      </TableCell>

      {/* El detalle envuelve en vez de estirar la tabla. Es lo que la hacía
          ancha: una resolución de licencia escupe cinco campos en una línea y
          empujaba las dos últimas columnas fuera de la pantalla. El mínimo es
          para que el reparto automático no lo comprima en una tira angosta. */}
      <TableCell className="max-w-md min-w-56 whitespace-normal">
        {etiquetaDeAuditoria(ETIQUETA_ACCION_AUDITORIA, f.accion)}
        {f.detalle && (
          <p className="text-muted-foreground mt-0.5 text-xs">{f.detalle}</p>
        )}
      </TableCell>

      {/* El id va en el title y no en la celda: casi siempre es un cuid que no
          le dice nada a nadie, pero sirve para rastrear el registro exacto. */}
      <TableCell
        className="whitespace-nowrap"
        title={f.entidadId ?? undefined}
      >
        {etiquetaDeAuditoria(ETIQUETA_ENTIDAD_AUDITORIA, f.entidad)}
      </TableCell>

      <TableCell className="whitespace-nowrap">
        <span className="tabular-nums">{f.ip ?? "—"}</span>
        {origen && (
          <p className="text-muted-foreground mt-0.5 text-xs">{origen}</p>
        )}
      </TableCell>
    </TableRow>
  );
}

function Tarjeta({ fila: f }: { fila: FilaAuditoria }) {
  const origen = origenDe(f);

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm tabular-nums">
            {f.dia}
            <span className="text-muted-foreground ml-2 text-xs">{f.hora}</span>
          </p>
          <Badge variant="outline" title={f.entidadId ?? undefined}>
            {etiquetaDeAuditoria(ETIQUETA_ENTIDAD_AUDITORIA, f.entidad)}
          </Badge>
        </div>

        <div>
          <p className="font-medium">
            {etiquetaDeAuditoria(ETIQUETA_ACCION_AUDITORIA, f.accion)}
          </p>
          <p className="text-muted-foreground text-sm">
            {f.usuario ?? "Cuenta eliminada"}
          </p>
        </div>

        {f.detalle && (
          <p className="text-muted-foreground text-xs">{f.detalle}</p>
        )}

        <p className="text-muted-foreground text-xs">
          {[f.ip, origen].filter(Boolean).join(" · ")}
        </p>
      </CardContent>
    </Card>
  );
}
