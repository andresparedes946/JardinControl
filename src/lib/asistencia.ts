import "server-only";

import { prisma } from "@/lib/prisma";
import { diaLocal, formatearHoras, horaLocal, minutosEntre } from "@/lib/time";

/**
 * Estado de asistencia del día para una empleada.
 *
 * El "día" es el día calendario local del jardín, no el UTC: un fichaje de
 * las 22:00 de Buenos Aires pertenece a ese día y no al siguiente. Ver
 * `diaLocal` en src/lib/time.ts.
 */

/** Qué corresponde hacer ahora. `null` cuando la jornada ya está cerrada. */
export type ProximoFichaje = "INGRESO" | "EGRESO" | null;

export type EstadoDelDia = {
  fecha: Date;
  proximo: ProximoFichaje;
  horaIngreso: string | null;
  horaSalida: string | null;
  /** Horas trabajadas en formato "5:04", solo cuando la jornada está cerrada. */
  trabajadas: string | null;
  minutosTarde: number;
};

/**
 * Resuelve el estado de hoy a partir de la fila de asistencia.
 *
 * La regla es una sola y vive acá para que la pantalla y la Server Action no
 * puedan discrepar: sin ingreso corresponde ingreso, con ingreso y sin salida
 * corresponde egreso, y con las dos no corresponde nada.
 */
export async function estadoDelDia(
  empleadoId: string,
  zonaHoraria: string,
): Promise<EstadoDelDia> {
  const fecha = diaLocal(new Date(), zonaHoraria);

  const asistencia = await prisma.asistencia.findUnique({
    where: { empleadoId_fecha: { empleadoId, fecha } },
  });

  const proximo: ProximoFichaje = !asistencia?.horaIngreso
    ? "INGRESO"
    : !asistencia.horaSalida
      ? "EGRESO"
      : null;

  return {
    fecha,
    proximo,
    horaIngreso: asistencia?.horaIngreso
      ? horaLocal(asistencia.horaIngreso, zonaHoraria)
      : null,
    horaSalida: asistencia?.horaSalida
      ? horaLocal(asistencia.horaSalida, zonaHoraria)
      : null,
    trabajadas:
      asistencia?.minutosTrabajados != null
        ? formatearHoras(asistencia.minutosTrabajados)
        : null,
    minutosTarde: asistencia?.minutosTarde ?? 0,
  };
}

/**
 * Minutos entre el ingreso y la salida.
 *
 * Se calcula sobre los instantes UTC guardados y no sobre las horas locales:
 * restar "13:03" menos "07:59" a mano se rompe con el cambio de día y con
 * cualquier ajuste de huso.
 */
export function minutosTrabajados(ingreso: Date, salida: Date): number {
  return Math.max(0, minutosEntre(ingreso, salida));
}
