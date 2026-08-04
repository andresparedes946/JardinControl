import "server-only";

import { prisma } from "@/lib/prisma";
import { formatearHoras, minutosDesdeMedianoche, rangoDelPeriodo } from "@/lib/time";

/**
 * Indicadores del dashboard.
 *
 * Todo lo de "hoy" se apoya en una idea que conviene tener clara: **no fichar
 * todavía no es faltar**. A las 8 de la mañana ninguna maestra del turno
 * tarde llegó tarde ni faltó, simplemente su turno no empezó. Contarlas como
 * ausentes haría que el panel diga cinco ausencias todas las mañanas y que
 * nadie le crea nunca más.
 *
 * Por eso cada empleada cae en uno de cuatro estados según la hora que es:
 * de licencia, presente, sin fichar (ya pasó su horario más la tolerancia) o
 * pendiente (su turno todavía no arrancó).
 */

export type EstadoHoy = "LICENCIA" | "PRESENTE" | "SIN_FICHAR" | "PENDIENTE";

export type EmpleadaHoy = {
  id: string;
  nombre: string;
  sala: string | null;
  colorSala: string | null;
  turno: string;
  horario: string | null;
  estado: EstadoHoy;
  horaIngreso: string | null;
  minutosTarde: number;
};

export type PanelHoy = {
  fecha: Date;
  /** El jardín no trabaja hoy: fin de semana o feriado. */
  sinActividad: string | null;
  presentes: number;
  tarde: number;
  sinFichar: number;
  pendientes: number;
  licencias: number;
  empleadas: EmpleadaHoy[];
};

/** Minutos transcurridos del día en la zona del jardín. */
function minutosDelDia(ahora: Date, zonaHoraria: string): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zonaHoraria,
  }).format(ahora);

  return minutosDesdeMedianoche(partes) ?? 0;
}

export async function panelDeHoy(
  hoy: Date,
  ahora: Date,
  config: { zonaHoraria: string; diasLaborales: number[] },
): Promise<PanelHoy> {
  const [empleados, asistencias, horarios, feriado, licencias] = await Promise.all([
    prisma.empleado.findMany({
      where: { estado: "ACTIVO" },
      include: {
        usuario: { select: { nombre: true, apellido: true } },
        sala: { select: { nombre: true, color: true } },
      },
      orderBy: [{ usuario: { apellido: "asc" } }, { usuario: { nombre: "asc" } }],
    }),
    prisma.asistencia.findMany({ where: { fecha: hoy } }),
    prisma.horario.findMany(),
    prisma.feriado.findUnique({ where: { fecha: hoy } }),
    prisma.licencia.findMany({
      where: {
        estado: "APROBADA",
        fechaInicio: { lte: hoy },
        fechaFin: { gte: hoy },
      },
      select: { empleadoId: true },
    }),
  ]);

  // `fecha` es @db.Date y su componente UTC ya es el día local del jardín.
  const esDiaLaboral = config.diasLaborales.includes(hoy.getUTCDay());
  const sinActividad = feriado
    ? feriado.descripcion
    : !esDiaLaboral
      ? "No es un día laboral"
      : null;

  const porTurno = new Map(horarios.map((h) => [h.turno, h]));
  const porEmpleado = new Map(asistencias.map((a) => [a.empleadoId, a]));
  const deLicencia = new Set(licencias.map((l) => l.empleadoId));
  const minutosAhora = minutosDelDia(ahora, config.zonaHoraria);

  const empleadas = empleados.map((e): EmpleadaHoy => {
    const asistencia = porEmpleado.get(e.id);
    const horario = porTurno.get(e.turno);
    const inicio = horario ? minutosDesdeMedianoche(horario.horaInicio) : null;

    // Se da por vencido el horario recién pasada la tolerancia: entre las
    // 08:00 y las 08:10 alguien puede estar entrando, no faltando.
    const yaDeberiaHaberFichado =
      !sinActividad &&
      inicio !== null &&
      minutosAhora > inicio + (horario?.toleranciaMinutos ?? 0);

    const estado: EstadoHoy = deLicencia.has(e.id)
      ? "LICENCIA"
      : asistencia?.horaIngreso
        ? "PRESENTE"
        : yaDeberiaHaberFichado
          ? "SIN_FICHAR"
          : "PENDIENTE";

    return {
      id: e.id,
      nombre: `${e.usuario.apellido}, ${e.usuario.nombre}`,
      sala: e.sala?.nombre ?? null,
      colorSala: e.sala?.color ?? null,
      turno: e.turno,
      horario: horario ? `${horario.horaInicio} a ${horario.horaFin}` : null,
      estado,
      horaIngreso: asistencia?.horaIngreso
        ? horaEnZona(asistencia.horaIngreso, config.zonaHoraria)
        : null,
      minutosTarde: asistencia?.minutosTarde ?? 0,
    };
  });

  return {
    fecha: hoy,
    sinActividad,
    presentes: empleadas.filter((e) => e.estado === "PRESENTE").length,
    tarde: empleadas.filter((e) => e.minutosTarde > 0).length,
    sinFichar: empleadas.filter((e) => e.estado === "SIN_FICHAR").length,
    pendientes: empleadas.filter((e) => e.estado === "PENDIENTE").length,
    licencias: empleadas.filter((e) => e.estado === "LICENCIA").length,
    empleadas,
  };
}

