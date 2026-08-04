import { CalendarOff, Clock, FileText, UserCheck, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AsistenciaDelMes } from "@/components/dashboard/asistencia-del-mes";
import { HorasPorSala } from "@/components/dashboard/horas-por-sala";
import { QuienEstaHoy } from "@/components/dashboard/quien-esta-hoy";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { panelDeHoy, panelDelMes } from "@/lib/dashboard";
import { obtenerConfiguracion } from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";
import { diaLocal, nombreDePeriodo, periodoDe } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };

// Lo de "hoy" depende de la hora que es, así que la página no se puede
// cachear: una versión guardada a las 7 diría que no fichó nadie.
export const dynamic = "force-dynamic";

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
          Quién está hoy y cómo viene el mes.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}

async function Contenido() {
  const config = await obtenerConfiguracion();
  const ahora = new Date();
  const hoy = diaLocal(ahora, config.zonaHoraria);
  const periodo = periodoDe(ahora, config.zonaHoraria);

  const [dia, mes] = await Promise.all([
    panelDeHoy(hoy, ahora, config),
    panelDelMes(periodo, config.diasLaborales),
  ]);

  return (
    <div className="space-y-10">
      {/* El panel se parte en dos por el único eje que le importa a quien lo
          mira: lo que está pasando ahora y lo que viene acumulando el mes.
          Antes iban mezclados —"Horas del mes" al lado de "Llegadas tarde",
          "Horas por sala" al lado de quién está hoy— y obligaba a leer el
          subtítulo de cada tarjeta para saber de qué período hablaba. */}
      <Seccion titulo="Hoy" detalle={fechaLarga(dia.fecha)}>
        {dia.sinActividad && (
          <div className="border-border text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
            <CalendarOff className="size-4 shrink-0" />
            <p>
              {dia.sinActividad}: hoy nadie tiene que fichar, así que no se
              cuentan ausencias.
            </p>
          </div>
        )}

        {/* Cuatro y no cinco: entra parejo en una, dos o cuatro columnas y no
            deja ninguna tarjeta sola al final de la grilla. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta
            etiqueta="Presentes"
            valor={dia.presentes}
            icono={UserCheck}
            detalle={
              dia.pendientes > 0
                ? `${dia.pendientes} sin empezar su turno`
                : undefined
            }
          />
          <Tarjeta
            etiqueta="Sin fichar"
            valor={dia.sinFichar}
            icono={UserX}
            detalle={
              dia.sinActividad ? "No es día laboral" : "Ya pasó su horario"
            }
            alerta={dia.sinFichar > 0}
          />
          <Tarjeta
            etiqueta="Llegadas tarde"
            valor={dia.tarde}
            icono={Clock}
            alerta={dia.tarde > 0}
          />
          <Tarjeta
            etiqueta="De licencia"
            valor={dia.licencias}
            icono={FileText}
            detalle="Con licencia aprobada"
          />
        </div>

        {/* A ancho completo: es lo que se mira primero al abrir el panel. Un
            número dice cuántas faltan; esta lista dice cuáles. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quién está en el jardín</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <QuienEstaHoy empleadas={dia.empleadas} />
          </CardContent>
        </Card>
      </Seccion>

      <Seccion
        titulo={capitalizar(nombreDePeriodo(periodo))}
        detalle={`${mes.jornadas} ${mes.jornadas === 1 ? "jornada" : "jornadas"} registradas`}
      >
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardContent className="grid grid-cols-2 gap-6 py-6">
              <Estadistica
                etiqueta="Horas trabajadas"
                valor={mes.horas}
                detalle={`${mes.jornadas} ${mes.jornadas === 1 ? "jornada" : "jornadas"}`}
              />
              {/* Sin jornadas no es 0% de puntualidad, es que todavía no hay
                  con qué calcularla. Mostrar el cero decía que llegaron todas
                  tarde justo el mes en que no fichó nadie. */}
              <Estadistica
                etiqueta="Puntualidad"
                valor={mes.jornadas === 0 ? "—" : `${mes.puntualidad}%`}
                detalle={
                  mes.jornadas === 0
                    ? "Sin jornadas todavía"
                    : mes.tardanzas === 0
                      ? "Sin llegadas tarde"
                      : `${mes.tardanzas} de ${mes.jornadas} empezaron tarde`
                }
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Horas por sala</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <HorasPorSala salas={mes.porSala} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asistencia día por día</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AsistenciaDelMes dias={mes.dias} />

            <p className="text-muted-foreground mt-4 text-xs">
              El detalle, con las correcciones a mano, está en{" "}
              <Link href="/asistencias" className="underline underline-offset-4">
                Asistencias
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </Seccion>
    </div>
  );
}

/** "martes 4 de agosto". El día viene normalizado a medianoche UTC. */
function fechaLarga(dia: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(dia);
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Seccion({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
        {detalle && (
          <p className="text-muted-foreground text-sm first-letter:uppercase">
            {detalle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Estadistica({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-sm font-medium">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      <p className="text-muted-foreground mt-1 text-xs">{detalle}</p>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  icono: Icono,
  detalle,
  alerta = false,
}: {
  etiqueta: string;
  valor: number | string;
  icono: React.ComponentType<{ className?: string }>;
  detalle?: string;
  alerta?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {etiqueta}
        </CardTitle>
        <Icono className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        {/* Sin tabular-nums: son números sueltos y grandes, y ahí los dígitos
            de ancho fijo hacen que un "12" se vea desarmado. */}
        <p
          className={`text-3xl font-semibold tracking-tight ${
            alerta ? "text-amber-600 dark:text-amber-500" : ""
          }`}
        >
          {valor}
        </p>
        {detalle && (
          <p className="text-muted-foreground mt-1 text-xs">{detalle}</p>
        )}
      </CardContent>
    </Card>
  );
}
