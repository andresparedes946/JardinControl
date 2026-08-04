import "server-only";

import { prisma } from "@/lib/prisma";
import { formatearHoras, minutosDesdeMedianoche, rangoDelPeriodo } from "@/lib/time";

/**
 * Liquidación mensual.
 *
 * Dos reglas mandan acá y conviene tenerlas a la vista:
 *
 * 1. **Se liquida sobre las asistencias, no sobre los fichajes.** La tabla
 *    `fichajes` guarda todo intento, incluidos los rechazados; la que dice
 *    qué pasó de verdad en una jornada es `asistencias`, que además es la
 *    que la dirección puede corregir a mano.
 * 2. **Un día de licencia aprobada se paga a las horas del turno.** Si no,
 *    una maestra con certificado médico cobraría cero por esos días. Las
 *    horas de licencia se cuentan aparte de las trabajadas para que la
 *    liquidación pueda explicar de dónde sale el número.
 */

/** Minutos que dura una jornada del turno, según el horario configurado. */
function minutosDelTurno(horaInicio: string, horaFin: string): number {
  const inicio = minutosDesdeMedianoche(horaInicio);
  const fin = minutosDesdeMedianoche(horaFin);
  if (inicio === null || fin === null) return 0;
  return Math.max(0, fin - inicio);
}

/**
 * Importe de una cantidad de minutos a un valor hora dado.
 *
 * La cuenta va en centavos y con enteros: hacerla en pesos con coma flotante
 * deja restos de centavo que después no cierran contra la suma de la columna.
 */
export function importe(minutos: number, valorHora: number): number {
  const centavosPorHora = Math.round(valorHora * 100);
  return Math.round((minutos * centavosPorHora) / 60) / 100;
}

export type FilaSueldo = {
  empleadoId: string;
  nombre: string;
  legajo: string;
  sala: string | null;
  colorSala: string | null;
  turno: string;
  minutosTrabajados: number;
  minutosLicencia: number;
  minutosTotales: number;
  horasTrabajadas: string;
  horasLicencia: string;
  horasTotales: string;
  valorHora: number;
  total: number;
  /** Jornadas con entrada pero sin salida: no suman horas y hay que corregirlas. */
  jornadasIncompletas: number;
  /** Días de licencia aprobada que cayeron en el mes. */
  diasLicencia: number;
  /** La liquidación ya generada de este período, si existe. */
  liquidacion: {
    minutosTrabajados: number;
    minutosLicencia: number;
    valorHora: number;
    total: number;
    generadaEn: Date;
    /** El cálculo de hoy no coincide con lo que quedó congelado. */
    desactualizada: boolean;
  } | null;
};

export type ResumenSueldos = {
  empleadas: number;
  minutos: number;
  horas: string;
  total: number;
  jornadasIncompletas: number;
  /** Cuántas filas ya tienen liquidación congelada. */
  liquidadas: number;
  /** Cuántas de esas quedaron desfasadas respecto del cálculo actual. */
  desactualizadas: number;
};

/**
 * Calcula el mes para todas las empleadas y lo contrasta con lo ya liquidado.
 *
 * Se trae todo de una y se agrupa en memoria en vez de hacer una consulta por
 * empleada: son unas pocas decenas de personas y unas pocas centenas de
 * jornadas, y así la tabla y los totales no pueden discrepar por haber
 * consultado con criterios distintos.
 */
