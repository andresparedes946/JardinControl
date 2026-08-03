import type { Metadata } from "next";
import { Suspense } from "react";

import { AccionesMiLicencia } from "@/components/licencias/acciones-mi-licencia";
import {
  colorDeEstadoLicencia,
  etiquetaDeEstadoLicencia,
  etiquetaDeTipoLicencia,
} from "@/components/licencias/etiquetas";
import { FormularioCertificado } from "@/components/licencias/formulario-certificado";
import { ListaComprobantes } from "@/components/licencias/lista-comprobantes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { licenciasDeEmpleado, type FilaLicencia } from "@/lib/licencias";
import { requerirSesion } from "@/lib/session";

export const metadata: Metadata = { title: "Mis licencias" };

export default async function MisLicenciasPage() {
  const { user } = await requerirSesion();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis licencias</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enviá el certificado y seguí en qué quedó.
        </p>
      </div>

      {user.empleadoId ? (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Contenido empleadoId={user.empleadoId} />
        </Suspense>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Tu usuario no tiene una empleada asociada, así que no puede enviar
            certificados.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** "03 de agosto de 2026", para el detalle de cada tarjeta. */
function fechaLarga(fecha: Date, zonaUTC = true): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    // Las fechas de la licencia son `@db.Date` y ya vienen en el día del
    // jardín; la de envío es un instante real y va en la hora de quien mira.
    timeZone: zonaUTC ? "UTC" : undefined,
  }).format(fecha);
}

async function Contenido({ empleadoId }: { empleadoId: string }) {
  const licencias = await licenciasDeEmpleado(empleadoId);

  return (
    <div className="space-y-4">
      <FormularioCertificado />

      {licencias.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Todavía no enviaste ningún certificado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {licencias.map((l) => (
            <Tarjeta key={l.id} licencia={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ licencia: l }: { licencia: FilaLicencia }) {
  // Hasta que la dirección lo revisa no hay ni tipo ni período: lo que figura
  // guardado es un marcador provisorio. Se muestra lo único cierto, la fecha
  // en que se envió.
  const pendiente = l.estado === "PENDIENTE";
  const unSoloDia = l.fechaInicio.getTime() === l.fechaFin.getTime();

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">
              {pendiente ? "Certificado enviado" : etiquetaDeTipoLicencia(l.tipo)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {pendiente ? (
                <>
                  {fechaLarga(l.creadaEn, false)} · esperando que la dirección
                  cargue los días
                </>
              ) : (
                <>
                  {unSoloDia
                    ? fechaLarga(l.fechaInicio)
                    : `${fechaLarga(l.fechaInicio)} al ${fechaLarga(l.fechaFin)}`}
                  <span className="ml-2 tabular-nums">
                    ({l.dias} {l.dias === 1 ? "día" : "días"})
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

        {pendiente && (
          <div className="flex justify-end">
            <AccionesMiLicencia
              id={l.id}
              enviado={fechaLarga(l.creadaEn, false)}
              comprobantes={l.comprobantes.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
