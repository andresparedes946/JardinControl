import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { listarLicencias, diasCorridos, rangoLegible } from "@/lib/licencias";
import { prisma } from "@/lib/prisma";
import { calcularPeriodo, pesos } from "@/lib/sueldos";
import { formatearHoras, horaLocal, rangoDelPeriodo } from "@/lib/time";
import {
  ETIQUETA_ESTADO_ASISTENCIA,
  ETIQUETA_ESTADO_LICENCIA,
  ETIQUETA_TIPO_LICENCIA,
  ETIQUETA_TURNO,
  type FiltrosReporte,
} from "@/lib/validaciones";

/**
 * Reportes exportables.
 *
 * Un reporte se arma una sola vez y de ahí salen las dos cosas: la vista
 * previa en pantalla y el archivo que se descarga. Si cada una hiciera su
 * propia consulta, tarde o temprano el CSV diría algo distinto de lo que la
 * directora vio antes de apretar "descargar", y ese es exactamente el error
 * que no se perdona en un papel que se firma.
 *
 * Por eso las filas viajan ya formateadas como texto: lo que se ve es,
 * carácter por carácter, lo que se exporta.
 */

export const TIPOS_REPORTE = ["asistencias", "sueldos", "licencias"] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export const ETIQUETA_TIPO_REPORTE: Record<TipoReporte, string> = {
  asistencias: "Asistencias",
  sueldos: "Sueldos",
  licencias: "Licencias",
};

export type ColumnaReporte = {
  clave: string;
  etiqueta: string;
  /** Los números se alinean a la derecha para poder compararlos de un vistazo. */
  derecha?: boolean;
};

export type Reporte = {
  tipo: TipoReporte;
  titulo: string;
  subtitulo: string;
  columnas: ColumnaReporte[];
  filas: Record<string, string>[];
  /** Fila de cierre, cuando sumar tiene sentido. */
  totales: Record<string, string> | null;
};

export async function generarReporte(
  filtros: FiltrosReporte,
  zonaHoraria: string,
): Promise<Reporte> {
  if (filtros.tipo === "sueldos") return reporteDeSueldos(filtros);
  if (filtros.tipo === "licencias") return reporteDeLicencias(filtros);
  return reporteDeAsistencias(filtros, zonaHoraria);
}

// ─────────────────────────── Asistencias ───────────────────────────

async function reporteDeAsistencias(
  filtros: FiltrosReporte,
  zonaHoraria: string,
): Promise<Reporte> {
  const rango = rangoDelPeriodo(filtros.periodo);

  const where: Prisma.AsistenciaWhereInput = rango
    ? { fecha: { gte: rango.desde, lt: rango.hasta } }
    : {};

  if (filtros.empleado) where.empleadoId = filtros.empleado;

  // Sala y turno son dos condiciones sobre la misma relación, así que se
  // arman juntas: asignarlas por separado a `where.empleado` haría que la
  // segunda pise a la primera.
  const porEmpleado: Prisma.EmpleadoWhereInput = {};
  if (filtros.sala) porEmpleado.salaId = filtros.sala;
  if (filtros.turno) porEmpleado.turno = filtros.turno;
  if (Object.keys(porEmpleado).length > 0) where.empleado = porEmpleado;

  const filas = await prisma.asistencia.findMany({
    where,
    include: {
      empleado: {
        include: {
          usuario: { select: { nombre: true, apellido: true } },
          sala: { select: { nombre: true } },
        },
      },
    },
    orderBy: [{ fecha: "asc" }, { empleado: { usuario: { apellido: "asc" } } }],
  });

  const minutos = filas.reduce((t, a) => t + (a.minutosTrabajados ?? 0), 0);

  return {
    tipo: "asistencias",
    titulo: "Asistencias",
    subtitulo: descripcionDeFiltros(filtros, filas.length, "jornada", "jornadas"),
    columnas: [
      { clave: "fecha", etiqueta: "Fecha" },
      { clave: "empleada", etiqueta: "Empleada" },
      { clave: "legajo", etiqueta: "Legajo" },
      { clave: "sala", etiqueta: "Sala" },
      { clave: "turno", etiqueta: "Turno" },
      { clave: "entrada", etiqueta: "Entrada", derecha: true },
      { clave: "salida", etiqueta: "Salida", derecha: true },
      { clave: "horas", etiqueta: "Horas", derecha: true },
      { clave: "tarde", etiqueta: "Tarde (min)", derecha: true },
      { clave: "estado", etiqueta: "Estado" },
      { clave: "observaciones", etiqueta: "Observaciones" },
    ],
    filas: filas.map((a) => ({
      fecha: fechaCorta(a.fecha),
      empleada: `${a.empleado.usuario.apellido}, ${a.empleado.usuario.nombre}`,
      legajo: a.empleado.legajo,
      sala: a.empleado.sala?.nombre ?? "",
      turno: ETIQUETA_TURNO[a.empleado.turno],
      entrada: a.horaIngreso ? horaLocal(a.horaIngreso, zonaHoraria) : "",
      salida: a.horaSalida ? horaLocal(a.horaSalida, zonaHoraria) : "",
      horas: a.minutosTrabajados != null ? formatearHoras(a.minutosTrabajados) : "",
      tarde: a.minutosTarde > 0 ? String(a.minutosTarde) : "",
      estado: ETIQUETA_ESTADO_ASISTENCIA[a.estado] ?? a.estado,
      // Una corrección a mano tiene que verse en el papel: es la diferencia
      // entre lo que midió el sistema y lo que escribió una persona.
      observaciones: [a.ajustadaManual ? "(corregida a mano)" : "", a.observaciones ?? ""]
        .filter(Boolean)
        .join(" "),
    })),
    totales:
      filas.length > 0
        ? { empleada: "Total", horas: formatearHoras(minutos) }
        : null,
  };
}