function horaEnZona(instante: Date, zonaHoraria: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zonaHoraria,
  }).format(instante);
}

// ─────────────────────────── El mes ───────────────────────────

export type DiaDelMes = {
  fecha: Date;
  dia: number;
  presentes: number;
  tarde: number;
  licencias: number;
  esFinDeSemana: boolean;
};

export type PanelDelMes = {
  minutos: number;
  horas: string;
  jornadas: number;
  tardanzas: number;
  /** Jornadas que empezaron dentro del horario, sobre el total. */
  puntualidad: number;
  diasLicencia: number;
  dias: DiaDelMes[];
  porSala: { sala: string; color: string; minutos: number; horas: string }[];
};

/**
 * Resumen del mes en curso.
 *
 * Se arma con una sola consulta y se agrupa en memoria: son unas pocas
 * centenas de jornadas y así el gráfico, los totales y la tabla de
 * asistencias no pueden discrepar por haber consultado distinto.
 */
export async function panelDelMes(
  periodo: string,
  diasLaborales: number[],
): Promise<PanelDelMes> {
  const rango = rangoDelPeriodo(periodo);
  if (!rango) return vacio();

  const asistencias = await prisma.asistencia.findMany({
    where: { fecha: { gte: rango.desde, lt: rango.hasta } },
    select: {
      fecha: true,
      estado: true,
      horaIngreso: true,
      minutosTrabajados: true,
      minutosTarde: true,
      empleado: { select: { sala: { select: { nombre: true, color: true } } } },
    },
  });

  const dias: DiaDelMes[] = [];
  for (
    let cursor = new Date(rango.desde.getTime());
    cursor < rango.hasta;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const fecha = new Date(cursor.getTime());
    const delDia = asistencias.filter((a) => a.fecha.getTime() === fecha.getTime());

    dias.push({
      fecha,
      dia: fecha.getUTCDate(),
      presentes: delDia.filter((a) => a.horaIngreso).length,
      tarde: delDia.filter((a) => a.minutosTarde > 0).length,
      licencias: delDia.filter((a) => a.estado === "LICENCIA").length,
      esFinDeSemana: !diasLaborales.includes(fecha.getUTCDay()),
    });
  }

  const conIngreso = asistencias.filter((a) => a.horaIngreso);
  const tardanzas = conIngreso.filter((a) => a.minutosTarde > 0).length;
  const minutos = asistencias.reduce((t, a) => t + (a.minutosTrabajados ?? 0), 0);

  const salas = new Map<string, { color: string; minutos: number }>();
  for (const a of asistencias) {
    const nombre = a.empleado.sala?.nombre ?? "Sin sala";
    const actual = salas.get(nombre) ?? {
      color: a.empleado.sala?.color ?? "#94a3b8",
      minutos: 0,
    };
    actual.minutos += a.minutosTrabajados ?? 0;
    salas.set(nombre, actual);
  }

  return {
    minutos,
    horas: formatearHoras(minutos),
    jornadas: conIngreso.length,
    tardanzas,
    puntualidad:
      conIngreso.length > 0
        ? Math.round(((conIngreso.length - tardanzas) / conIngreso.length) * 100)
        : 0,
    diasLicencia: asistencias.filter((a) => a.estado === "LICENCIA").length,
    dias,
    porSala: [...salas.entries()]
      .map(([sala, v]) => ({
        sala,
        color: v.color,
        minutos: v.minutos,
        horas: formatearHoras(v.minutos),
      }))
      .filter((s) => s.minutos > 0)
      .sort((a, b) => b.minutos - a.minutos),
  };
}

function vacio(): PanelDelMes {
  return {
    minutos: 0,
    horas: "0:00",
    jornadas: 0,
    tardanzas: 0,
    puntualidad: 0,
    diasLicencia: 0,
    dias: [],
    porSala: [],
  };
}