export async function calcularPeriodo(
  periodo: string,
): Promise<{ filas: FilaSueldo[]; resumen: ResumenSueldos }> {
  const rango = rangoDelPeriodo(periodo);
  if (!rango) return { filas: [], resumen: resumir([]) };

  const [empleados, asistencias, horarios, liquidaciones] = await Promise.all([
    prisma.empleado.findMany({
      where: { estado: "ACTIVO" },
      include: {
        usuario: { select: { nombre: true, apellido: true } },
        sala: { select: { nombre: true, color: true } },
      },
      orderBy: [{ usuario: { apellido: "asc" } }, { usuario: { nombre: "asc" } }],
    }),
    prisma.asistencia.findMany({
      where: { fecha: { gte: rango.desde, lt: rango.hasta } },
      select: {
        empleadoId: true,
        estado: true,
        horaIngreso: true,
        horaSalida: true,
        minutosTrabajados: true,
      },
    }),
    prisma.horario.findMany(),
    prisma.liquidacion.findMany({ where: { periodo } }),
  ]);

  const minutosPorTurno = new Map(
    horarios.map((h) => [h.turno, minutosDelTurno(h.horaInicio, h.horaFin)]),
  );
  const porEmpleado = new Map(liquidaciones.map((l) => [l.empleadoId, l]));

  const filas = empleados.map((e) => {
    const suyas = asistencias.filter((a) => a.empleadoId === e.id);
    const minutosDeSuTurno = minutosPorTurno.get(e.turno) ?? 0;

    const minutosTrabajados = suyas.reduce(
      (t, a) => t + (a.minutosTrabajados ?? 0),
      0,
    );

    const diasLicencia = suyas.filter((a) => a.estado === "LICENCIA").length;
    const minutosLicencia = diasLicencia * minutosDeSuTurno;
    const minutosTotales = minutosTrabajados + minutosLicencia;

    const valorHora = Number(e.valorHora);
    const total = importe(minutosTotales, valorHora);

    const liquidacion = porEmpleado.get(e.id);

    return {
      empleadoId: e.id,
      nombre: `${e.usuario.apellido}, ${e.usuario.nombre}`,
      legajo: e.legajo,
      sala: e.sala?.nombre ?? null,
      colorSala: e.sala?.color ?? null,
      turno: e.turno,
      minutosTrabajados,
      minutosLicencia,
      minutosTotales,
      horasTrabajadas: formatearHoras(minutosTrabajados),
      horasLicencia: formatearHoras(minutosLicencia),
      horasTotales: formatearHoras(minutosTotales),
      valorHora,
      total,
      jornadasIncompletas: suyas.filter(
        (a) => a.horaIngreso && !a.horaSalida,
      ).length,
      diasLicencia,
      liquidacion: liquidacion
        ? {
            minutosTrabajados: liquidacion.minutosTrabajados,
            minutosLicencia: liquidacion.minutosLicencia,
            valorHora: Number(liquidacion.valorHora),
            total: Number(liquidacion.total),
            generadaEn: liquidacion.generadaEn,
            desactualizada:
              liquidacion.minutosTrabajados !== minutosTrabajados ||
              liquidacion.minutosLicencia !== minutosLicencia ||
              Number(liquidacion.valorHora) !== valorHora,
          }
        : null,
    };
  });

  return { filas, resumen: resumir(filas) };
}

function resumir(filas: FilaSueldo[]): ResumenSueldos {
  const minutos = filas.reduce((t, f) => t + f.minutosTotales, 0);

  return {
    empleadas: filas.filter((f) => f.minutosTotales > 0).length,
    minutos,
    horas: formatearHoras(minutos),
    // Se suman los importes ya redondeados de cada fila, no el total de
    // minutos por el valor hora: si no, el total de la pantalla no daría la
    // suma de la columna y cualquiera pensaría que hay un error.
    total: filas.reduce((t, f) => t + f.total, 0),
    jornadasIncompletas: filas.reduce((t, f) => t + f.jornadasIncompletas, 0),
    liquidadas: filas.filter((f) => f.liquidacion).length,
    desactualizadas: filas.filter((f) => f.liquidacion?.desactualizada).length,
  };
}

/** Los períodos con asistencias cargadas, más el actual, para el selector. */
export async function periodosLiquidables(actual: string): Promise<string[]> {
  const [asistencias, liquidaciones] = await Promise.all([
    prisma.asistencia.findMany({ select: { fecha: true } }),
    prisma.liquidacion.findMany({ select: { periodo: true } }),
  ]);

  const periodos = new Set<string>([actual]);
  // `fecha` es @db.Date: su año y mes ya son los del día local del jardín.
  for (const a of asistencias) {
    periodos.add(
      `${a.fecha.getUTCFullYear()}-${String(a.fecha.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  for (const l of liquidaciones) periodos.add(l.periodo);

  return [...periodos].sort().reverse();
}

/** "$ 123.456,78" */
export function pesos(monto: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(monto);
}
