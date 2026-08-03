import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { FiltrosLicencias } from "@/lib/validaciones";

/**
 * Licencias: pedidos de las empleadas y su resolución.
 *
 * Las fechas de una licencia son días calendario (`@db.Date`), sin hora ni
 * huso: una licencia del 3 al 7 vale esos cinco días completos, se pida desde
 * donde se pida. Por eso acá se trabaja con `Date` a medianoche UTC, igual
 * que en `Asistencia.fecha`, y nunca con instantes.
 */

/** "2026-08-03" → Date a medianoche UTC. */
export function diaDesdeISO(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** Date a medianoche UTC → "2026-08-03", para los `<input type="date">`. */
export function isoDesdeDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Todos los días del rango, extremos incluidos. */
export function diasDelRango(desde: Date, hasta: Date): Date[] {
  const dias: Date[] = [];
  const cursor = new Date(desde.getTime());

  while (cursor <= hasta) {
    dias.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

/** Cantidad de días corridos que abarca la licencia, extremos incluidos. */
export function diasCorridos(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;
}

/**
 * El rango como se lee en pantalla: "03/08 al 07/08", o "03/08" si es un solo
 * día. Va en UTC porque `fechaInicio` y `fechaFin` son `@db.Date`: su parte de
 * fecha ya es el día del jardín y reinterpretarla lo correría uno.
 */
export function rangoLegible(desde: Date, hasta: Date): string {
  const dia = (f: Date) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    }).format(f);

  return desde.getTime() === hasta.getTime()
    ? dia(desde)
    : `${dia(desde)} al ${dia(hasta)}`;
}

// ─────────────────────────── Consultas ───────────────────────────

const INCLUDE_LICENCIA = {
  empleado: {
    include: {
      usuario: { select: { nombre: true, apellido: true } },
      sala: { select: { nombre: true, color: true } },
    },
  },
  revisadaPor: { select: { nombre: true, apellido: true } },
  comprobantes: {
    select: {
      id: true,
      nombreOriginal: true,
      mimeType: true,
      tamanioBytes: true,
    },
    orderBy: { subidoEn: "asc" },
  },
} as const;

type LicenciaCruda = Prisma.LicenciaGetPayload<{
  include: typeof INCLUDE_LICENCIA;
}>;

export type FilaLicencia = {
  id: string;
  tipo: string;
  estado: string;
  fechaInicio: Date;
  fechaFin: Date;
  dias: number;
  motivo: string | null;
  observaciones: string | null;
  revisadaPor: string | null;
  revisadaEn: Date | null;
  creadaEn: Date;
  empleado: { id: string; nombre: string; sala: string | null; colorSala: string | null };
  comprobantes: {
    id: string;
    nombreOriginal: string;
    mimeType: string;
    tamanioBytes: number;
  }[];
};

function aFila(l: LicenciaCruda): FilaLicencia {
  return {
    id: l.id,
    tipo: l.tipo,
    estado: l.estado,
    fechaInicio: l.fechaInicio,
    fechaFin: l.fechaFin,
    dias: diasCorridos(l.fechaInicio, l.fechaFin),
    motivo: l.motivo,
    observaciones: l.observaciones,
    revisadaPor: l.revisadaPor
      ? `${l.revisadaPor.nombre} ${l.revisadaPor.apellido}`
      : null,
    revisadaEn: l.revisadaEn,
    creadaEn: l.createdAt,
    empleado: {
      id: l.empleadoId,
      nombre: `${l.empleado.usuario.apellido}, ${l.empleado.usuario.nombre}`,
      sala: l.empleado.sala?.nombre ?? null,
      colorSala: l.empleado.sala?.color ?? null,
    },
    comprobantes: l.comprobantes,
  };
}

export type ResumenLicencias = {
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
};

/**
 * Listado para la dirección.
 *
 * Ordena las pendientes primero y no por fecha: lo que trae a alguien a esta
 * pantalla es resolver lo que está esperando, no repasar el historial.
 */
export async function listarLicencias(
  filtros: FiltrosLicencias,
): Promise<{ filas: FilaLicencia[]; resumen: ResumenLicencias }> {
  const where: Prisma.LicenciaWhereInput = {};
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.empleado) where.empleadoId = filtros.empleado;

  const [crudas, porEstado] = await Promise.all([
    prisma.licencia.findMany({
      where,
      include: INCLUDE_LICENCIA,
      orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }],
    }),
    // El resumen ignora los filtros a propósito: es el estado general de las
    // licencias, no el de lo que se está mirando.
    prisma.licencia.groupBy({ by: ["estado"], _count: { _all: true } }),
  ]);

  const contar = (estado: string) =>
    porEstado.find((g) => g.estado === estado)?._count._all ?? 0;

  return {
    filas: crudas.map(aFila),
    resumen: {
      pendientes: contar("PENDIENTE"),
      aprobadas: contar("APROBADA"),
      rechazadas: contar("RECHAZADA"),
    },
  };
}

