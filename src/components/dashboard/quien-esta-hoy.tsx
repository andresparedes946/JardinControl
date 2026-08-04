import { Clock, FileText, MinusCircle, UserCheck, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { EmpleadaHoy, EstadoHoy } from "@/lib/dashboard";
import { ETIQUETA_TURNO, TURNOS } from "@/lib/validaciones";

/**
 * Quién está y quién falta, ahora.
 *
 * Es la lista y no solo el número porque a una directora con diez maestras no
 * le sirve "2 sin fichar": le sirve saber cuáles dos, de qué sala y a qué hora
 * tendrían que haber entrado.
 *
 * El orden no es alfabético: primero lo que hay que mirar (sin fichar), después
 * lo que ya pasó (presentes y licencias) y al final lo que todavía no empezó.
 */

const ORDEN: Record<EstadoHoy, number> = {
  SIN_FICHAR: 0,
  PRESENTE: 1,
  LICENCIA: 2,
  PENDIENTE: 3,
};

export function QuienEstaHoy({ empleadas }: { empleadas: EmpleadaHoy[] }) {
  if (empleadas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay empleadas activas cargadas.
      </p>
    );
  }

  const ordenadas = [...empleadas].sort(
    (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.nombre.localeCompare(b.nombre),
  );

  return (
    <ul className="divide-border divide-y">
      {ordenadas.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{e.nombre}</p>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
              {e.sala && (
                <>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: e.colorSala ?? undefined }}
                    aria-hidden
                  />
                  <span className="truncate">{e.sala}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span className="whitespace-nowrap">
                {ETIQUETA_TURNO[e.turno as (typeof TURNOS)[number]] ?? e.turno}
                {e.horario && ` ${e.horario}`}
              </span>
            </p>
          </div>

          <Estado empleada={e} />
        </li>
      ))}
    </ul>
  );
}

function Estado({ empleada: e }: { empleada: EmpleadaHoy }) {
  if (e.estado === "LICENCIA") {
    return (
      <Badge variant="outline" className="shrink-0">
        <FileText className="size-3" />
        Licencia
      </Badge>
    );
  }

  if (e.estado === "PRESENTE") {
    return (
      <span className="flex shrink-0 items-center gap-2">
        {e.minutosTarde > 0 && (
          <span
            className="flex items-center gap-1 text-xs whitespace-nowrap text-amber-600 dark:text-amber-500"
            title={`Llegó ${e.minutosTarde} minutos tarde`}
          >
            <Clock className="size-3" />
            {e.minutosTarde}′ tarde
          </span>
        )}
        <Badge variant="secondary">
          <UserCheck className="size-3" />
          {e.horaIngreso}
        </Badge>
      </span>
    );
  }

  if (e.estado === "SIN_FICHAR") {
    return (
      <Badge variant="destructive" className="shrink-0">
        <UserX className="size-3" />
        Sin fichar
      </Badge>
    );
  }

  return (
    <Badge variant="ghost" className="text-muted-foreground shrink-0">
      <MinusCircle className="size-3" />
      No empezó
    </Badge>
  );
}