// ─────────────────────────── Sueldos ───────────────────────────

async function reporteDeSueldos(filtros: FiltrosReporte): Promise<Reporte> {
  // Sale del mismo cálculo que la pantalla de Sueldos, no de una consulta
  // paralela: el reporte no puede dar otro número que el que se liquidó.
  const { filas, resumen } = await calcularPeriodo(filtros.periodo);

  const visibles = filas.filter(
    (f) =>
      (!filtros.empleado || f.empleadoId === filtros.empleado) &&
      (!filtros.turno || f.turno === filtros.turno) &&
      f.minutosTotales > 0,
  );

  return {
    tipo: "sueldos",
    titulo: "Liquidación de sueldos",
    subtitulo: descripcionDeFiltros(filtros, visibles.length, "empleada", "empleadas"),
    columnas: [
      { clave: "empleada", etiqueta: "Empleada" },
      { clave: "legajo", etiqueta: "Legajo" },
      { clave: "sala", etiqueta: "Sala" },
      { clave: "turno", etiqueta: "Turno" },
      { clave: "trabajadas", etiqueta: "Horas trabajadas", derecha: true },
      { clave: "licencia", etiqueta: "Horas licencia", derecha: true },
      { clave: "totalHoras", etiqueta: "Total horas", derecha: true },
      { clave: "valorHora", etiqueta: "Valor hora", derecha: true },
      { clave: "total", etiqueta: "Total", derecha: true },
      { clave: "liquidada", etiqueta: "Liquidada" },
    ],
    filas: visibles.map((f) => ({
      empleada: f.nombre,
      legajo: f.legajo,
      sala: f.sala ?? "",
      turno: ETIQUETA_TURNO[f.turno as keyof typeof ETIQUETA_TURNO] ?? f.turno,
      trabajadas: f.horasTrabajadas,
      licencia: f.minutosLicencia > 0 ? f.horasLicencia : "",
      totalHoras: f.horasTotales,
      valorHora: pesos(f.valorHora),
      total: pesos(f.total),
      liquidada: f.liquidacion
        ? f.liquidacion.desactualizada
          ? "Sí, desfasada"
          : "Sí"
        : "No",
    })),
    totales:
      visibles.length > 0
        ? {
            empleada: "Total",
            totalHoras: formatearHoras(
              visibles.reduce((t, f) => t + f.minutosTotales, 0),
            ),
            total: pesos(
              // Cuando hay filtros, el total es el de lo que se está mirando,
              // no el del mes entero: si no, el papel no cerraría con su
              // propia columna.
              visibles.length === filas.filter((f) => f.minutosTotales > 0).length
                ? resumen.total
                : visibles.reduce((t, f) => t + f.total, 0),
            ),
          }
        : null,
  };
}

// ─────────────────────────── Licencias ───────────────────────────

