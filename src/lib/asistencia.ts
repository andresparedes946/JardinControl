import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  diaLocal,
  formatearHoras,
  horaLocal,
  minutosEntre,
  rangoDelPeriodo,
} from "@/lib/time";
import type { FiltrosAsistencias } from "@/lib/validaciones";

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

// ─────────────────────── Consultas por período ───────────────────────

/** Fila lista para mostrar: las horas ya vienen en la zona del jardín. */
export type FilaAsistencia = {
  id: string;
  fecha: Date;
  horaIngreso: string | null;
  horaSalida: string | null;
  minutosTrabajados: number;
  trabajadas: string | null;
  minutosTarde: number;
  estado: string;
  ajustadaManual: boolean;
  observaciones: string | null;
  empleado: { nombre: string; sala: string | null; colorSala: string | null };
};

export type ResumenPeriodo = {
  dias: number;
  minutos: number;
  horas: string;
  tardanzas: number;
  minutosTarde: number;
};

type FilaCruda = Prisma.AsistenciaGetPayload<{
  include: {
    empleado: {
      include: {
        usuario: { select: { nombre: true; apellido: true } };
        sala: { select: { nombre: true; color: true } };
      };
    };
  };
}>;

function aFila(a: FilaCruda, zonaHoraria: string): FilaAsistencia {
  return {
    id: a.id,
    fecha: a.fecha,
    horaIngreso: a.horaIngreso ? horaLocal(a.horaIngreso, zonaHoraria) : null,
    horaSalida: a.horaSalida ? horaLocal(a.horaSalida, zonaHoraria) : null,
    minutosTrabajados: a.minutosTrabajados ?? 0,
    trabajadas:
      a.minutosTrabajados != null ? formatearHoras(a.minutosTrabajados) : null,
    minutosTarde: a.minutosTarde,
    estado: a.estado,
    ajustadaManual: a.ajustadaManual,
    observaciones: a.observaciones,
    empleado: {
      nombre: `${a.empleado.usuario.apellido}, ${a.empleado.usuario.nombre}`,
      sala: a.empleado.sala?.nombre ?? null,
      colorSala: a.empleado.sala?.color ?? null,
    },
  };
}

/**
 * Los totales se calculan sobre las filas ya traídas y no con un `aggregate`
 * aparte: son a lo sumo unas pocas centenas por mes, y así no hay forma de que
 * la tabla y el resumen discrepen por haber consultado con criterios distintos.
 */
function resumir(filas: FilaAsistencia[]): ResumenPeriodo {
  const minutos = filas.reduce((t, f) => t + f.minutosTrabajados, 0);
  const minutosTarde = filas.reduce((t, f) => t + f.minutosTarde, 0);

  return {
    dias: filas.filter((f) => f.horaIngreso !== null).length,
    minutos,
    horas: formatearHoras(minutos),
    tardanzas: filas.filter((f) => f.minutosTarde > 0).length,
    minutosTarde,
  };
}

const INCLUDE_EMPLEADO = {
  empleado: {
    include: {
      usuario: { select: { nombre: true, apellido: true } },
      sala: { select: { nombre: true, color: true } },
    },
  },
} as const;

/** Listado para la dirección: todas las empleadas de un mes, con filtros. */
export async function listarAsistencias(
  filtros: FiltrosAsistencias,
  zonaHoraria: string,
): Promise<{ filas: FilaAsistencia[]; resumen: ResumenPeriodo }> {
  const rango = rangoDelPeriodo(filtros.periodo);
  if (!rango) return { filas: [], resumen: resumir([]) };

  const where: Prisma.AsistenciaWhereInput = {
    fecha: { gte: rango.desde, lt: rango.hasta },
  };

  if (filtros.empleado) where.empleadoId = filtros.empleado;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.sala) where.empleado = { salaId: filtros.sala };

  const crudas = await prisma.asistencia.findMany({
    where,
    include: INCLUDE_EMPLEADO,
    orderBy: [
      { fecha: "desc" },
      { empleado: { usuario: { apellido: "asc" } } },
    ],
  });

  const filas = crudas.map((a) => aFila(a, zonaHoraria));
  return { filas, resumen: resumir(filas) };
}

/** Historial propio de una empleada, del más reciente al más viejo. */
export async function historialDeEmpleado(
  empleadoId: string,
  periodo: string,
  zonaHoraria: string,
): Promise<{ filas: FilaAsistencia[]; resumen: ResumenPeriodo }> {
  const rango = rangoDelPeriodo(periodo);
  if (!rango) return { filas: [], resumen: resumir([]) };

  const crudas = await prisma.asistencia.findMany({
    where: { empleadoId, fecha: { gte: rango.desde, lt: rango.hasta } },
    include: INCLUDE_EMPLEADO,
    orderBy: { fecha: "desc" },
  });

  const filas = crudas.map((a) => aFila(a, zonaHoraria));
  return { filas, resumen: resumir(filas) };
}

/** Los períodos con datos, más el actual, para poblar el selector de mes. */
export async function periodosConDatos(
  zonaHoraria: string,
  empleadoId?: string,
): Promise<string[]> {
  const filas = await prisma.asistencia.findMany({
    where: empleadoId ? { empleadoId } : undefined,
    select: { fecha: true },
    orderBy: { fecha: "desc" },
  });

  const actual = periodoDeDia(diaLocal(new Date(), zonaHoraria));
  const periodos = new Set<string>([actual]);
  // `fecha` es @db.Date: su año y mes ya están en UTC y representan el día
  // local del jardín, así que no hay que reinterpretarlos.
  for (const f of filas) periodos.add(periodoDeDia(f.fecha));

  return [...periodos].sort().reverse();
}

function periodoDeDia(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}
