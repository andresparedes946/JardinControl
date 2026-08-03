/**
 * Manejo de fechas y horas.
 *
 * Regla del proyecto: todo instante se guarda en UTC y se interpreta en la
 * zona horaria del jardín únicamente al calcular "qué día es" y "qué hora
 * local es". Mezclar ambas cosas es la causa número uno de errores en el
 * cálculo de horas trabajadas.
 */

import { TZDate } from "@date-fns/tz";

export const ZONA_HORARIA_POR_DEFECTO = "America/Argentina/Buenos_Aires";

/** Minutos transcurridos entre dos instantes (b - a), redondeados. */
export function minutosEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

/**
 * Día calendario local del jardín, normalizado a medianoche UTC.
 *
 * Las columnas `@db.Date` de Postgres guardan solo la parte de fecha y
 * Prisma la lee tomando el componente UTC del `Date`. Por eso construimos
 * el valor con `Date.UTC` a partir de los componentes LOCALES: así el
 * 31/07 a las 22:00 de Buenos Aires se guarda como 2026-07-31 y no como
 * 2026-08-01, que es lo que pasaría usando el instante UTC crudo.
 */
export function diaLocal(
  instante: Date = new Date(),
  zonaHoraria: string = ZONA_HORARIA_POR_DEFECTO,
): Date {
  const local = new TZDate(instante, zonaHoraria);
  return new Date(
    Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()),
  );
}

/** Día de la semana local: 0 = domingo … 6 = sábado. */
export function diaDeLaSemanaLocal(
  instante: Date = new Date(),
  zonaHoraria: string = ZONA_HORARIA_POR_DEFECTO,
): number {
  return new TZDate(instante, zonaHoraria).getDay();
}

/** Período de liquidación "YYYY-MM" del instante dado, en hora local. */
export function periodoDe(
  instante: Date = new Date(),
  zonaHoraria: string = ZONA_HORARIA_POR_DEFECTO,
): string {
  const local = new TZDate(instante, zonaHoraria);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}`;
}

/** Hora local en formato "HH:mm". */
export function horaLocal(
  instante: Date,
  zonaHoraria: string = ZONA_HORARIA_POR_DEFECTO,
): string {
  const local = new TZDate(instante, zonaHoraria);
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
}

/**
 * Instante UTC de una hora local "HH:mm" en un día dado.
 *
 * Es la operación inversa de `horaLocal`, y hace falta cuando la dirección
 * corrige un fichaje a mano: escribe "08:05" pensando en la hora del jardín,
 * y lo que se guarda tiene que ser el instante UTC equivalente. Hacerlo con
 * `new Date(...)` usaría la zona horaria de la computadora de quien corrige,
 * que no tiene por qué ser la del jardín.
 *
 * `dia` viene de una columna `@db.Date`, cuya parte de fecha vive en UTC.
 */
export function instanteDesdeHoraLocal(
  dia: Date,
  hora: string,
  zonaHoraria: string = ZONA_HORARIA_POR_DEFECTO,
): Date | null {
  const minutos = minutosDesdeMedianoche(hora);
  if (minutos === null) return null;

  const local = new TZDate(
    dia.getUTCFullYear(),
    dia.getUTCMonth(),
    dia.getUTCDate(),
    Math.floor(minutos / 60),
    minutos % 60,
    zonaHoraria,
  );

  return new Date(local.getTime());
}

/**
 * Rango de un período "YYYY-MM", como [desde, hasta) sobre días calendario.
 *
 * El extremo derecho es exclusivo a propósito: comparar contra el día 1 del
 * mes siguiente evita tener que saber si el mes tiene 28, 30 o 31 días.
 */
export function rangoDelPeriodo(
  periodo: string,
): { desde: Date; hasta: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo.trim());
  if (!m) return null;

  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;

  return {
    desde: new Date(Date.UTC(anio, mes - 1, 1)),
    hasta: new Date(Date.UTC(anio, mes, 1)),
  };
}

/** Convierte "HH:mm" a minutos desde la medianoche. Devuelve null si no parsea. */
export function minutosDesdeMedianoche(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!m) return null;

  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) return null;

  return horas * 60 + minutos;
}

/**
 * Minutos de tardanza respecto del horario del turno, ya descontada la
 * tolerancia. Llegar dentro de la tolerancia devuelve 0, no un negativo.
 */
export function minutosDeTardanza(
  horaIngreso: Date,
  horaInicioTurno: string,
  toleranciaMinutos: number,
  zonaHoraria: string = ZONA_HORARIA_POR_DEFECTO,
): number {
  const inicio = minutosDesdeMedianoche(horaInicioTurno);
  if (inicio === null) return 0;

  const local = new TZDate(horaIngreso, zonaHoraria);
  const llegada = local.getHours() * 60 + local.getMinutes();

  return Math.max(0, llegada - inicio - toleranciaMinutos);
}

/** Formatea una cantidad de minutos como "5:04" (horas:minutos). */
export function formatearHoras(minutos: number): string {
  const signo = minutos < 0 ? "-" : "";
  const abs = Math.abs(minutos);
  return `${signo}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
