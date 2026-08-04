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
          Cómo viene el día y cómo viene el mes.
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
    <div className="space-y-6">
      {dia.sinActividad && (
        <div className="border-border text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
          <CalendarOff className="size-4 shrink-0" />
          <p>
            {dia.sinActividad}: hoy nadie tiene que fichar, así que no se cuentan
            ausencias.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Tarjeta
          etiqueta="Presentes hoy"
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
          detalle={dia.sinActividad ? "No es día laboral" : "Ya pasó su horario"}
          alerta={dia.sinFichar > 0}
        />
        <Tarjeta
          etiqueta="Llegadas tarde"
          valor={dia.tarde}
          icono={Clock}
          detalle="Hoy"
          alerta={dia.tarde > 0}
        />
        <Tarjeta
          etiqueta="De licencia"
          valor={dia.licencias}
          icono={FileText}
          detalle="Con licencia aprobada"
        />
        <Tarjeta
          etiqueta="Horas del mes"
          valor={mes.horas}
          icono={Clock}
          detalle={`${mes.jornadas} ${mes.jornadas === 1 ? "jornada" : "jornadas"}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Hoy en el jardín</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <QuienEstaHoy empleadas={dia.empleadas} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Horas por sala en {nombreDePeriodo(periodo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <HorasPorSala salas={mes.porSala} />

            <div className="border-border mt-6 border-t pt-4">
              <p className="text-muted-foreground text-xs">Puntualidad del mes</p>
              <p className="mt-1 text-2xl font-semibold">{mes.puntualidad}%</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {mes.tardanzas === 0
                  ? "Ninguna llegada tarde en el mes"
                  : `${mes.tardanzas} de ${mes.jornadas} jornadas empezaron tarde`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Asistencia de {nombreDePeriodo(periodo)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <AsistenciaDelMes dias={mes.dias} />

          <p className="text-muted-foreground mt-4 text-xs">
            El detalle día por día, con las correcciones a mano, está en{" "}
            <Link href="/asistencias" className="underline underline-offset-4">
              Asistencias
            </Link>
            .
          </p>
        </CardContent>
      </Card>
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
          className={`text-2xl font-semibold ${
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