/** Las licencias propias de una empleada, de la más reciente a la más vieja. */
export async function licenciasDeEmpleado(
  empleadoId: string,
): Promise<FilaLicencia[]> {
  const crudas = await prisma.licencia.findMany({
    where: { empleadoId },
    include: INCLUDE_LICENCIA,
    orderBy: { fechaInicio: "desc" },
  });

  return crudas.map(aFila);
}

/**
 * Licencia que pisa el rango pedido, si hay alguna.
 *
 * Solo cuentan las pendientes y las aprobadas: una rechazada no reserva nada,
 * así que volver a pedir esos mismos días con el certificado que faltaba tiene
 * que poder hacerse.
 */
export async function licenciaSolapada(
  empleadoId: string,
  desde: Date,
  hasta: Date,
  excluirId?: string,
) {
  return prisma.licencia.findFirst({
    where: {
      empleadoId,
      id: excluirId ? { not: excluirId } : undefined,
      estado: { in: ["PENDIENTE", "APROBADA"] },
      // Dos rangos se solapan si cada uno empieza antes de que termine el otro.
      fechaInicio: { lte: hasta },
      fechaFin: { gte: desde },
    },
    select: { id: true, fechaInicio: true, fechaFin: true, estado: true },
  });
}

// ────────────────── Impacto sobre las asistencias ──────────────────

/**
 * Marca como LICENCIA los días laborales que cubre una licencia aprobada.
 *
 * Sin esto, aprobar una licencia no dejaría rastro en el historial y esos días
 * figurarían como ausencias sin explicación. Se respetan tres cosas:
 *
 * - solo los días laborales configurados, salteando feriados;
 * - nunca se pisa una jornada con ingreso registrado (alguien que fichó y
 *   después pidió licencia por la tarde trabajó, y eso vale);
 * - nunca se pisa una fila corregida a mano por la dirección.
 */
export async function marcarAsistenciasDeLicencia(
  licencia: { id: string; empleadoId: string; fechaInicio: Date; fechaFin: Date; tipo: string },
  diasLaborales: number[],
  etiquetaTipo: string,
): Promise<number> {
  const dias = diasDelRango(licencia.fechaInicio, licencia.fechaFin).filter((d) =>
    diasLaborales.includes(d.getUTCDay()),
  );

  if (dias.length === 0) return 0;

  const [feriados, existentes] = await Promise.all([
    prisma.feriado.findMany({
      where: { fecha: { in: dias } },
      select: { fecha: true },
    }),
    prisma.asistencia.findMany({
      where: { empleadoId: licencia.empleadoId, fecha: { in: dias } },
      select: { id: true, fecha: true, horaIngreso: true, ajustadaManual: true },
    }),
  ]);

  const esFeriado = new Set(feriados.map((f) => f.fecha.getTime()));
  const porFecha = new Map(existentes.map((a) => [a.fecha.getTime(), a]));

  const observaciones = `Licencia por ${etiquetaTipo.toLowerCase()}`;
  const aCrear: Date[] = [];
  const aActualizar: string[] = [];

  for (const dia of dias) {
    if (esFeriado.has(dia.getTime())) continue;

    const existente = porFecha.get(dia.getTime());
    if (!existente) {
      aCrear.push(dia);
    } else if (!existente.horaIngreso && !existente.ajustadaManual) {
      aActualizar.push(existente.id);
    }
  }

  await prisma.$transaction([
    prisma.asistencia.createMany({
      data: aCrear.map((fecha) => ({
        empleadoId: licencia.empleadoId,
        fecha,
        estado: "LICENCIA" as const,
        observaciones,
      })),
      skipDuplicates: true,
    }),
    prisma.asistencia.updateMany({
      where: { id: { in: aActualizar } },
      data: { estado: "LICENCIA", observaciones },
    }),
  ]);

  return aCrear.length + aActualizar.length;
}

/**
 * Deshace lo anterior, para cuando la dirección se arrepiente y pasa una
 * licencia ya aprobada a rechazada.
 *
 * Borra únicamente las filas que puso la aprobación: estado LICENCIA, sin
 * ingreso y sin corrección manual. Cualquier otra cosa que haya en esos días
 * es información real que no le corresponde tocar a esto.
 */
export async function desmarcarAsistenciasDeLicencia(licencia: {
  empleadoId: string;
  fechaInicio: Date;
  fechaFin: Date;
}): Promise<number> {
  const { count } = await prisma.asistencia.deleteMany({
    where: {
      empleadoId: licencia.empleadoId,
      fecha: { gte: licencia.fechaInicio, lte: licencia.fechaFin },
      estado: "LICENCIA",
      horaIngreso: null,
      ajustadaManual: false,
    },
  });

  return count;
}