async function reporteDeLicencias(filtros: FiltrosReporte): Promise<Reporte> {
  const { filas } = await listarLicencias({
    estado: filtros.estado as "PENDIENTE" | "APROBADA" | "RECHAZADA" | undefined,
    empleado: filtros.empleado,
  });

  const rango = rangoDelPeriodo(filtros.periodo);

  // Entra la licencia que toca el mes, aunque empiece antes o termine después:
  // una licencia del 28/7 al 4/8 es parte de agosto para quien lo mira.
  const visibles = rango
    ? filas.filter((l) => l.fechaInicio < rango.hasta && l.fechaFin >= rango.desde)
    : filas;

  // Las pendientes no suman días: su rango todavía es el marcador provisorio
  // con el que nació la licencia, y la columna las muestra vacías. Contarlas
  // dejaría un total que no da la suma de lo que se ve.
  const diasTotales = visibles
    .filter((l) => l.estado !== "PENDIENTE")
    .reduce((t, l) => t + diasCorridos(l.fechaInicio, l.fechaFin), 0);

  return {
    tipo: "licencias",
    titulo: "Licencias",
    subtitulo: descripcionDeFiltros(filtros, visibles.length, "licencia", "licencias"),
    columnas: [
      { clave: "empleada", etiqueta: "Empleada" },
      { clave: "sala", etiqueta: "Sala" },
      { clave: "tipo", etiqueta: "Tipo" },
      { clave: "periodo", etiqueta: "Período" },
      { clave: "dias", etiqueta: "Días", derecha: true },
      { clave: "estado", etiqueta: "Estado" },
      { clave: "comprobantes", etiqueta: "Comprobantes", derecha: true },
      { clave: "motivo", etiqueta: "Aclaración" },
      { clave: "observaciones", etiqueta: "Observaciones" },
      { clave: "revisadaPor", etiqueta: "Revisada por" },
    ],
    filas: visibles.map((l) => ({
      empleada: l.empleado.nombre,
      sala: l.empleado.sala ?? "",
      // Una licencia pendiente todavía no tiene ni tipo ni período: los carga
      // la dirección al resolverla. Ponerlos acá sería inventar un dato.
      tipo: l.estado === "PENDIENTE" ? "" : ETIQUETA_TIPO_LICENCIA[l.tipo as keyof typeof ETIQUETA_TIPO_LICENCIA] ?? l.tipo,
      periodo:
        l.estado === "PENDIENTE"
          ? `recibida el ${fechaCorta(l.creadaEn)}`
          : rangoLegible(l.fechaInicio, l.fechaFin),
      dias: l.estado === "PENDIENTE" ? "" : String(l.dias),
      estado: ETIQUETA_ESTADO_LICENCIA[l.estado as keyof typeof ETIQUETA_ESTADO_LICENCIA] ?? l.estado,
      comprobantes: String(l.comprobantes.length),
      motivo: l.motivo ?? "",
      observaciones: l.observaciones ?? "",
      revisadaPor: l.revisadaPor ?? "",
    })),
    totales:
      visibles.length > 0
        ? { empleada: "Total", dias: String(diasTotales) }
        : null,
  };
}

// ─────────────────────────── Auxiliares ───────────────────────────

/** "03/08/2026". Las fechas de reporte van en día del jardín, no en UTC crudo. */
function fechaCorta(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
}

function descripcionDeFiltros(
  filtros: FiltrosReporte,
  cantidad: number,
  singular: string,
  plural: string,
): string {
  const partes = [`${cantidad} ${cantidad === 1 ? singular : plural}`];
  if (filtros.turno) partes.push(`turno ${ETIQUETA_TURNO[filtros.turno].toLowerCase()}`);
  return partes.join(" · ");
}

// ─────────────────────────── CSV ───────────────────────────

/**
 * Arma el CSV del reporte.
 *
 * Dos decisiones que parecen manías y no lo son, porque de ellas depende que
 * el archivo se abra bien haciendo doble clic:
 *
 * - **Separador punto y coma.** Excel en configuración regional argentina usa
 *   la coma como separador decimal, así que un CSV separado por comas le
 *   entra todo en una sola columna.
 * - **BOM al principio.** Sin él, Excel lee el archivo como ANSI y los
 *   acentos y las eñes salen rotos: "Corbalán" se convierte en "CorbalÃ¡n".
 */
export function reporteACSV(reporte: Reporte): string {
  const escapar = (valor: string) =>
    /[;"\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

  const lineas = [
    reporte.columnas.map((c) => escapar(c.etiqueta)).join(";"),
    ...reporte.filas.map((f) =>
      reporte.columnas.map((c) => escapar(f[c.clave] ?? "")).join(";"),
    ),
  ];

  if (reporte.totales) {
    lineas.push(
      reporte.columnas.map((c) => escapar(reporte.totales?.[c.clave] ?? "")).join(";"),
    );
  }

  // El BOM es un carácter invisible, así que va en una constante con nombre:
  // metido directamente en la plantilla no se ve, y el primero que "limpie"
  // el archivo se lo lleva puesto sin que nadie lo note hasta abrir un CSV
  // con los acentos rotos.
  const BOM = "﻿";

  return BOM + lineas.join("\r\n") + "\r\n";
}

export function nombreDeArchivo(reporte: Reporte, periodo: string): string {
  return `${reporte.tipo}-${periodo}.csv`;
}
